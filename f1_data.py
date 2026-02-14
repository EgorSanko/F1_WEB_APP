"""
F1 Hub — F1 Data Integration Layer
Async HTTP client with retry, rate limiting, and data enrichment.
Merges OpenF1 (live) + Ergast/Jolpica (history) into unified responses.
"""

import asyncio
import time
import logging
import json
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple

import httpx

from config import (
    OPENF1_API, ERGAST_API, DRIVERS, TEAM_COLORS, TYRE_COLORS, CACHE_TTL,
    CIRCUIT_IMAGES, CIRCUIT_IMAGE_BASE, DRIVER_PHOTO_BASE, TEAM_ASSETS,
    STANDINGS_2025_DRIVERS, STANDINGS_2025_CONSTRUCTORS,
    SEASON_2025_RESULTS, CIRCUITS, PAST_RACES_VK, VK_DIRECT_2025,
    DRIVERS_2025, DRIVERS_2026, TEAM_COLORS_2025, TEAM_COLORS_2026,
    get_drivers, get_team_colors, CURRENT_SEASON, GROQ_API_KEY,
)

logger = logging.getLogger("f1hub.data")

# ============ ASYNC HTTP CLIENT ============
# Shared client with connection pooling, timeouts, retries

_client: Optional[httpx.AsyncClient] = None


def get_client() -> httpx.AsyncClient:
    """Get or create shared async HTTP client."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=10.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            follow_redirects=True,
            headers={"User-Agent": "F1Hub/1.0"},
        )
    return _client


async def close_client():
    """Close the shared client (call on shutdown)."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


# ============ RATE LIMITER (for Ergast: 4 req/sec) ============

class RateLimiter:
    """Simple token bucket rate limiter."""
    def __init__(self, rate: float = 4.0, burst: int = 4):
        self.rate = rate       # requests per second
        self.burst = burst     # max burst
        self.tokens = burst
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
            self.last_refill = now

            if self.tokens < 1:
                wait = (1 - self.tokens) / self.rate
                await asyncio.sleep(wait)
                self.tokens = 0
            else:
                self.tokens -= 1


_ergast_limiter = RateLimiter(rate=3.5, burst=4)  # slightly under 4/s to be safe

# ============ OpenF1 CONCURRENCY LIMIT ============
_openf1_semaphore = asyncio.Semaphore(3)  # max 3 concurrent OpenF1 requests

# ============ CACHE ============

_cache: Dict[str, Dict[str, Any]] = {}


def cache_get(key: str, ttl_override: int = None) -> Optional[Any]:
    """Get value from cache if not expired."""
    if key in _cache:
        entry = _cache[key]
        ttl = ttl_override or CACHE_TTL.get(key.split(":")[0], 300)
        if time.time() - entry["time"] < ttl:
            return entry["data"]
    return None


def cache_set(key: str, data: Any):
    """Set cache value."""
    _cache[key] = {"data": data, "time": time.time()}


def cache_clear(prefix: str = None):
    """Clear cache entries."""
    global _cache
    if prefix:
        _cache = {k: v for k, v in _cache.items() if not k.startswith(prefix)}
    else:
        _cache = {}


def cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    now = time.time()
    total = len(_cache)
    expired = sum(1 for k, v in _cache.items()
                  if now - v["time"] >= CACHE_TTL.get(k.split(":")[0], 300))
    return {"total_keys": total, "expired": expired, "active": total - expired}


# ============ DEMO MODE ============
# When no live session, auto-fallback to last historical session.
# Manual override via set_demo_session().

_demo_override_key: Optional[str] = None


async def get_fallback_session_key() -> Tuple[str, bool, Optional[Dict]]:
    """
    Determine which session_key to use for live endpoints.
    Returns (session_key, is_demo, demo_session_info).
    - Live session active → ("latest", False, None)
    - Manual override set → (override_key, True, info)
    - No live session → (last_session_key, True, info)
    """
    global _demo_override_key

    # 1) Manual override via /api/demo/set
    if _demo_override_key:
        info = cache_get(f"demo_info:{_demo_override_key}", ttl_override=3600)
        if not info:
            sessions = await fetch_openf1("sessions", {"session_key": _demo_override_key})
            if sessions:
                s = sessions[-1] if isinstance(sessions, list) else sessions
                if isinstance(s, list):
                    s = s[0] if s else {}
                try:
                    fallback_sk = int(_demo_override_key)
                except (ValueError, TypeError):
                    fallback_sk = _demo_override_key
                info = {
                    "session_key": s.get("session_key", fallback_sk),
                    "session_name": s.get("session_name", ""),
                    "session_type": s.get("session_type", ""),
                    "meeting_name": s.get("meeting_name", ""),
                    "circuit_short_name": s.get("circuit_short_name", ""),
                    "date_start": s.get("date_start", ""),
                    "date_end": s.get("date_end", ""),
                }
            else:
                try:
                    fallback_sk = int(_demo_override_key)
                except (ValueError, TypeError):
                    fallback_sk = _demo_override_key
                info = {"session_key": fallback_sk, "meeting_name": f"Session {_demo_override_key}"}
            cache_set(f"demo_info:{_demo_override_key}", info)
        return _demo_override_key, True, info

    # 2) Check cached resolution (60s TTL)
    cached = cache_get("_fallback_resolved", ttl_override=60)
    if cached:
        return cached["key"], cached["is_demo"], cached.get("info")

    # 3) Check if latest session is actually live
    sessions = await fetch_openf1("sessions", {"session_key": "latest"})
    if not sessions:
        last_rnd = max(SEASON_2025_RESULTS.keys())
        sk = str(SEASON_2025_RESULTS[last_rnd]["session_key"])
        info = {"session_key": int(sk), "meeting_name": SEASON_2025_RESULTS[last_rnd]["name"],
                "session_name": "Race", "date_start": SEASON_2025_RESULTS[last_rnd]["date"]}
        cache_set("_fallback_resolved", {"key": sk, "is_demo": True, "info": info})
        return sk, True, info

    session = sessions[-1] if isinstance(sessions, list) and sessions else sessions
    if isinstance(session, list):
        session = session[0] if session else {}

    now = datetime.utcnow()
    is_live = False
    date_start = session.get("date_start", "")
    date_end = session.get("date_end", "")
    if date_start and date_end:
        try:
            start = datetime.fromisoformat(date_start.replace("Z", "+00:00").replace("+00:00", ""))
            end = datetime.fromisoformat(date_end.replace("Z", "+00:00").replace("+00:00", ""))
            is_live = start <= now <= (end + timedelta(minutes=30))
        except (ValueError, TypeError):
            pass

    if is_live:
        cache_set("_fallback_resolved", {"key": "latest", "is_demo": False})
        return "latest", False, None

    # Not live — use this session's key
    sk = session.get("session_key")
    if sk:
        info = {
            "session_key": sk,
            "session_name": session.get("session_name", ""),
            "session_type": session.get("session_type", ""),
            "meeting_name": session.get("meeting_name", ""),
            "circuit_short_name": session.get("circuit_short_name", ""),
            "date_start": date_start,
            "date_end": date_end,
        }
        cache_set("_fallback_resolved", {"key": str(sk), "is_demo": True, "info": info})
        return str(sk), True, info

    # Absolute fallback
    last_rnd = max(SEASON_2025_RESULTS.keys())
    sk = str(SEASON_2025_RESULTS[last_rnd]["session_key"])
    info = {"session_key": int(sk), "meeting_name": SEASON_2025_RESULTS[last_rnd]["name"], "session_name": "Race"}
    cache_set("_fallback_resolved", {"key": sk, "is_demo": True, "info": info})
    return sk, True, info


def set_demo_session(session_key: Optional[str]):
    """Set or clear demo session override. None or 'auto' = auto mode."""
    global _demo_override_key
    if session_key and session_key.lower() in ("auto", "clear", "none", ""):
        session_key = None
    _demo_override_key = session_key
    cache_clear("_fallback")
    cache_clear("live_")
    logger.info(f"Demo session {'set to ' + session_key if session_key else 'cleared'}")


def get_demo_sessions_list() -> List[Dict]:
    """Return available historical sessions for demo mode picker."""
    sessions = []
    for rnd, data in sorted(SEASON_2025_RESULTS.items(), reverse=True):
        sk = data.get("session_key")
        if sk:
            sessions.append({
                "session_key": sk,
                "name": data["name"],
                "date": data["date"],
                "round": rnd,
                "type": "Race",
                "laps": data.get("laps", 0),
            })
    return sessions


# ============ FETCH HELPERS WITH RETRY ============

