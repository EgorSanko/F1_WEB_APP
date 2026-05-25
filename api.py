"""
F1 Hub — FastAPI Backend (v2 — async with f1_data layer)
All API endpoints with async data fetching, Telegram auth, games, predictions.
"""

import hmac
import hashlib
import json
import time
import logging
import random
from urllib.parse import unquote
from datetime import datetime
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import re
import database as db
import f1_data
from config import (
    normalize_team_name,
    TELEGRAM_TOKEN, WEBAPP_URL, ADMIN_IDS,
    DRIVERS, TEAM_COLORS, TYRE_COLORS,
    PREDICTION_POINTS, ACHIEVEMENTS, GAME_COOLDOWN_SECONDS,
    DEBUG, CACHE_TTL, TEAM_ASSETS, STREAM_LINKS, VK_SERVICE_KEY,
    PAST_RACES_VK, SEASON_2025_RESULTS,
    get_drivers, get_team_colors, CURRENT_SEASON, GROQ_API_KEY,
)

# ============ LOGGING ============
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("f1hub")


# ============ LIFESPAN ============



@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio as _asyncio
    import f1_live

    db.init_db()
    logger.info("F1 Hub API started (v2 async)")

    # Single F1 live-timing upstream (SignalR over WS, ported from f1-dash).
    live_client = f1_live.F1LiveClient()
    f1_live.set_client(live_client)
    app.state.f1_live = live_client
    app.state.f1_live_task = _asyncio.create_task(live_client.run_forever())
    logger.info("F1LiveClient background task started")

    # Cache prewarmer — prime heavy endpoints so first user doesn't wait 3.6s
    async def _prewarm():
        await _asyncio.sleep(1)
        try:
            await f1_data.get_home_data(season=CURRENT_SEASON)
            logger.info("Cache prewarmed: /api/home")
        except Exception as e:
            logger.warning("Prewarm /api/home failed: %s", e)
        try:
            await f1_data.get_schedule(season=CURRENT_SEASON)
            logger.info("Cache prewarmed: /api/schedule")
        except Exception as e:
            logger.warning("Prewarm /api/schedule failed: %s", e)
        # Note: /api/news is parsed inline (championat.com), not in f1_data.
        # It's fast enough and not worth pre-warming.

    app.state.prewarm_task = _asyncio.create_task(_prewarm())

    try:
        yield
    finally:
        logger.info("F1 Hub API shutting down")
        await live_client.shutdown()
        app.state.f1_live_task.cancel()
        try:
            await app.state.f1_live_task
        except (_asyncio.CancelledError, Exception):
            pass
        f1_live.set_client(None)
        await f1_data.close_client()


# ============ APP ============
app = FastAPI(title="F1 Hub API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
import os
_static_base = os.path.join(os.path.dirname(__file__) or ".", "static")
os.makedirs(os.path.join(_static_base, "drivers"), exist_ok=True)
os.makedirs(os.path.join(_static_base, "vendor"), exist_ok=True)
os.makedirs(os.path.join(_static_base, "fonts"), exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_base), name="static_files")

_avatars_dir = os.path.join(os.path.dirname(__file__), "data", "avatars")
os.makedirs(_avatars_dir, exist_ok=True)
app.mount("/avatars", StaticFiles(directory=_avatars_dir), name="avatars")


# ============ RATE LIMITING ============
from collections import defaultdict

_rate_buckets: Dict[str, list] = defaultdict(list)
RATE_LIMIT = 300          # requests per window
RATE_WINDOW = 60          # seconds
RATE_LIMIT_AUTH = 600     # higher limit for authenticated users


def _check_rate_limit(ip: str, authenticated: bool = False) -> bool:
    """Return True if request is allowed, False if rate-limited."""
    now = time.time()
    bucket = _rate_buckets[ip]
    # Prune old entries
    cutoff = now - RATE_WINDOW
    _rate_buckets[ip] = bucket = [t for t in bucket if t > cutoff]
    limit = RATE_LIMIT_AUTH if authenticated else RATE_LIMIT
    if len(bucket) >= limit:
        return False
    bucket.append(now)
    return True


# ============ REQUEST LOGGING MIDDLEWARE ============

from starlette.middleware.base import BaseHTTPMiddleware

class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        # Rate limiting (skip health + static)
        path = request.url.path
        if path.startswith("/api/") and path != "/api/health":
            ip = request.client.host if request.client else "unknown"
            has_auth = bool(request.headers.get("X-Telegram-Init-Data") or
                           request.headers.get("Authorization", "").startswith("TgLogin "))
            if not _check_rate_limit(ip, authenticated=has_auth):
                from starlette.responses import JSONResponse
                return JSONResponse(
                    {"detail": "Too many requests"}, status_code=429,
                    headers={"Retry-After": str(RATE_WINDOW)}
                )

        response = await call_next(request)
        ms = (time.time() - start) * 1000

        # Structured log for API requests (skip static/health)
        if path.startswith("/api/") and path != "/api/health":
            auth_type = "none"
            if request.headers.get("X-Telegram-Init-Data"):
                auth_type = "webapp"
            elif request.headers.get("Authorization", "").startswith("TgLogin "):
                auth_type = "widget"
            logger.info(
                '{"endpoint":"%s","method":"%s","status":%d,"ms":%.1f,"auth":"%s"}',
                path, request.method, response.status_code, ms, auth_type,
            )
        return response

app.add_middleware(RequestLogMiddleware)


# ============ TELEGRAM AUTH ============
# Unified: accepts both WebApp initData AND Login Widget query string.
# WebApp initData: HMAC key = SHA256("WebAppData", BOT_TOKEN), has "user" JSON field
# Login Widget:    HMAC key = SHA256(BOT_TOKEN), has top-level id/first_name/username

AUTH_MAX_AGE = 30 * 86400  # 30 days (RM lesson: 24h silently logged out profiles)


def _validate_webapp_initdata(parsed: Dict[str, str]) -> Dict[str, Any]:
    """Validate WebApp initData (has 'user' field with JSON)."""
    received_hash = parsed.pop("hash", "")
    if not received_hash:
        raise HTTPException(status_code=401, detail="No hash")

    data_check_string = "\n".join(
        f"{k}={parsed[k]}" for k in sorted(parsed.keys())
    )
    secret_key = hmac.new(
        b"WebAppData", TELEGRAM_TOKEN.encode(), hashlib.sha256
    ).digest()
    expected_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(received_hash, expected_hash):
        raise HTTPException(status_code=401, detail="Invalid signature")

    auth_date = int(parsed.get("auth_date", 0))
    if time.time() - auth_date > AUTH_MAX_AGE:
        raise HTTPException(status_code=401, detail="Auth expired")

    user_data = json.loads(parsed.get("user", "{}"))
    if not user_data.get("id"):
        raise HTTPException(status_code=401, detail="No user")
    return user_data


def _validate_login_widget(parsed: Dict[str, str]) -> Dict[str, Any]:
    """Validate Telegram Login Widget auth data (top-level id/first_name/hash)."""
    received_hash = parsed.pop("hash", "")
    if not received_hash:
        raise HTTPException(status_code=401, detail="No hash")

    data_check_string = "\n".join(
        f"{k}={parsed[k]}" for k in sorted(parsed.keys())
    )
    secret_key = hashlib.sha256(TELEGRAM_TOKEN.encode()).digest()
    expected_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(received_hash, expected_hash):
        raise HTTPException(status_code=401, detail="Invalid signature")

    auth_date = int(parsed.get("auth_date", 0))
    if time.time() - auth_date > AUTH_MAX_AGE:
        raise HTTPException(status_code=401, detail="Auth expired")

    uid = parsed.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="No user id")

    return {
        "id": int(uid),
        "first_name": parsed.get("first_name", ""),
        "last_name": parsed.get("last_name", ""),
        "username": parsed.get("username", ""),
        "photo_url": parsed.get("photo_url", ""),
    }


def validate_telegram_data(init_data: str) -> Dict[str, Any]:
    """Validate Telegram auth — auto-detects WebApp initData vs Login Widget."""
    if not init_data:
        if DEBUG:
            return {"id": 999999, "first_name": "Test", "username": "testuser"}
        raise HTTPException(status_code=401, detail="No auth data")

    try:
        parsed = {}
        for part in init_data.split("&"):
            if "=" in part:
                key, value = part.split("=", 1)
                parsed[key] = unquote(value)

        # Auto-detect: WebApp initData has "user" field, Login Widget has "id"
        if "user" in parsed:
            return _validate_webapp_initdata(parsed)
        elif "id" in parsed:
            return _validate_login_widget(parsed)
        else:
            raise HTTPException(status_code=401, detail="Unknown auth format")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Auth failed")


def get_current_user(request: Request) -> Dict[str, Any]:
    """Extract and validate Telegram auth from request.
    Checks X-Telegram-Init-Data header first (WebApp), then Authorization header (Login Widget).
    """
    init_data = request.headers.get("X-Telegram-Init-Data", "")
    if not init_data:
        # Login Widget: frontend sends auth as Authorization: TgLogin <query_string>
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("TgLogin "):
            init_data = auth_header[8:]
    return validate_telegram_data(init_data)


async def fetch_telegram_avatar(user_id: int) -> Optional[str]:
    """Fetch user avatar URL via Telegram Bot API."""
    if not TELEGRAM_TOKEN:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUserProfilePhotos",
                params={"user_id": user_id, "limit": 1}
            )
            data = resp.json()
            if not data.get("ok") or not data["result"]["photos"]:
                return None
            # Get the largest available photo
            photo = data["result"]["photos"][0][-1]
            resp2 = await client.get(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getFile",
                params={"file_id": photo["file_id"]}
            )
            data2 = resp2.json()
            if not data2.get("ok"):
                return None
            return f"https://api.telegram.org/file/bot{TELEGRAM_TOKEN}/{data2['result']['file_path']}"
    except Exception as e:
        logger.debug(f"Failed to fetch avatar for user {user_id}: {e}")
        return None


# ============ HEALTH ============

@app.get("/app/auth-callback", response_class=HTMLResponse)
async def app_auth_callback(request: Request):
    """OAuth callback bridge for the native mobile app.

    Telegram OAuth Login Widget only redirects to HTTPS URLs (registered as
    bot domain via @BotFather /setdomain). This page receives the signed
    payload and bounces it to whatever scheme the app currently uses
    (passed as ?back= param: exp://... in Expo Go, f1hub://... in dev/prod build).
    Falls back to f1hub://auth if `back` is missing.
    """
    import urllib.parse as _u
    params = dict(request.query_params)
    back_raw = params.pop("back", None)
    payload = _u.urlencode(params, safe=":/")
    if back_raw:
        # back already URL-encoded by client when assembling return_to
        sep = "&" if "?" in back_raw else "?"
        deep_link = f"{back_raw}{sep}{payload}" if payload else back_raw
    else:
        deep_link = f"f1hub://auth?{payload}" if payload else "f1hub://auth"
    html = """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>F1 HUB — Возврат в приложение</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;background:#15151E;color:#FAFAFA;font-family:system-ui,sans-serif;
    height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}
  .c{max-width:340px}
  h1{font-size:22px;margin:0 0 12px;font-weight:800}
  p{color:#A0A0B0;font-size:14px;line-height:1.5;margin:0 0 20px}
  a.btn{display:inline-block;background:#E10600;color:#fff;padding:14px 24px;
    border-radius:12px;text-decoration:none;font-weight:700;font-size:15px}
</style>
</head>
<body>
<div class="c">
  <h1>Возвращаемся в приложение…</h1>
  <p>Если это не произошло автоматически, нажми кнопку ниже.</p>
  <a class="btn" href="__DEEPLINK__">Открыть F1 HUB</a>
</div>
<script>
  // Auto-redirect to the mobile app
  setTimeout(function(){ window.location = "__DEEPLINK__"; }, 50);
</script>
</body>
</html>"""
    return HTMLResponse(html.replace("__DEEPLINK__", deep_link))


@app.get("/api/health")
async def health():
    cache = f1_data.cache_stats()
    return {
        "status": "ok",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "cache": cache,
    }


# ============ STATIC ============

@app.get("/")
async def serve_index(request: Request):
    """Serve webapp.html for TG WebApp (f1.lead-seek.ru), public-v2.html for public site (f1hub.lead-seek.ru)."""
    host = request.headers.get("host", "")
    no_cache = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    if "f1hub" in host:
        return FileResponse("public-v2.html", headers=no_cache)
    return FileResponse("webapp.html", headers=no_cache)


