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
from fastapi.responses import FileResponse
from pydantic import BaseModel

import re
import database as db
import f1_data
from config import (
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
    db.init_db()
    logger.info("F1 Hub API started (v2 async)")
    yield
    await f1_data.close_client()
    logger.info("F1 Hub API shutting down")


# ============ APP ============
app = FastAPI(title="F1 Hub API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ TELEGRAM AUTH ============

def validate_telegram_data(init_data: str) -> Dict[str, Any]:
    """Validate Telegram WebApp initData — HMAC-SHA256 verification."""
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
        if time.time() - auth_date > 86400:  # 24 hours
            raise HTTPException(status_code=401, detail="Auth expired")

        user_data = json.loads(parsed.get("user", "{}"))
        if not user_data.get("id"):
            raise HTTPException(status_code=401, detail="No user")

        return user_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Auth failed")


def get_current_user(request: Request) -> Dict[str, Any]:
    init_data = request.headers.get("X-Telegram-Init-Data", "")
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
async def serve_index():
    return FileResponse("index.html")


@app.get("/{filename}.html")
async def serve_html(filename: str):
    import os
    path = f"{filename}.html"
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404)


# ============ USER ============

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

    # Fetch avatar from Bot API if not available from initData
    if not user.get("photo_url"):
        avatar_url = await fetch_telegram_avatar(tg_user["id"])
        if avatar_url:
            user["photo_url"] = avatar_url
            db.execute_write("UPDATE users SET photo_url = ? WHERE user_id = ?", (avatar_url, tg_user["id"]))

    rank = db.get_user_rank(user["user_id"])
    achievements = db.get_user_achievements(user["user_id"])

    return {
        **user,
        "rank": rank,
        "achievements_list": [a["achievement_key"] for a in achievements],
        "achievements_count": len(achievements),
        "achievements_total": len(ACHIEVEMENTS),
    }


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
    return {"predictions": db.get_user_predictions(tg_user["id"])}


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
async def get_race_results(round_num: int):
    result = await f1_data.get_race_results(round_num)
    if "error" in result and "not found" in result.get("error", "").lower():
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/api/race/{round_num}/qualifying")
async def get_qualifying(round_num: int):
    result = await f1_data.get_qualifying_results(round_num)
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


# ============ LIVE DATA (OpenF1) ============

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
    season: int = 2025
    prediction_type: str
    prediction_value: Any
    points_bet: int = 0


@app.get("/api/predictions/available")
async def predictions_available(request: Request):
    tg_user = get_current_user(request)
    next_race = await f1_data.get_next_race()

    if "round" not in next_race:
        return {"available": False, "message": "No upcoming race"}

    existing = db.get_user_predictions(tg_user["id"], next_race["round"], 2025)
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


def _calc_game_points(game_type: str, score: int) -> int:
    if game_type == "pit_stop":
        if score < 2000: return 50
        if score < 2500: return 30
        if score < 3000: return 20
        if score < 4000: return 10
        return 5
    if game_type == "reaction":
        if score < 200: return 50
        if score < 300: return 30
        if score < 500: return 10
        return 5
    if game_type in ("guess_track", "quiz"):
        return score * 5
    return 0


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
async def get_race_tyres(round_num: int):
    """Get tyre strategy data for a specific race round."""
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


@app.get("/api/live/track-map")
async def live_track_map():
    """Live track map: track outline + car positions."""
    return await f1_data.get_live_track_map()


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


# ============ ADMIN ============

@app.post("/api/admin/settle/{race_round}")
async def admin_settle(race_round: int, request: Request):
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
