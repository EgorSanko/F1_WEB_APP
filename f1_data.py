"""
F1 Hub — F1 Data Integration Layer
Async HTTP client with retry, rate limiting, and data enrichment.
Merges OpenF1 (live) + Ergast/Jolpica (history) into unified responses.
"""

import asyncio
import time
import logging
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple

import httpx

from config import (
    OPENF1_API, ERGAST_API, DRIVERS, TEAM_COLORS, TYRE_COLORS, CACHE_TTL,
    CIRCUIT_IMAGES, CIRCUIT_IMAGE_BASE, DRIVER_PHOTO_BASE, TEAM_ASSETS,
    STANDINGS_2025_DRIVERS, STANDINGS_2025_CONSTRUCTORS
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


# ============ FETCH HELPERS WITH RETRY ============

async def fetch_openf1(
    endpoint: str,
    params: dict = None,
    retries: int = 2,
    retry_delay: float = 1.0,
) -> Optional[Any]:
    """
    Fetch from OpenF1 API with retry logic.
    Returns parsed JSON (list or dict) or None on failure.
    """
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

def enrich_driver(driver_number: int, extra: dict = None) -> dict:
    """Build a full driver info dict from config + optional extra data."""
    info = DRIVERS.get(driver_number, {})
    team = info.get("team", "")

    result = {
        "driver_number": driver_number,
        "name": info.get("name", f"Пилот {driver_number}"),
        "first_name": info.get("name", "").split(" ")[0] if info.get("name") else "",
        "last_name": " ".join(info.get("name", "").split(" ")[1:]) if info.get("name") else "",
        "code": info.get("code", str(driver_number)),
        "team": team,
        "team_color": TEAM_COLORS.get(team, "#888888"),
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
    "bortoleto": 5, "hadjar": 35,
}


def ergast_driver_id_to_number(driver_id: str) -> Optional[int]:
    """Convert Ergast driverId to our driver number."""
    return ERGAST_TO_NUMBER.get(driver_id)


def _get_circuit_image(circuit_id: str) -> str:
    """Get track outline image URL for a circuit."""
    name = CIRCUIT_IMAGES.get(circuit_id, "")
    if name:
        return f"{CIRCUIT_IMAGE_BASE}/{name}.png"
    return ""


# ============ HIGH-LEVEL DATA FUNCTIONS ============

async def get_schedule() -> Dict[str, Any]:
    """Get full season schedule with enriched data."""
    cached = cache_get("schedule")
    if cached:
        return cached

    data = await fetch_ergast("current")
    if not data:
        return {"season": "2025", "races": [], "error": "Failed to fetch schedule"}

    races = data.get("RaceTable", {}).get("Races", [])
    result = []

    for race in races:
        entry = {
            "round": int(race["round"]),
            "name": race["raceName"],
            "circuit": race["Circuit"]["circuitName"],
            "circuit_id": race["Circuit"]["circuitId"],
            "circuit_image": _get_circuit_image(race["Circuit"]["circuitId"]),
            "country": race["Circuit"]["Location"]["country"],
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
        "season": data.get("RaceTable", {}).get("season", "2025"),
        "races": result,
        "total_races": len(result),
    }
    cache_set("schedule", response)
    return response


async def get_next_race() -> Dict[str, Any]:
    """Get the next upcoming race with full details."""
    cached = cache_get("next_race")
    if cached:
        return cached

    schedule = await get_schedule()
    now = datetime.utcnow()

    for race in schedule.get("races", []):
        if race.get("race_datetime"):
            try:
                race_dt = datetime.fromisoformat(race["race_datetime"].replace("Z", ""))
                # Include races up to 6 hours after start (still might be going)
                if race_dt + timedelta(hours=6) > now:
                    cache_set("next_race", race)
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

async def get_driver_standings() -> Dict[str, Any]:
    """Get current driver championship standings."""
    cached = cache_get("standings_drivers")
    if cached:
        return cached

    data = await fetch_ergast("current/driverStandings")
    if not data:
        return {"standings": [], "error": "Failed to fetch standings"}

    standings_lists = data.get("StandingsTable", {}).get("StandingsLists", [])
    if not standings_lists:
        # Fallback: use hardcoded 2025 final standings
        standings = []
        leader_points = 0
        prev_points = 0
        for s in STANDINGS_2025_DRIVERS:
            points = s["points"]
            if not leader_points:
                leader_points = points
            entry = enrich_driver(s["driver_number"], {
                "position": s["position"],
                "points": points,
                "gap_to_leader": round(leader_points - points, 1),
                "gap_to_prev": round(prev_points - points, 1) if prev_points else 0,
                "wins": s.get("wins", 0),
            })
            standings.append(entry)
            prev_points = points
        response = {"standings": standings, "season": "2025", "round": "24", "fallback": True}
        cache_set("standings_drivers", response)
        return response

    standings = []
    leader_points = 0
    prev_points = 0

    for s in standings_lists[0].get("DriverStandings", []):
        points = float(s["points"])
        if not leader_points:
            leader_points = points

        driver_id = s["Driver"].get("driverId", "")
        driver_num = ergast_driver_id_to_number(driver_id) or int(s["Driver"].get("permanentNumber", 0))
        team_name = s["Constructors"][0]["name"] if s.get("Constructors") else ""

        entry = enrich_driver(driver_num, {
            "position": int(s["position"]),
            "points": points,
            "gap_to_leader": round(leader_points - points, 1),
            "gap_to_prev": round(prev_points - points, 1) if prev_points else 0,
            "wins": int(s.get("wins", 0)),
            "nationality": s["Driver"].get("nationality", ""),
            "ergast_id": driver_id,
        })
        standings.append(entry)
        prev_points = points

    response = {
        "standings": standings,
        "season": standings_lists[0].get("season", "2025"),
        "round": standings_lists[0].get("round", ""),
    }
    cache_set("standings_drivers", response)
    return response


async def get_constructor_standings() -> Dict[str, Any]:
    """Get current constructor championship standings."""
    cached = cache_get("standings_constructors")
    if cached:
        return cached

    data = await fetch_ergast("current/constructorStandings")
    if not data:
        return {"standings": [], "error": "Failed to fetch constructor standings"}

    standings_lists = data.get("StandingsTable", {}).get("StandingsLists", [])
    if not standings_lists:
        # Fallback: use hardcoded 2025 final standings
        standings = []
        leader_points = 0
        for s in STANDINGS_2025_CONSTRUCTORS:
            points = s["points"]
            if not leader_points:
                leader_points = points
            team_name = s["team"]
            team_drivers = [
                enrich_driver(num)
                for num, info in DRIVERS.items()
                if info.get("team") == team_name
            ]
            standings.append({
                "position": s["position"],
                "team": team_name,
                "team_color": TEAM_COLORS.get(team_name, "#888"),
                "points": points,
                "gap_to_leader": round(leader_points - points, 1),
                "wins": s.get("wins", 0),
                "drivers": team_drivers,
            })
        response = {"standings": standings, "fallback": True}
        cache_set("standings_constructors", response)
        return response

    standings = []
    leader_points = 0

    for s in standings_lists[0].get("ConstructorStandings", []):
        points = float(s["points"])
        if not leader_points:
            leader_points = points

        team_name = s["Constructor"]["name"]

        # Get drivers for this team
        team_drivers = [
            enrich_driver(num)
            for num, info in DRIVERS.items()
            if info.get("team") == team_name
        ]

        standings.append({
            "position": int(s["position"]),
            "team": team_name,
            "team_color": TEAM_COLORS.get(team_name, "#888"),
            "points": points,
            "gap_to_leader": round(leader_points - points, 1),
            "wins": int(s.get("wins", 0)),
            "nationality": s["Constructor"].get("nationality", ""),
            "drivers": team_drivers,
        })

    response = {"standings": standings}
    cache_set("standings_constructors", response)
    return response


# ============ LIVE DATA (OpenF1) ============

async def get_live_session() -> Dict[str, Any]:
    """Check if there's a live session and get its info."""
    cached = cache_get("live_session")
    if cached:
        return cached

    sessions = await fetch_openf1("sessions", {"session_key": "latest"})
    if not sessions:
        return {"is_live": False, "message": "No session data available"}

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
            # Add 30 min buffer after session end
            is_live = start <= now <= (end + timedelta(minutes=30))
        except (ValueError, TypeError):
            pass

    response = {
        "is_live": is_live,
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
    cache_set("live_session", response)
    return response


async def get_live_positions() -> Dict[str, Any]:
    """Get current positions with tyres and pit stop info — merged from 3 endpoints."""
    cached = cache_get("live_positions")
    if cached:
        return cached

    # Fetch all 3 sources in parallel
    positions_raw, stints_raw, pits_raw = await asyncio.gather(
        fetch_openf1("position", {"session_key": "latest"}),
        fetch_openf1("stints", {"session_key": "latest"}),
        fetch_openf1("pit", {"session_key": "latest"}),
    )

    if not positions_raw:
        return {"positions": [], "count": 0}

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

    response = {"positions": result, "count": len(result)}
    cache_set("live_positions", response)
    return response


async def get_live_timing() -> Dict[str, Any]:
    """Get timing data: laps, sectors, intervals — merged and enriched."""
    cached = cache_get("live_timing")
    if cached:
        return cached

    laps_raw, intervals_raw = await asyncio.gather(
        fetch_openf1("laps", {"session_key": "latest"}),
        fetch_openf1("intervals", {"session_key": "latest"}),
    )

    if not laps_raw:
        return {"timing": [], "session_best": {}}

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
    }
    cache_set("live_timing", response)
    return response


async def get_live_weather() -> Dict[str, Any]:
    """Get current track weather."""
    cached = cache_get("live_weather")
    if cached:
        return cached

    data = await fetch_openf1("weather", {"session_key": "latest"})
    if not data:
        return {"weather": None}

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
        }
    }
    cache_set("live_weather", response)
    return response