@app.get("/{filename}.html")
async def serve_html(filename: str):
    import os
    path = f"{filename}.html"
    if os.path.exists(path):
        return FileResponse(path, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    raise HTTPException(status_code=404)




# ============ NEW SPA ROUTES (post-swap) ============
@app.get("/home-embed")
async def serve_home_embed_new():
    import os
    if os.path.exists("redesign-v2-embed.html"):
        return FileResponse("redesign-v2-embed.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    raise HTTPException(status_code=404)

@app.get("/calendar-embed")
async def serve_calendar_embed_new():
    import os
    if os.path.exists("redesign-calendar-embed.html"):
        return FileResponse("redesign-calendar-embed.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    raise HTTPException(status_code=404)

# Top-level SPA pages (calendar, standings, predict, profile, games, news, highlights, race/N, article)
@app.get("/calendar")
@app.get("/standings")
@app.get("/predict")
@app.get("/profile")
@app.get("/games")
@app.get("/news")
@app.get("/highlights")
@app.get("/article")
@app.get("/race/{rest:path}")
@app.get("/standings/{rest:path}")
async def serve_spa_pages(request: Request, rest: str = ""):
    host = request.headers.get("host", "")
    if "f1hub" not in host:
        # f1.lead-seek.ru webapp doesn't have these pages
        raise HTTPException(status_code=404)
    return FileResponse("public-v2.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


# 301 redirects from old /redesign/v2/* to root
from fastapi.responses import RedirectResponse as _RR
@app.get("/redesign/v2/home-embed-old")
async def _r1(): return _RR("/home-embed", status_code=301)
@app.get("/redesign/v2/calendar-embed-old")
async def _r2(): return _RR("/calendar-embed", status_code=301)

@app.get("/redesign")
async def serve_redesign():
    import os
    if os.path.exists("redesign.html"):
        return FileResponse("redesign.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    raise HTTPException(status_code=404)


@app.get("/redesign/calendar")
async def serve_redesign_calendar():
    import os
    if os.path.exists("redesign-calendar.html"):
        return FileResponse("redesign-calendar.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    raise HTTPException(status_code=404)


@app.get("/redesign/v2/preview")
async def serve_redesign_v2_preview():
    import os
    if os.path.exists("redesign-v2.html"):
        return FileResponse("redesign-v2.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    raise HTTPException(status_code=404)


@app.get("/redesign/v2")
@app.get("/redesign/v2/{rest:path}")
async def serve_public_v2(rest: str = ""):
    """Backward-compat: 301 redirect old /redesign/v2/* to new root paths."""
    from fastapi.responses import RedirectResponse
    target = "/" + rest if rest else "/"
    # Fix legacy embed paths
    if target == "/home-embed-legacy": target = "/home-embed"
    if target == "/calendar-embed-legacy": target = "/calendar-embed"
    return RedirectResponse(url=target, status_code=301)


# ============ USER ============

async def _fetch_tg_photo(user_id: int) -> str | None:
    """Fetch user profile photo from Telegram Bot API, save locally, return static URL."""
    try:
        import httpx, os
        avatar_dir = os.path.join(os.path.dirname(__file__), "data", "avatars")
        os.makedirs(avatar_dir, exist_ok=True)
        local_path = os.path.join(avatar_dir, f"{user_id}.jpg")
        # If already cached locally and < 7 days old, return
        if os.path.exists(local_path):
            import time
            if time.time() - os.path.getmtime(local_path) < 7 * 86400:
                return f"/avatars/{user_id}.jpg"
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUserProfilePhotos",
                                 params={"user_id": user_id, "limit": 1})
            data = r.json()
            photos = data.get("result", {}).get("photos", [])
            if not photos:
                return None
            file_id = photos[0][-1]["file_id"]
            r2 = await client.get(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getFile",
                                  params={"file_id": file_id})
            file_path = r2.json().get("result", {}).get("file_path")
            if not file_path:
                return None
            r3 = await client.get(f"https://api.telegram.org/file/bot{TELEGRAM_TOKEN}/{file_path}")
            if r3.status_code == 200:
                with open(local_path, "wb") as f:
                    f.write(r3.content)
                return f"/avatars/{user_id}.jpg"
    except Exception:
        pass
    return None


@app.get("/api/user/me")
async def user_me(request: Request):
    tg_user = get_current_user(request)
    user = db.get_or_create_user(
        user_id=tg_user["id"],
        username=tg_user.get("username"),
        first_name=tg_user.get("first_name"),
        last_name=tg_user.get("last_name"),
        photo_url=tg_user.get("photo_url"),
    )

    # Always update photo_url from initData (TG sends fresh avatar URL each session)
    tg_photo = tg_user.get("photo_url")
    if tg_photo and tg_photo != user.get("photo_url"):
        user["photo_url"] = tg_photo
        db.execute_write("UPDATE users SET photo_url = ? WHERE user_id = ?", (tg_photo, tg_user["id"]))

    # If still no photo (e.g. Login Widget doesn't send it), fetch from Bot API
    if not user.get("photo_url"):
        bot_photo = await _fetch_tg_photo(tg_user["id"])
        if bot_photo:
            user["photo_url"] = bot_photo
            db.execute_write("UPDATE users SET photo_url = ? WHERE user_id = ?", (bot_photo, tg_user["id"]))

    rank = db.get_user_rank(user["user_id"])
    achievements = db.get_user_achievements(user["user_id"])

    return {
        **user,
        "rank": rank,
        "achievements_list": [a["achievement_key"] for a in achievements],
        "achievements_count": len(achievements),
        "achievements_total": len(ACHIEVEMENTS),
    }


@app.post("/api/auth/widget")
async def auth_widget(request: Request):
    """Validate Login Widget auth data from public site.
    Body: { "auth_data": "id=...&first_name=...&hash=..." }
    Returns user info if valid.
    """
    body = await request.json()
    auth_data = body.get("auth_data", "")
    if not auth_data:
        raise HTTPException(status_code=400, detail="Missing auth_data")
    tg_user = validate_telegram_data(auth_data)
    user = db.get_or_create_user(
        user_id=tg_user["id"],
        username=tg_user.get("username"),
        first_name=tg_user.get("first_name"),
        last_name=tg_user.get("last_name"),
        photo_url=tg_user.get("photo_url"),
    )
    return {"ok": True, "user": user}


@app.post("/api/auth/code")
async def auth_code(request: Request):
    """Validate a one-time login code from /code bot command.
    Body: { "code": "123456" }
    Returns auth token (query string) if valid.
    """
    body = await request.json()
    code = str(body.get("code", "")).strip()
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")
    user_id = db.verify_auth_code(code)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired code")
    user = db.get_or_create_user(user_id=user_id)
    import time, urllib.parse
    params = {
        "id": str(user["user_id"]),
        "first_name": user.get("first_name") or "",
        "username": user.get("username") or "",
        "auth_date": str(int(time.time())),
    }
    # Build a Login-Widget-compatible query string with HMAC hash
    data_check_string = "\n".join(f"{k}={params[k]}" for k in sorted(params))
    secret_key = hashlib.sha256(TELEGRAM_TOKEN.encode()).digest()
    h = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    params["hash"] = h
    token = urllib.parse.urlencode(params)
    return {"ok": True, "token": token, "user": user}

# ============ MOBILE PUSH ============

@app.post("/push/register")
async def push_register(request: Request):
    """Register an Expo push token for the current authenticated user."""
    tg_user = get_current_user(request)
    body = await request.json()
    token = (body.get("token") or "").strip()
    platform = (body.get("platform") or "android").strip()
    if not token.startswith("ExponentPushToken[") and not token.startswith("ExpoPushToken["):
        raise HTTPException(status_code=400, detail="Invalid Expo push token")
    db.execute_write(
        """CREATE TABLE IF NOT EXISTS push_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            expo_token TEXT NOT NULL,
            platform TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, expo_token)
        )"""
    )
    db.execute_write(
        "INSERT OR IGNORE INTO push_tokens (user_id, expo_token, platform) VALUES (?, ?, ?)",
        (tg_user["id"], token, platform),
    )
    return {"ok": True}


@app.delete("/push/register")
async def push_unregister(request: Request):
    """Remove a push token (called on logout)."""
    tg_user = get_current_user(request)
    body = await request.json() if int(request.headers.get("content-length", "0")) else {}
    token = (body.get("token") if isinstance(body, dict) else None) or ""
    if token:
        db.execute_write(
            "DELETE FROM push_tokens WHERE user_id = ? AND expo_token = ?",
            (tg_user["id"], token),
        )
    else:
        db.execute_write("DELETE FROM push_tokens WHERE user_id = ?", (tg_user["id"],))
    return {"ok": True}

@app.get("/push/prefs")
async def push_prefs_get(request: Request):
    """Return current user's push preferences (default: all on)."""
    tg_user = get_current_user(request)
    db.execute_write(
        """CREATE TABLE IF NOT EXISTS push_prefs (
            user_id INTEGER PRIMARY KEY,
            notify_race INTEGER DEFAULT 1,
            notify_review INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )
    rows = db.execute("SELECT notify_race, notify_review FROM push_prefs WHERE user_id = ?", (tg_user["id"],))
    if rows:
        r = rows[0]
        return {"notify_race": bool(r["notify_race"]), "notify_review": bool(r["notify_review"])}
    return {"notify_race": True, "notify_review": True}


@app.post("/push/prefs")
async def push_prefs_set(request: Request):
    """Update current user's push preferences."""
    tg_user = get_current_user(request)
    body = await request.json()
    notify_race = 1 if body.get("notify_race", True) else 0
    notify_review = 1 if body.get("notify_review", True) else 0
    db.execute_write(
        """CREATE TABLE IF NOT EXISTS push_prefs (
            user_id INTEGER PRIMARY KEY,
            notify_race INTEGER DEFAULT 1,
            notify_review INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )"""
    )
    db.execute_write(
        """INSERT INTO push_prefs (user_id, notify_race, notify_review, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
               notify_race=excluded.notify_race,
               notify_review=excluded.notify_review,
               updated_at=CURRENT_TIMESTAMP""",
        (tg_user["id"], notify_race, notify_review),
    )
    return {"notify_race": bool(notify_race), "notify_review": bool(notify_review)}





class BroadcastRequest(BaseModel):
    race_round: int
    session_type: str  # race, qualifying, sprint, sprint_qualifying
    video_url: str
    title: Optional[str] = None
    is_live: bool = False

class FavoriteRequest(BaseModel):
    driver: Optional[int] = None
    team: Optional[str] = None


@app.post("/api/user/favorite")
async def set_favorite(body: FavoriteRequest, request: Request):
    tg_user = get_current_user(request)
    db.update_user_favorite(tg_user["id"], driver=body.driver, team=body.team)
    return {"status": "ok"}


@app.get("/api/user/predictions")
async def user_predictions(request: Request):
    tg_user = get_current_user(request)
    preds = db.get_user_predictions(tg_user["id"])
    # Enrich with race_name from schedule
    seasons_needed = {p["season"] for p in preds}
    race_names = {}
    for s in seasons_needed:
        try:
            sched = await f1_data.get_schedule(season=s)
            for r in sched.get("races", []):
                race_names[(s, r["round"])] = r["name"]
        except Exception:
            pass
    for p in preds:
        p["race_name"] = race_names.get((p["season"], p["race_round"]), "")
    return {"predictions": preds}


@app.get("/api/user/achievements")
async def user_achievements(request: Request):
    tg_user = get_current_user(request)
    achievements = db.get_user_achievements(tg_user["id"])
    return {
        "achievements": [
            {**ACHIEVEMENTS.get(a["achievement_key"], {}), "key": a["achievement_key"], "unlocked_at": a["unlocked_at"]}
            for a in achievements
        ],
        "total": len(ACHIEVEMENTS),
        "all_achievements": ACHIEVEMENTS,
    }


# ============ SCHEDULE & RESULTS (Ergast) ============

@app.get("/api/schedule")
async def get_schedule(season: int = CURRENT_SEASON):
    return await f1_data.get_schedule(season=season)


@app.get("/api/race/next")
async def get_next_race(season: int = CURRENT_SEASON):
    return await f1_data.get_next_race(season=season)


@app.get("/api/race/{round_num}/results")
async def get_race_results(round_num: int, season: int = CURRENT_SEASON):
    result = await f1_data.get_race_results(round_num, season=season)
    if "error" in result and "not found" in result.get("error", "").lower():
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/api/race/{round_num}/qualifying")
async def get_qualifying(round_num: int, season: int = CURRENT_SEASON):
    result = await f1_data.get_qualifying_results(round_num, season=season)
    if "error" in result and "not found" in result.get("error", "").lower():
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/api/race/last")
async def get_last_race():
    return await f1_data.get_last_race()


# ============ COMBINED ENDPOINTS (fewer requests from frontend) ============

@app.get("/api/home")
async def get_home(season: int = CURRENT_SEASON):
    """Combined endpoint: next race + last race + top standings. One call for home screen."""
    return await f1_data.get_home_data(season=season)


@app.get("/api/live/dashboard")
async def get_live_dashboard():
    """Combined endpoint: session + positions + timing + weather + race control."""
    return await f1_data.get_live_dashboard()


@app.get("/api/f1/bundle")
async def f1_bundle(request: Request, season: int = CURRENT_SEASON):
    """Combined bundle for anonymous page load: home + schedule + standings.
    Supports ETag/304 to avoid re-downloading unchanged data."""
    import asyncio as _aio

    home, schedule, drivers_st, constructors_st = await _aio.gather(
        f1_data.get_home_data(season=season),
        f1_data.get_schedule(season=season),
        f1_data.get_driver_standings(season=season),
        f1_data.get_constructor_standings(season=season),
    )
    bundle = {
        "home": home,
        "schedule": schedule,
        "standings": {"drivers": drivers_st, "constructors": constructors_st},
        "season": season,
    }

    # ETag based on content hash
    content = json.dumps(bundle, sort_keys=True, default=str)
    etag = hashlib.md5(content.encode()).hexdigest()

    if_none_match = request.headers.get("if-none-match", "").strip('"')
    if if_none_match == etag:
        from starlette.responses import Response
        return Response(status_code=304, headers={"ETag": f'"{etag}"'})

    from starlette.responses import JSONResponse
    return JSONResponse(
        content=bundle,
        headers={"ETag": f'"{etag}"', "Cache-Control": "public, max-age=60"},
    )


# ============ LIVE DATA ============
# Primary source: F1 SignalR upstream via f1_live.F1LiveClient.
# Fallback:       OpenF1 archive (used when the SignalR stream is offline,
#                 i.e. between race weekends, AND caller asked for a specific
#                 archived session via /api/demo/set).
# Between sessions with no demo override, endpoints return
# {"active": false, ...} so the frontend can show an honest "Нет сессии"
# instead of the old fake Suzuka demo.

@app.get("/api/live/status")
async def live_status():
    """Debug endpoint: snapshot of the SignalR client (connected, topics, errors)."""
    import f1_live
    c = f1_live.get_client()
    if c is None:
        return {"enabled": False}
    snap = c.snapshot()
    snap["enabled"] = True
    return snap


@app.get("/api/live/session")
async def live_session():
    return await f1_data.get_live_session()


@app.get("/api/live/positions")
async def live_positions():
    return await f1_data.get_live_positions()


@app.get("/api/live/timing")
async def live_timing():
    return await f1_data.get_live_timing()


@app.get("/api/live/weather")
async def live_weather():
    return await f1_data.get_live_weather()


@app.get("/api/live/race-control")
async def live_race_control():
    return await f1_data.get_live_race_control()


@app.get("/api/live/track-status")
async def live_track_status():
    """Track flag state (green, yellow, VSC, SC, red) from SignalR."""
    import f1_live
    c = f1_live.get_client()
    if not c or not c.is_session_active():
        return {"active": False, "offline": True, "status": None, "message": "Нет активной сессии"}
    ts = c.topic("TrackStatus") or {}
    # Status codes per F1 SignalR: 1=AllClear, 2=Yellow, 3=?, 4=SC, 5=Red, 6=VSC, 7=VSCEnding
    code = str(ts.get("Status") or "")
    message = ts.get("Message") or ""
    label_map = {
        "1": "Track clear", "2": "Yellow flag", "4": "Safety Car",
        "5": "Red flag", "6": "Virtual Safety Car", "7": "VSC ending",
    }
    return {
        "active": True,
        "is_live": True,
        "source": "signalr",
        "status_code": code,
        "status": label_map.get(code, message or "Unknown"),
        "message": message,
    }


@app.get("/api/live/radio")
async def live_radio():
    data = await f1_data.get_live_radio()
    if data and isinstance(data, dict):
        data["transcription_available"] = bool(GROQ_API_KEY)
    return data


@app.get("/api/radio/transcribe")
async def transcribe_radio(url: str):
    """Transcribe a team radio message via Groq Whisper API."""
    if not GROQ_API_KEY:
        raise HTTPException(503, "Transcription not configured")
    if not url.startswith("https://"):
        raise HTTPException(400, "Invalid audio URL")
    return await f1_data.transcribe_radio_groq(url)


@app.get("/api/live/pit-stops")
async def live_pit_stops():
    return await f1_data.get_live_pit_stops()


# ============ STANDINGS ============

@app.get("/api/standings/drivers")
async def standings_drivers(season: int = CURRENT_SEASON):
    return await f1_data.get_driver_standings(season=season)


@app.get("/api/standings/constructors")
async def standings_constructors(season: int = CURRENT_SEASON):
    data = await f1_data.get_constructor_standings(season=season)
    # Enrich with team assets
    for s in data.get("standings", []):
        assets = TEAM_ASSETS.get(s.get("team", ""), {})
        s["logo_url"] = assets.get("logo", "")
        s["car_url"] = assets.get("car", "")
    return data


# ============ DRIVERS & TEAMS ============

@app.get("/api/drivers")
async def get_drivers_list(season: int = CURRENT_SEASON):
    drivers_dict = get_drivers(season)
    drivers = [f1_data.enrich_driver(num, season=season) for num in drivers_dict]
    return {"drivers": drivers, "season": season}


@app.get("/api/driver/{number}")
async def get_driver(number: int, season: int = CURRENT_SEASON):
    result = await f1_data.get_driver_profile(number, season=season)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    drivers_dict = get_drivers(season)
    name = drivers_dict.get(number, {}).get("name", "")
    result["photo_url_large"] = f1_data.get_driver_photo_url_large(name)
    return result


@app.get("/api/teams")
async def get_teams_list(season: int = CURRENT_SEASON):
    drivers_dict = get_drivers(season)
    colors = get_team_colors(season)
    teams = {}
    for num, info in drivers_dict.items():
        team_name = info["team"]
        if team_name not in teams:
            assets = TEAM_ASSETS.get(team_name, {})
            teams[team_name] = {
                "name": team_name,
                "color": colors.get(team_name, "#888"),
                "logo_url": assets.get("logo", ""),
                "car_url": assets.get("car", ""),
                "drivers": [],
            }
        teams[team_name]["drivers"].append(f1_data.enrich_driver(num, season=season))
    return {"teams": list(teams.values()), "season": season}


# ============ PREDICTIONS ============

class PredictionRequest(BaseModel):
    race_round: int
    season: int = 2026
    prediction_type: str
    prediction_value: Any
    points_bet: int = 0




# ============ CAREER STATS (Ergast/Jolpica) ============
import sqlite3, os, json as _json, time
_career_cache = {}  # in-memory: { key: (expires_at, data) }
_CAREER_TTL = 86400  # 7 days — career rarely changes
_CAREER_DB = os.path.join(os.path.dirname(__file__), "data", "career_cache.db")

def _career_db():
    conn = sqlite3.connect(_CAREER_DB)
    conn.execute("CREATE TABLE IF NOT EXISTS career_cache (key TEXT PRIMARY KEY, data TEXT, updated_at INTEGER)")
    return conn

def _career_get(key):
    """Try in-memory then SQLite."""
    now = time.time()
    if key in _career_cache:
        exp, data = _career_cache[key]
        if exp > now:
            return data
    try:
        conn = _career_db()
        row = conn.execute("SELECT data, updated_at FROM career_cache WHERE key=?", (key,)).fetchone()
        conn.close()
        if row and row[1] + _CAREER_TTL > now:
            data = _json.loads(row[0])
            _career_cache[key] = (row[1] + _CAREER_TTL, data)
            return data
    except Exception:
        pass
    return None

def _career_set(key, data):
    now = time.time()
    _career_cache[key] = (now + _CAREER_TTL, data)
    try:
        conn = _career_db()
        conn.execute("INSERT OR REPLACE INTO career_cache (key, data, updated_at) VALUES (?, ?, ?)",
                     (key, _json.dumps(data), int(now)))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"career cache write failed: {e}")

async def _cached(key, fetcher):
    cached = _career_get(key)
    if cached is not None:
        return cached
    data = await fetcher()
    if data is not None:
        career = data.get("career") if isinstance(data, dict) else None
        # Only cache if data looks complete (seasons_count > 0 indicates seasons fetch succeeded)
        if career and career.get("seasons_count", 0) > 0:
            _career_set(key, data)
    return data


@app.get("/api/driver/career/{driver_id}")
async def get_driver_career(driver_id: str):
    """Career stats for a driver via Jolpica/Ergast (championships, wins, podiums, poles, races)."""
    async def _fetch():
        from f1_data import fetch_ergast
        # 1) Basic profile
        prof = await fetch_ergast(f"drivers/{driver_id}")
        drivers = (prof or {}).get("DriverTable", {}).get("Drivers", []) if prof else []
        if not drivers:
            return None
        d = drivers[0]
        import asyncio
        # Chunked to respect Ergast rate limit (4/s)
        calls = [
            fetch_ergast(f"drivers/{driver_id}/results/1", limit=1),
            fetch_ergast(f"drivers/{driver_id}/results", limit=1),
            fetch_ergast(f"drivers/{driver_id}/qualifying/1", limit=1),
            fetch_ergast(f"drivers/{driver_id}/results/2", limit=1),
            fetch_ergast(f"drivers/{driver_id}/results/3", limit=1),
            fetch_ergast(f"drivers/{driver_id}/seasons", limit=100),
        ]
        results = []
        for i in range(0, len(calls), 3):
            results.extend(await asyncio.gather(*calls[i:i+3]))
        wins, races, poles, p2, p3, seasons_data = results
        # Driver championships — historical facts, hardcoded for reliability
        DRIVER_CHAMPS = {
            "hamilton": 7, "max_verstappen": 4, "alonso": 2,
            "schumacher": 7, "fangio": 5, "vettel": 4, "prost": 4,
            "lauda": 3, "stewart": 3, "piquet": 3, "brabham": 3, "senna": 3,
            "rosberg": 1, "raikkonen": 1, "button": 1, "hakkinen": 2,
            "damon_hill": 1, "villeneuve": 1, "mansell": 1, "andretti": 1,
            "hunt": 1, "fittipaldi": 2, "rindt": 1, "stewart": 3,
            "graham_hill": 2, "clark": 2, "hill": 1, "ascari": 2,
            "farina": 1, "n_rosberg": 1, "scheckter": 1, "jones": 1,
            "kjones": 1, "surtees": 1,
        }
        championships = DRIVER_CHAMPS.get(driver_id, 0)
        seasons = (seasons_data or {}).get("SeasonTable", {}).get("Seasons", []) if seasons_data else []
        career_wins = int(wins.get("total", 0)) if wins else 0
        total_races = int(races.get("total", 0)) if races else 0
        career_poles = int(poles.get("total", 0)) if poles else 0
        podiums = career_wins + (int(p2.get("total", 0)) if p2 else 0) + (int(p3.get("total", 0)) if p3 else 0)
        debut = int(seasons[0]["season"]) if seasons else None
        return {
            "driver_id": driver_id,
            "given_name": d.get("givenName"),
            "family_name": d.get("familyName"),
            "date_of_birth": d.get("dateOfBirth"),
            "nationality": d.get("nationality"),
            "permanent_number": d.get("permanentNumber"),
            "code": d.get("code"),
            "wiki_url": d.get("url"),
            "career": {
                "championships": championships,
                "wins": career_wins,
                "podiums": podiums,
                "poles": career_poles,
                "races": total_races,
                "debut_season": debut,
                "seasons_count": len(seasons),
            },
        }
    data = await _cached(f"drv_career_{driver_id}", _fetch)
    if not data:
        raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found in Ergast")
    return data


@app.get("/api/team/career/{constructor_id}")
async def get_team_career(constructor_id: str):
    """Career stats for a constructor via Jolpica/Ergast."""
    async def _fetch():
        from f1_data import fetch_ergast
        prof = await fetch_ergast(f"constructors/{constructor_id}")
        teams = (prof or {}).get("ConstructorTable", {}).get("Constructors", []) if prof else []
        if not teams:
            return None
        t = teams[0]
        import asyncio
        # Team championships also need per-season counting since Jolpica requires season_year
        t_calls = [
            fetch_ergast(f"constructors/{constructor_id}/results/1", limit=1),
            fetch_ergast(f"constructors/{constructor_id}/results", limit=1),
            fetch_ergast(f"constructors/{constructor_id}/qualifying/1", limit=1),
            fetch_ergast(f"constructors/{constructor_id}/seasons", limit=100),
        ]
        t_results = []
        for i in range(0, len(t_calls), 3):
            t_results.extend(await asyncio.gather(*t_calls[i:i+3]))
        wins, races, poles, seasons_data = t_results
        # Constructor championships — hardcoded historical facts
        TEAM_CHAMPS = {
            "ferrari": 16, "williams": 9, "mclaren": 9, "mercedes": 8,
            "lotus_f1": 0, "lotus": 7, "team_lotus": 7, "red_bull": 6, "cooper": 2,
            "brabham": 2, "tyrrell": 1, "matra": 1, "brawn": 1,
            "renault": 2, "alpine": 2, "vanwall": 1, "bmw_sauber": 0,
            "benetton": 1,
        }
        championships = TEAM_CHAMPS.get(constructor_id, 0)
        seasons = (seasons_data or {}).get("SeasonTable", {}).get("Seasons", []) if seasons_data else []
        career_wins = int(wins.get("total", 0)) if wins else 0
        total_races = int(races.get("total", 0)) if races else 0
        career_poles = int(poles.get("total", 0)) if poles else 0
        debut = int(seasons[0]["season"]) if seasons else None
        return {
            "constructor_id": constructor_id,
            "name": t.get("name"),
            "nationality": t.get("nationality"),
            "wiki_url": t.get("url"),
            "career": {
                "championships": championships,
                "wins": career_wins,
                "poles": career_poles,
                "races": total_races,
                "debut_season": debut,
                "seasons_count": len(seasons),
            },
        }
    data = await _cached(f"team_career_{constructor_id}", _fetch)
    if not data:
        raise HTTPException(status_code=404, detail=f"Constructor {constructor_id} not found in Ergast")
    return data


@app.get("/api/predictions/available")
async def predictions_available(request: Request):
    tg_user = get_current_user(request)
    next_race = await f1_data.get_next_race()

    if "round" not in next_race:
        return {"available": False, "message": "No upcoming race"}

    existing = db.get_user_predictions(tg_user["id"], next_race["round"], CURRENT_SEASON)
    existing_types = {p["prediction_type"] for p in existing}

    types = [
        {"type": "winner", "label": "Победитель гонки", "description": "Выбери 1 пилота", "max_points": 50},
        {"type": "podium", "label": "Подиум (TOP-3)", "description": "Выбери 3 пилотов", "max_points": 100},
        {"type": "fastest_lap", "label": "Быстрый круг", "description": "Кто покажет лучший круг?", "max_points": 30},
        {"type": "dnf_count", "label": "Количество DNF", "description": "Сколько сходов будет?", "max_points": 40},
        {"type": "safety_car", "label": "Safety Car", "description": "Будет ли машина безопасности?", "max_points": 20},
    ]

    return {
        "available": True,
        "race": next_race,
        "predictions": [{**t, "already_predicted": t["type"] in existing_types} for t in types],
        "drivers": [f1_data.enrich_driver(num, season=CURRENT_SEASON) for num in get_drivers(CURRENT_SEASON)],
    }


@app.post("/api/predictions/make")
async def make_prediction(body: PredictionRequest, request: Request):
    tg_user = get_current_user(request)

    valid_types = {"winner", "podium", "fastest_lap", "dnf_count", "safety_car"}
    if body.prediction_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid type: {body.prediction_type}")

    val = body.prediction_value
    if body.prediction_type == "winner" and not isinstance(val, int):
        raise HTTPException(status_code=400, detail="Winner must be driver number")
    if body.prediction_type == "podium" and (not isinstance(val, list) or len(val) != 3):
        raise HTTPException(status_code=400, detail="Podium must be 3 driver numbers")
    if body.prediction_type == "safety_car" and val not in [True, False, "yes", "no"]:
        raise HTTPException(status_code=400, detail="Safety car: yes/no")

    pred_id = db.create_prediction(
        user_id=tg_user["id"],
        race_round=body.race_round,
        season=body.season,
        prediction_type=body.prediction_type,
        prediction_value=val,
        points_bet=body.points_bet,
    )

    db.execute_write(
        "UPDATE users SET predictions_total = predictions_total + 1 WHERE user_id = ?",
        (tg_user["id"],)
    )
    new_achievements = db.check_and_award_achievements(tg_user["id"])

    return {"status": "ok", "prediction_id": pred_id, "new_achievements": new_achievements}


@app.get("/api/predictions/results")
async def prediction_results(request: Request):
    tg_user = get_current_user(request)
    preds = db.get_user_predictions(tg_user["id"])
    settled = [p for p in preds if p["status"] != "pending"]
    pending = [p for p in preds if p["status"] == "pending"]
    return {
        "settled": settled,
        "pending": pending,
        "total_won": sum(p.get("points_won", 0) for p in settled),
    }


# ============ GAMES ============

@app.get("/api/games/status")
async def games_status(request: Request):
    tg_user = get_current_user(request)
    game_types = ["pit_stop", "guess_track", "reaction", "quiz"]
    return {"games": {gt: db.can_play_game(tg_user["id"], gt) for gt in game_types}}


class GameResultRequest(BaseModel):
    game_type: str
    score: int
    details: Optional[str] = None


@app.post("/api/games/result")
async def submit_game_result(body: GameResultRequest, request: Request):
    tg_user = get_current_user(request)

    valid_games = {"pit_stop", "guess_track", "reaction", "quiz"}
    if body.game_type not in valid_games:
        raise HTTPException(status_code=400, detail="Invalid game type")

    status = db.can_play_game(tg_user["id"], body.game_type)
    if not status["can_play"]:
        raise HTTPException(status_code=429, detail=f"Cooldown: {status['seconds_left']}s left")

    points = _calc_game_points(body.game_type, body.score)
    db.record_game(tg_user["id"], body.game_type, body.score, points, body.details)

    new_achievements = db.check_and_award_achievements(tg_user["id"])

    if body.game_type == "pit_stop" and body.score < 2000:
        if db.unlock_achievement(tg_user["id"], "pit_master"):
            new_achievements.append("pit_master")
    if body.game_type == "reaction" and body.score < 200:
        if db.unlock_achievement(tg_user["id"], "reaction_god"):
            new_achievements.append("reaction_god")

    return {"status": "ok", "points_earned": points, "new_achievements": new_achievements}


@app.get("/api/games/leaderboard")
async def games_leaderboard(request: Request, game_type: str = "reaction"):
    """Leaderboard of best scores (personal records) for a game type.
    For reaction/pit_stop: lower is better."""
    valid = {"reaction", "pit_stop"}
    if game_type not in valid:
        raise HTTPException(status_code=400, detail="Invalid game type")
    # Best score per user (MIN for reaction & pit_stop = lower is better)
    rows = db.execute("""
        SELECT g.user_id, MIN(g.score) as best_score, COUNT(*) as attempts,
               u.first_name, u.last_name, u.username, u.photo_url
        FROM games g
        JOIN users u ON u.user_id = g.user_id
        WHERE g.game_type = ? AND g.score > 0
        GROUP BY g.user_id
        ORDER BY best_score ASC
        LIMIT 50
    """, (game_type,))
    # Current user's personal best
    my_best = None
    try:
        tg_user = get_current_user(request)
        my = db.execute_one(
            "SELECT MIN(score) as best FROM games WHERE user_id = ? AND game_type = ? AND score > 0",
            (tg_user["id"], game_type)
        )
        my_best = my["best"] if my else None
    except Exception:
        pass
    return {
        "leaderboard": [{
            "rank": i + 1,
            "user_id": r["user_id"],
            "first_name": r["first_name"],
            "last_name": r.get("last_name"),
            "photo_url": r["photo_url"],
            "best_score": r["best_score"],
            "attempts": r["attempts"],
        } for i, r in enumerate(rows)],
        "my_best": my_best,
    }


def _calc_game_points(game_type: str, score: int) -> int:
    return 0  # Games are for fun only, points only from predictions


# ============ QUIZ ============

QUIZ_QUESTIONS = [
    {"q": "Кто является самым молодым чемпионом мира в F1?",
     "opts": ["Sebastian Vettel", "Max Verstappen", "Lewis Hamilton", "Fernando Alonso"], "a": 0, "cat": "history"},
    {"q": "Сколько чемпионских титулов у Lewis Hamilton?",
     "opts": ["6", "7", "8", "5"], "a": 1, "cat": "stats"},
    {"q": "Какая трасса самая длинная в календаре F1?",
     "opts": ["Spa-Francorchamps", "Jeddah", "Monza", "Silverstone"], "a": 0, "cat": "tracks"},
    {"q": "Какой цвет у шин SOFT?",
     "opts": ["Жёлтый", "Белый", "Красный", "Зелёный"], "a": 2, "cat": "rules"},
    {"q": "Что означает синий флаг?",
     "opts": ["Пропусти обгоняющего", "Опасность на трассе", "Конец сессии", "DRS активирован"], "a": 0, "cat": "rules"},
    {"q": "В каком году Ferrari последний раз выиграла Кубок конструкторов?",
     "opts": ["2007", "2008", "2004", "2010"], "a": 1, "cat": "history"},
    {"q": "Какая команда базируется в Маранелло?",
     "opts": ["McLaren", "Red Bull Racing", "Ferrari", "Mercedes"], "a": 2, "cat": "teams"},
    {"q": "Сколько длится пит-стоп в среднем (смена шин)?",
     "opts": ["~2.5 секунды", "~5 секунд", "~10 секунд", "~1 секунда"], "a": 0, "cat": "rules"},
    {"q": "Сколько очков получает победитель гонки?",
     "opts": ["20", "25", "30", "15"], "a": 1, "cat": "rules"},
    {"q": "Кто выиграл больше всего гонок в истории F1?",
     "opts": ["Michael Schumacher", "Lewis Hamilton", "Ayrton Senna", "Alain Prost"], "a": 1, "cat": "history"},
    {"q": "Какой компаунд шин самый мягкий?",
     "opts": ["Medium", "Hard", "Soft", "Intermediate"], "a": 2, "cat": "rules"},
    {"q": "На какой трассе проходит Гран-при Монако?",
     "opts": ["Circuit de Monaco", "Monza", "Silverstone", "Hungaroring"], "a": 0, "cat": "tracks"},
    {"q": "Что такое DRS?",
     "opts": ["Drag Reduction System", "Driver Radio System", "Data Recording System", "Digital Race Strategy"], "a": 0, "cat": "rules"},
    {"q": "Сколько команд в F1 сезоне 2025?",
     "opts": ["8", "10", "12", "11"], "a": 1, "cat": "stats"},
    {"q": "Какая максимальная скорость болида F1?",
     "opts": ["~300 км/ч", "~370 км/ч", "~250 км/ч", "~400 км/ч"], "a": 1, "cat": "stats"},
]


@app.get("/api/quiz/question")
async def quiz_question():
    idx = random.randint(0, len(QUIZ_QUESTIONS) - 1)
    q = QUIZ_QUESTIONS[idx]
    return {"question": q["q"], "options": q["opts"], "category": q["cat"], "question_id": idx}


class QuizAnswerRequest(BaseModel):
    question_id: int
    answer: int


@app.post("/api/quiz/answer")
async def quiz_answer(body: QuizAnswerRequest):
    if body.question_id < 0 or body.question_id >= len(QUIZ_QUESTIONS):
        raise HTTPException(status_code=400, detail="Invalid question")
    q = QUIZ_QUESTIONS[body.question_id]
    correct = body.answer == q["a"]
    return {"correct": correct, "correct_answer": q["a"], "explanation": q["opts"][q["a"]]}


# ============ LEADERBOARD ============

@app.get("/api/leaderboard")
async def leaderboard(request: Request):
    board = db.get_leaderboard()
    try:
        tg_user = get_current_user(request)
        user_rank = db.get_user_rank(tg_user["id"])
        user = db.execute_one("SELECT points FROM users WHERE user_id = ?", (tg_user["id"],))
    except Exception:
        user_rank = None
        user = None

    return {
        "leaderboard": board,
        "user_rank": user_rank,
        "user_points": user["points"] if user else None,
    }


# ============ NEWS (from championat.com + Telegram fallback) ============

@app.get("/api/news")
async def get_news():
    """Parse F1 news from championat.com with Telegram fallback."""
    cached = f1_data.cache_get("news")
    if cached:
        return cached

    posts = []
    source = "championat.com"

    # --- PRIMARY: championat.com ---
    try:
        client = f1_data.get_client()
        resp = await client.get(
            "https://www.championat.com/auto/_f1.html",
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            timeout=10.0,
        )
        if resp.status_code == 200:
            html = resp.text
            # Find all article-preview blocks
            previews = re.finditer(
                r'class="article-preview"[^>]*>.*?class="article-preview__details".*?</div>\s*</div>',
                html, re.DOTALL
            )
            for match in previews:
                block = match.group(0)
                post = {}

                # URL + title
                title_match = re.search(
                    r'<a class="article-preview__title"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
                    block, re.DOTALL
                )
                if title_match:
                    url = title_match.group(1).strip()
                    if not url.startswith("http"):
                        url = "https://www.championat.com" + url
                    post["url"] = url
                    post["title"] = re.sub(r'<[^>]+>', '', title_match.group(2)).strip()

                # Subtitle / preview
                sub_match = re.search(
                    r'<a class="article-preview__subtitle"[^>]*>(.*?)</a>',
                    block, re.DOTALL
                )
                if sub_match:
                    post["preview"] = re.sub(r'<[^>]+>', '', sub_match.group(1)).strip()

                # Photo
                img_match = re.search(r'data-src="([^"]+)"', block)
                if img_match:
                    photo_url = img_match.group(1)
                    # Use medium size for cards
                    photo_url = re.sub(r'/s/\d+x\d+/', '/s/640x427/', photo_url)
                    post["photo"] = photo_url

                # Date
                date_match = re.search(
                    r'class="article-preview__date"[^>]*>(.*?)</div>',
                    block, re.DOTALL
                )
                if date_match:
                    post["date_text"] = date_match.group(1).strip()

                if post.get("title"):
                    posts.append(post)

            if posts:
                logger.info(f"Championat.com: parsed {len(posts)} articles")
    except Exception as e:
        logger.error(f"Championat.com fetch error: {e}")

    # --- FALLBACK: Telegram channel ---
    if not posts:
        source = "@stanizlavsky"
        try:
            client = f1_data.get_client()
            resp = await client.get(
                "https://t.me/s/stanizlavsky",
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                timeout=10.0,
            )
            if resp.status_code == 200:
                html = resp.text
                msg_blocks = re.findall(
                    r'<div class="tgme_widget_message_wrap[^"]*"[^>]*>.*?</div>\s*</div>\s*</div>\s*</div>',
                    html, re.DOTALL
                )
                for block in msg_blocks[-20:]:
                    post = {}
                    post_match = re.search(r'data-post="([^"]+)"', block)
                    if post_match:
                        post["url"] = f"https://t.me/{post_match.group(1)}"
                    text_match = re.search(
                        r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>',
                        block, re.DOTALL
                    )
                    if text_match:
                        text = re.sub(r'<br\s*/?>', '\n', text_match.group(1))
                        text = re.sub(r'<[^>]+>', '', text).strip()
                        lines = text.split('\n')
                        post["title"] = lines[0][:200] if lines else text[:200]
                        post["preview"] = ' '.join(lines[1:]).strip()[:300] if len(lines) > 1 else ''
                    photo_match = re.search(r"background-image:url\('([^']+)'\)", block)
                    if photo_match:
                        post["photo"] = photo_match.group(1)
                    date_match = re.search(r'<time[^>]*datetime="([^"]+)"', block)
                    if date_match:
                        post["date_text"] = date_match.group(1)
                    if post.get("title"):
                        posts.append(post)
        except Exception as e:
            logger.error(f"Telegram news fallback error: {e}")

    response = {
        "posts": posts[:25],
        "source": source,
        "source_url": "https://www.championat.com/auto/_f1.html" if source == "championat.com" else "https://t.me/stanizlavsky",
    }
    if posts:
        f1_data.cache_set("news", response)
    return response


@app.get("/api/news/article")
async def get_article(url: str):
    """Parse full article text from championat.com."""
    if not url:
        return {"error": "no_url"}

    cache_key = f"article:{url}"
    cached = f1_data.cache_get(cache_key)
    if cached:
        return cached

    try:
        client = f1_data.get_client()
        resp = await client.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            timeout=10.0,
            follow_redirects=True,
        )
        if resp.status_code != 200:
            return {"error": "not_found"}

        html = resp.text

        # Title
        title_match = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.DOTALL)
        title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else ""

        # Date
        date_match = re.search(r'<time[^>]*datetime="([^"]*)"', html)
        date = date_match.group(1) if date_match else ""

        # OG image
        og_image = re.search(r'<meta property="og:image" content="([^"]*)"', html)
        image = og_image.group(1) if og_image else ""

        # Article content — extract from article-content div with proper nesting
        content_html = ""
        for marker in ["article-content", "article__content", "content__body"]:
            start = html.find(marker)
            if start < 0:
                continue
            # Find the > that closes the opening tag
            tag_end = html.find(">", start)
            if tag_end < 0:
                continue
            pos = tag_end + 1
            depth = 1
            while depth > 0 and pos < len(html):
                next_open = html.find("<div", pos)
                next_close = html.find("</div>", pos)
                if next_close == -1:
                    break
                if next_open != -1 and next_open < next_close:
                    depth += 1
                    pos = next_open + 4
                else:
                    depth -= 1
                    if depth == 0:
                        content_html = html[tag_end + 1:next_close]
                    pos = next_close + 6
            if content_html:
                break

        if not content_html:
            # Fallback: collect all meaningful <p> tags
            paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', html, re.DOTALL)
            paragraphs = [p for p in paragraphs if len(re.sub(r'<[^>]+>', '', p).strip()) > 50]
            content_html = '\n'.join(f'<p>{p}</p>' for p in paragraphs[:30])

        # Clean: remove scripts, styles, ads, iframes
        for tag in ['script', 'style', 'iframe']:
            content_html = re.sub(rf'<{tag}[^>]*>.*?</{tag}>', '', content_html, flags=re.DOTALL)
        for cls in ['banner', 'advert', 'promo', 'related']:
            content_html = re.sub(rf'<div[^>]*class="[^"]*{cls}[^"]*"[^>]*>.*?</div>', '', content_html, flags=re.DOTALL)

        # Extract clean paragraphs
        raw_paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', content_html, re.DOTALL)
        clean_paragraphs = []
        for p in raw_paragraphs:
            text = re.sub(r'<(?!/?(?:strong|em|b|i|a)\b)[^>]+>', '', p).strip()
            if text and len(text) > 10:
                clean_paragraphs.append(text)

        # Also extract blockquotes
        quotes = re.findall(r'<blockquote[^>]*>(.*?)</blockquote>', content_html, re.DOTALL)
        clean_quotes = [re.sub(r'<[^>]+>', '', q).strip() for q in quotes if len(re.sub(r'<[^>]+>', '', q).strip()) > 10]

        result = {
            "title": title,
            "date": date,
            "image": image,
            "paragraphs": clean_paragraphs,
            "quotes": clean_quotes,
            "source_url": url,
            "source": "championat.com",
        }

        f1_data.cache_set(cache_key, result)
        return result

    except Exception as e:
        logger.error(f"Article parse error: {e}")
        return {"error": str(e)}


# ============ STREAMS (from VK Video) ============

@app.get("/api/streams")
async def get_streams():
    """Fetch F1 videos from YouTube RSS feeds + channel links."""
    cached = f1_data.cache_get("streams")
    if cached:
        return cached

    videos = []
    try:
        client = f1_data.get_client()

        # YouTube RSS feeds (no API key needed)
        yt_feeds = [
            "https://www.youtube.com/feeds/videos.xml?channel_id=UCB_qr75-ydFVKSF9Dmo6izg",  # Formula 1 Official
        ]

        for feed_url in yt_feeds:
            resp = await client.get(feed_url, timeout=10.0)
            if resp.status_code == 200:
                xml = resp.text
                # Parse Atom feed entries
                entries = re.findall(r'<entry>(.*?)</entry>', xml, re.DOTALL)
                for entry_xml in entries[:15]:
                    title_m = re.search(r'<title>([^<]+)</title>', entry_xml)
                    vid_id_m = re.search(r'<yt:videoId>([^<]+)</yt:videoId>', entry_xml)
                    published_m = re.search(r'<published>([^<]+)</published>', entry_xml)
                    views_m = re.search(r'<media:statistics views="(\d+)"', entry_xml)

                    if title_m and vid_id_m:
                        vid_id = vid_id_m.group(1)
                        videos.append({
                            "title": title_m.group(1),
                            "thumbnail": f"https://i.ytimg.com/vi/{vid_id}/mqdefault.jpg",
                            "url": f"https://www.youtube.com/watch?v={vid_id}",
                            "duration": 0,
                            "views": int(views_m.group(1)) if views_m else 0,
                            "is_live": False,
                            "date": published_m.group(1) if published_m else "",
                            "platform": "youtube",
                        })
            else:
                logger.warning(f"YouTube RSS fetch failed: {resp.status_code}")

    except Exception as e:
        logger.error(f"Streams fetch error: {e}")

    response = {
        "videos": videos[:15],
        "channels": STREAM_LINKS,
        "channel_url": "https://vkvideo.ru/@stanizlavskylive",
        "channel_name": "@stanizlavskylive",
    }
    if videos:
        f1_data.cache_set("streams", response)
    return response


# ============ PAST RACES VK ============

@app.get("/api/past-races-vk")
async def get_past_races_vk():
    """Return list of past race VK video recording links."""
    return {"races": PAST_RACES_VK}


@app.get("/api/season/{season}/results")
async def get_season_results(season: int):
    """Get full season results with podiums, top-10, VK links."""
    if season == 2025:
        return f1_data.get_season_results(season)
    return {"season": season, "races": [], "not_started": True}


@app.get("/api/race/{round_num}/tyres")
async def get_race_tyres(round_num: int, season: int = 2026):
    """Get tyre strategy data for a specific race round."""
    if season != 2025:
        raise HTTPException(status_code=404, detail=f"No tyre data for season {season}")
    race = SEASON_2025_RESULTS.get(round_num)
    if not race:
        raise HTTPException(status_code=404, detail=f"Race round {round_num} not found")
    session_key = race.get("session_key")
    if not session_key:
        raise HTTPException(status_code=404, detail=f"No session_key for round {round_num}")
    return await f1_data.get_race_strategy(str(session_key))


# ============ ANALYTICS ENDPOINTS ============

@app.get("/api/analytics/strategy")
async def analytics_strategy(session_key: str = "latest"):
    """Tyre strategy visualization data."""
    return await f1_data.get_race_strategy(session_key)


@app.get("/api/analytics/positions")
async def analytics_positions(session_key: str = "latest"):
    """Position change chart data."""
    return await f1_data.get_race_position_chart(session_key)


@app.get("/api/analytics/laptimes")
async def analytics_laptimes(session_key: str = "latest", drivers: str = ""):
    """Lap time comparison data. drivers=1,44,16 to filter."""
    driver_numbers = None
    if drivers:
        try:
            driver_numbers = [int(x.strip()) for x in drivers.split(",") if x.strip()]
        except ValueError:
            pass
    return await f1_data.get_race_laptimes(session_key, driver_numbers)


@app.get("/api/analytics/degradation")
async def analytics_degradation(session_key: str = "latest", drivers: str = ""):
    """Tyre degradation analysis with fuel-corrected times and trend lines."""
    driver_numbers = None
    if drivers:
        try:
            driver_numbers = [int(x.strip()) for x in drivers.split(",") if x.strip()]
        except ValueError:
            pass
    return await f1_data.get_live_tyre_degradation(session_key, driver_numbers)


@app.get("/api/analytics/telemetry/drivers")
async def telemetry_drivers(session_key: str = "latest"):
    """List drivers available in a session for telemetry comparison."""
    return await f1_data.get_session_drivers(session_key)


@app.get("/api/analytics/telemetry")
async def analytics_telemetry(session_key: str = "latest", driver1: int = 0, driver2: int = 0):
    """Telemetry comparison of two drivers' best laps."""
    if not driver1 or not driver2:
        return {"error": "specify driver1 and driver2"}
    return await f1_data.get_telemetry_comparison(session_key, driver1, driver2)


@app.get("/api/analytics/strategy-prediction")
async def analytics_strategy_prediction(session_key: str = "latest"):
    """AI strategy prediction with optimal pit windows."""
    return await f1_data.get_strategy_prediction(session_key)


@app.get("/api/analytics/weather-radar")
async def analytics_weather_radar(session_key: str = "latest"):
    """Weather radar with rain overlay tiles."""
    return await f1_data.get_weather_radar(session_key)


@app.get("/api/analytics/lap-time-series")
async def analytics_lap_time_series(session_key: str = "latest", drivers: str = ""):
    """Full lap time table data for all drivers."""
    driver_numbers = None
    if drivers:
        try:
            driver_numbers = [int(x.strip()) for x in drivers.split(",") if x.strip()]
        except ValueError:
            pass
    return await f1_data.get_lap_time_series(session_key, driver_numbers)


@app.get("/api/analytics/race-trace")
async def analytics_race_trace(session_key: str = "latest"):
    """Race trace — cumulative gap to leader per lap."""
    return await f1_data.get_race_trace(session_key)


@app.get("/api/analytics/speed-traps")
async def analytics_speed_traps(session_key: str = "latest"):
    """Speed trap leaderboard."""
    return await f1_data.get_speed_traps(session_key)


@app.get("/api/head-to-head")
async def head_to_head(season: int = CURRENT_SEASON):
    """Teammate head-to-head comparison."""
    return await f1_data.get_head_to_head(season)


@app.get("/api/live/car-data")
async def live_car_data(driver: int = 1):
    """Live car telemetry for speedometer — speed, throttle, brake, gear, DRS."""
    return await f1_data.get_live_car_data(driver)


@app.get("/api/live/track-map")
async def live_track_map():
    """Live track map: track outline + car positions."""
    return await f1_data.get_live_track_map()


@app.get("/api/standings/points-progression")
async def points_progression(season: int = CURRENT_SEASON):
    """Cumulative points progression chart data."""
    return await f1_data.get_points_progression(season)


# ============ DEMO MODE ============

@app.get("/api/demo/sessions")
async def demo_sessions():
    """List available historical sessions for demo mode."""
    cached = f1_data.cache_get("demo_sessions")
    if cached:
        return cached
    sessions = f1_data.get_demo_sessions_list()
    response = {"sessions": sessions}
    f1_data.cache_set("demo_sessions", response)
    return response


@app.get("/api/demo/set")
async def demo_set(session_key: str):
    """Set a specific demo session. Pass session_key from /api/demo/sessions."""
    f1_data.set_demo_session(session_key)
    return {"status": "ok", "session_key": session_key}


@app.get("/api/demo/clear")
async def demo_clear():
    """Clear demo override, return to auto mode."""
    f1_data.set_demo_session(None)
    return {"status": "ok", "message": "Demo cleared, back to auto mode"}




@app.get("/api/user/is-admin")
async def user_is_admin(request: Request):
    try:
        tg_user = get_current_user(request)
        return {"is_admin": tg_user["id"] in ADMIN_IDS}
    except Exception:
        return {"is_admin": False}



# ============ POSITION CHART (f1report.ru) ============

CIRCUIT_SLUG_MAP = {
    "albert_park": "australia-albert-park", "shanghai": "china-shanghai",
    "suzuka": "japan-suzuka", "bahrain": "bahrain-sakhir",
    "jeddah": "saudi-arabia-jeddah", "miami": "usa-miami",
    "imola": "emilia-romagna-imola", "monaco": "monaco-monte-carlo",
    "catalunya": "spain-barcelona", "villeneuve": "canada-montreal",
    "red_bull_ring": "austria-spielberg", "silverstone": "great-britain-silverstone",
    "spa": "belgium-spa", "hungaroring": "hungary-budapest",
    "zandvoort": "netherlands-zandvoort", "monza": "italy-monza",
    "baku": "azerbaijan-baku", "marina_bay": "singapore-marina-bay",
    "americas": "usa-austin", "rodriguez": "mexico-mexico-city",
    "interlagos": "brazil-sao-paulo", "vegas": "usa-las-vegas",
    "losail": "qatar-lusail", "yas_marina": "abu-dhabi-yas-marina",
    "madrid": "spain-madrid",
}


@app.get("/api/race/{round_num}/positions")
async def get_position_chart(round_num: int, season: int = CURRENT_SEASON):
    """Get lap-by-lap position data from f1report.ru animation page."""
    cache_key = f"positions_chart:{season}:{round_num}"
    cached = f1_data.cache_get(cache_key)
    if cached:
        return cached

    # Find circuit_id for this round
    schedule = await f1_data.get_schedule(season)
    race = None
    for r in schedule.get("races", []):
        if r.get("round") == round_num:
            race = r
            break
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")

    circuit_id = race.get("circuit_id", "")
    slug = CIRCUIT_SLUG_MAP.get(circuit_id)
    if not slug:
        raise HTTPException(status_code=404, detail=f"No f1report mapping for {circuit_id}")

    url = f"https://f1report.ru/animation/{season}/{slug}.html"
    import httpx
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code != 200:
                raise HTTPException(status_code=404, detail="f1report page not found")
            html = resp.text
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Failed to fetch f1report data")

    # Parse JavaScript data arrays
    import re as _re

    # Extract TNAME (driver names)
    drivers = {}
    for m in _re.finditer(r'TNAME\[(\d+)\]="([^"]+)"', html):
        drivers[int(m.group(1))] = m.group(2)

    if not drivers:
        raise HTTPException(status_code=404, detail="No driver data found")

    # Extract S[][] (cumulative times) to compute positions
    s_data = {}
    for m in _re.finditer(r'S\[(\d+)\]\[(\d+)\]=([0-9.]+)', html):
        lap, idx, time = int(m.group(1)), int(m.group(2)), float(m.group(3))
        if idx == 0:
            continue
        if lap not in s_data:
            s_data[lap] = {}
        s_data[lap][idx] = time

    if not s_data:
        raise HTTPException(status_code=404, detail="No timing data found")

    # Compute positions per lap
    max_lap = max(s_data.keys())
    driver_indices = sorted(drivers.keys())

    # Build position arrays per driver
    positions = {}
    for idx in driver_indices:
        name = drivers[idx]
        positions[idx] = {"name": name, "laps": []}

    for lap in range(1, max_lap + 1):
        if lap not in s_data:
            continue
        # Get active drivers (non-zero time)
        active = [(idx, s_data[lap].get(idx, 0)) for idx in driver_indices if s_data[lap].get(idx, 0) > 0]
        active.sort(key=lambda x: x[1])

        for pos, (idx, _) in enumerate(active, 1):
            positions[idx]["laps"].append({"lap": lap, "position": pos})

        # Mark DNF drivers
        for idx in driver_indices:
            if idx not in dict(active):
                if positions[idx]["laps"] and positions[idx]["laps"][-1].get("lap", 0) < lap:
                    pass  # Already stopped

    # Get team colors
    result_data = []
    for idx in driver_indices:
        p = positions[idx]
        if not p["laps"]:
            continue
        # Try to get driver info for color
        driver_info = f1_data.enrich_driver_by_name(p["name"], season=season)
        result_data.append({
            "name": p["name"],
            "code": driver_info.get("code", p["name"][:3].upper()),
            "team_color": driver_info.get("team_color", "#888"),
            "positions": [l["position"] for l in p["laps"]],
            "laps": [l["lap"] for l in p["laps"]],
        })

    response = {
        "round": round_num,
        "season": season,
        "total_laps": max_lap,
        "drivers": result_data,
    }
    f1_data.cache_set(cache_key, response)
    return response


# ============ BROADCASTS ============

@app.get("/api/broadcasts")
async def list_broadcasts(race_round: Optional[int] = None, season: Optional[int] = None, is_live: Optional[bool] = None):
    db.auto_end_stale_broadcasts()
    return {"broadcasts": db.get_broadcasts(race_round=race_round, season=season, is_live=1 if is_live else None if is_live is None else 0)}


@app.get("/api/broadcasts/live")
async def live_broadcasts():
    db.auto_end_stale_broadcasts()
    return {"broadcasts": db.get_live_broadcasts()}


@app.post("/api/admin/broadcast")
async def admin_upsert_broadcast(req: BroadcastRequest, request: Request):
    tg_user = get_current_user(request)
    if tg_user["id"] not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Resolve embed URL (VK or YouTube)
    video_url = req.video_url.strip()
    embed_url = await resolve_vk_embed(video_url)

    bid = db.upsert_broadcast(
        race_round=req.race_round,
        season=CURRENT_SEASON,
        session_type=req.session_type,
        video_url=video_url,
        embed_url=embed_url,
        title=req.title,
        is_live=req.is_live,
        created_by=tg_user["id"],
    )

    # Push "обзор выложен" only for review-type broadcasts (and non-live)
    if req.session_type == "review" and not req.is_live:
        try:
            race_name = req.title
            if not race_name:
                schedule = await f1_data.get_schedule(CURRENT_SEASON)
                race = next((r for r in (schedule.get("races") if isinstance(schedule, dict) else schedule) or [] if r.get("round") == req.race_round), None)
                race_name = race.get("name") if race else f"раунд {req.race_round}"
            review_key = f"expo_review_{req.race_round}_{bid}"
            if not _push_was_sent(review_key):
                rows = db.execute("""
                    SELECT pt.expo_token FROM push_tokens pt
                    LEFT JOIN push_prefs pp ON pp.user_id = pt.user_id
                    WHERE COALESCE(pp.notify_review, 1) = 1
                """)
                tokens = [r["expo_token"] for r in rows]
                sent = await _expo_push_send(
                    tokens,
                    "🎬 Обзор выложен",
                    f"Обзор: {race_name}",
                    {"type": "review_uploaded", "race_round": req.race_round, "broadcast_id": bid},
                )
                _push_mark_sent(review_key, sent)
        except Exception as e:
            import logging as _l
            _l.getLogger("expo_push").error(f"Review push failed: {e}")

    return {"id": bid, "embed_url": embed_url}


@app.post("/api/admin/broadcast/{broadcast_id}/end")
async def admin_end_broadcast(broadcast_id: int, request: Request):
    tg_user = get_current_user(request)
    if tg_user["id"] not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.end_broadcast(broadcast_id)
    return {"status": "ok"}


@app.delete("/api/admin/broadcast/{broadcast_id}")
async def admin_delete_broadcast(broadcast_id: int, request: Request):
    tg_user = get_current_user(request)
    if tg_user["id"] not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete_broadcast(broadcast_id)
    return {"status": "ok"}


@app.get("/api/admin/broadcasts")
async def admin_list_broadcasts(request: Request):
    tg_user = get_current_user(request)
    if tg_user["id"] not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Not authorized")
    return {"broadcasts": db.get_broadcasts(season=CURRENT_SEASON)}


async def resolve_vk_embed(video_url: str) -> str:
    """Construct embed URL from VK, YouTube, or Rutube video URL."""
    import re as _re

    # YouTube — return embed URL
    yt = _re.search(r'(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]+)', video_url)
    if yt:
        return f"https://www.youtube.com/embed/{yt.group(1)}?rel=0"

    # Rutube — return embed URL
    rt = _re.search(r'rutube\.ru/video/([a-f0-9]+)', video_url)
    if rt:
        return f"https://rutube.ru/play/embed/{rt.group(1)}"

    # VK video — extract oid and id
    match = _re.search(r'video(-?\d+)_(\d+)', video_url)
    if not match:
        return None
    oid, vid = match.group(1), match.group(2)

    # Fetch the VK video page to extract embed hash
    vk_page_url = f"https://vk.com/video{oid}_{vid}"
    try:
        async with _httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(vk_page_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            if resp.status_code == 200:
                hash_match = _re.search(r'hash=([a-f0-9]+)', resp.text)
                if hash_match:
                    h = hash_match.group(1)
                    logging.info(f"VK embed hash found: {h[:8]}...")
                    return f"https://vk.com/video_ext.php?oid={oid}&id={vid}&hash={h}&hd=2"
    except Exception as e:
        logging.warning(f"Failed to fetch VK hash: {e}")

    # Fallback without hash (may not work for some videos)
    return f"https://vk.com/video_ext.php?oid={oid}&id={vid}&hd=2"


@app.get("/api/vk-embed")
async def vk_embed_proxy(url: str):
    """Proxy VK oEmbed to resolve proper embed URL with hash."""
    import httpx as _httpx
    import re as _re

    # Validate it's a VK URL
    if not _re.search(r'vk\.com|vkvideo\.ru|vksport', url):
        raise HTTPException(status_code=400, detail="Not a VK URL")

    # Extract video oid_id for canonical URL
    m = _re.search(r'video(-?\d+)_(\d+)', url)
    if not m:
        raise HTTPException(status_code=400, detail="No video ID found")

    oid, vid = m.group(1), m.group(2)
    canonical = f"https://vk.com/video{oid}_{vid}"

    # Try oEmbed first
    try:
        async with _httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(
                f"https://vk.com/video_oembed.json?url={canonical}",
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            if resp.status_code == 200:
                data = resp.json()
                html = data.get("html", "")
                src_match = _re.search(r'src="([^"]+)"', html)
                if src_match:
                    return {"embed_url": src_match.group(1)}
    except Exception:
        pass

    # Fallback: scrape video page for hash
    try:
        async with _httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(
                canonical,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            if resp.status_code == 200:
                # Look for the correct embed hash pattern
                # VK stores it in various JSON structures on the page
                text = resp.text

                # Try to find embed URL directly
                embed_match = _re.search(r'video_ext\.php\?oid=' + _re.escape(oid) + r'&id=' + _re.escape(vid) + r'&hash=([a-f0-9]+)', text)
                if embed_match:
                    h = embed_match.group(1)
                    return {"embed_url": f"https://vk.com/video_ext.php?oid={oid}&id={vid}&hash={h}&hd=2"}

                # Try to find any usable hash near video references
                # Look for access_hash in JSON
                for pattern in [
                    r'"access_hash"\s*:\s*"([^"]+)"',
                    r'"hash"\s*:\s*"([a-f0-9]{10,})"',
                ]:
                    hm = _re.search(pattern, text)
                    if hm:
                        h = hm.group(1)
                        return {"embed_url": f"https://vk.com/video_ext.php?oid={oid}&id={vid}&hash={h}&hd=2"}
    except Exception:
        pass

    # No hash found - return URL without hash
    return {"embed_url": f"https://vk.com/video_ext.php?oid={oid}&id={vid}&hd=2"}


@app.get("/api/rutube-stream/{video_id}")
async def rutube_stream(video_id: str):
    """Get HLS stream URL from Rutube API."""
    import httpx as _httpx
    import re as _re
    if not _re.match(r'^[a-f0-9]+$', video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID")

    cache_key = f"rutube_stream:{video_id}"
    cached = f1_data.cache_get(cache_key)
    if cached:
        return cached

    try:
        async with _httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://rutube.ru/api/play/options/{video_id}/?no_404=true&referer=&pver=v2",
                headers={"User-Agent": "Mozilla/5.0"}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=404, detail="Video not found")
            data = resp.json()
            hls = data.get("video_balancer", {}).get("m3u8")
            if not hls:
                raise HTTPException(status_code=404, detail="No HLS stream")
            from urllib.parse import quote
            proxied_hls = f"/api/proxy-stream?url={quote(hls, safe='')}"
            result = {
                "hls_url": proxied_hls,
                "title": data.get("title", ""),
                "duration": data.get("duration", 0),
                "thumbnail": data.get("thumbnail_url", ""),
            }
            f1_data.cache_set(cache_key, result)
            return result
    except _httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Rutube API error")


@app.get("/api/youtube-stream/{video_id}")
async def youtube_stream(video_id: str):
    """Get direct video URL from YouTube via yt-dlp."""
    import re as _re
    if not _re.match(r'^[\w-]+$', video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID")

    cache_key = f"yt_stream:{video_id}"
    cached = f1_data.cache_get(cache_key)
    if cached:
        return cached

    try:
        import subprocess
        result = subprocess.run(
            ['yt-dlp', '-j', '--no-download', f'https://www.youtube.com/watch?v={video_id}'],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            raise HTTPException(status_code=404, detail="Video not found")

        import json as _json
        data = _json.loads(result.stdout)

        # Get available formats with direct URLs
        formats = []
        for f in data.get('formats', []):
            if f.get('vcodec', 'none') != 'none' and f.get('acodec', 'none') != 'none':
                h = f.get('height', 0)
                if h and f.get('url'):
                    formats.append({
                        'url': f['url'],
                        'height': h,
                        'label': f'{h}p',
                    })

        if not formats:
            # Try best combined format
            result2 = subprocess.run(
                ['yt-dlp', '-g', '-f', 'best[height<=1080]', f'https://www.youtube.com/watch?v={video_id}'],
                capture_output=True, text=True, timeout=30
            )
            if result2.stdout.strip():
                formats = [{'url': result2.stdout.strip(), 'height': 720, 'label': '720p'}]

        # Sort by quality
        formats.sort(key=lambda x: x['height'])

        response = {
            'title': data.get('title', ''),
            'duration': data.get('duration', 0),
            'thumbnail': data.get('thumbnail', ''),
            'formats': formats,
            'best_url': formats[-1]['url'] if formats else None,
        }
        f1_data.cache_set(cache_key, response)
        return response
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="yt-dlp timeout")
    except Exception as e:
        logging.error(f"YouTube stream error: {e}")
        raise HTTPException(status_code=502, detail="Failed to get stream")


import base64 as _b64

@app.get("/api/proxy-stream")
async def proxy_stream(request: Request, url: str):
    """Proxy HLS/video streams to bypass CORS."""
    import httpx as _httpx

    # Only allow rutube and googlevideo domains
    allowed = ['rutube.ru', 'googlevideo.com', 'youtube.com', 'bl.rutube.ru']
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if not any(parsed.hostname and parsed.hostname.endswith(d) for d in allowed):
        raise HTTPException(status_code=403, detail="Domain not allowed")

    try:
        async with _httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://rutube.ru/",
            })
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail="Upstream error")

            content = resp.content
            ct = resp.headers.get("content-type", "application/octet-stream")

            # If it's an m3u8 playlist, rewrite URLs to go through our proxy
            if 'mpegurl' in ct.lower() or url.endswith('.m3u8'):
                text = content.decode('utf-8', errors='ignore')
                import re as _re
                from urllib.parse import urljoin, quote

                lines = text.split('\n')
                new_lines = []
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        # This is a URL - make it absolute and proxy it
                        abs_url = urljoin(url, line)
                        new_lines.append(f"/api/proxy-stream?url={quote(abs_url, safe='')}")
                    else:
                        new_lines.append(line)
                content = '\n'.join(new_lines).encode('utf-8')
                ct = 'application/vnd.apple.mpegurl'

            from fastapi.responses import Response
            return Response(
                content=content,
                media_type=ct,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=300",
                }
            )
    except _httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ============ ADMIN ============

@app.post("/api/admin/settle/{race_round}")
async def admin_settle(race_round: int, request: Request, season: int = 0):
    """Settle all predictions for a race round."""
    tg_user = get_current_user(request)
    if tg_user["id"] not in ADMIN_IDS:
        raise HTTPException(status_code=403, detail="Not authorized")

    results = await f1_data.get_race_results(race_round)
    if "error" in results:
        raise HTTPException(status_code=404, detail=results["error"])

    race_results = results.get("results", [])
    if not race_results:
        raise HTTPException(status_code=404, detail="No results")

    winner = race_results[0]["driver_number"]
    podium = [r["driver_number"] for r in race_results[:3]]
    dnf_count = results.get("dnf_count", 0)
    fastest_lap_driver = results.get("fastest_lap_driver")

    # Determine safety car from OpenF1 race control data
    rc_data = await f1_data.get_live_race_control()
    had_safety_car = any(
        msg.get("category") in ("SafetyCar", "VirtualSafetyCar")
        for msg in rc_data.get("messages", [])
    )

    pred_season = season if season > 0 else CURRENT_SEASON
    # Also try 2025 season for old predictions
    predictions = db.get_pending_predictions(race_round, pred_season)
    if not predictions and pred_season != 2025:
        predictions = db.get_pending_predictions(race_round, 2025)
    settled = 0

    for pred in predictions:
        points = 0
        status = "incorrect"
        ptype = pred["prediction_type"]
        try:
            pvalue = json.loads(pred["prediction_value"]) if isinstance(pred["prediction_value"], str) else pred["prediction_value"]
        except (json.JSONDecodeError, TypeError):
            pvalue = pred["prediction_value"]

        if ptype == "winner" and pvalue == winner:
            points, status = PREDICTION_POINTS["winner"]["correct"], "correct"
        elif ptype == "podium" and isinstance(pvalue, list):
            matches = len(set(pvalue) & set(podium))
            if matches == 3:
                points, status = PREDICTION_POINTS["podium"]["all_3"], "correct"
            elif matches == 2:
                points, status = PREDICTION_POINTS["podium"]["2_of_3"], "partial"
            elif matches == 1:
                points, status = PREDICTION_POINTS["podium"]["1_of_3"], "partial"
        elif ptype == "fastest_lap" and pvalue == fastest_lap_driver:
            points, status = PREDICTION_POINTS["fastest_lap"]["correct"], "correct"
        elif ptype == "dnf_count":
            try:
                diff = abs(int(pvalue) - dnf_count)
                if diff == 0:
                    points, status = PREDICTION_POINTS["dnf_count"]["exact"], "correct"
                elif diff == 1:
                    points, status = PREDICTION_POINTS["dnf_count"]["off_by_1"], "partial"
            except (ValueError, TypeError):
                pass
        elif ptype == "safety_car":
            predicted_yes = pvalue in (True, "yes", "true")
            if predicted_yes == had_safety_car:
                points, status = PREDICTION_POINTS["safety_car"]["correct"], "correct"

        db.resolve_prediction(pred["id"], status, points)
        if points > 0:
            db.add_user_points(pred["user_id"], points)
        if status == "correct":
            db.execute_write(
                "UPDATE users SET predictions_correct=predictions_correct+1, streak=streak+1, max_streak=MAX(max_streak,streak+1) WHERE user_id=?",
                (pred["user_id"],)
            )
        elif status == "incorrect":
            db.execute_write("UPDATE users SET streak=0 WHERE user_id=?", (pred["user_id"],))

        db.check_and_award_achievements(pred["user_id"])
        settled += 1

    f1_data.cache_clear("leaderboard")
    db.update_leaderboard()
    return {"settled": settled, "race_round": race_round}


@app.post("/api/admin/cache/clear")
async def admin_cache_clear(request: Request):
    tg_user = get_current_user(request)
    if tg_user["id"] not in ADMIN_IDS:
        raise HTTPException(status_code=403)
    f1_data.cache_clear()
    return {"status": "ok", "message": "Cache cleared"}

# ============ EXPO PUSH BACKGROUND SENDER ============
import asyncio as _asyncio
import os as _os
import logging as _logging
_push_log = _logging.getLogger("expo_push")

_PUSH_MARK_DIR = "/app/data/notifications"

def _push_was_sent(key: str) -> bool:
    return _os.path.exists(_os.path.join(_PUSH_MARK_DIR, f"{key}.sent"))

def _push_mark_sent(key: str, count: int):
    _os.makedirs(_PUSH_MARK_DIR, exist_ok=True)
    with open(_os.path.join(_PUSH_MARK_DIR, f"{key}.sent"), "w") as f:
        f.write(f"sent={count}")


async def _expo_push_send(tokens: list, title: str, body: str, data: dict = None):
    """POST to Expo Push API in batches of 100."""
    if not tokens:
        return 0
    import httpx as _httpx
    sent = 0
    async with _httpx.AsyncClient(timeout=10) as client:
        for i in range(0, len(tokens), 100):
            chunk = tokens[i : i + 100]
            messages = [
                {
                    "to": tok,
                    "title": title,
                    "body": body,
                    "sound": "default",
                    "priority": "high",
                    "data": data or {},
                }
                for tok in chunk
            ]
            try:
                resp = await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json=messages,
                    headers={"Accept": "application/json", "Content-Type": "application/json"},
                )
                if resp.status_code == 200:
                    sent += len(chunk)
                else:
                    _push_log.warning(f"Expo push HTTP {resp.status_code}: {resp.text[:200]}")
            except Exception as e:
                _push_log.error(f"Expo push send error: {e}")
    return sent


async def _push_loop():
    """Background loop: every 60s, check next race for 2h / 5min windows."""
    await _asyncio.sleep(30)  # warmup
    while True:
        try:
            next_race = await f1_data.get_next_race()
            if next_race and "round" in next_race:
                race_date = next_race.get("date", "")
                race_time = next_race.get("time", "14:00:00Z")
                race_name = next_race.get("name") or next_race.get("raceName") or "Гран-при"
                race_round = next_race["round"]
                if race_date:
                    dt_str = f"{race_date}T{race_time}"
                    if not dt_str.endswith("Z") and "+" not in dt_str:
                        dt_str += "Z"
                    try:
                        race_dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                        now = datetime.now(timezone.utc)
                        seconds = (race_dt - now).total_seconds()

                        windows = [
                            # (low, high seconds, marker_key, title, body)
                            (7080, 7320, f"expo_2h_{race_round}",
                             f"🏁 {race_name}",
                             "Старт через 2 часа. Успей сделать прогноз!"),
                            (240, 360, f"expo_5m_{race_round}",
                             f"🔴 {race_name} — 5 минут!",
                             "Lights out скоро. Открой Live."),
                        ]

                        for low, high, key, title, body in windows:
                            if low < seconds < high and not _push_was_sent(key):
                                rows = db.execute("""
                                    SELECT pt.expo_token FROM push_tokens pt
                                    LEFT JOIN push_prefs pp ON pp.user_id = pt.user_id
                                    WHERE COALESCE(pp.notify_race, 1) = 1
                                """)
                                tokens = [r["expo_token"] for r in rows]
                                sent = await _expo_push_send(
                                    tokens, title, body,
                                    {"type": "race_reminder", "race_round": race_round},
                                )
                                _push_mark_sent(key, sent)
                                _push_log.info(f"Sent {sent} push for {key}")
                    except Exception as e:
                        _push_log.error(f"Push window check error: {e}")
        except Exception as e:
            _push_log.error(f"Push loop error: {e}")
        await _asyncio.sleep(60)


@app.on_event("startup")
async def _start_push_loop():
    _asyncio.create_task(_push_loop())




# ============ BROADCAST SOCIAL: likes, comments ============
# Appended to /opt/f1-hub/api.py — добавляет лайки/комментарии к трансляциям.

from pydantic import BaseModel as _SocialBaseModel
from typing import Optional as _SocialOpt


class CommentRequest(_SocialBaseModel):
    text: str
    parent_id: _SocialOpt[int] = None


def _social_db():
    import sqlite3
    conn = sqlite3.connect("/app/data/f1hub.db")
    conn.row_factory = sqlite3.Row
    return conn


def _social_user_id(request: "Request") -> _SocialOpt[int]:
    try:
        u = get_current_user(request)
        return int(u["id"])
    except Exception:
        return None


def _serialize_comment(r, my_user_id: _SocialOpt[int]) -> dict:
    return {
        "id": r["id"],
        "broadcast_id": r["broadcast_id"],
        "user_id": r["user_id"],
        "parent_id": r["parent_id"],
        "text": r["text"],
        "created_at": r["created_at"],
        "user_name": r["first_name"] or r["username"] or f"User{r['user_id']}",
        "user_username": r["username"],
        "user_photo_url": r["photo_url"],
        "likes_count": r["likes_count"] if "likes_count" in r.keys() else 0,
        "my_liked": bool(r["my_liked"]) if "my_liked" in r.keys() else False,
        "is_mine": (my_user_id == r["user_id"]) if my_user_id else False,
    }


@app.get("/api/broadcast/{broadcast_id}/social")
async def broadcast_social_get(broadcast_id: int, request: Request):
    user_id = _social_user_id(request)
    conn = _social_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS c FROM broadcast_likes WHERE broadcast_id=?", (broadcast_id,))
    likes_count = cur.fetchone()["c"]
    cur.execute(
        "SELECT COUNT(*) AS c FROM broadcast_comments WHERE broadcast_id=? AND is_deleted=0",
        (broadcast_id,),
    )
    comments_count = cur.fetchone()["c"]
    my_liked = False
    if user_id:
        cur.execute(
            "SELECT 1 FROM broadcast_likes WHERE broadcast_id=? AND user_id=?",
            (broadcast_id, user_id),
        )
        my_liked = cur.fetchone() is not None
    conn.close()
    return {"likes_count": likes_count, "comments_count": comments_count, "my_liked": my_liked}


@app.post("/api/broadcast/{broadcast_id}/like")
async def broadcast_like_toggle(broadcast_id: int, request: Request):
    user = get_current_user(request)
    user_id = int(user["id"])
    conn = _social_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM broadcast_likes WHERE broadcast_id=? AND user_id=?",
        (broadcast_id, user_id),
    )
    if cur.fetchone():
        cur.execute(
            "DELETE FROM broadcast_likes WHERE broadcast_id=? AND user_id=?",
            (broadcast_id, user_id),
        )
        my_liked = False
    else:
        cur.execute(
            "INSERT INTO broadcast_likes(broadcast_id, user_id) VALUES(?,?)",
            (broadcast_id, user_id),
        )
        my_liked = True
    conn.commit()
    cur.execute("SELECT COUNT(*) AS c FROM broadcast_likes WHERE broadcast_id=?", (broadcast_id,))
    likes_count = cur.fetchone()["c"]
    conn.close()
    return {"my_liked": my_liked, "likes_count": likes_count}


@app.get("/api/broadcast/{broadcast_id}/comments")
async def broadcast_get_comments(
    broadcast_id: int,
    request: Request,
    sort: str = "new",
    offset: int = 0,
    limit: int = 20,
):
    user_id = _social_user_id(request)
    limit = max(1, min(100, limit))
    offset = max(0, offset)
    order = "c.created_at DESC" if sort == "new" else "c.created_at ASC"
    conn = _social_db()
    cur = conn.cursor()
    cur.execute(
        f"""
        SELECT c.id, c.broadcast_id, c.user_id, c.parent_id, c.text, c.created_at,
               u.first_name, u.username, u.photo_url,
               (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id=c.id) AS likes_count,
               EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id=c.id AND cl.user_id=?) AS my_liked
        FROM broadcast_comments c
        LEFT JOIN users u ON u.user_id = c.user_id
        WHERE c.broadcast_id=? AND c.is_deleted=0
        ORDER BY {order}
        LIMIT ? OFFSET ?
        """,
        (user_id or 0, broadcast_id, limit, offset),
    )
    rows = cur.fetchall()
    cur.execute(
        "SELECT COUNT(*) AS c FROM broadcast_comments WHERE broadcast_id=? AND is_deleted=0",
        (broadcast_id,),
    )
    total = cur.fetchone()["c"]
    conn.close()
    return {
        "comments": [_serialize_comment(r, user_id) for r in rows],
        "total": total,
    }


@app.post("/api/broadcast/{broadcast_id}/comment")
async def broadcast_post_comment(
    broadcast_id: int, req: CommentRequest, request: Request
):
    user = get_current_user(request)
    user_id = int(user["id"])
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty comment")
    if len(text) > 1000:
        raise HTTPException(status_code=400, detail="Comment too long (max 1000)")
    conn = _social_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO broadcast_comments(broadcast_id, user_id, parent_id, text) VALUES(?,?,?,?)",
        (broadcast_id, user_id, req.parent_id, text),
    )
    cid = cur.lastrowid
    conn.commit()
    cur.execute(
        """
        SELECT c.id, c.broadcast_id, c.user_id, c.parent_id, c.text, c.created_at,
               u.first_name, u.username, u.photo_url,
               0 AS likes_count, 0 AS my_liked
        FROM broadcast_comments c
        LEFT JOIN users u ON u.user_id = c.user_id
        WHERE c.id=?
        """,
        (cid,),
    )
    r = cur.fetchone()
    conn.close()
    return _serialize_comment(r, user_id)


@app.post("/api/comment/{comment_id}/like")
async def comment_like_toggle(comment_id: int, request: Request):
    user = get_current_user(request)
    user_id = int(user["id"])
    conn = _social_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM comment_likes WHERE comment_id=? AND user_id=?",
        (comment_id, user_id),
    )
    if cur.fetchone():
        cur.execute(
            "DELETE FROM comment_likes WHERE comment_id=? AND user_id=?",
            (comment_id, user_id),
        )
        my_liked = False
    else:
        cur.execute(
            "INSERT INTO comment_likes(comment_id, user_id) VALUES(?,?)",
            (comment_id, user_id),
        )
        my_liked = True
    conn.commit()
    cur.execute(
        "SELECT COUNT(*) AS c FROM comment_likes WHERE comment_id=?", (comment_id,)
    )
    likes_count = cur.fetchone()["c"]
    conn.close()
    return {"my_liked": my_liked, "likes_count": likes_count}


