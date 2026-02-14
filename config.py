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
    "Racing Bulls": "#6692FF",
    "Kick Sauber": "#52E252",
}

# ============ DRIVERS 2025 ============
# Updated: mid-season transfers applied (Tsunoda→RBR, Lawson→Racing Bulls, Colapinto→Alpine, Hadjar #35)
_PB = "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/2025Drivers"

def _dp(last, first, size="1col"):
    """Build F1 driver photo URL."""
    s = last.replace("ü", "u").replace("é", "e")
    c = s[:6]
    return f"{_PB}/{c.upper()}01_{first}_{s.upper()}/{c.lower()}01.png.transform/{size}/image.png"

DRIVERS = {
    1:  {"name": "Max Verstappen", "code": "VER", "team": "Red Bull Racing", "country": "NL",
         "photo_url": _dp("Verstappen", "Max"), "photo_url_large": _dp("Verstappen", "Max", "4col")},
    22: {"name": "Yuki Tsunoda", "code": "TSU", "team": "Red Bull Racing", "country": "JP",
         "photo_url": _dp("Tsunoda", "Yuki"), "photo_url_large": _dp("Tsunoda", "Yuki", "4col")},
    44: {"name": "Lewis Hamilton", "code": "HAM", "team": "Ferrari", "country": "GB",
         "photo_url": _dp("Hamilton", "Lewis"), "photo_url_large": _dp("Hamilton", "Lewis", "4col")},
    16: {"name": "Charles Leclerc", "code": "LEC", "team": "Ferrari", "country": "MC",
         "photo_url": _dp("Leclerc", "Charles"), "photo_url_large": _dp("Leclerc", "Charles", "4col")},
    4:  {"name": "Lando Norris", "code": "NOR", "team": "McLaren", "country": "GB",
         "photo_url": _dp("Norris", "Lando"), "photo_url_large": _dp("Norris", "Lando", "4col")},
    81: {"name": "Oscar Piastri", "code": "PIA", "team": "McLaren", "country": "AU",
         "photo_url": _dp("Piastri", "Oscar"), "photo_url_large": _dp("Piastri", "Oscar", "4col")},
    63: {"name": "George Russell", "code": "RUS", "team": "Mercedes", "country": "GB",
         "photo_url": _dp("Russell", "George"), "photo_url_large": _dp("Russell", "George", "4col")},
    12: {"name": "Andrea Kimi Antonelli", "code": "ANT", "team": "Mercedes", "country": "IT",
         "photo_url": _dp("Antonelli", "Kimi"), "photo_url_large": _dp("Antonelli", "Kimi", "4col")},
    14: {"name": "Fernando Alonso", "code": "ALO", "team": "Aston Martin", "country": "ES",
         "photo_url": _dp("Alonso", "Fernando"), "photo_url_large": _dp("Alonso", "Fernando", "4col")},
    18: {"name": "Lance Stroll", "code": "STR", "team": "Aston Martin", "country": "CA",
         "photo_url": _dp("Stroll", "Lance"), "photo_url_large": _dp("Stroll", "Lance", "4col")},
    10: {"name": "Pierre Gasly", "code": "GAS", "team": "Alpine", "country": "FR",
         "photo_url": _dp("Gasly", "Pierre"), "photo_url_large": _dp("Gasly", "Pierre", "4col")},
    43: {"name": "Franco Colapinto", "code": "COL", "team": "Alpine", "country": "AR",
         "photo_url": _dp("Colapinto", "Franco"), "photo_url_large": _dp("Colapinto", "Franco", "4col")},
    23: {"name": "Alexander Albon", "code": "ALB", "team": "Williams", "country": "TH",
         "photo_url": _dp("Albon", "Alexander"), "photo_url_large": _dp("Albon", "Alexander", "4col")},
    55: {"name": "Carlos Sainz", "code": "SAI", "team": "Williams", "country": "ES",
         "photo_url": _dp("Sainz", "Carlos"), "photo_url_large": _dp("Sainz", "Carlos", "4col")},
    31: {"name": "Esteban Ocon", "code": "OCO", "team": "Haas F1 Team", "country": "FR",
         "photo_url": _dp("Ocon", "Esteban"), "photo_url_large": _dp("Ocon", "Esteban", "4col")},
    87: {"name": "Oliver Bearman", "code": "BEA", "team": "Haas F1 Team", "country": "GB",
         "photo_url": _dp("Bearman", "Oliver"), "photo_url_large": _dp("Bearman", "Oliver", "4col")},
    30: {"name": "Liam Lawson", "code": "LAW", "team": "Racing Bulls", "country": "NZ",
         "photo_url": _dp("Lawson", "Liam"), "photo_url_large": _dp("Lawson", "Liam", "4col")},
    35: {"name": "Isack Hadjar", "code": "HAD", "team": "Racing Bulls", "country": "FR",
         "photo_url": _dp("Hadjar", "Isack"), "photo_url_large": _dp("Hadjar", "Isack", "4col")},
    27: {"name": "Nico Hülkenberg", "code": "HUL", "team": "Kick Sauber", "country": "DE",
         "photo_url": _dp("Hülkenberg", "Nico"), "photo_url_large": _dp("Hülkenberg", "Nico", "4col")},
    5:  {"name": "Gabriel Bortoleto", "code": "BOR", "team": "Kick Sauber", "country": "BR",
         "photo_url": _dp("Bortoleto", "Gabriel"), "photo_url_large": _dp("Bortoleto", "Gabriel", "4col")},
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
    "Racing Bulls": {
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

# ============ PAST RACE RECORDINGS (VK Video) ============
_VK_CHANNEL = "https://vkvideo.ru/@stanizlavskylive"
PAST_RACES_VK = [
    # 2025 season
    {"race": "Bahrain GP 2025",        "round": 1,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Saudi Arabia GP 2025",   "round": 2,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Australia GP 2025",      "round": 3,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Japan GP 2025",          "round": 4,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "China GP 2025",          "round": 5,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Miami GP 2025",          "round": 6,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Emilia Romagna GP 2025", "round": 7,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Monaco GP 2025",         "round": 8,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Spain GP 2025",          "round": 9,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Canada GP 2025",         "round": 10, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Austria GP 2025",        "round": 11, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Great Britain GP 2025",  "round": 12, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Hungary GP 2025",        "round": 13, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Belgium GP 2025",        "round": 14, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Netherlands GP 2025",    "round": 15, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Italy GP 2025",          "round": 16, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Azerbaijan GP 2025",     "round": 17, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Singapore GP 2025",      "round": 18, "season": 2025, "url": _VK_CHANNEL},
    {"race": "USA GP 2025",            "round": 19, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Mexico GP 2025",         "round": 20, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Brazil GP 2025",         "round": 21, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Las Vegas GP 2025",      "round": 22, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Qatar GP 2025",          "round": 23, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Abu Dhabi GP 2025",      "round": 24, "season": 2025, "url": _VK_CHANNEL},
    # 2024 season
    {"race": "Bahrain GP 2024",        "round": 1,  "season": 2024, "url": _VK_CHANNEL},
    {"race": "Saudi Arabia GP 2024",   "round": 2,  "season": 2024, "url": _VK_CHANNEL},
    {"race": "Australia GP 2024",      "round": 3,  "season": 2024, "url": _VK_CHANNEL},
    {"race": "Japan GP 2024",          "round": 4,  "season": 2024, "url": _VK_CHANNEL},
    {"race": "China GP 2024",          "round": 5,  "season": 2024, "url": _VK_CHANNEL},
    {"race": "Miami GP 2024",          "round": 6,  "season": 2024, "url": _VK_CHANNEL},
    {"race": "Emilia Romagna GP 2024", "round": 7,  "season": 2024, "url": _VK_CHANNEL},
    {"race": "Monaco GP 2024",         "round": 8,  "season": 2024, "url": _VK_CHANNEL},
    {"race": "Canada GP 2024",         "round": 9,  "season": 2024, "url": _VK_CHANNEL},
    {"race": "Spain GP 2024",          "round": 10, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Austria GP 2024",        "round": 11, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Great Britain GP 2024",  "round": 12, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Hungary GP 2024",        "round": 13, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Belgium GP 2024",        "round": 14, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Netherlands GP 2024",    "round": 15, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Italy GP 2024",          "round": 16, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Azerbaijan GP 2024",     "round": 17, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Singapore GP 2024",      "round": 18, "season": 2024, "url": _VK_CHANNEL},
    {"race": "USA GP 2024",            "round": 19, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Mexico GP 2024",         "round": 20, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Brazil GP 2024",         "round": 21, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Las Vegas GP 2024",      "round": 22, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Qatar GP 2024",          "round": 23, "season": 2024, "url": _VK_CHANNEL},
    {"race": "Abu Dhabi GP 2024",      "round": 24, "season": 2024, "url": _VK_CHANNEL},
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

# ============ STANDINGS FALLBACK (2025 final) ============
# Used when Ergast API returns empty (off-season)
STANDINGS_2025_DRIVERS = [
    {"position": 1,  "driver_number": 1,  "points": 437, "wins": 9},
    {"position": 2,  "driver_number": 4,  "points": 374, "wins": 8},
    {"position": 3,  "driver_number": 16, "points": 356, "wins": 5},
    {"position": 4,  "driver_number": 81, "points": 292, "wins": 3},
    {"position": 5,  "driver_number": 44, "points": 258, "wins": 2},
    {"position": 6,  "driver_number": 63, "points": 231, "wins": 2},
    {"position": 7,  "driver_number": 55, "points": 171, "wins": 0},
    {"position": 8,  "driver_number": 14, "points": 137, "wins": 0},
    {"position": 9,  "driver_number": 22, "points": 96,  "wins": 0},
    {"position": 10, "driver_number": 10, "points": 84,  "wins": 0},
    {"position": 11, "driver_number": 30, "points": 78,  "wins": 0},
    {"position": 12, "driver_number": 23, "points": 68,  "wins": 0},
    {"position": 13, "driver_number": 18, "points": 58,  "wins": 0},
    {"position": 14, "driver_number": 31, "points": 52,  "wins": 0},
    {"position": 15, "driver_number": 12, "points": 48,  "wins": 0},
    {"position": 16, "driver_number": 27, "points": 41,  "wins": 0},
    {"position": 17, "driver_number": 87, "points": 36,  "wins": 0},
    {"position": 18, "driver_number": 35, "points": 22,  "wins": 0},
    {"position": 19, "driver_number": 43, "points": 14,  "wins": 0},
    {"position": 20, "driver_number": 5,  "points": 10,  "wins": 0},
]

STANDINGS_2025_CONSTRUCTORS = [
    {"position": 1,  "team": "McLaren",          "points": 666, "wins": 11},
    {"position": 2,  "team": "Ferrari",          "points": 614, "wins": 7},
    {"position": 3,  "team": "Red Bull Racing",  "points": 533, "wins": 9},
    {"position": 4,  "team": "Mercedes",         "points": 279, "wins": 2},
    {"position": 5,  "team": "Williams",         "points": 239, "wins": 0},
    {"position": 6,  "team": "Aston Martin",     "points": 195, "wins": 0},
    {"position": 7,  "team": "Racing Bulls",     "points": 100, "wins": 0},
    {"position": 8,  "team": "Alpine",           "points": 98,  "wins": 0},
    {"position": 9,  "team": "Haas F1 Team",     "points": 88,  "wins": 0},
    {"position": 10, "team": "Kick Sauber",      "points": 51,  "wins": 0},
]
