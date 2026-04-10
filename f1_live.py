"""
F1 Hub — F1 Live Timing client (SignalR over WebSocket).

Port of the ingest logic from slowlydev/f1-dash (Rust) to Python/asyncio.
Keeps ONE upstream connection to livetiming.formula1.com and mirrors the
latest state of all subscribed topics into an in-memory dict. All /api/live/*
endpoints read from this state instead of hitting OpenF1 on every request.

Dependencies:
  - httpx (already in requirements) for the negotiate handshake
  - websockets (already in uvicorn[standard]) for the WS connection
  - stdlib: zlib, base64 for decoding .z topics

Topics subscribed (taken from f1-dash/realtime/src/f1.rs):
  Heartbeat, ExtrapolatedClock, TimingStats, TimingAppData, WeatherData,
  TrackStatus, SessionStatus, DriverList, RaceControlMessages, SessionInfo,
  SessionData, LapCount, TimingData, TeamRadio, ChampionshipPrediction
  CarData.z, Position.z  (decoded via zlib raw-deflate + base64)
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
import uuid
import zlib
from typing import Any, Dict, Optional
from urllib.parse import quote

import httpx
import websockets
from websockets.exceptions import ConnectionClosed

logger = logging.getLogger("f1hub.live")


class F1SessionOffline(Exception):
    """Raised when CloudFront 403s the negotiate endpoint (no active session)."""


SIGNALR_HOST = "livetiming.formula1.com"
SIGNALR_HUB = "Streaming"
NEGOTIATE_URL = f"https://{SIGNALR_HOST}/signalr/negotiate"
CONNECT_URL = f"wss://{SIGNALR_HOST}/signalr/connect"

TOPICS = [
    "Heartbeat",
    "CarData.z",
    "Position.z",
    "ExtrapolatedClock",
    "TimingStats",
    "TimingAppData",
    "WeatherData",
    "TrackStatus",
    "SessionStatus",
    "DriverList",
    "RaceControlMessages",
    "SessionInfo",
    "SessionData",
    "LapCount",
    "TimingData",
    "TeamRadio",
    "ChampionshipPrediction",
]

# Treat the stream as "active" only if we received a message within this window.
ACTIVE_WINDOW_SEC = 180

# Heartbeat watchdog: if no upstream message for this long, force reconnect.
IDLE_RECONNECT_SEC = 120


def _deep_merge(dst: Dict[str, Any], src: Dict[str, Any]) -> None:
    """In-place recursive merge src into dst. F1 sends partial diffs."""
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            _deep_merge(dst[k], v)
        else:
            dst[k] = v


def _inflate_z(b64: str) -> Any:
    """base64 → raw-deflate → JSON. Used for *.z topics (CarData, Position)."""
    raw = base64.b64decode(b64)
    inflated = zlib.decompress(raw, -zlib.MAX_WBITS)
    return json.loads(inflated.decode("utf-8"))


class F1LiveClient:
    """
    Single upstream connection to F1 live timing. Runs forever with
    exponential backoff reconnect; caller supplies one `asyncio.Task`.
    """

    def __init__(self) -> None:
        self.state: Dict[str, Any] = {}
        self.last_message_at: float = 0.0
        self.last_connect_at: float = 0.0
        self.connected: bool = False
        self.last_error: Optional[str] = None
        self.reconnects: int = 0
        self._ws: Optional[websockets.WebSocketClientProtocol] = None  # type: ignore[name-defined]
        self._stop: bool = False
        self._db_session_id: Optional[int] = None
        self._seen_rc_keys: set = set()  # dedup race control messages

    # --------------------------------------------------------------- state

    def topic(self, name: str) -> Any:
        return self.state.get(name)

    def is_session_active(self) -> bool:
        """True iff we have a named SessionInfo AND a recent upstream message."""
        if self.last_message_at == 0:
            return False
        if (time.time() - self.last_message_at) > ACTIVE_WINDOW_SEC:
            return False
        si = self.state.get("SessionInfo")
        if not isinstance(si, dict):
            return False
        name = si.get("Name") or si.get("Meeting", {}).get("Name")
        return bool(name)

    def snapshot(self) -> Dict[str, Any]:
        return {
            "connected": self.connected,
            "last_message_at": self.last_message_at,
            "last_connect_at": self.last_connect_at,
            "reconnects": self.reconnects,
            "topics": sorted(self.state.keys()),
            "is_session_active": self.is_session_active(),
            "last_error": self.last_error,
        }

    # --------------------------------------------------------------- proto

    async def _negotiate(self) -> tuple[str, str]:
        conn_data = json.dumps([{"name": SIGNALR_HUB}])
        params = {"clientProtocol": "1.5", "connectionData": conn_data}
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(NEGOTIATE_URL, params=params, headers={
                "User-Agent": "BestHTTP",
                "Accept-Encoding": "gzip,identity",
            })
            # 403 = CloudFront blocks the endpoint between F1 sessions. This is
            # the normal state outside race weekends; don't treat as an error,
            # the caller will back off and retry.
            if r.status_code == 403:
                raise F1SessionOffline("livetiming 403 (no active session)")
            r.raise_for_status()
            body = r.json()
            # Cookie is required for the WS upgrade.
            cookie = r.headers.get("set-cookie", "")
        token = body.get("ConnectionToken")
        if not token:
            raise RuntimeError(f"negotiate returned no ConnectionToken: {body}")
        return token, cookie

    async def _connect_ws(self) -> None:
        token, cookie = await self._negotiate()
        conn_data = json.dumps([{"name": SIGNALR_HUB}])
        url = (
            f"{CONNECT_URL}"
            f"?clientProtocol=1.5&transport=webSockets"
            f"&connectionToken={quote(token)}"
            f"&connectionData={quote(conn_data)}"
        )
        headers = {
            "User-Agent": "BestHTTP",
            "Accept-Encoding": "gzip,identity",
        }
        if cookie:
            headers["Cookie"] = cookie

        logger.info("f1_live: connecting ws")
        self._ws = await websockets.connect(
            url,
            additional_headers=headers,
            ping_interval=20,
            ping_timeout=20,
            close_timeout=5,
            max_size=8 * 1024 * 1024,
        )
        self.last_connect_at = time.time()

        # Subscribe + read initial snapshot
        sub_id = str(uuid.uuid4())
        await self._ws.send(json.dumps({
            "H": SIGNALR_HUB,
            "M": "Subscribe",
            "A": [TOPICS],
            "I": sub_id,
        }))

        # Wait for initial R payload (may come after some Heartbeat M frames)
        # We accept anything once we see the matching I.
        deadline = time.time() + 15
        while True:
            if time.time() > deadline:
                raise RuntimeError("timeout waiting for Subscribe response")
            msg = await asyncio.wait_for(self._ws.recv(), timeout=15)
            if not isinstance(msg, str):
                continue
            self.last_message_at = time.time()
            try:
                payload = json.loads(msg)
            except ValueError:
                continue
            if payload.get("I") == sub_id:
                initial = payload.get("R") or {}
                if isinstance(initial, dict):
                    for t, d in initial.items():
                        self._apply(t, d)
                self.connected = True
                logger.info(
                    "f1_live: subscribed, initial topics=%s session_active=%s",
                    sorted(initial.keys()) if isinstance(initial, dict) else [],
                    self.is_session_active(),
                )
                return
            # Interleaved updates while we wait for the ack
            self._handle_update_frame(payload)

    def _handle_update_frame(self, payload: Dict[str, Any]) -> None:
        for frame in payload.get("M", []) or []:
            args = frame.get("A")
            if not args or len(args) < 2:
                continue
            topic = args[0]
            data = args[1]
            self._apply(topic, data)

    def _apply(self, topic: str, data: Any) -> None:
        try:
            if topic.endswith(".z") and isinstance(data, str):
                try:
                    data = _inflate_z(data)
                except Exception as e:
                    logger.debug("f1_live: inflate %s failed: %s", topic, e)
                    return
                topic = topic[:-2]  # strip .z

            existing = self.state.get(topic)
            if isinstance(existing, dict) and isinstance(data, dict):
                _deep_merge(existing, data)
            else:
                self.state[topic] = data

            # Persist to SQLite
            self._persist(topic, data)
        except Exception as e:
            logger.warning("f1_live: apply %s failed: %s", topic, e)

    def _persist(self, topic: str, data: Any) -> None:
        """Persist key topics to SQLite for survival across restarts."""
        try:
            import database as db

            if topic == "SessionInfo" and isinstance(data, dict):
                meeting = data.get("Meeting", {})
                name = data.get("Name") or meeting.get("Name", "")
                if name and self._db_session_id is None:
                    # End any stale active sessions
                    db.end_all_live_sessions()
                    self._db_session_id = db.create_live_session(
                        meeting_name=meeting.get("Name", ""),
                        session_name=name,
                        session_type=data.get("Type", ""),
                        circuit_short_name=meeting.get("Circuit", {}).get("ShortName", ""),
                        country_name=meeting.get("Country", {}).get("Name", ""),
                        session_key=data.get("Key") or str(meeting.get("Key", "")),
                        signalr_data=json.dumps(data, default=str),
                    )
                    self._seen_rc_keys.clear()
                    logger.info("f1_live: persisted session id=%s name=%s", self._db_session_id, name)

            elif topic == "RaceControlMessages" and self._db_session_id:
                messages = data if isinstance(data, list) else (
                    data.get("Messages") if isinstance(data, dict) else None
                )
                if not messages:
                    return
                if isinstance(messages, dict):
                    messages = list(messages.values())
                for msg in messages:
                    if not isinstance(msg, dict):
                        continue
                    # Dedup by (category, message, lap)
                    key = (msg.get("Category"), msg.get("Message"), msg.get("Lap"))
                    if key in self._seen_rc_keys:
                        continue
                    self._seen_rc_keys.add(key)
                    db.save_race_control_message(
                        session_id=self._db_session_id,
                        category=msg.get("Category"),
                        flag=msg.get("Flag"),
                        message=msg.get("Message"),
                        scope=msg.get("Scope"),
                        sector=msg.get("Sector"),
                        lap_number=msg.get("Lap"),
                        driver_number=msg.get("RacingNumber"),
                        ts=msg.get("Utc") or msg.get("Time"),
                    )

        except Exception as e:
            logger.debug("f1_live: persist %s failed: %s", topic, e)

    def _end_db_session(self) -> None:
        """End current DB session and save final timing snapshot."""
        if not self._db_session_id:
            return
        try:
            import database as db
            # Save final timing data
            timing = self.state.get("TimingData")
            if isinstance(timing, dict):
                lines = timing.get("Lines", timing)
                if isinstance(lines, dict):
                    for drv_num, drv_data in lines.items():
                        if not isinstance(drv_data, dict):
                            continue
                        try:
                            db.save_timing_snapshot(
                                session_id=self._db_session_id,
                                driver_number=int(drv_num),
                                position=drv_data.get("Position") or drv_data.get("Line"),
                                gap_to_leader=drv_data.get("GapToLeader"),
                                interval=drv_data.get("IntervalToPositionAhead", {}).get("Value")
                                    if isinstance(drv_data.get("IntervalToPositionAhead"), dict)
                                    else drv_data.get("IntervalToPositionAhead"),
                                last_lap_time=drv_data.get("LastLapTime", {}).get("Value")
                                    if isinstance(drv_data.get("LastLapTime"), dict)
                                    else None,
                                best_lap_time=drv_data.get("BestLapTime", {}).get("Value")
                                    if isinstance(drv_data.get("BestLapTime"), dict)
                                    else None,
                                num_laps=drv_data.get("NumberOfLaps"),
                                status=drv_data.get("Status") or drv_data.get("Retired"),
                            )
                        except Exception as e:
                            logger.debug("f1_live: timing snapshot drv %s: %s", drv_num, e)
            db.end_live_session(self._db_session_id)
            logger.info("f1_live: ended DB session id=%s", self._db_session_id)
        except Exception as e:
            logger.warning("f1_live: end_db_session failed: %s", e)
        finally:
            self._db_session_id = None
            self._seen_rc_keys.clear()

    async def _read_loop(self) -> None:
        assert self._ws is not None
        async for msg in self._ws:
            if not isinstance(msg, str):
                continue
            self.last_message_at = time.time()
            try:
                payload = json.loads(msg)
            except ValueError:
                continue
            self._handle_update_frame(payload)
            # If SessionInfo changes mid-stream (new session), drop state and reconnect.
            # f1-dash does the same; it's the simplest way to get a clean initial snapshot.
            if payload.get("M"):
                for frame in payload["M"]:
                    args = frame.get("A")
                    if args and args[0] == "SessionInfo":
                        logger.info("f1_live: SessionInfo changed, will reconnect")
                        self._end_db_session()
                        return

    async def _watchdog(self) -> None:
        """Force-reconnect if the upstream goes silent."""
        while True:
            await asyncio.sleep(15)
            if self.last_message_at and (time.time() - self.last_message_at) > IDLE_RECONNECT_SEC:
                logger.warning(
                    "f1_live: watchdog idle %.0fs, closing ws",
                    time.time() - self.last_message_at,
                )
                try:
                    if self._ws is not None:
                        await self._ws.close()
                except Exception:
                    pass
                return

    async def run_forever(self) -> None:
        backoff = 5
        # Separate (longer) backoff for the "no active session" state so we
        # don't spam logs between race weekends.
        offline_backoff = 30
        while not self._stop:
            self.connected = False
            self._ws = None
            hit_offline = False
            try:
                await self._connect_ws()
                backoff = 5
                offline_backoff = 30
                # Race the reader loop against the idle watchdog.
                reader = asyncio.create_task(self._read_loop())
                watch = asyncio.create_task(self._watchdog())
                done, pending = await asyncio.wait(
                    {reader, watch}, return_when=asyncio.FIRST_COMPLETED
                )
                for t in pending:
                    t.cancel()
                for t in done:
                    exc = t.exception()
                    if exc and not isinstance(exc, (ConnectionClosed, asyncio.CancelledError)):
                        raise exc
            except asyncio.CancelledError:
                raise
            except F1SessionOffline as e:
                hit_offline = True
                self.last_error = str(e)
                # debug-level: expected state outside race weekends
                logger.debug(
                    "f1_live: offline (%s), retry in %ss",
                    self.last_error, offline_backoff,
                )
            except Exception as e:
                self.last_error = f"{type(e).__name__}: {e}"
                logger.warning(
                    "f1_live: upstream error (%s), reconnect in %ss",
                    self.last_error, backoff,
                )
            finally:
                self.connected = False
                if self._ws is not None:
                    try:
                        await self._ws.close()
                    except Exception:
                        pass
                    self._ws = None
                self.reconnects += 1

            if self._stop:
                break
            try:
                if hit_offline:
                    await asyncio.sleep(offline_backoff)
                    offline_backoff = min(offline_backoff * 2, 600)  # cap 10 min
                else:
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, 60)
            except asyncio.CancelledError:
                raise

    async def shutdown(self) -> None:
        self._stop = True
        self._end_db_session()
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass


# ================================================================= singleton

_client: Optional[F1LiveClient] = None


def get_client() -> Optional[F1LiveClient]:
    return _client


def set_client(c: Optional[F1LiveClient]) -> None:
    global _client
    _client = c