async def fetch_openf1(
    endpoint: str,
    params: dict = None,
    retries: int = 2,
    retry_delay: float = 1.0,
) -> Optional[Any]:
    """
    Fetch from OpenF1 API with retry logic and concurrency limit.
    Returns parsed JSON (list or dict) or None on failure.
    """
    async with _openf1_semaphore:
        client = get_client()
        url = f"{OPENF1_API}/{endpoint}"

        for attempt in range(retries + 1):
            try:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    return data
                elif resp.status_code == 429:
                    # Rate limited — wait and retry
                    wait = min(retry_delay * (2 ** attempt), 10)
                    logger.warning(f"OpenF1 rate limited on {endpoint}, waiting {wait}s")
                    await asyncio.sleep(wait)
                    continue
                else:
                    logger.warning(f"OpenF1 {endpoint} returned {resp.status_code}")
                    if attempt < retries:
                        await asyncio.sleep(retry_delay)
                        continue
                    return None
            except (httpx.RequestError, httpx.TimeoutException) as e:
                logger.error(f"OpenF1 {endpoint} error (attempt {attempt+1}): {e}")
                if attempt < retries:
                    await asyncio.sleep(retry_delay * (attempt + 1))
                continue

        return None


async def fetch_ergast(
    endpoint: str,
    retries: int = 2,
    retry_delay: float = 1.0,
) -> Optional[Dict]:
    """
    Fetch from Ergast/Jolpica API with rate limiting and retry.
    Returns MRData dict or None on failure.
    """
    await _ergast_limiter.acquire()
    client = get_client()
    url = f"{ERGAST_API}/{endpoint}.json"

    for attempt in range(retries + 1):
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.json().get("MRData", {})
            elif resp.status_code == 429:
                wait = min(retry_delay * (2 ** attempt), 10)
                logger.warning(f"Ergast rate limited on {endpoint}, waiting {wait}s")
                await asyncio.sleep(wait)
                await _ergast_limiter.acquire()
                continue
            else:
                logger.warning(f"Ergast {endpoint} returned {resp.status_code}")
                if attempt < retries:
                    await asyncio.sleep(retry_delay)
                    continue
                return None
        except (httpx.RequestError, httpx.TimeoutException) as e:
            logger.error(f"Ergast {endpoint} error (attempt {attempt+1}): {e}")
            if attempt < retries:
                await asyncio.sleep(retry_delay * (attempt + 1))
            continue

    return None


# ============ DRIVER ENRICHMENT ============

def enrich_driver(driver_number: int, extra: dict = None, season: int = None) -> dict:
    """Build a full driver info dict from config + optional extra data."""
    s = season or CURRENT_SEASON
    drivers = get_drivers(s)
    colors = get_team_colors(s)
    info = drivers.get(driver_number, {})
    # Fallback: try other season if not found
    if not info:
        other = get_drivers(2025 if s == 2026 else 2026)
        info = other.get(driver_number, {})
    team = info.get("team", "")

    result = {
        "driver_number": driver_number,
        "name": info.get("name", f"Пилот {driver_number}"),
        "first_name": info.get("name", "").split(" ")[0] if info.get("name") else "",
        "last_name": " ".join(info.get("name", "").split(" ")[1:]) if info.get("name") else "",
        "code": info.get("code", str(driver_number)),
        "team": team,
        "team_color": colors.get(team, TEAM_COLORS.get(team, "#888888")),
        "country": info.get("country", ""),
        "photo_url": info.get("photo_url", ""),
        "photo_url_large": info.get("photo_url_large", ""),
    }
    if extra:
        result.update(extra)
    return result


def get_driver_photo_url(name: str) -> str:
    """Get F1 official driver headshot URL."""
    if not name:
        return ""
    # F1 uses lastname format: verstappen, hamilton, leclerc
    lastname = name.split(" ")[-1].lower()
    # Handle special cases
    special = {
        "verstappen": "verstappen",
        "hamilton": "hamilton",
        "leclerc": "leclerc",
        "norris": "norris",
        "piastri": "piastri",
        "russell": "russell",
        "antonelli": "antonelli",
        "alonso": "alonso",
        "stroll": "stroll",
        "gasly": "gasly",
        "doohan": "doohan",
        "albon": "albon",
        "sainz": "sainz",
        "ocon": "ocon",
        "bearman": "bearman",
        "tsunoda": "tsunoda",
        "lawson": "lawson",
        "hülkenberg": "hulkenberg",
        "bortoleto": "bortoleto",
        "hadjar": "hadjar",
    }
    slug = special.get(lastname, lastname)
    return f"{DRIVER_PHOTO_BASE}/{slug}.jpg.transform/2col/image.jpg"


def get_driver_photo_url_large(name: str) -> str:
    """Get large (4col) F1 official driver headshot URL."""
    if not name:
        return ""
    small = get_driver_photo_url(name)
    return small.replace("/2col/", "/4col/") if small else ""


# ============ ERGAST ID MAPPING ============
# Maps Ergast driverId to our driver_number for cross-referencing

ERGAST_TO_NUMBER = {
    "max_verstappen": 1, "hamilton": 44, "leclerc": 16,
    "norris": 4, "piastri": 81, "russell": 63,
    "antonelli": 12, "alonso": 14, "stroll": 18,
    "gasly": 10, "colapinto": 43, "albon": 23,
    "sainz": 55, "ocon": 31, "bearman": 87,
    "tsunoda": 22, "lawson": 30, "hulkenberg": 27,
    "bortoleto": 5, "hadjar": 6, "doohan": 7,
}
ERGAST_TO_NUMBER_2025 = ERGAST_TO_NUMBER

ERGAST_TO_NUMBER_2026 = {
    "max_verstappen": 3, "hamilton": 44, "leclerc": 16,
    "norris": 1, "piastri": 81, "russell": 63,
    "antonelli": 12, "alonso": 14, "stroll": 18,
    "gasly": 10, "colapinto": 43, "albon": 23,
    "sainz": 55, "ocon": 31, "bearman": 87,
    "lawson": 30, "hulkenberg": 27, "hadjar": 6,
    "bortoleto": 5, "lindblad": 41,
    "perez": 11, "bottas": 77,
}


def ergast_driver_id_to_number(driver_id: str, season: int = None) -> Optional[int]:
    """Convert Ergast driverId to our driver number."""
    s = season or CURRENT_SEASON
    mapping = ERGAST_TO_NUMBER_2026 if s == 2026 else ERGAST_TO_NUMBER_2025
    return mapping.get(driver_id)


def _get_circuit_image(circuit_id: str) -> str:
    """Get track outline image URL for a circuit."""
    name = CIRCUIT_IMAGES.get(circuit_id, "")
    if name:
        return f"{CIRCUIT_IMAGE_BASE}/{name}.png"
    return ""


# ============ HIGH-LEVEL DATA FUNCTIONS ============

RACE_NAMES_RU = {
    "Australian Grand Prix": "Гран-при Австралии",
    "Chinese Grand Prix": "Гран-при Китая",
    "Japanese Grand Prix": "Гран-при Японии",
    "Bahrain Grand Prix": "Гран-при Бахрейна",
    "Saudi Arabian Grand Prix": "Гран-при Саудовской Аравии",
    "Miami Grand Prix": "Гран-при Майами",
    "Canadian Grand Prix": "Гран-при Канады",
    "Monaco Grand Prix": "Гран-при Монако",
    "Spanish Grand Prix": "Гран-при Испании",
    "Austrian Grand Prix": "Гран-при Австрии",
    "British Grand Prix": "Гран-при Великобритании",
    "Belgian Grand Prix": "Гран-при Бельгии",
    "Hungarian Grand Prix": "Гран-при Венгрии",
    "Dutch Grand Prix": "Гран-при Нидерландов",
    "Italian Grand Prix": "Гран-при Италии",
    "Azerbaijan Grand Prix": "Гран-при Азербайджана",
    "Singapore Grand Prix": "Гран-при Сингапура",
    "United States Grand Prix": "Гран-при США",
    "Mexico City Grand Prix": "Гран-при Мексики",
    "São Paulo Grand Prix": "Гран-при Сан-Паулу",
    "Las Vegas Grand Prix": "Гран-при Лас-Вегаса",
    "Qatar Grand Prix": "Гран-при Катара",
    "Abu Dhabi Grand Prix": "Гран-при Абу-Даби",
    "Emilia Romagna Grand Prix": "Гран-при Эмилии-Романьи",
    "German Grand Prix": "Гран-при Германии",
    "Portuguese Grand Prix": "Гран-при Португалии",
}

SPRINT_ROUNDS_2026 = {
    "shanghai": True,
    "miami": True,
    "spa": True,
    "americas": True,
    "losail": True,
    "interlagos": True,
}

CIRCUIT_COUNTRIES = {
    "albert_park": "AU", "shanghai": "CN", "suzuka": "JP",
    "bahrain": "BH", "jeddah": "SA", "miami": "US",
    "villeneuve": "CA", "monaco": "MC", "catalunya": "ES",
    "red_bull_ring": "AT", "silverstone": "GB", "spa": "BE",
    "hungaroring": "HU", "zandvoort": "NL", "monza": "IT",
    "baku": "AZ", "marina_bay": "SG", "americas": "US",
    "rodriguez": "MX", "interlagos": "BR", "vegas": "US",
    "losail": "QA", "yas_marina": "AE", "imola": "IT",
}