async def get_live_race_control() -> Dict[str, Any]:
    """Get race control messages (flags, penalties, etc.)."""
    cached = cache_get("live_race_control")
    if cached:
        return cached

    data = await fetch_openf1("race_control", {"session_key": "latest"})
    if not data:
        return {"messages": []}

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

    response = {"messages": messages}
    cache_set("live_race_control", response)
    return response


async def get_live_radio() -> Dict[str, Any]:
    """Get latest team radio messages."""
    cached = cache_get("live_radio")
    if cached:
        return cached

    data = await fetch_openf1("team_radio", {"session_key": "latest"})
    if not data:
        return {"radio": []}

    radio = []
    for msg in data[-15:]:  # last 15
        dn = msg.get("driver_number")
        radio.append(enrich_driver(dn, {
            "date": msg.get("date", ""),
            "recording_url": msg.get("recording_url", ""),
        }))

    response = {"radio": radio}
    cache_set("live_radio", response)
    return response


async def get_live_pit_stops() -> Dict[str, Any]:
    """Get pit stops from the current session."""
    cached = cache_get("live_pit_stops")
    if cached:
        return cached

    data = await fetch_openf1("pit", {"session_key": "latest"})
    if not data:
        return {"pit_stops": []}

    pit_stops = []
    for p in data:
        dn = p.get("driver_number")
        if dn:
            pit_stops.append(enrich_driver(dn, {
                "date": p.get("date", ""),
                "lap_number": p.get("lap_number"),
                "pit_duration": p.get("pit_duration"),
            }))

    response = {"pit_stops": pit_stops}
    cache_set("live_pit_stops", response)
    return response


