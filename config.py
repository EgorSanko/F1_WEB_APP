"""
F1 Hub — Configuration
All constants, API URLs, team/driver data, and settings.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ============ ENVIRONMENT ============
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://localhost")
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x.strip()]
DATABASE_PATH = os.getenv("DATABASE_PATH", "/app/data/f1hub.db")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
VK_SERVICE_KEY = os.getenv("VK_SERVICE_KEY", "24af3a8d24af3a8d24af3a8d4e2791dbde224af24af3a8d4d20f32301ddf2ade9ff84df")

# ============ API URLS ============
OPENF1_API = "https://api.openf1.org/v1"
ERGAST_API = "https://api.jolpi.ca/ergast/f1"

# ============ CACHE TTL (seconds) ============
CACHE_TTL = {
    "live_positions": 10,
    "live_timing": 10,
    "live_weather": 60,
    "live_race_control": 10,
    "live_radio": 15,
    "live_pit_stops": 10,
    "live_tyres": 15,
    "live_session": 30,
    "schedule": 3600,           # 1 hour
    "standings_drivers": 900,   # 15 min
    "standings_constructors": 900,
    "race_results": 3600,
    "drivers_list": 86400,      # 24 hours
    "teams_list": 86400,
    "next_race": 1800,          # 30 min
    "leaderboard": 300,         # 5 min
    "news": 900,                # 15 min
    "streams": 1800,            # 30 min
}

# ============ GAME SETTINGS ============
GAME_COOLDOWN_SECONDS = 4 * 3600  # 4 hours between plays
INITIAL_USER_POINTS = 100

# ============ PREDICTION POINTS ============
PREDICTION_POINTS = {
    "winner": {"correct": 50},
    "podium": {"all_3": 100, "2_of_3": 30, "1_of_3": 10},
    "top10": {"exact_position": 20, "in_top10": 5},
    "fastest_lap": {"correct": 30},
    "dnf_count": {"exact": 40, "off_by_1": 15},
    "safety_car": {"correct": 20},
}

# ============ TEAM COLORS 2025 ============
TEAM_COLORS = {
    "Red Bull Racing": "#3671C6",
    "Mercedes": "#27F4D2",
    "Ferrari": "#E8002D",
    "McLaren": "#FF8000",
    "Aston Martin": "#229971",
    "Alpine": "#FF87BC",
    "Williams": "#64C4FF",
    "Haas F1 Team": "#B6BABD",
    "RB": "#6692FF",
    "Kick Sauber": "#52E252",
}

# ============ DRIVERS 2025 ============
# Update this at the start of each season
DRIVERS = {
    1:  {"name": "Max Verstappen",    "code": "VER", "team": "Red Bull Racing",  "country": "NL"},
    44: {"name": "Lewis Hamilton",    "code": "HAM", "team": "Ferrari",          "country": "GB"},
    16: {"name": "Charles Leclerc",   "code": "LEC", "team": "Ferrari",          "country": "MC"},
    4:  {"name": "Lando Norris",      "code": "NOR", "team": "McLaren",          "country": "GB"},
    81: {"name": "Oscar Piastri",     "code": "PIA", "team": "McLaren",          "country": "AU"},
    63: {"name": "George Russell",    "code": "RUS", "team": "Mercedes",         "country": "GB"},
    12: {"name": "Andrea Kimi Antonelli", "code": "ANT", "team": "Mercedes",     "country": "IT"},
    14: {"name": "Fernando Alonso",   "code": "ALO", "team": "Aston Martin",     "country": "ES"},
    18: {"name": "Lance Stroll",      "code": "STR", "team": "Aston Martin",     "country": "CA"},
    10: {"name": "Pierre Gasly",      "code": "GAS", "team": "Alpine",           "country": "FR"},
    7:  {"name": "Jack Doohan",       "code": "DOO", "team": "Alpine",           "country": "AU"},
    23: {"name": "Alexander Albon",   "code": "ALB", "team": "Williams",         "country": "TH"},
    55: {"name": "Carlos Sainz",      "code": "SAI", "team": "Williams",         "country": "ES"},
    31: {"name": "Esteban Ocon",      "code": "OCO", "team": "Haas F1 Team",     "country": "FR"},
    87: {"name": "Oliver Bearman",    "code": "BEA", "team": "Haas F1 Team",     "country": "GB"},
    22: {"name": "Yuki Tsunoda",      "code": "TSU", "team": "RB",              "country": "JP"},
    30: {"name": "Liam Lawson",       "code": "LAW", "team": "Red Bull Racing",  "country": "NZ"},
    27: {"name": "Nico Hülkenberg",   "code": "HUL", "team": "Kick Sauber",     "country": "DE"},
    5:  {"name": "Gabriel Bortoleto", "code": "BOR", "team": "Kick Sauber",     "country": "BR"},
    61: {"name": "Isack Hadjar",      "code": "HAD", "team": "RB",              "country": "FR"},
}

# ============ CIRCUIT COORDINATES (for weather) ============
CIRCUITS = {
    "bahrain":       {"lat": 26.0325, "lon": 50.5106, "name": "Bahrain International Circuit"},
    "jeddah":        {"lat": 21.6319, "lon": 39.1044, "name": "Jeddah Corniche Circuit"},
    "albert_park":   {"lat": -37.8497, "lon": 144.968, "name": "Albert Park Circuit"},
    "suzuka":        {"lat": 34.8431, "lon": 136.541, "name": "Suzuka International Racing Course"},
    "shanghai":      {"lat": 31.3389, "lon": 121.220, "name": "Shanghai International Circuit"},
    "miami":         {"lat": 25.9581, "lon": -80.2389, "name": "Miami International Autodrome"},
    "imola":         {"lat": 44.3439, "lon": 11.7167, "name": "Autodromo Enzo e Dino Ferrari"},
    "monaco":        {"lat": 43.7347, "lon": 7.42056, "name": "Circuit de Monaco"},
    "catalunya":     {"lat": 41.5700, "lon": 2.26111, "name": "Circuit de Barcelona-Catalunya"},
    "villeneuve":    {"lat": 45.5000, "lon": -73.5228, "name": "Circuit Gilles Villeneuve"},
    "red_bull_ring": {"lat": 47.2197, "lon": 14.7647, "name": "Red Bull Ring"},
    "silverstone":   {"lat": 52.0786, "lon": -1.01694, "name": "Silverstone Circuit"},
    "hungaroring":   {"lat": 47.5789, "lon": 19.2486, "name": "Hungaroring"},
    "spa":           {"lat": 50.4372, "lon": 5.97139, "name": "Circuit de Spa-Francorchamps"},
    "zandvoort":     {"lat": 52.3888, "lon": 4.54092, "name": "Circuit Zandvoort"},
    "monza":         {"lat": 45.6206, "lon": 9.28111, "name": "Autodromo Nazionale Monza"},
    "baku":          {"lat": 40.3725, "lon": 49.8533, "name": "Baku City Circuit"},
    "marina_bay":    {"lat": 1.29140, "lon": 103.864, "name": "Marina Bay Street Circuit"},
    "cota":          {"lat": 30.1328, "lon": -97.6411, "name": "Circuit of the Americas"},
    "rodriguez":     {"lat": 19.4042, "lon": -99.0907, "name": "Autódromo Hermanos Rodríguez"},
    "interlagos":    {"lat": -23.7036, "lon": -46.6997, "name": "Autódromo José Carlos Pace"},
    "las_vegas":     {"lat": 36.1147, "lon": -115.173, "name": "Las Vegas Street Circuit"},
    "lusail":        {"lat": 25.4900, "lon": 51.4542, "name": "Lusail International Circuit"},
    "yas_marina":    {"lat": 24.4672, "lon": 54.6031, "name": "Yas Marina Circuit"},
}

# ============ CIRCUIT TRACK IMAGES ============
# Maps Ergast circuitId → F1 media track outline image name
CIRCUIT_IMAGES = {
    "bahrain": "Bahrain",
    "jeddah": "Saudi%20Arabia",
    "albert_park": "Australia",
    "suzuka": "Japan",
    "shanghai": "China",
    "miami": "Miami",
    "imola": "Emilia%20Romagna",
    "monaco": "Monaco",
    "catalunya": "Spain",
    "villeneuve": "Canada",
    "red_bull_ring": "Austria",
    "silverstone": "Great%20Britain",
    "hungaroring": "Hungary",
    "spa": "Belgium",
    "zandvoort": "Netherlands",
    "monza": "Italy",
    "baku": "Azerbaijan",
    "marina_bay": "Singapore",
    "americas": "USA",
    "rodriguez": "Mexico",
    "interlagos": "Brazil",
    "las_vegas": "Las%20Vegas",
    "losail": "Qatar",
    "yas_marina": "Abu%20Dhabi",
}

CIRCUIT_IMAGE_BASE = "https://media.formula1.com/image/upload/f_auto/q_auto/v1677245035/content/dam/fom-website/2018-redesign-assets/Track%20outline%20702x405"

# ============ DRIVER PHOTO URL ============
DRIVER_PHOTO_BASE = "https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers"

# ============ TEAM ASSETS (logos, car photos) ============
TEAM_ASSETS = {
    "Red Bull Racing": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/red-bull-racing-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/red-bull-racing.png.transform/4col/image.png",
    },
    "Ferrari": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/ferrari-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/ferrari.png.transform/4col/image.png",
    },
    "McLaren": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/mclaren-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/mclaren.png.transform/4col/image.png",
    },
    "Mercedes": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/mercedes-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/mercedes.png.transform/4col/image.png",
    },
    "Aston Martin": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/aston-martin-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/aston-martin.png.transform/4col/image.png",
    },
    "Alpine": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/alpine-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/alpine.png.transform/4col/image.png",
    },
    "Williams": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/williams-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/williams.png.transform/4col/image.png",
    },
    "Haas F1 Team": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/haas-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/haas.png.transform/4col/image.png",
    },
    "RB": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/rb-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/rb.png.transform/4col/image.png",
    },
    "Kick Sauber": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/kick-sauber-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/kick-sauber.png.transform/4col/image.png",
    },
}

# ============ STREAM / VIDEO SOURCES ============
STREAM_LINKS = [
    {
        "title": "F1 Трансляции",
        "channel": "@stanizlavskylive",
        "url": "https://vkvideo.ru/@stanizlavskylive",
        "platform": "VK Video",
        "icon": "vk",
    },
    {
        "title": "Formula 1 Official",
        "channel": "@Formula1",
        "url": "https://www.youtube.com/@Formula1",
        "platform": "YouTube",
        "icon": "yt",
    },
    {
        "title": "F1 Highlights",
        "channel": "F1",
        "url": "https://www.youtube.com/@Formula1/videos",
        "platform": "YouTube",
        "icon": "yt",
    },
    {
        "title": "Stanizlavsky Telegram",
        "channel": "@stanizlavsky",
        "url": "https://t.me/stanizlavsky",
        "platform": "Telegram",
        "icon": "tg",
    },
]

# ============ TYRE COMPOUNDS ============
TYRE_COLORS = {
    "SOFT": "#FF3333",
    "MEDIUM": "#FFD700",
    "HARD": "#CCCCCC",
    "INTERMEDIATE": "#39B54A",
    "WET": "#0067FF",
    "UNKNOWN": "#888888",
}

# ============ ACHIEVEMENTS ============
ACHIEVEMENTS = {
    "first_prediction":    {"name": "Первый прогноз",      "desc": "Сделай свой первый прогноз",         "icon": "🔮"},
    "first_win":           {"name": "Первая победа",       "desc": "Угадай победителя гонки",            "icon": "🏆"},
    "perfect_podium":      {"name": "Идеальный подиум",    "desc": "Угадай весь подиум",                 "icon": "🥇"},
    "streak_3":            {"name": "Хет-трик",            "desc": "3 правильных прогноза подряд",       "icon": "🔥"},
    "streak_5":            {"name": "На серии!",           "desc": "5 правильных прогнозов подряд",      "icon": "⚡"},
    "streak_10":           {"name": "Непобедимый",         "desc": "10 правильных прогнозов подряд",     "icon": "👑"},
    "points_500":          {"name": "Полтысячи",           "desc": "Набери 500 очков",                   "icon": "💰"},
    "points_1000":         {"name": "Тысячник",            "desc": "Набери 1000 очков",                  "icon": "💎"},
    "games_10":            {"name": "Игрок",               "desc": "Сыграй в 10 мини-игр",               "icon": "🎮"},
    "pit_master":          {"name": "Мастер пит-стопов",   "desc": "Пит-стоп быстрее 2.0 секунд",       "icon": "🔧"},
    "reaction_god":        {"name": "Реакция бога",        "desc": "Реакция быстрее 0.2 секунд",         "icon": "⚡"},
    "all_predictions":     {"name": "Аналитик",            "desc": "Сделай все 5 типов прогнозов",       "icon": "📊"},
}