async def get_schedule(season: int = None) -> Dict[str, Any]:
    """Get full season schedule with enriched data."""
    s = season or CURRENT_SEASON
    cache_key = f"schedule:{s}"
    cached = cache_get(cache_key, ttl_override=3600)
    if cached:
        return cached

    endpoint = "current" if s == 2025 else str(s)
    data = await fetch_ergast(endpoint)
    if not data:
        return {"season": str(s), "races": [], "error": "Failed to fetch schedule"}

    races = data.get("RaceTable", {}).get("Races", [])
    result = []

    for race in races:
        circuit_id = race["Circuit"]["circuitId"]
        english_name = race["raceName"]
        entry = {
            "round": int(race["round"]),
            "name": RACE_NAMES_RU.get(english_name, english_name),
            "circuit": race["Circuit"]["circuitName"],
            "circuit_id": circuit_id,
            "circuit_image": _get_circuit_image(circuit_id),
            "country": race["Circuit"]["Location"]["country"],
            "country_code": CIRCUIT_COUNTRIES.get(circuit_id, ""),
            "locality": race["Circuit"]["Location"]["locality"],
            "lat": float(race["Circuit"]["Location"]["lat"]),
            "lng": float(race["Circuit"]["Location"]["long"]),
            "date": race["date"],
            "time": race.get("time", ""),
            "sessions": {},
        }

        # Parse all session times
        session_map = {
            "FirstPractice": "fp1",
            "SecondPractice": "fp2",
            "ThirdPractice": "fp3",
            "Qualifying": "qualifying",
            "Sprint": "sprint",
            "SprintQualifying": "sprint_qualifying",
        }
        for ergast_key, our_key in session_map.items():
            if ergast_key in race:
                entry["sessions"][our_key] = {
                    "date": race[ergast_key].get("date", ""),
                    "time": race[ergast_key].get("time", ""),
                }

        # Race session always exists
        entry["sessions"]["race"] = {
            "date": race["date"],
            "time": race.get("time", ""),
        }

        # Sprint detection: from API sessions or hardcoded for 2026
        has_sprint = "sprint" in entry["sessions"] or "sprint_qualifying" in entry["sessions"]
        if not has_sprint and s == 2026:
            has_sprint = SPRINT_ROUNDS_2026.get(circuit_id, False)
        entry["sprint"] = has_sprint

        # Determine status
        now = datetime.utcnow()
        try:
            race_dt_str = race["date"]
            race_time = race.get("time", "14:00:00Z").replace("Z", "")
            race_dt = datetime.fromisoformat(f"{race_dt_str}T{race_time}")
            entry["race_datetime"] = race_dt.isoformat() + "Z"
            entry["is_past"] = race_dt < now
            entry["is_next"] = False  # Will be set below
        except (ValueError, TypeError):
            entry["race_datetime"] = None
            entry["is_past"] = False

        result.append(entry)

    # Mark the next race
    for entry in result:
        if not entry.get("is_past"):
            entry["is_next"] = True
            break

    response = {
        "season": data.get("RaceTable", {}).get("season", str(s)),
        "races": result,
        "total_races": len(result),
    }
    cache_set(cache_key, response)
    return response


async def get_next_race(season: int = None) -> Dict[str, Any]:
    """Get the next upcoming race with full details."""
    s = season or CURRENT_SEASON
    nrc_key = f"next_race:{s}"
    cached = cache_get(nrc_key, ttl_override=1800)
    if cached:
        return cached

    schedule = await get_schedule(s)
    now = datetime.utcnow()

    for race in schedule.get("races", []):
        if race.get("race_datetime"):
            try:
                race_dt = datetime.fromisoformat(race["race_datetime"].replace("Z", ""))
                # Include races up to 6 hours after start (still might be going)
                if race_dt + timedelta(hours=6) > now:
                    cache_set(nrc_key, race)
                    return race
            except (ValueError, TypeError):
                continue

    return {"message": "No upcoming races", "races_total": len(schedule.get("races", []))}


async def get_race_results(round_num: int) -> Dict[str, Any]:
    """Get race results for a specific round, enriched with our data."""
    cache_key = f"race_results:{round_num}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    data = await fetch_ergast(f"current/{round_num}/results")
    if not data:
        return {"error": "Failed to fetch results", "round": round_num}

    races = data.get("RaceTable", {}).get("Races", [])
    if not races:
        return {"error": "Race results not found", "round": round_num}

    race = races[0]
    results = []
    fastest_lap_driver = None

    for r in race.get("Results", []):
        driver_num = int(r.get("number", 0))
        fl_rank = int(r.get("FastestLap", {}).get("rank", 0) or 0)
        if fl_rank == 1:
            fastest_lap_driver = driver_num

        # Determine finish status
        status_raw = r.get("status", "")
        is_dnf = status_raw not in ["Finished", "+1 Lap", "+2 Laps", "+3 Laps"]

        entry = enrich_driver(driver_num, {
            "position": int(r["position"]),
            "grid": int(r.get("grid", 0)),
            "laps": int(r.get("laps", 0)),
            "status": status_raw,
            "is_dnf": is_dnf,
            "points": float(r.get("points", 0)),
            "time": r.get("Time", {}).get("time", ""),
            "gap": r.get("Time", {}).get("time", ""),  # time behind leader
            "fastest_lap_time": r.get("FastestLap", {}).get("Time", {}).get("time", ""),
            "fastest_lap_rank": fl_rank,
            "fastest_lap_lap": int(r.get("FastestLap", {}).get("lap", 0) or 0),
            "avg_speed": r.get("FastestLap", {}).get("AverageSpeed", {}).get("speed", ""),
        })
        results.append(entry)

    response = {
        "round": int(race["round"]),
        "name": race["raceName"],
        "circuit": race["Circuit"]["circuitName"],
        "country": race["Circuit"]["Location"]["country"],
        "date": race["date"],
        "results": results,
        "dnf_count": sum(1 for r in results if r["is_dnf"]),
        "fastest_lap_driver": fastest_lap_driver,
        "total_laps": max((r["laps"] for r in results), default=0),
    }
    cache_set(cache_key, response)
    return response


async def get_last_race() -> Dict[str, Any]:
    """Get results of the most recent race."""
    cached = cache_get("race_results:last")
    if cached:
        return cached

    data = await fetch_ergast("current/last/results")
    if not data:
        return {"error": "Failed to fetch last race"}

    races = data.get("RaceTable", {}).get("Races", [])
    if not races:
        return {"message": "No race results yet this season"}

    race = races[0]
    results = []
    for r in race.get("Results", []):
        driver_num = int(r.get("number", 0))
        results.append(enrich_driver(driver_num, {
            "position": int(r["position"]),
            "points": float(r.get("points", 0)),
            "time": r.get("Time", {}).get("time", ""),
            "status": r.get("status", ""),
            "grid": int(r.get("grid", 0)),
            "fastest_lap_rank": int(r.get("FastestLap", {}).get("rank", 0) or 0),
        }))

    response = {
        "round": int(race["round"]),
        "name": race["raceName"],
        "circuit": race["Circuit"]["circuitName"],
        "date": race["date"],
        "results": results,
    }
    cache_set("race_results:last", response)
    return response


async def get_qualifying_results(round_num: int) -> Dict[str, Any]:
    """Get qualifying results for a specific round."""
    cache_key = f"qualifying_results:{round_num}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    data = await fetch_ergast(f"current/{round_num}/qualifying")
    if not data:
        return {"error": "Failed to fetch qualifying", "round": round_num}

    races = data.get("RaceTable", {}).get("Races", [])
    if not races:
        return {"error": "Qualifying results not found", "round": round_num}

    race = races[0]
    results = []
    for q in race.get("QualifyingResults", []):
        driver_num = int(q.get("number", 0))
        results.append(enrich_driver(driver_num, {
            "position": int(q["position"]),
            "q1": q.get("Q1", ""),
            "q2": q.get("Q2", ""),
            "q3": q.get("Q3", ""),
        }))

    response = {
        "round": int(race["round"]),
        "name": race["raceName"],
        "date": race["date"],
        "results": results,
    }
    cache_set(cache_key, response)
    return response


# ============ STANDINGS ============