@app.delete("/api/comment/{comment_id}")
async def comment_delete(comment_id: int, request: Request):
    user = get_current_user(request)
    user_id = int(user["id"])
    conn = _social_db()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM broadcast_comments WHERE id=?", (comment_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    is_owner = row["user_id"] == user_id
    is_admin = user_id in (ADMIN_IDS if "ADMIN_IDS" in globals() else set())
    if not (is_owner or is_admin):
        conn.close()
        raise HTTPException(status_code=403, detail="Forbidden")
    cur.execute("UPDATE broadcast_comments SET is_deleted=1 WHERE id=?", (comment_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
# Patch to add /api/drivers/career/batch and /api/teams/career/batch
# Inserted at end of api.py

# ============ BATCH CAREER ENDPOINTS ============

@app.get("/api/drivers/career/batch")
async def get_drivers_career_batch(ids: str):
    """Batch career stats for multiple drivers. ids = comma-separated driver_ids.
    Returns {drivers: {id: data, ...}, missing: [ids without cache]}.
    Cache-only — cold misses are NOT auto-filled (cron prewarmer handles that)."""
    driver_ids = [x.strip() for x in ids.split(",") if x.strip()]
    if not driver_ids or len(driver_ids) > 30:
        raise HTTPException(status_code=400, detail="1-30 ids required")
    out = {}
    missing = []
    for did in driver_ids:
        data = _career_get(f"drv_career_{did}")
        if data:
            out[did] = data
        else:
            missing.append(did)
    return {"drivers": out, "missing": missing}


@app.get("/api/teams/career/batch")
async def get_teams_career_batch(ids: str):
    """Batch career stats for multiple constructors. ids = comma-separated constructor_ids."""
    constructor_ids = [x.strip() for x in ids.split(",") if x.strip()]
    if not constructor_ids or len(constructor_ids) > 15:
        raise HTTPException(status_code=400, detail="1-15 ids required")
    out = {}
    missing = []
    for cid in constructor_ids:
        data = _career_get(f"team_career_{cid}")
        if data:
            out[cid] = data
        else:
            missing.append(cid)
    return {"teams": out, "missing": missing}

# ============ AUTO-SETTLE LOOP ============

async def _settle_round_impl(race_round: int, season: int = None) -> dict:
    """Internal settle logic, callable from admin endpoint or background loop."""
    s = season or CURRENT_SEASON
    results = await f1_data.get_race_results(race_round, season=s)
    if "error" in results:
        return {"error": results["error"], "settled": 0}
    race_results = results.get("results", [])
    if not race_results:
        return {"error": "No results", "settled": 0}

    winner = race_results[0]["driver_number"]
    podium = [r["driver_number"] for r in race_results[:3]]
    dnf_count = results.get("dnf_count", 0)
    fastest_lap_driver = results.get("fastest_lap_driver")
    rc_data = await f1_data.get_live_race_control()
    had_safety_car = any(
        msg.get("category") in ("SafetyCar", "VirtualSafetyCar")
        for msg in rc_data.get("messages", [])
    )

    predictions = db.get_pending_predictions(race_round, s)
    if not predictions and s != 2025:
        predictions = db.get_pending_predictions(race_round, 2025)
    settled = 0

    for pred in predictions:
        points = 0
        status = "incorrect"
        ptype = pred["prediction_type"]
        try:
            pvalue = json.loads(pred["prediction_value"]) if isinstance(pred["prediction_value"], str) else pred["prediction_value"]
        except (json.JSONDecodeError, TypeError):
            pvalue = pred["prediction_value"]

        if ptype == "winner" and pvalue == winner:
            points, status = PREDICTION_POINTS["winner"]["correct"], "correct"
        elif ptype == "podium" and isinstance(pvalue, list):
            matches = len(set(pvalue) & set(podium))
            if matches == 3:
                points, status = PREDICTION_POINTS["podium"]["all_3"], "correct"
            elif matches == 2:
                points, status = PREDICTION_POINTS["podium"]["2_of_3"], "partial"
            elif matches == 1:
                points, status = PREDICTION_POINTS["podium"]["1_of_3"], "partial"
        elif ptype == "fastest_lap" and pvalue == fastest_lap_driver:
            points, status = PREDICTION_POINTS["fastest_lap"]["correct"], "correct"
        elif ptype == "dnf_count":
            try:
                diff = abs(int(pvalue) - dnf_count)
                if diff == 0:
                    points, status = PREDICTION_POINTS["dnf_count"]["exact"], "correct"
                elif diff == 1:
                    points, status = PREDICTION_POINTS["dnf_count"]["off_by_1"], "partial"
            except (ValueError, TypeError):
                pass
        elif ptype == "safety_car":
            predicted_yes = pvalue in (True, "yes", "true")
            if predicted_yes == had_safety_car:
                points, status = PREDICTION_POINTS["safety_car"]["correct"], "correct"

        db.resolve_prediction(pred["id"], status, points)
        if points > 0:
            db.add_user_points(pred["user_id"], points)
        if status == "correct":
            db.execute_write(
                "UPDATE users SET predictions_correct=predictions_correct+1, streak=streak+1, max_streak=MAX(max_streak,streak+1) WHERE user_id=?",
                (pred["user_id"],)
            )
        elif status == "incorrect":
            db.execute_write("UPDATE users SET streak=0 WHERE user_id=?", (pred["user_id"],))

        db.check_and_award_achievements(pred["user_id"])
        settled += 1

    f1_data.cache_clear("leaderboard")
    db.update_leaderboard()
    return {"settled": settled, "race_round": race_round, "season": s}


async def _auto_settle_loop():
    """Background loop: every 10 min, settle predictions for races that finished 3+ hours ago."""
    await _asyncio.sleep(60)  # warmup
    while True:
        try:
            schedule = await f1_data.get_schedule(CURRENT_SEASON)
            now = datetime.utcnow()
            for race in schedule.get("races", []):
                if not race.get("race_datetime"):
                    continue
                try:
                    race_dt = datetime.fromisoformat(race["race_datetime"].replace("Z", ""))
                except (ValueError, TypeError):
                    continue
                hours_past = (now - race_dt).total_seconds() / 3600
                # Settle window: race finished 3h-72h ago (so we don't churn forever)
                if not (3 < hours_past < 72):
                    continue
                race_round = race.get("round")
                if not race_round:
                    continue
                # Check if any pending predictions for this round/season
                pending = db.get_pending_predictions(race_round, CURRENT_SEASON)
                if not pending:
                    continue
                _push_log.info(f"auto-settle: round {race_round} has {len(pending)} pending, settling...")
                try:
                    result = await _settle_round_impl(race_round, CURRENT_SEASON)
                    _push_log.info(f"auto-settle round {race_round}: {result}")
                except Exception as e:
                    _push_log.error(f"auto-settle error for round {race_round}: {e}")
        except Exception as e:
            _push_log.error(f"auto-settle loop error: {e}")
        await _asyncio.sleep(600)  # every 10 min


@app.on_event("startup")
async def _start_auto_settle_loop():
    _asyncio.create_task(_auto_settle_loop())

# ============ BROADCAST THUMBNAIL HELPER ============

async def _resolve_thumbnail_url(video_url: str, embed_url: str = None) -> str | None:
    """Extract thumbnail URL for a video. Supports YouTube (direct), Rutube (API),
    falls back to None for unsupported providers. Server-side — bypasses CORS/UA issues."""
    import re, httpx
    url = video_url or embed_url or ""
    # YouTube
    m = re.search(r'(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([\w-]{6,})', url)
    if m:
        return f"https://i.ytimg.com/vi/{m.group(1)}/hqdefault.jpg"
    # Rutube
    m = re.search(r'rutube\.ru/(?:video|play/embed)/([a-f0-9]+)', url)
    if m:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    f"https://rutube.ru/api/video/{m.group(1)}/",
                    headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"},
                )
                if r.status_code == 200:
                    return (r.json() or {}).get("thumbnail_url")
        except Exception:
            pass
    return None


async def _backfill_broadcast_thumbnails():
    """One-time task: populate thumbnail_url for all broadcasts that don't have one."""
    import sqlite3
    conn = sqlite3.connect("/app/data/f1hub.db")
    conn.row_factory = sqlite3.Row
    # Ensure column exists
    try:
        conn.execute("ALTER TABLE broadcasts ADD COLUMN thumbnail_url TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # Column already exists
    rows = conn.execute(
        "SELECT id, video_url, embed_url FROM broadcasts WHERE thumbnail_url IS NULL OR thumbnail_url = ''"
    ).fetchall()
    updated = 0
    for row in rows:
        thumb = await _resolve_thumbnail_url(row["video_url"], row["embed_url"])
        if thumb:
            conn.execute("UPDATE broadcasts SET thumbnail_url=? WHERE id=?", (thumb, row["id"]))
            updated += 1
    conn.commit()
    conn.close()
    return updated


async def _thumbnail_backfill_loop():
    """Background loop: every hour, backfill broadcast thumbnails."""
    await _asyncio.sleep(45)  # warmup
    while True:
        try:
            n = await _backfill_broadcast_thumbnails()
            if n > 0:
                _push_log.info(f"broadcast thumbnail backfill: {n} updated")
        except Exception as e:
            _push_log.error(f"thumbnail backfill error: {e}")
        await _asyncio.sleep(3600)  # 1 hour


@app.on_event("startup")
async def _start_thumbnail_backfill():
    _asyncio.create_task(_thumbnail_backfill_loop())