# ============ ENRICHED DRIVER PROFILES ============

async def get_driver_profile(driver_number: int) -> Dict[str, Any]:
    """Get full driver profile with season stats from Ergast."""
    if driver_number not in DRIVERS:
        return {"error": "Driver not found"}

    driver = enrich_driver(driver_number)

    # Find Ergast ID for this driver
    ergast_id = None
    for eid, num in ERGAST_TO_NUMBER.items():
        if num == driver_number:
            ergast_id = eid
            break

    if not ergast_id:
        return driver

    # Get driver's season results
    data = await fetch_ergast(f"current/drivers/{ergast_id}/results")
    if data:
        races = data.get("RaceTable", {}).get("Races", [])
        season_results = []
        total_points = 0
        wins = 0
        podiums = 0
        poles = 0  # Would need qualifying data
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

        driver["season_stats"] = {
            "races": len(season_results),
            "points": total_points,
            "wins": wins,
            "podiums": podiums,
            "dnfs": dnfs,
            "best_finish": best_finish if best_finish < 99 else None,
            "results": season_results,
        }

    # Get teammate for comparison
    team = DRIVERS[driver_number]["team"]
    teammate_num = None
    for num, info in DRIVERS.items():
        if info["team"] == team and num != driver_number:
            teammate_num = num
            break

    if teammate_num:
        driver["teammate"] = enrich_driver(teammate_num)

    return driver


# ============ COMBINED DASHBOARD DATA ============

async def get_home_data() -> Dict[str, Any]:
    """
    Get all data needed for the home screen in parallel.
    This is the 'heavy' Stage 2 load.
    """
    next_race, last_race, standings = await asyncio.gather(
        get_next_race(),
        get_last_race(),
        get_driver_standings(),
    )

    return {
        "next_race": next_race,
        "last_race": last_race,
        "standings_top3": {
            "standings": (standings.get("standings") or [])[:3]
        },
    }


async def get_live_dashboard() -> Dict[str, Any]:
    """Get all live data in a single parallel fetch, with cross-enrichment."""
    session, positions, timing, weather, rc = await asyncio.gather(
        get_live_session(),
        get_live_positions(),
        get_live_timing(),
        get_live_weather(),
        get_live_race_control(),
    )

    # Cross-enrich: add current lap to positions for better tyre age
    if positions.get("positions") and timing.get("timing"):
        timing_by_dn = {t["driver_number"]: t for t in timing["timing"]}
        for p in positions["positions"]:
            t = timing_by_dn.get(p["driver_number"])
            if t and t.get("lap_number"):
                # Recalculate tyre age from actual lap number
                stint_start = p.get("_stint_lap_start", 0)
                if stint_start and p.get("tyre_age", 0) == 0:
                    p["tyre_age"] = max(0, t["lap_number"] - stint_start)
                p["current_lap"] = t["lap_number"]

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
        (s.get("lap_end") or s.get("lap_start", 0) for stints in driver_stints.values() for s in stints),
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