async def get_driver_standings(season: int = None) -> Dict[str, Any]:
    """Get driver championship standings for a given season."""
    s = season or CURRENT_SEASON
    cache_key = f"standings_drivers:{s}"
    cached = cache_get(cache_key, ttl_override=900)
    if cached:
        return cached

    endpoint = "current/driverStandings" if s == 2025 else f"{s}/driverStandings"
    data = await fetch_ergast(endpoint)
    if not data:
        return {"standings": [], "error": "Failed to fetch standings"}

    standings_lists = data.get("StandingsTable", {}).get("StandingsLists", [])
    if not standings_lists:
        if s == 2025:
            # Fallback: use hardcoded 2025 final standings
            standings = []
            leader_points = 0
            prev_points = 0
            for sd in STANDINGS_2025_DRIVERS:
                points = sd["points"]
                if not leader_points:
                    leader_points = points
                entry = enrich_driver(sd["driver_number"], {
                    "position": sd["position"],
                    "points": points,
                    "gap_to_leader": round(leader_points - points, 1),
                    "gap_to_prev": round(prev_points - points, 1) if prev_points else 0,
                    "wins": sd.get("wins", 0),
                }, season=2025)
                standings.append(entry)
                prev_points = points
            response = {"standings": standings, "season": "2025", "round": "24", "fallback": True}
            cache_set(cache_key, response)
            return response
        else:
            # 2026 season not started yet
            response = {"standings": [], "season": str(s), "not_started": True}
            cache_set(cache_key, response)
            return response

    standings = []
    leader_points = 0
    prev_points = 0

    for sd in standings_lists[0].get("DriverStandings", []):
        points = float(sd["points"])
        if not leader_points:
            leader_points = points

        driver_id = sd["Driver"].get("driverId", "")
        driver_num = ergast_driver_id_to_number(driver_id, s) or int(sd["Driver"].get("permanentNumber", 0))
        team_name = sd["Constructors"][0]["name"] if sd.get("Constructors") else ""

        entry = enrich_driver(driver_num, {
            "position": int(sd["position"]),
            "points": points,
            "gap_to_leader": round(leader_points - points, 1),
            "gap_to_prev": round(prev_points - points, 1) if prev_points else 0,
            "wins": int(sd.get("wins", 0)),
            "nationality": sd["Driver"].get("nationality", ""),
            "ergast_id": driver_id,
        }, season=s)
        standings.append(entry)
        prev_points = points

    response = {
        "standings": standings,
        "season": standings_lists[0].get("season", str(s)),
        "round": standings_lists[0].get("round", ""),
    }
    cache_set(cache_key, response)
    return response


async def get_constructor_standings(season: int = None) -> Dict[str, Any]:
    """Get constructor championship standings."""
    s = season or CURRENT_SEASON
    cache_key = f"standings_constructors:{s}"
    cached = cache_get(cache_key, ttl_override=900)
    if cached:
        return cached

    endpoint = "current/constructorStandings" if s == 2025 else f"{s}/constructorStandings"
    data = await fetch_ergast(endpoint)
    if not data:
        return {"standings": [], "error": "Failed to fetch constructor standings"}

    drivers_dict = get_drivers(s)
    colors = get_team_colors(s)

    standings_lists = data.get("StandingsTable", {}).get("StandingsLists", [])
    if not standings_lists:
        if s == 2025:
            standings = []
            leader_points = 0
            for sc in STANDINGS_2025_CONSTRUCTORS:
                points = sc["points"]
                if not leader_points:
                    leader_points = points
                team_name = sc["team"]
                team_drivers = [
                    enrich_driver(num, season=2025)
                    for num, info in DRIVERS_2025.items()
                    if info.get("team") == team_name
                ]
                standings.append({
                    "position": sc["position"],
                    "team": team_name,
                    "team_color": colors.get(team_name, "#888"),
                    "points": points,
                    "gap_to_leader": round(leader_points - points, 1),
                    "wins": sc.get("wins", 0),
                    "drivers": team_drivers,
                })
            response = {"standings": standings, "season": "2025", "fallback": True}
            cache_set(cache_key, response)
            return response
        else:
            response = {"standings": [], "season": str(s), "not_started": True}
            cache_set(cache_key, response)
            return response

    standings = []
    leader_points = 0

    for sc in standings_lists[0].get("ConstructorStandings", []):
        points = float(sc["points"])
        if not leader_points:
            leader_points = points

        team_name = sc["Constructor"]["name"]

        team_drivers = [
            enrich_driver(num, season=s)
            for num, info in drivers_dict.items()
            if info.get("team") == team_name
        ]

        standings.append({
            "position": int(sc["position"]),
            "team": team_name,
            "team_color": colors.get(team_name, "#888"),
            "points": points,
            "gap_to_leader": round(leader_points - points, 1),
            "wins": int(sc.get("wins", 0)),
            "nationality": sc["Constructor"].get("nationality", ""),
            "drivers": team_drivers,
        })

    response = {"standings": standings, "season": str(s)}
    cache_set(cache_key, response)
    return response


# ============ LIVE DATA (OpenF1) ============

async def get_live_session(_session_key=None) -> Dict[str, Any]:
    """Check if there's a live session and get its info."""
    if _session_key is None:
        _session_key, _is_demo, _demo_info = await get_fallback_session_key()
    else:
        _is_demo = (_session_key != "latest")
        _demo_info = None

    cache_key = f"live_session:{_session_key}"
    cached = cache_get(cache_key, ttl_override=300 if _is_demo else None)
    if cached:
        return cached

    sessions = await fetch_openf1("sessions", {"session_key": _session_key})
    if not sessions:
        return {"is_live": False, "is_demo": _is_demo, "message": "No session data available"}

    session = sessions[-1] if isinstance(sessions, list) and sessions else sessions
    if isinstance(session, list):
        session = session[0] if session else {}

    now = datetime.utcnow()
    is_live = False
    date_start = session.get("date_start", "")
    date_end = session.get("date_end", "")

    if not _is_demo and date_start and date_end:
        try:
            start = datetime.fromisoformat(date_start.replace("Z", "+00:00").replace("+00:00", ""))
            end = datetime.fromisoformat(date_end.replace("Z", "+00:00").replace("+00:00", ""))
            is_live = start <= now <= (end + timedelta(minutes=30))
        except (ValueError, TypeError):
            pass

    response = {
        "is_live": is_live,
        "is_demo": _is_demo,
        "session_key": session.get("session_key"),
        "session_name": session.get("session_name", ""),
        "session_type": session.get("session_type", ""),
        "meeting_name": session.get("meeting_name", ""),
        "meeting_key": session.get("meeting_key"),
        "date_start": date_start,
        "date_end": date_end,
        "circuit_short_name": session.get("circuit_short_name", ""),
        "country_name": session.get("country_name", ""),
        "year": session.get("year"),
    }
    if _demo_info:
        response["demo_session"] = _demo_info
    cache_set(cache_key, response)
    return response


async def get_live_positions(_session_key=None) -> Dict[str, Any]:
    """Get current positions with tyres and pit stop info — merged from 3 endpoints."""
    if _session_key is None:
        _session_key, _is_demo, _demo_info = await get_fallback_session_key()
    else:
        _is_demo = (_session_key != "latest")
        _demo_info = None

    cache_key = f"live_positions:{_session_key}"
    cached = cache_get(cache_key, ttl_override=300 if _is_demo else None)
    if cached:
        return cached

    # Fetch all 3 sources in parallel
    positions_raw, stints_raw, pits_raw = await asyncio.gather(
        fetch_openf1("position", {"session_key": _session_key}),
        fetch_openf1("stints", {"session_key": _session_key}),
        fetch_openf1("pit", {"session_key": _session_key}),
    )

    if not positions_raw:
        return {"positions": [], "count": 0, "is_demo": _is_demo}

    # Latest position per driver
    latest_pos = {}
    for entry in positions_raw:
        dn = entry.get("driver_number")
        if dn is None:
            continue
        if dn not in latest_pos or entry.get("date", "") > latest_pos[dn].get("date", ""):
            latest_pos[dn] = entry

    # Latest stint (current tyre) per driver
    latest_stint = {}
    if stints_raw:
        for s in stints_raw:
            dn = s.get("driver_number")
            if dn is None:
                continue
            stint_num = s.get("stint_number", 0)
            if dn not in latest_stint or stint_num > latest_stint[dn].get("stint_number", 0):
                latest_stint[dn] = s

    # Pit stop count per driver
    pit_counts = {}
    if pits_raw:
        for p in pits_raw:
            dn = p.get("driver_number")
            if dn:
                pit_counts[dn] = pit_counts.get(dn, 0) + 1

    # Build sorted result
    sorted_positions = sorted(latest_pos.values(), key=lambda x: x.get("position", 99))
    result = []

    for pos in sorted_positions:
        dn = pos["driver_number"]
        stint = latest_stint.get(dn, {})
        compound = stint.get("compound", "UNKNOWN")

        # Calculate tyre age
        tyre_age = 0
        if stint.get("lap_start"):
            lap_end = stint.get("lap_end")
            if lap_end:
                tyre_age = lap_end - stint["lap_start"]
            # If no lap_end, stint is still active — we can't know exact age
            # without current lap number, so leave as 0

        result.append(enrich_driver(dn, {
            "position": pos.get("position", 0),
            "tyre": compound,
            "tyre_color": TYRE_COLORS.get(compound, "#888"),
            "tyre_age": tyre_age,
            "stint_number": stint.get("stint_number", 1),
            "pit_stops": pit_counts.get(dn, 0),
            "_stint_lap_start": stint.get("lap_start", 0),
        }))

    response = {"positions": result, "count": len(result), "is_demo": _is_demo}
    if _demo_info:
        response["demo_session"] = _demo_info
    cache_set(cache_key, response)
    return response


async def get_live_timing(_session_key=None) -> Dict[str, Any]:
    """Get timing data: laps, sectors, intervals — merged and enriched."""
    if _session_key is None:
        _session_key, _is_demo, _demo_info = await get_fallback_session_key()
    else:
        _is_demo = (_session_key != "latest")
        _demo_info = None

    cache_key = f"live_timing:{_session_key}"
    cached = cache_get(cache_key, ttl_override=300 if _is_demo else None)
    if cached:
        return cached

    laps_raw, intervals_raw = await asyncio.gather(
        fetch_openf1("laps", {"session_key": _session_key}),
        fetch_openf1("intervals", {"session_key": _session_key}),
    )

    if not laps_raw:
        return {"timing": [], "session_best": {}, "is_demo": _is_demo}

    # Last lap per driver
    latest_laps = {}
    # Personal bests: lap duration + each sector per driver
    pb_lap = {}
    pb_s1 = {}
    pb_s2 = {}
    pb_s3 = {}

    for lap in laps_raw:
        dn = lap.get("driver_number")
        if dn is None:
            continue

        lap_num = lap.get("lap_number", 0)
        if dn not in latest_laps or lap_num > latest_laps[dn].get("lap_number", 0):
            latest_laps[dn] = lap

        # Track personal bests per metric
        duration = lap.get("lap_duration")
        if duration and (dn not in pb_lap or duration < pb_lap[dn]):
            pb_lap[dn] = duration
        s1v = lap.get("duration_sector_1")
        if s1v and (dn not in pb_s1 or s1v < pb_s1[dn]):
            pb_s1[dn] = s1v
        s2v = lap.get("duration_sector_2")
        if s2v and (dn not in pb_s2 or s2v < pb_s2[dn]):
            pb_s2[dn] = s2v
        s3v = lap.get("duration_sector_3")
        if s3v and (dn not in pb_s3 or s3v < pb_s3[dn]):
            pb_s3[dn] = s3v

    # Latest interval per driver
    latest_intervals = {}
    if intervals_raw:
        for iv in intervals_raw:
            dn = iv.get("driver_number")
            if dn and (dn not in latest_intervals or iv.get("date", "") > latest_intervals[dn].get("date", "")):
                latest_intervals[dn] = iv

    # Session bests
    all_laps = [l for l in laps_raw if l.get("lap_duration")]
    all_s1 = [l["duration_sector_1"] for l in laps_raw if l.get("duration_sector_1")]
    all_s2 = [l["duration_sector_2"] for l in laps_raw if l.get("duration_sector_2")]
    all_s3 = [l["duration_sector_3"] for l in laps_raw if l.get("duration_sector_3")]

    best_s1 = min(all_s1) if all_s1 else None
    best_s2 = min(all_s2) if all_s2 else None
    best_s3 = min(all_s3) if all_s3 else None
    best_lap = min(l["lap_duration"] for l in all_laps) if all_laps else None

    timing = []
    for dn, lap in latest_laps.items():
        interval = latest_intervals.get(dn, {})
        s1 = lap.get("duration_sector_1")
        s2 = lap.get("duration_sector_2")
        s3 = lap.get("duration_sector_3")
        lap_dur = lap.get("lap_duration")

        timing.append(enrich_driver(dn, {
            "lap_number": lap.get("lap_number", 0),
            "lap_duration": lap_dur,
            "is_personal_best": lap_dur == pb_lap.get(dn) if lap_dur else False,
            "sector_1": s1,
            "sector_2": s2,
            "sector_3": s3,
            "s1_status": "best" if s1 and s1 == best_s1 else ("pb" if s1 and s1 == pb_s1.get(dn) else "normal"),
            "s2_status": "best" if s2 and s2 == best_s2 else ("pb" if s2 and s2 == pb_s2.get(dn) else "normal"),
            "s3_status": "best" if s3 and s3 == best_s3 else ("pb" if s3 and s3 == pb_s3.get(dn) else "normal"),
            "is_best_lap": lap_dur == best_lap if lap_dur else False,
            "gap_to_leader": interval.get("gap_to_leader"),
            "interval": interval.get("interval"),
        }))

    response = {
        "timing": timing,
        "session_best": {
            "sector_1": best_s1,
            "sector_2": best_s2,
            "sector_3": best_s3,
            "lap": best_lap,
        },
        "total_laps_in_data": len(laps_raw),
        "is_demo": _is_demo,
    }
    if _demo_info:
        response["demo_session"] = _demo_info
    cache_set(cache_key, response)
    return response


async def get_live_weather(_session_key=None) -> Dict[str, Any]:
    """Get current track weather."""
    if _session_key is None:
        _session_key, _is_demo, _demo_info = await get_fallback_session_key()
    else:
        _is_demo = (_session_key != "latest")
        _demo_info = None

    cache_key = f"live_weather:{_session_key}"
    cached = cache_get(cache_key, ttl_override=300 if _is_demo else None)
    if cached:
        return cached

    data = await fetch_openf1("weather", {"session_key": _session_key})
    if not data:
        return {"weather": None, "is_demo": _is_demo}

    latest = data[-1] if data else {}
    response = {
        "weather": {
            "air_temperature": latest.get("air_temperature"),
            "track_temperature": latest.get("track_temperature"),
            "humidity": latest.get("humidity"),
            "pressure": latest.get("pressure"),
            "rainfall": latest.get("rainfall", 0),
            "is_raining": bool(latest.get("rainfall", 0)),
            "wind_speed": latest.get("wind_speed"),
            "wind_direction": latest.get("wind_direction"),
        },
        "is_demo": _is_demo,
    }
    if _demo_info:
        response["demo_session"] = _demo_info
    cache_set(cache_key, response)
    return response


async def get_live_race_control(_session_key=None) -> Dict[str, Any]:
    """Get race control messages (flags, penalties, etc.)."""
    if _session_key is None:
        _session_key, _is_demo, _demo_info = await get_fallback_session_key()
    else:
        _is_demo = (_session_key != "latest")
        _demo_info = None

    cache_key = f"live_race_control:{_session_key}"
    cached = cache_get(cache_key, ttl_override=300 if _is_demo else None)
    if cached:
        return cached

    data = await fetch_openf1("race_control", {"session_key": _session_key})
    if not data:
        return {"messages": [], "is_demo": _is_demo}

    messages = []
    for msg in data[-25:]:  # last 25 messages
        messages.append({
            "date": msg.get("date", ""),
            "category": msg.get("category", ""),
            "flag": msg.get("flag", ""),
            "message": msg.get("message", ""),
            "scope": msg.get("scope", ""),
            "driver_number": msg.get("driver_number"),
            "lap_number": msg.get("lap_number"),
        })

    response = {"messages": messages, "is_demo": _is_demo}
    if _demo_info:
        response["demo_session"] = _demo_info
    cache_set(cache_key, response)
    return response


async def get_live_radio(_session_key=None) -> Dict[str, Any]:
    """Get latest team radio messages."""
    if _session_key is None:
        _session_key, _is_demo, _demo_info = await get_fallback_session_key()
    else:
        _is_demo = (_session_key != "latest")
        _demo_info = None

    cache_key = f"live_radio:{_session_key}"
    cached = cache_get(cache_key, ttl_override=300 if _is_demo else None)
    if cached:
        return cached

    data = await fetch_openf1("team_radio", {"session_key": _session_key})
    if not data:
        return {"radio": [], "is_demo": _is_demo}

    radio = []
    for msg in data[-15:]:  # last 15
        dn = msg.get("driver_number")
        radio.append(enrich_driver(dn, {
            "date": msg.get("date", ""),
            "recording_url": msg.get("recording_url", ""),
        }))

    response = {"radio": radio, "is_demo": _is_demo}
    if _demo_info:
        response["demo_session"] = _demo_info
    cache_set(cache_key, response)
    return response


async def get_live_pit_stops(_session_key=None) -> Dict[str, Any]:
    """Get pit stops from the current session."""
    if _session_key is None:
        _session_key, _is_demo, _demo_info = await get_fallback_session_key()
    else:
        _is_demo = (_session_key != "latest")
        _demo_info = None

    cache_key = f"live_pit_stops:{_session_key}"
    cached = cache_get(cache_key, ttl_override=300 if _is_demo else None)
    if cached:
        return cached

    data = await fetch_openf1("pit", {"session_key": _session_key})
    if not data:
        return {"pit_stops": [], "is_demo": _is_demo}

    pit_stops = []
    for p in data:
        dn = p.get("driver_number")
        if dn:
            pit_stops.append(enrich_driver(dn, {
                "date": p.get("date", ""),
                "lap_number": p.get("lap_number"),
                "pit_duration": p.get("pit_duration"),
            }))

    response = {"pit_stops": pit_stops, "is_demo": _is_demo}
    if _demo_info:
        response["demo_session"] = _demo_info
    cache_set(cache_key, response)
    return response


# ============ ENRICHED DRIVER PROFILES ============

async def get_driver_profile(driver_number: int, season: int = None) -> Dict[str, Any]:
    """Get full driver profile with season stats."""
    s = season or CURRENT_SEASON
    drivers_dict = get_drivers(s)
    # Try current season, fallback to other
    if driver_number not in drivers_dict:
        other = get_drivers(2025 if s == 2026 else 2026)
        if driver_number not in other:
            return {"error": "Driver not found"}

    driver = enrich_driver(driver_number, season=s)

    # Find Ergast ID for this driver
    ergast_map = ERGAST_TO_NUMBER_2026 if s == 2026 else ERGAST_TO_NUMBER_2025
    ergast_id = None
    for eid, num in ergast_map.items():
        if num == driver_number:
            ergast_id = eid
            break

    if not ergast_id:
        # For 2025: still try to get stats from hardcoded data
        if s == 2025:
            driver["season_stats"] = _get_2025_hardcoded_stats(driver_number)
        return driver

    # Get driver's season results from API
    endpoint = f"current/drivers/{ergast_id}/results" if s == 2025 else f"{s}/drivers/{ergast_id}/results"
    data = await fetch_ergast(endpoint)
    if data:
        races = data.get("RaceTable", {}).get("Races", [])
        season_results = []
        total_points = 0
        wins = 0
        podiums = 0
        dnfs = 0
        best_finish = 99

        for race in races:
            if race.get("Results"):
                r = race["Results"][0]
                pos = int(r["position"])
                pts = float(r.get("points", 0))
                total_points += pts
                if pos == 1: wins += 1
                if pos <= 3: podiums += 1
                if pos < best_finish: best_finish = pos
                if r.get("status", "") not in ["Finished", "+1 Lap", "+2 Laps", "+3 Laps"]:
                    dnfs += 1

                season_results.append({
                    "round": int(race["round"]),
                    "race": race["raceName"],
                    "position": pos,
                    "grid": int(r.get("grid", 0)),
                    "points": pts,
                    "status": r.get("status", ""),
                })

        if season_results:
            driver["season_stats"] = {
                "races": len(season_results),
                "points": total_points,
                "wins": wins,
                "podiums": podiums,
                "dnfs": dnfs,
                "best_finish": best_finish if best_finish < 99 else None,
                "results": season_results,
            }
        elif s == 2025:
            driver["season_stats"] = _get_2025_hardcoded_stats(driver_number)
    elif s == 2025:
        driver["season_stats"] = _get_2025_hardcoded_stats(driver_number)

    # Get teammate for comparison
    d_dict = get_drivers(s)
    d_info = d_dict.get(driver_number, {})
    team = d_info.get("team", "")
    teammate_num = None
    for num, info in d_dict.items():
        if info["team"] == team and num != driver_number:
            teammate_num = num
            break

    if teammate_num:
        driver["teammate"] = enrich_driver(teammate_num, season=s)

    return driver


def _get_2025_hardcoded_stats(driver_number: int) -> Dict[str, Any]:
    """Get 2025 season stats from hardcoded STANDINGS and RESULTS data."""
    POINTS_TABLE = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}
    # Points and wins from standings
    standing = next((s for s in STANDINGS_2025_DRIVERS if s["driver_number"] == driver_number), None)
    points = standing["points"] if standing else 0
    wins_from_standings = standing.get("wins", 0) if standing else 0

    # Calculate from SEASON_2025_RESULTS
    wins = 0
    podiums = 0
    results = []
    for rnd, race in sorted(SEASON_2025_RESULTS.items()):
        podium = race.get("podium", [])
        top_10 = race.get("top_10", [])
        if driver_number in podium:
            podiums += 1
            if podium[0] == driver_number:
                wins += 1
        if driver_number in top_10:
            pos = top_10.index(driver_number) + 1
            results.append({
                "round": rnd,
                "race": race["name"],
                "position": pos,
                "grid": 0,
                "points": POINTS_TABLE.get(pos, 0),
                "status": "Finished",
            })

    return {
        "races": len(results),
        "points": points,
        "wins": wins or wins_from_standings,
        "podiums": podiums,
        "dnfs": 0,
        "best_finish": min((r["position"] for r in results), default=None),
        "results": results,
    }


# ============ COMBINED DASHBOARD DATA ============

async def get_home_data(season: int = None) -> Dict[str, Any]:
    """
    Get all data needed for the home screen in parallel.
    This is the 'heavy' Stage 2 load.
    """
    s = season or CURRENT_SEASON
    next_race, last_race, standings = await asyncio.gather(
        get_next_race(s),
        get_last_race(),
        get_driver_standings(s),
    )

    return {
        "next_race": next_race,
        "last_race": last_race,
        "standings_top3": {
            "standings": (standings.get("standings") or [])[:3]
        },
        "season": s,
    }


async def get_live_dashboard() -> Dict[str, Any]:
    """Get all live data in a single parallel fetch, with cross-enrichment."""
    # Resolve session key once, pass to all sub-functions
    _session_key, _is_demo, _demo_info = await get_fallback_session_key()

    session, positions, timing, weather, rc = await asyncio.gather(
        get_live_session(_session_key),
        get_live_positions(_session_key),
        get_live_timing(_session_key),
        get_live_weather(_session_key),
        get_live_race_control(_session_key),
    )

    # Cross-enrich: add current lap to positions for better tyre age
    if positions.get("positions") and timing.get("timing"):
        timing_by_dn = {t["driver_number"]: t for t in timing["timing"]}
        for p in positions["positions"]:
            t = timing_by_dn.get(p["driver_number"])
            if t and t.get("lap_number"):
                stint_start = p.get("_stint_lap_start", 0)
                if stint_start and p.get("tyre_age", 0) == 0:
                    p["tyre_age"] = max(0, t["lap_number"] - stint_start)
                p["current_lap"] = t["lap_number"]

    # Ensure is_demo is on session for frontend
    if _is_demo and session:
        session["is_demo"] = True
        if _demo_info:
            session["demo_session"] = _demo_info

    return {
        "session": session,
        "positions": positions,
        "timing": timing,
        "weather": weather,
        "race_control": rc,
    }


# ============ ANALYTICS: TYRE STRATEGY ============

async def get_race_strategy(session_key: str = "latest") -> Dict[str, Any]:
    """Get tyre strategy data: stints + pit stops per driver for visualization."""
    cache_key = f"strategy:{session_key}"
    cached = cache_get(cache_key, ttl_override=300)
    if cached:
        return cached

    stints_raw, pits_raw, positions_raw = await asyncio.gather(
        fetch_openf1("stints", {"session_key": session_key}),
        fetch_openf1("pit", {"session_key": session_key}),
        fetch_openf1("position", {"session_key": session_key}),
    )

    if not stints_raw:
        return {"drivers": [], "total_laps": 0}

    # Group stints by driver
    driver_stints: Dict[int, list] = {}
    for s in stints_raw:
        dn = s.get("driver_number")
        if dn is None:
            continue
        driver_stints.setdefault(dn, []).append({
            "compound": s.get("compound", "UNKNOWN"),
            "lap_start": s.get("lap_start", 0),
            "lap_end": s.get("lap_end"),
            "stint_number": s.get("stint_number", 1),
            "tyre_age_at_start": s.get("tyre_age_at_start", 0),
        })

    # Pit stop durations by driver
    pit_map: Dict[int, list] = {}
    if pits_raw:
        for p in pits_raw:
            dn = p.get("driver_number")
            if dn:
                pit_map.setdefault(dn, []).append({
                    "lap_number": p.get("lap_number"),
                    "pit_duration": p.get("pit_duration"),
                })

    # Final positions for sorting
    final_pos = {}
    if positions_raw:
        for entry in positions_raw:
            dn = entry.get("driver_number")
            if dn is not None:
                final_pos[dn] = entry.get("position", 99)

    # Total laps (max lap_end across all stints)
    total_laps = max(
        (s.get("lap_end") or s.get("lap_start") or 0 for stints in driver_stints.values() for s in stints),
        default=0,
    )

    # Build result
    drivers = []
    for dn, stints in driver_stints.items():
        stints.sort(key=lambda x: x["stint_number"])
        drivers.append(enrich_driver(dn, {
            "stints": stints,
            "pit_stops": pit_map.get(dn, []),
            "finish_position": final_pos.get(dn, 99),
        }))

    drivers.sort(key=lambda d: d["finish_position"])

    response = {"drivers": drivers, "total_laps": total_laps}
    cache_set(cache_key, response)
    return response


# ============ ANALYTICS: POSITION CHART ============

async def get_race_position_chart(session_key: str = "latest") -> Dict[str, Any]:
    """Get lap-by-lap positions for every driver — for position change chart."""
    cache_key = f"position_chart:{session_key}"
    cached = cache_get(cache_key, ttl_override=300)
    if cached:
        return cached

    laps_raw = await fetch_openf1("laps", {"session_key": session_key})
    positions_raw = await fetch_openf1("position", {"session_key": session_key})

    if not laps_raw and not positions_raw:
        return {"drivers": [], "total_laps": 0}

    # Build lap-by-lap positions from laps data (has lap_number directly)
    driver_positions: Dict[int, Dict[int, int]] = {}
    max_lap = 0

    if laps_raw:
        # laps endpoint has: driver_number, lap_number, position (sometimes)
        # We need to derive position from position endpoint
        pass

    # Use position endpoint: each entry has driver_number, position, date
    # We need to map these to lap numbers
    if positions_raw and laps_raw:
        # Build lap start times per driver from laps data
        lap_times: Dict[int, List[Tuple[int, str]]] = {}
        for lap in laps_raw:
            dn = lap.get("driver_number")
            lap_num = lap.get("lap_number", 0)
            date_start = lap.get("date_start", "")
            if dn and lap_num and date_start:
                lap_times.setdefault(dn, []).append((lap_num, date_start))
            if lap_num > max_lap:
                max_lap = lap_num

        # For each driver, find position at each lap
        # Group position entries by driver
        pos_by_driver: Dict[int, list] = {}
        for entry in positions_raw:
            dn = entry.get("driver_number")
            if dn is not None:
                pos_by_driver.setdefault(dn, []).append(entry)

        # For each driver, take the latest position before each lap start
        for dn in set(list(lap_times.keys()) + list(pos_by_driver.keys())):
            positions_list = sorted(pos_by_driver.get(dn, []), key=lambda x: x.get("date", ""))
            laps_list = sorted(lap_times.get(dn, []), key=lambda x: x[0])

            if not laps_list:
                continue

            driver_positions[dn] = {}
            pos_idx = 0

            for lap_num, lap_date in laps_list:
                # Advance position index to the latest position before this lap
                while pos_idx < len(positions_list) - 1 and positions_list[pos_idx + 1].get("date", "") <= lap_date:
                    pos_idx += 1
                if pos_idx < len(positions_list):
                    driver_positions[dn][lap_num] = positions_list[pos_idx].get("position", 0)

    elif positions_raw:
        # Fallback: just use position data with estimated lap mapping
        for entry in positions_raw:
            dn = entry.get("driver_number")
            pos = entry.get("position")
            if dn is not None and pos:
                driver_positions.setdefault(dn, {})

    # Build result
    drivers = []
    for dn, lap_positions in driver_positions.items():
        if not lap_positions:
            continue
        positions_array = [
            {"lap": lap, "position": pos}
            for lap, pos in sorted(lap_positions.items())
        ]
        drivers.append(enrich_driver(dn, {
            "positions": positions_array,
        }))

    response = {"drivers": drivers, "total_laps": max_lap}
    cache_set(cache_key, response)
    return response


# ============ ANALYTICS: LAP TIMES ============

async def get_race_laptimes(session_key: str = "latest", driver_numbers: list = None) -> Dict[str, Any]:
    """Get lap time data for comparison charts."""
    cache_key = f"laptimes:{session_key}"
    cached = cache_get(cache_key, ttl_override=300)
    if cached and not driver_numbers:
        return cached

    laps_raw, stints_raw = await asyncio.gather(
        fetch_openf1("laps", {"session_key": session_key}),
        fetch_openf1("stints", {"session_key": session_key}),
    )

    if not laps_raw:
        return {"drivers": [], "total_laps": 0}

    # Build stint map: driver_number -> [(lap_start, lap_end, compound)]
    stint_map: Dict[int, list] = {}
    if stints_raw:
        for s in stints_raw:
            dn = s.get("driver_number")
            if dn is not None:
                stint_map.setdefault(dn, []).append({
                    "lap_start": s.get("lap_start", 0),
                    "lap_end": s.get("lap_end", 999),
                    "compound": s.get("compound", "UNKNOWN"),
                })

    def get_compound(dn, lap_num):
        for stint in stint_map.get(dn, []):
            end = stint["lap_end"] if stint["lap_end"] else 999
            if stint["lap_start"] <= lap_num <= end:
                return stint["compound"]
        return "UNKNOWN"

    # Group laps by driver
    driver_laps: Dict[int, list] = {}
    max_lap = 0
    all_durations = []

    for lap in laps_raw:
        dn = lap.get("driver_number")
        if dn is None:
            continue
        if driver_numbers and dn not in driver_numbers:
            continue

        lap_num = lap.get("lap_number", 0)
        duration = lap.get("lap_duration")
        is_pit = lap.get("is_pit_out_lap", False)

        if lap_num > max_lap:
            max_lap = lap_num
        if duration:
            all_durations.append(duration)

        driver_laps.setdefault(dn, []).append({
            "lap": lap_num,
            "time": duration,
            "s1": lap.get("duration_sector_1"),
            "s2": lap.get("duration_sector_2"),
            "s3": lap.get("duration_sector_3"),
            "compound": get_compound(dn, lap_num),
            "is_pit_out": is_pit,
            "i1_speed": lap.get("i1_speed"),
            "i2_speed": lap.get("i2_speed"),
            "st_speed": lap.get("st_speed"),
        })

    # Session best lap
    best_lap = min(all_durations) if all_durations else None

    drivers = []
    for dn, laps in driver_laps.items():
        laps.sort(key=lambda x: x["lap"])
        valid_times = [l["time"] for l in laps if l["time"]]
        personal_best = min(valid_times) if valid_times else None
        drivers.append(enrich_driver(dn, {
            "laps": laps,
            "personal_best": personal_best,
        }))

    response = {
        "drivers": drivers,
        "total_laps": max_lap,
        "session_best": best_lap,
    }
    if not driver_numbers:
        cache_set(cache_key, response)
    return response


# ============ ANALYTICS: TYRE DEGRADATION ============

async def get_live_tyre_degradation(session_key: str = "latest", driver_numbers: list = None) -> Dict[str, Any]:
    """Get tyre degradation analysis: corrected lap times + linear trend per stint."""
    cache_key = f"tyre_degradation:{session_key}"
    ttl = 30 if session_key == "latest" else 300
    cached = cache_get(cache_key, ttl_override=ttl)
    if cached and not driver_numbers:
        return cached

    laps_raw, stints_raw = await asyncio.gather(
        fetch_openf1("laps", {"session_key": session_key}),
        fetch_openf1("stints", {"session_key": session_key}),
    )

    if not laps_raw or not stints_raw:
        return {"drivers": [], "total_laps": 0}

    # Find total race laps
    all_lap_nums = [l.get("lap_number", 0) for l in laps_raw if l.get("lap_number")]
    total_laps = max(all_lap_nums) if all_lap_nums else 0

    # Group stints by driver
    driver_stints: Dict[int, list] = {}
    for s in stints_raw:
        dn = s.get("driver_number")
        if dn is None:
            continue
        if driver_numbers and dn not in driver_numbers:
            continue
        driver_stints.setdefault(dn, []).append({
            "compound": s.get("compound", "UNKNOWN"),
            "lap_start": s.get("lap_start", 0),
            "lap_end": s.get("lap_end"),
            "stint_number": s.get("stint_number", 1),
        })

    # Group laps by driver
    driver_laps: Dict[int, list] = {}
    for lap in laps_raw:
        dn = lap.get("driver_number")
        if dn is None:
            continue
        if driver_numbers and dn not in driver_numbers:
            continue
        duration = lap.get("lap_duration")
        if not duration:
            continue
        driver_laps.setdefault(dn, []).append({
            "lap": lap.get("lap_number", 0),
            "time": duration,
            "is_pit_out": lap.get("is_pit_out_lap", False),
        })

    def _linear_regression(points):
        """Manual linear regression: returns (slope, intercept) or None."""
        n = len(points)
        if n < 3:
            return None
        sum_x = sum(p[0] for p in points)
        sum_y = sum(p[1] for p in points)
        sum_xy = sum(p[0] * p[1] for p in points)
        sum_x2 = sum(p[0] ** 2 for p in points)
        denom = n * sum_x2 - sum_x ** 2
        if denom == 0:
            return None
        slope = (n * sum_xy - sum_x * sum_y) / denom
        intercept = (sum_y - slope * sum_x) / n
        return slope, intercept

    drivers = []
    for dn, stints in driver_stints.items():
        stints.sort(key=lambda x: x["stint_number"])
        laps = sorted(driver_laps.get(dn, []), key=lambda x: x["lap"])

        if not laps:
            continue

        stint_results = []
        for stint in stints:
            lap_start = stint["lap_start"] or 1
            lap_end = stint["lap_end"] or total_laps

            # Get laps in this stint
            stint_laps = [l for l in laps if lap_start <= l["lap"] <= lap_end]
            if not stint_laps:
                continue

            # Filter out pit out laps
            clean_laps = [l for l in stint_laps if not l.get("is_pit_out")]
            if len(clean_laps) < 2:
                continue

            # Calculate median for outlier filtering
            times = sorted(l["time"] for l in clean_laps)
            median_time = times[len(times) // 2]

            # Filter outliers (>110% of median)
            filtered = [l for l in clean_laps if l["time"] <= median_time * 1.10]
            if len(filtered) < 2:
                filtered = clean_laps  # fallback to unfiltered

            # Fuel correction: subtract 0.03s per remaining lap
            lap_data = []
            for l in filtered:
                corrected = l["time"] - 0.03 * (total_laps - l["lap"])
                lap_data.append({
                    "lap": l["lap"],
                    "raw_time": round(l["time"], 3),
                    "corrected_time": round(corrected, 3),
                })

            # Linear regression on corrected times
            points = [(d["lap"], d["corrected_time"]) for d in lap_data]
            reg = _linear_regression(points)

            deg_rate = None
            trend_line = []
            if reg:
                slope, intercept = reg
                deg_rate = round(slope, 4)  # seconds per lap
                first_lap = lap_data[0]["lap"]
                last_lap = lap_data[-1]["lap"]
                trend_line = [
                    {"lap": first_lap, "time": round(slope * first_lap + intercept, 3)},
                    {"lap": last_lap, "time": round(slope * last_lap + intercept, 3)},
                ]

            stint_results.append({
                "compound": stint["compound"],
                "stint_number": stint["stint_number"],
                "deg_rate": deg_rate,
                "laps": lap_data,
                "trend_line": trend_line,
            })

        if stint_results:
            drivers.append(enrich_driver(dn, {
                "stints": stint_results,
            }))

    response = {"drivers": drivers, "total_laps": total_laps}
    if not driver_numbers:
        cache_set(cache_key, response)
    return response


# ============ LIVE TRACK MAP ============

TRACK_CACHE_DIR = "/app/data/tracks"


async def _get_track_outline(session_key: str) -> Optional[List[Dict]]:
    """Get track outline points from one driver's one complete lap.
    Persisted to disk — fetched from OpenF1 only once ever per session."""
    # 1) In-memory cache (fastest)
    cache_key = f"track_outline:{session_key}"
    cached = cache_get(cache_key, ttl_override=86400)
    if cached:
        return cached

    # 2) File cache (survives restarts)
    cache_file = os.path.join(TRACK_CACHE_DIR, f"{session_key}.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                points = json.load(f)
            if points and len(points) >= 20:
                cache_set(cache_key, points)
                return points
        except (json.JSONDecodeError, IOError):
            pass

    # 3) Fetch from OpenF1 (heavy — only once)
    laps = await fetch_openf1("laps", {
        "session_key": session_key,
        "driver_number": 1,
    })
    if not laps:
        laps = await fetch_openf1("laps", {
            "session_key": session_key,
            "driver_number": 44,
        })
    if not laps:
        return None

    # Find a complete mid-race lap (not first lap, has date_start)
    target_lap = None
    for lap in laps:
        if lap.get("date_start") and lap.get("lap_number", 0) > 2 and lap.get("lap_duration"):
            target_lap = lap
            break
    if not target_lap and laps:
        for lap in laps:
            if lap.get("date_start"):
                target_lap = lap
                break
    if not target_lap:
        return None

    # Fetch location data for that one lap (one driver only)
    dn = target_lap.get("driver_number", 1)
    date_start = target_lap["date_start"]
    location = await fetch_openf1("location", {
        "session_key": session_key,
        "driver_number": dn,
        "date>": date_start,
    })
    if not location:
        return None

    # Downsample to ~250 points
    points_raw = location[:500]
    stride = max(1, len(points_raw) // 250)
    points = [
        {"x": p.get("x", 0), "y": p.get("y", 0)}
        for i, p in enumerate(points_raw) if i % stride == 0
        if p.get("x") is not None and p.get("y") is not None
    ]

    if len(points) < 20:
        return None

    # Save to disk (persist forever)
    try:
        os.makedirs(TRACK_CACHE_DIR, exist_ok=True)
        with open(cache_file, "w") as f:
            json.dump(points, f)
        logger.info(f"Track outline saved to disk: {cache_file} ({len(points)} points)")
    except IOError as e:
        logger.warning(f"Failed to save track outline to disk: {e}")

    cache_set(cache_key, points)
    return points


async def get_live_track_map() -> Dict[str, Any]:
    """Get track outline + car positions.
    Uses lightweight /position API instead of heavy /location.
    Cars are distributed along track outline based on race position."""
    _session_key, _is_demo, _demo_info = await get_fallback_session_key()

    cache_key = f"live_track_map:{_session_key}"
    cached = cache_get(cache_key, ttl_override=3600 if _is_demo else 5)
    if cached:
        return cached

    # Get session info
    session = await get_live_session(_session_key)
    session_key = session.get("session_key")
    if not session_key:
        return {"track": None, "cars": [], "is_demo": _is_demo, "error": "No active session"}

    # Get track outline (persisted to disk — fetched from API only once ever)
    track_points = await _get_track_outline(str(session_key))

    # Fetch ONLY /position (lightweight) — NO /location (thousands of points, crashes VPS)
    position_raw = await fetch_openf1("position", {"session_key": session_key})

    # Latest position per driver
    latest_position = {}
    if position_raw:
        for entry in position_raw:
            dn = entry.get("driver_number")
            if dn is not None:
                if dn not in latest_position or entry.get("date", "") > latest_position[dn].get("date", ""):
                    latest_position[dn] = entry

    # Distribute cars along track outline based on race position
    cars = []
    total_points = len(track_points) if track_points else 0
    sorted_drivers = sorted(latest_position.values(), key=lambda x: x.get("position", 99))

    for i, pos in enumerate(sorted_drivers):
        dn = pos.get("driver_number")
        if dn is None:
            continue
        # Spread cars evenly along ~80% of track (leader at front, P20 behind)
        if total_points > 0:
            idx = int((i / max(len(sorted_drivers), 1)) * total_points * 0.8)
            point = track_points[idx % total_points]
            x, y = point["x"], point["y"]
        else:
            x, y = 0, 0

        cars.append(enrich_driver(dn, {
            "x": x,
            "y": y,
            "position": pos.get("position", 0),
        }))

    cars.sort(key=lambda c: c.get("position", 99))

    response = {
        "track": {"points": track_points} if track_points else None,
        "cars": cars,
        "timestamp": datetime.utcnow().isoformat(),
        "is_demo": _is_demo,
    }
    if _demo_info:
        response["demo_session"] = _demo_info
    cache_set(cache_key, response)
    return response


# ============ SEASON 2025 RESULTS ============

def get_season_results(season: int = 2025) -> Dict[str, Any]:
    """Get full season race results from hardcoded data."""
    races = []

    for rnd, data in sorted(SEASON_2025_RESULTS.items()):
        winner_num = data["podium"][0]
        winner = enrich_driver(winner_num, season=season)
        podium = [enrich_driver(n, season=season) for n in data["podium"]]
        top_10 = [enrich_driver(n, {"position": i + 1}, season=season) for i, n in enumerate(data.get("top_10", data["podium"]))]

        circuit_id = data.get("circuit_id", "")
        circuit_info = CIRCUITS.get(circuit_id, {})

        # VK video: direct link if available, search stanizlavskylive channel as fallback
        vk_url = VK_DIRECT_2025.get(rnd, "")
        race_country = data["name"].replace("Гран-при ", "")
        vk_search_url = f"https://vkvideo.ru/search?q=stanizlavskylive+Формула+1+Гран-При+{race_country.replace(' ', '+')}+2025+Гонка"

        race_entry = {
            "round": rnd,
            "name": data["name"],
            "date": data["date"],
            "circuit_id": circuit_id,
            "circuit_name": circuit_info.get("name", ""),
            "circuit_image": _get_circuit_image(circuit_id),
            "laps": data.get("laps", 0),
            "sprint": data.get("sprint", False),
            "winner": winner,
            "podium": podium,
            "top_10": top_10,
            "vk_url": vk_url,
            "vk_search_url": vk_search_url,
        }

        # Sprint results for sprint weekends
        if data.get("sprint_podium"):
            race_entry["sprint_podium"] = [enrich_driver(n, season=season) for n in data["sprint_podium"]]
            race_entry["sprint_top_10"] = [enrich_driver(n, {"position": i + 1}, season=season) for i, n in enumerate(data.get("sprint_top_10", data["sprint_podium"]))]

        races.append(race_entry)

    return {"season": season, "races": races, "total_races": len(races)}


# ============ RADIO TRANSCRIPTION (Groq Whisper API) ============

async def transcribe_radio_groq(audio_url: str) -> Dict[str, Any]:
    """Transcribe team radio via Groq Whisper API (free tier)."""
    import io

    cache_key = f"radio_transcript:{audio_url}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    if not GROQ_API_KEY:
        return {"text_en": None, "text_ru": None, "error": "not_configured"}

    try:
        client = get_client()

        # Download audio
        audio_resp = await client.get(audio_url, timeout=10.0)
        if audio_resp.status_code != 200:
            return {"text_en": None, "text_ru": None, "error": "audio_download_failed"}

        # Send to Groq Whisper API
        audio_bytes = io.BytesIO(audio_resp.content)
        import httpx as _httpx
        async with _httpx.AsyncClient(timeout=30.0) as groq_client:
            resp = await groq_client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files={"file": ("radio.mp3", audio_bytes, "audio/mpeg")},
                data={"model": "whisper-large-v3", "language": "en", "response_format": "json"},
            )

        if resp.status_code != 200:
            logger.warning(f"Groq API error {resp.status_code}: {resp.text[:200]}")
            return {"text_en": None, "text_ru": None, "error": f"groq_{resp.status_code}"}

        text_en = resp.json().get("text", "").strip()
        if not text_en:
            result = {"text_en": "", "text_ru": None}
            cache_set(cache_key, result)
            return result

        # Translate EN→RU via MyMemory (free, no key needed)
        text_ru = None
        try:
            tr_resp = await client.get(
                "https://api.mymemory.translated.net/get",
                params={"q": text_en[:500], "langpair": "en|ru"},
                timeout=5.0,
            )
            if tr_resp.status_code == 200:
                text_ru = tr_resp.json().get("responseData", {}).get("translatedText")
        except Exception:
            pass

        result = {"text_en": text_en, "text_ru": text_ru}
        cache_set(cache_key, result)
        return result

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return {"text_en": None, "text_ru": None, "error": str(e)}
