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
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

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
    "tyre_degradation": 30,     # 30 sec for live, 300 for specific
    "live_track_map": 5,         # 5 sec live, 3600 demo (in code)
    "live_track_map": 2,        # 2 sec — real-time car positions
    "track_outline": 3600,      # 1 hour — track shape doesn't change
    "demo_sessions": 3600,      # 1 hour — list of available demo sessions
    "radio_transcript": 86400,  # 24 hours — transcriptions don't change
    "telemetry_comparison": 300,  # 5 min — best lap comparison
    "strategy_prediction": 600,   # 10 min — strategy simulation
    "weather_radar": 120,         # 2 min — radar updates every 5 min
    "article": 3600,              # 1 hour — articles don't change
    "race_trace": 300,            # 5 min — race trace data
    "speed_traps": 300,           # 5 min — speed trap leaderboard
    "lap_time_series": 300,       # 5 min — all lap times
    "h2h": 900,                   # 15 min — head-to-head
    "car_data": 2,                  # 2 sec — live car telemetry
    "points_progression": 1800,       # 30 min — cumulative points chart
}

# ============ GAME SETTINGS ============
GAME_COOLDOWN_SECONDS = 0  # No cooldown
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

# ============ TEAM COLORS ============
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
TEAM_COLORS_2025 = TEAM_COLORS

# ============ ERGAST API → INTERNAL NAME MAP ============
# Jolpica/Ergast uses different team names than our internal config
TEAM_NAME_MAP = {
    "Red Bull": "Red Bull Racing",
    "RB F1 Team": "Racing Bulls",
    "Alpine F1 Team": "Alpine",
    "Haas F1 Team": "Haas",
    "Cadillac F1 Team": "Cadillac",
    "Kick Sauber": "Kick Sauber",
    "Sauber": "Kick Sauber",
}

def normalize_team_name(name: str) -> str:
    """Map Ergast API team name to internal canonical name."""
    return TEAM_NAME_MAP.get(name, name)


TEAM_COLORS_2026 = {
    "McLaren": "#FF8000",
    "Mercedes": "#27F4D2",
    "Red Bull Racing": "#3671C6",
    "Ferrari": "#E8002D",
    "Williams": "#64C4FF",
    "Racing Bulls": "#6692FF",
    "Aston Martin": "#229971",
    "Alpine": "#FF87BC",
    "Haas": "#B6BABD",
    "Audi": "#00594F",
    "Cadillac": "#1E3D2F",
}

# ============ DRIVERS 2025 ============
# Updated: mid-season transfers applied (Tsunoda→RBR, Lawson→Racing Bulls, Colapinto→Alpine, Hadjar #6)
_PB25 = "https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers"
_PB24 = "https://media.formula1.com/content/dam/fom-website/drivers/2024Drivers"

def _dp(slug, size="1col", year=2025):
    """Build verified F1 driver photo URL. slug = lowercase lastname."""
    base = _PB25 if year == 2025 else _PB24
    return f"{base}/{slug}.png.transform/{size}/image.png"

def _local_photo(driver_number):
    """Local self-hosted driver photo URL (works in Telegram WebApp)."""
    return f"/static/drivers/{driver_number}.png"

DRIVERS = {
    1:  {"name": "Max Verstappen", "code": "VER", "team": "Red Bull Racing", "country": "NL",
         "photo_url": _local_photo(1), "photo_url_large": _dp("verstappen", "4col")},
    22: {"name": "Yuki Tsunoda", "code": "TSU", "team": "Red Bull Racing", "country": "JP",
         "photo_url": _local_photo(22), "photo_url_large": _dp("tsunoda", "4col")},
    44: {"name": "Lewis Hamilton", "code": "HAM", "team": "Ferrari", "country": "GB",
         "photo_url": _local_photo(44), "photo_url_large": _dp("hamilton", "4col")},
    16: {"name": "Charles Leclerc", "code": "LEC", "team": "Ferrari", "country": "MC",
         "photo_url": _local_photo(16), "photo_url_large": _dp("leclerc", "4col")},
    4:  {"name": "Lando Norris", "code": "NOR", "team": "McLaren", "country": "GB",
         "photo_url": _local_photo(4), "photo_url_large": _dp("norris", "4col")},
    81: {"name": "Oscar Piastri", "code": "PIA", "team": "McLaren", "country": "AU",
         "photo_url": _local_photo(81), "photo_url_large": _dp("piastri", "4col")},
    63: {"name": "George Russell", "code": "RUS", "team": "Mercedes", "country": "GB",
         "photo_url": _local_photo(63), "photo_url_large": _dp("russell", "4col")},
    12: {"name": "Andrea Kimi Antonelli", "code": "ANT", "team": "Mercedes", "country": "IT",
         "photo_url": _local_photo(12), "photo_url_large": _dp("antonelli", "4col")},
    14: {"name": "Fernando Alonso", "code": "ALO", "team": "Aston Martin", "country": "ES",
         "photo_url": _local_photo(14), "photo_url_large": _dp("alonso", "4col")},
    18: {"name": "Lance Stroll", "code": "STR", "team": "Aston Martin", "country": "CA",
         "photo_url": _local_photo(18), "photo_url_large": _dp("stroll", "4col")},
    10: {"name": "Pierre Gasly", "code": "GAS", "team": "Alpine", "country": "FR",
         "photo_url": _local_photo(10), "photo_url_large": _dp("gasly", "4col")},
    43: {"name": "Franco Colapinto", "code": "COL", "team": "Alpine", "country": "AR",
         "photo_url": _local_photo(43), "photo_url_large": _dp("colapinto", "4col", year=2024)},
    23: {"name": "Alexander Albon", "code": "ALB", "team": "Williams", "country": "TH",
         "photo_url": _local_photo(23), "photo_url_large": _dp("albon", "4col")},
    55: {"name": "Carlos Sainz", "code": "SAI", "team": "Williams", "country": "ES",
         "photo_url": _local_photo(55), "photo_url_large": _dp("sainz", "4col")},
    31: {"name": "Esteban Ocon", "code": "OCO", "team": "Haas F1 Team", "country": "FR",
         "photo_url": _local_photo(31), "photo_url_large": _dp("ocon", "4col")},
    87: {"name": "Oliver Bearman", "code": "BEA", "team": "Haas F1 Team", "country": "GB",
         "photo_url": _local_photo(87), "photo_url_large": _dp("bearman", "4col")},
    30: {"name": "Liam Lawson", "code": "LAW", "team": "Racing Bulls", "country": "NZ",
         "photo_url": _local_photo(30), "photo_url_large": _dp("lawson", "4col")},
    6:  {"name": "Isack Hadjar", "code": "HAD", "team": "Racing Bulls", "country": "FR",
         "photo_url": _local_photo(6), "photo_url_large": _dp("hadjar", "4col")},
    7:  {"name": "Jack Doohan", "code": "DOO", "team": "Alpine", "country": "AU",
         "photo_url": _local_photo(7), "photo_url_large": _dp("doohan", "4col")},
    27: {"name": "Nico Hülkenberg", "code": "HUL", "team": "Kick Sauber", "country": "DE",
         "photo_url": _local_photo(27), "photo_url_large": _dp("hulkenberg", "4col")},
    5:  {"name": "Gabriel Bortoleto", "code": "BOR", "team": "Kick Sauber", "country": "BR",
         "photo_url": _local_photo(5), "photo_url_large": _dp("bortoleto", "4col")},
}
DRIVERS_2025 = DRIVERS

# ============ DRIVERS 2026 ============
_PB26 = "https://media.formula1.com/content/dam/fom-website/drivers/2026Drivers"

def _dp26(slug, size="1col"):
    return f"{_PB26}/{slug}.png.transform/{size}/image.png"

DRIVERS_2026 = {
    1:  {"name": "Lando Norris",      "code": "NOR", "team": "McLaren",        "country": "GB",
         "photo_url": _local_photo(4), "photo_url_large": _dp("norris", "4col")},
    81: {"name": "Oscar Piastri",     "code": "PIA", "team": "McLaren",        "country": "AU",
         "photo_url": _local_photo(81), "photo_url_large": _dp("piastri", "4col")},
    63: {"name": "George Russell",    "code": "RUS", "team": "Mercedes",       "country": "GB",
         "photo_url": _local_photo(63), "photo_url_large": _dp("russell", "4col")},
    12: {"name": "Kimi Antonelli",    "code": "ANT", "team": "Mercedes",       "country": "IT",
         "photo_url": _local_photo(12), "photo_url_large": _dp("antonelli", "4col")},
    3:  {"name": "Max Verstappen",    "code": "VER", "team": "Red Bull Racing","country": "NL",
         "photo_url": _local_photo(1), "photo_url_large": _dp("verstappen", "4col")},
    6:  {"name": "Isack Hadjar",      "code": "HAD", "team": "Red Bull Racing","country": "FR",
         "photo_url": _local_photo(6), "photo_url_large": _dp("hadjar", "4col")},
    16: {"name": "Charles Leclerc",   "code": "LEC", "team": "Ferrari",        "country": "MC",
         "photo_url": _local_photo(16), "photo_url_large": _dp("leclerc", "4col")},
    44: {"name": "Lewis Hamilton",    "code": "HAM", "team": "Ferrari",        "country": "GB",
         "photo_url": _local_photo(44), "photo_url_large": _dp("hamilton", "4col")},
    23: {"name": "Alex Albon",        "code": "ALB", "team": "Williams",       "country": "TH",
         "photo_url": _local_photo(23), "photo_url_large": _dp("albon", "4col")},
    55: {"name": "Carlos Sainz",      "code": "SAI", "team": "Williams",       "country": "ES",
         "photo_url": _local_photo(55), "photo_url_large": _dp("sainz", "4col")},
    30: {"name": "Liam Lawson",       "code": "LAW", "team": "Racing Bulls",   "country": "NZ",
         "photo_url": _local_photo(30), "photo_url_large": _dp("lawson", "4col")},
    41: {"name": "Arvid Lindblad",    "code": "LIN", "team": "Racing Bulls",   "country": "GB",
         "photo_url": _local_photo(41), "photo_url_large": _dp("lindblad", "4col")},
    14: {"name": "Fernando Alonso",   "code": "ALO", "team": "Aston Martin",   "country": "ES",
         "photo_url": _local_photo(14), "photo_url_large": _dp("alonso", "4col")},
    18: {"name": "Lance Stroll",      "code": "STR", "team": "Aston Martin",   "country": "CA",
         "photo_url": _local_photo(18), "photo_url_large": _dp("stroll", "4col")},
    10: {"name": "Pierre Gasly",      "code": "GAS", "team": "Alpine",         "country": "FR",
         "photo_url": _local_photo(10), "photo_url_large": _dp("gasly", "4col")},
    43: {"name": "Franco Colapinto",  "code": "COL", "team": "Alpine",         "country": "AR",
         "photo_url": _local_photo(43), "photo_url_large": _dp("colapinto", "4col", year=2024)},
    31: {"name": "Esteban Ocon",      "code": "OCO", "team": "Haas",           "country": "FR",
         "photo_url": _local_photo(31), "photo_url_large": _dp("ocon", "4col")},
    87: {"name": "Oliver Bearman",    "code": "BEA", "team": "Haas",           "country": "GB",
         "photo_url": _local_photo(87), "photo_url_large": _dp("bearman", "4col")},
    27: {"name": "Nico Hulkenberg",   "code": "HUL", "team": "Audi",           "country": "DE",
         "photo_url": _local_photo(27), "photo_url_large": _dp("hulkenberg", "4col")},
    5:  {"name": "Gabriel Bortoleto", "code": "BOR", "team": "Audi",           "country": "BR",
         "photo_url": _local_photo(5), "photo_url_large": _dp("bortoleto", "4col")},
    11: {"name": "Sergio Perez",      "code": "PER", "team": "Cadillac",       "country": "MX",
         "photo_url": _local_photo(11), "photo_url_large": _dp("perez", "4col")},
    77: {"name": "Valtteri Bottas",   "code": "BOT", "team": "Cadillac",       "country": "FI",
         "photo_url": _local_photo(77), "photo_url_large": _dp("bottas", "4col")},
}


# ============ SEASON HELPERS ============
CURRENT_SEASON = 2026

def get_drivers(season=2026):
    """Get drivers dict for a specific season."""
    return DRIVERS_2026 if season == 2026 else DRIVERS_2025

def get_team_colors(season=2026):
    """Get team colors for a specific season."""
    return TEAM_COLORS_2026 if season == 2026 else TEAM_COLORS_2025


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
    # Aliases for Jolpica API circuit IDs
    "americas":      {"lat": 30.1328, "lon": -97.6411, "name": "Circuit of the Americas"},
    "vegas":         {"lat": 36.1147, "lon": -115.173, "name": "Las Vegas Street Circuit"},
    "losail":        {"lat": 25.4900, "lon": 51.4542, "name": "Lusail International Circuit"},
    "madring":       {"lat": 40.4168, "lon": -3.7038, "name": "Circuito de Madrid"},
}

# Race laps per circuit (OpenF1 circuit_short_name lowercase → race lap count)
CIRCUIT_LAPS = {
    "sakhir": 57, "bahrain": 57, "jeddah": 50, "albert_park": 58, "albert park": 58,
    "shanghai": 56, "suzuka": 53, "miami": 57, "imola": 63,
    "monaco": 78, "barcelona": 66, "catalunya": 66, "montreal": 70, "villeneuve": 70,
    "spielberg": 71, "red_bull_ring": 71, "silverstone": 52, "spa": 44,
    "spa-francorchamps": 44, "budapest": 70, "hungaroring": 70,
    "zandvoort": 72, "monza": 53, "baku": 51,
    "marina bay": 62, "marina_bay": 62, "singapore": 62,
    "austin": 56, "cota": 56, "americas": 56,
    "mexico city": 71, "rodriguez": 71, "interlagos": 71, "são paulo": 71,
    "las vegas": 50, "vegas": 50,
    "losail": 57, "lusail": 57, "yas marina": 58, "yas_marina": 58,
    "madrid": 66, "madring": 66,
}

# Base lap time per circuit (seconds, approximate race pace)
CIRCUIT_BASE_LAP = {
    "sakhir": 92, "bahrain": 92, "jeddah": 88, "albert_park": 80, "albert park": 80,
    "shanghai": 96, "suzuka": 91, "miami": 92, "imola": 78,
    "monaco": 73, "barcelona": 78, "catalunya": 78, "montreal": 74, "villeneuve": 74,
    "spielberg": 66, "red_bull_ring": 66, "silverstone": 88, "spa": 105,
    "spa-francorchamps": 105, "budapest": 78, "hungaroring": 78,
    "zandvoort": 72, "monza": 82, "baku": 103,
    "marina bay": 100, "marina_bay": 100, "singapore": 100,
    "austin": 97, "cota": 97, "americas": 97,
    "mexico city": 79, "rodriguez": 79, "interlagos": 72, "são paulo": 72,
    "las vegas": 94, "vegas": 94,
    "losail": 84, "lusail": 84, "yas marina": 87, "yas_marina": 87,
    "madrid": 78, "madring": 78,
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
    "vegas": "Las%20Vegas",
    "losail": "Qatar",
    "yas_marina": "Abu%20Dhabi",
}

CIRCUIT_IMAGE_BASE = "https://media.formula1.com/image/upload/f_auto/q_auto/v1677245035/content/dam/fom-website/2018-redesign-assets/Track%20outline%20702x405"

# ============ CIRCUIT CARD IMAGES (race promo cards) ============
CIRCUIT_CARD_IMAGES = {
    "albert_park": "australia",
    "shanghai": "china",
    "suzuka": "japan",
    "bahrain": "bahrain",
    "jeddah": "saudi-arabia",
    "miami": "miami",
    "villeneuve": "canada",
    "monaco": "monaco",
    "catalunya": "spain",
    "red_bull_ring": "austria",
    "silverstone": "great-britain",
    "spa": "belgium",
    "hungaroring": "hungary",
    "zandvoort": "netherlands",
    "monza": "italy",
    "baku": "azerbaijan",
    "marina_bay": "singapore",
    "americas": "united-states",
    "rodriguez": "mexico",
    "interlagos": "brazil",
    "las_vegas": "las-vegas",
    "losail": "qatar",
    "yas_marina": "abu-dhabi",
}

def get_circuit_card_url(circuit_id, width=720):
    """Get race promo card image URL from formula1.com CDN."""
    slug = CIRCUIT_CARD_IMAGES.get(circuit_id, "")
    if not slug:
        return ""
    return f"https://media.formula1.com/image/upload/c_lfill,w_{width}/q_auto/v1740000000/fom-website/static-assets/2026/races/card/{slug}.webp"

# ============ DRIVER PHOTO URL ============
DRIVER_PHOTO_BASE = "https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers"

# ============ F1 CDN DRIVER PHOTO CODES ============
# Format: driver_number -> (team_slug, driver_code)
F1_PHOTO_CODES_2025 = {
    1:  ("redbullracing", "maxver01"),     # Verstappen
    22: ("redbullracing", "yuktsu01"),     # Tsunoda (moved to RBR mid-season)
    44: ("ferrari", "lewham01"),           # Hamilton
    16: ("ferrari", "chalec01"),           # Leclerc
    4:  ("mclaren", "lannor01"),           # Norris
    81: ("mclaren", "oscpia01"),           # Piastri
    63: ("mercedes", "georus01"),          # Russell
    12: ("mercedes", "andant01"),          # Antonelli
    14: ("astonmartin", "feralo01"),       # Alonso
    18: ("astonmartin", "lanstr01"),       # Stroll
    10: ("alpine", "piegas01"),            # Gasly
    43: ("alpine", "fracol01"),            # Colapinto
    23: ("williams", "alealb01"),          # Albon
    55: ("williams", "carsai01"),          # Sainz
    31: ("haasf1team", "estoco01"),        # Ocon
    87: ("haasf1team", "olibea01"),        # Bearman
    30: ("racingbulls", "lialaw01"),       # Lawson
    6:  ("racingbulls", "isahad01"),       # Hadjar
    7:  ("alpine", "jacdoo01"),            # Doohan
    27: ("kicksauber", "nichul01"),        # Hulkenberg
    5:  ("kicksauber", "gabbor01"),        # Bortoleto
}

F1_PHOTO_CODES_2026 = {
    1:  ("mclaren", "lannor01"),           # Norris
    81: ("mclaren", "oscpia01"),           # Piastri
    63: ("mercedes", "georus01"),          # Russell
    12: ("mercedes", "andant01"),          # Antonelli
    3:  ("redbullracing", "maxver01"),     # Verstappen
    6:  ("redbullracing", "isahad01"),     # Hadjar
    44: ("ferrari", "lewham01"),           # Hamilton
    16: ("ferrari", "chalec01"),           # Leclerc
    14: ("astonmartin", "feralo01"),       # Alonso
    18: ("astonmartin", "lanstr01"),       # Stroll
    23: ("williams", "alealb01"),          # Albon
    55: ("williams", "carsai01"),          # Sainz
    10: ("alpine", "piegas01"),            # Gasly
    43: ("alpine", "fracol01"),            # Colapinto
    31: ("haasf1team", "estoco01"),        # Ocon
    87: ("haasf1team", "olibea01"),        # Bearman
    30: ("racingbulls", "lialaw01"),       # Lawson  (Note: kept for mapping)
    22: ("racingbulls", "yuktsu01"),       # Tsunoda
    41: ("racingbulls", "arvlin01"),       # Lindblad
    27: ("audi", "nichul01"),             # Hulkenberg
    5:  ("audi", "gabbor01"),             # Bortoleto
    77: ("cadillac", "valbot01"),          # Bottas
    11: ("cadillac", "serper01"),          # Perez
}

CUSTOM_CARD_PHOTOS = {
    77: {"url": "/static/drivers/77_custom.jpg", "position": "center 85%"},
}

def get_f1_cdn_photo(driver_number, season=2026, width=200):
    """Get driver avatar photo URL (face-cropped square for round avatars)."""
    codes = F1_PHOTO_CODES_2026 if season == 2026 else F1_PHOTO_CODES_2025
    if driver_number not in codes:
        return ""
    team, code = codes[driver_number]
    return f"https://media.formula1.com/image/upload/c_fill,g_north,ar_1:1,w_{width}/q_auto/v1740000000/common/f1/{season}/{team}/{code}/{season}{team}{code}right.webp"

def get_f1_cdn_card_photo(driver_number, season=2026):
    """Get driver card photo (larger, may be custom). Returns (url, position)."""
    if driver_number in CUSTOM_CARD_PHOTOS:
        custom = CUSTOM_CARD_PHOTOS[driver_number]
        if isinstance(custom, dict):
            return custom["url"], custom.get("position", "top center")
        return custom, "top center"
    codes = F1_PHOTO_CODES_2026 if season == 2026 else F1_PHOTO_CODES_2025
    if driver_number not in codes:
        return "", "top center"
    team, code = codes[driver_number]
    return f"https://media.formula1.com/image/upload/c_fill,w_400,h_300,g_north/q_auto/v1740000000/common/f1/{season}/{team}/{code}/{season}{team}{code}right.webp", "top center"

# ============ TEAM ASSETS (logos, car photos) ============
TEAM_ASSETS = {
    "Red Bull Racing": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/redbullracing/2026redbullracinglogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/redbullracing/2026redbullracingcarright.webp",
    },
    "Ferrari": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/ferrari/2026ferrarilogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/ferrari/2026ferraricarright.webp",
    },
    "McLaren": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/mclaren/2026mclarenlogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/mclaren/2026mclarencarright.webp",
    },
    "Mercedes": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/mercedes/2026mercedeslogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/mercedes/2026mercedescarright.webp",
    },
    "Aston Martin": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/astonmartin/2026astonmartinlogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/astonmartin/2026astonmartincarright.webp",
    },
    "Alpine": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/alpine/2026alpinelogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/alpine/2026alpinecarright.webp",
    },
    "Williams": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/williams/2026williamslogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/williams/2026williamscarright.webp",
    },
    "Haas F1 Team": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/haasf1team/2026haasf1teamlogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/haasf1team/2026haasf1teamcarright.webp",
    },
    "Racing Bulls": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/racingbulls/2026racingbullslogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/racingbulls/2026racingbullscarright.webp",
    },
    "Kick Sauber": {
        "logo": "https://media.formula1.com/content/dam/fom-website/teams/2025/kick-sauber-logo.png.transform/2col/image.png",
        "car": "https://media.formula1.com/content/dam/fom-website/teams/2025/kick-sauber.png.transform/4col/image.png",
    },
    "Haas": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/haasf1team/2026haasf1teamlogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/haasf1team/2026haasf1teamcarright.webp",
    },
    "Audi": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/audi/2026audilogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/audi/2026audicarright.webp",
    },
    "Cadillac": {
        "logo": "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1/2026/cadillac/2026cadillaclogowhite.webp",
        "car": "https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/v1740000001/common/f1/2026/cadillac/2026cadillaccarright.webp",
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
# Main VK groups with F1 race recordings:
#   -212096379 = Вершина Автоспорта (versporta) — Попов и Фабричнова commentary
#   -52461685  = F1 archive group — numbered episodes, Setanta Sports commentary
#   -213739922 = АиМ Трансляции — Попов и Фабричнова, 1080p
_VK_V = "https://vk.com/video"  # prefix for direct video links

# Direct VK video links for 2025 races (found via web search)
VK_DIRECT_2025 = {
    1: f"{_VK_V}-212096379_456239428",   # Австралия
    2: f"{_VK_V}-52461685_456258496",    # Китай
    3: f"{_VK_V}-212096379_456239453",   # Япония
    5: f"{_VK_V}-212096379_456239481",   # Саудовская Аравия
    7: f"{_VK_V}-212096379_456239539",   # Эмилия-Романья
    11: f"{_VK_V}-52461685_456259022",   # Австрия
    12: f"{_VK_V}-52461685_456259056",   # Великобритания
    13: f"{_VK_V}-213739922_456242679",  # Бельгия
    14: f"{_VK_V}-212096379_456239710",  # Венгрия
    15: f"{_VK_V}-212096379_456239724",  # Нидерланды
    22: f"{_VK_V}-52461685_456259606",   # Лас-Вегас
}

PAST_RACES_VK = [
    # 2025 season — direct VK video links where found, channel fallback otherwise
    {"race": "Australia GP 2025",      "round": 1,  "season": 2025, "url": f"{_VK_V}-212096379_456239428"},
    {"race": "China GP 2025",          "round": 2,  "season": 2025, "url": f"{_VK_V}-52461685_456258496"},
    {"race": "Japan GP 2025",          "round": 3,  "season": 2025, "url": f"{_VK_V}-212096379_456239453"},
    {"race": "Bahrain GP 2025",        "round": 4,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Saudi Arabia GP 2025",   "round": 5,  "season": 2025, "url": f"{_VK_V}-212096379_456239481"},
    {"race": "Miami GP 2025",          "round": 6,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Emilia Romagna GP 2025", "round": 7,  "season": 2025, "url": f"{_VK_V}-212096379_456239539"},
    {"race": "Monaco GP 2025",         "round": 8,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Spain GP 2025",          "round": 9,  "season": 2025, "url": _VK_CHANNEL},
    {"race": "Canada GP 2025",         "round": 10, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Austria GP 2025",        "round": 11, "season": 2025, "url": f"{_VK_V}-52461685_456259022"},
    {"race": "Great Britain GP 2025",  "round": 12, "season": 2025, "url": f"{_VK_V}-52461685_456259056"},
    {"race": "Belgium GP 2025",        "round": 13, "season": 2025, "url": f"{_VK_V}-213739922_456242679"},
    {"race": "Hungary GP 2025",        "round": 14, "season": 2025, "url": f"{_VK_V}-212096379_456239710"},
    {"race": "Netherlands GP 2025",    "round": 15, "season": 2025, "url": f"{_VK_V}-212096379_456239724"},
    {"race": "Italy GP 2025",          "round": 16, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Azerbaijan GP 2025",     "round": 17, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Singapore GP 2025",      "round": 18, "season": 2025, "url": _VK_CHANNEL},
    {"race": "USA GP 2025",            "round": 19, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Mexico GP 2025",         "round": 20, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Brazil GP 2025",         "round": 21, "season": 2025, "url": _VK_CHANNEL},
    {"race": "Las Vegas GP 2025",      "round": 22, "season": 2025, "url": f"{_VK_V}-52461685_456259606"},
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
    {"position": 1,  "driver_number": 4,  "points": 423, "wins": 7},   # Норрис
    {"position": 2,  "driver_number": 1,  "points": 421, "wins": 8},   # Ферстаппен
    {"position": 3,  "driver_number": 81, "points": 410, "wins": 7},   # Пиастри
    {"position": 4,  "driver_number": 63, "points": 319, "wins": 2},   # Расселл
    {"position": 5,  "driver_number": 16, "points": 242, "wins": 0},   # Леклер
    {"position": 6,  "driver_number": 44, "points": 156, "wins": 0},   # Хэмилтон
    {"position": 7,  "driver_number": 12, "points": 150, "wins": 0},   # Антонелли
    {"position": 8,  "driver_number": 23, "points": 73,  "wins": 0},   # Албон
    {"position": 9,  "driver_number": 55, "points": 64,  "wins": 0},   # Сайнс
    {"position": 10, "driver_number": 14, "points": 56,  "wins": 0},   # Алонсо
    {"position": 11, "driver_number": 27, "points": 51,  "wins": 0},   # Хюлькенберг
    {"position": 12, "driver_number": 6,  "points": 51,  "wins": 0},   # Хаджар
    {"position": 13, "driver_number": 87, "points": 41,  "wins": 0},   # Берман
    {"position": 14, "driver_number": 30, "points": 38,  "wins": 0},   # Лоусон
    {"position": 15, "driver_number": 31, "points": 38,  "wins": 0},   # Окон
    {"position": 16, "driver_number": 18, "points": 33,  "wins": 0},   # Стролл
    {"position": 17, "driver_number": 22, "points": 33,  "wins": 0},   # Цунода
    {"position": 18, "driver_number": 10, "points": 22,  "wins": 0},   # Гасли
    {"position": 19, "driver_number": 5,  "points": 19,  "wins": 0},   # Бортолето
    {"position": 20, "driver_number": 43, "points": 0,   "wins": 0},   # Колапинто
    {"position": 21, "driver_number": 7,  "points": 0,   "wins": 0},   # Дуэн
]

STANDINGS_2025_CONSTRUCTORS = [
    {"position": 1,  "team": "McLaren",          "points": 833, "wins": 14},
    {"position": 2,  "team": "Mercedes",         "points": 469, "wins": 2},
    {"position": 3,  "team": "Red Bull Racing",  "points": 451, "wins": 8},
    {"position": 4,  "team": "Ferrari",          "points": 398, "wins": 0},
    {"position": 5,  "team": "Williams",         "points": 137, "wins": 0},
    {"position": 6,  "team": "Racing Bulls",     "points": 92,  "wins": 0},
    {"position": 7,  "team": "Aston Martin",     "points": 89,  "wins": 0},
    {"position": 8,  "team": "Haas F1 Team",     "points": 79,  "wins": 0},
    {"position": 9,  "team": "Kick Sauber",      "points": 70,  "wins": 0},
    {"position": 10, "team": "Alpine",           "points": 22,  "wins": 0},
]

# ============ SEASON 2025 RESULTS (all 24 races) ============
# Data sourced from Jolpica/Ergast API; podium = [P1, P2, P3] driver numbers
# sprint = True for sprint weekends
SEASON_2025_RESULTS = {
    1: {
        "name": "Гран-при Австралии",
        "date": "2025-03-16",
        "circuit_id": "albert_park",
        "laps": 57,
        "session_key": 9693,
        "podium": [4, 1, 63],
        "top_10": [4, 1, 63, 12, 23, 18, 27, 16, 81, 44],
    },
    2: {
        "name": "Гран-при Китая",
        "date": "2025-03-23",
        "circuit_id": "shanghai",
        "laps": 56,
        "sprint": True,
        "session_key": 9998,
        "sprint_session_key": 9993,
        "podium": [81, 4, 63],
        "top_10": [81, 4, 63, 1, 31, 12, 23, 87, 18, 55],
        "sprint_podium": [44, 81, 1],
        "sprint_top_10": [44, 81, 1, 63, 16, 22, 12, 4, 18, 14],
    },
    3: {
        "name": "Гран-при Японии",
        "date": "2025-04-06",
        "circuit_id": "suzuka",
        "laps": 53,
        "session_key": 10006,
        "podium": [1, 4, 81],
        "top_10": [1, 4, 81, 16, 63, 12, 44, 6, 23, 87],
    },
    4: {
        "name": "Гран-при Бахрейна",
        "date": "2025-04-13",
        "circuit_id": "bahrain",
        "laps": 57,
        "session_key": 10014,
        "podium": [81, 63, 4],
        "top_10": [81, 63, 4, 16, 44, 1, 10, 31, 22, 87],
    },
    5: {
        "name": "Гран-при Саудовской Аравии",
        "date": "2025-04-20",
        "circuit_id": "jeddah",
        "laps": 50,
        "session_key": 10022,
        "podium": [81, 1, 16],
        "top_10": [81, 1, 16, 4, 63, 12, 44, 55, 23, 6],
    },
    6: {
        "name": "Гран-при Майами",
        "date": "2025-05-04",
        "circuit_id": "miami",
        "laps": 57,
        "sprint": True,
        "session_key": 10033,
        "sprint_session_key": 10028,
        "podium": [81, 4, 63],
        "top_10": [81, 4, 63, 1, 23, 12, 16, 44, 55, 22],
        "sprint_podium": [4, 81, 44],
        "sprint_top_10": [4, 81, 44, 63, 18, 22, 12, 10, 27, 6],
    },
    7: {
        "name": "Гран-при Эмилии-Романьи",
        "date": "2025-05-18",
        "circuit_id": "imola",
        "laps": 63,
        "session_key": 9987,
        "podium": [1, 4, 81],
        "top_10": [1, 4, 81, 44, 23, 16, 63, 55, 6, 22],
    },
    8: {
        "name": "Гран-при Монако",
        "date": "2025-05-25",
        "circuit_id": "monaco",
        "laps": 78,
        "session_key": 9979,
        "podium": [4, 16, 81],
        "top_10": [4, 16, 81, 1, 44, 6, 31, 30, 23, 55],
    },
    9: {
        "name": "Гран-при Испании",
        "date": "2025-06-01",
        "circuit_id": "catalunya",
        "laps": 66,
        "session_key": 9971,
        "podium": [81, 4, 16],
        "top_10": [81, 4, 16, 63, 27, 44, 6, 10, 14, 1],
    },
    10: {
        "name": "Гран-при Канады",
        "date": "2025-06-15",
        "circuit_id": "villeneuve",
        "laps": 70,
        "session_key": 9963,
        "podium": [63, 1, 12],
        "top_10": [63, 1, 12, 81, 16, 44, 14, 27, 31, 55],
    },
    11: {
        "name": "Гран-при Австрии",
        "date": "2025-06-29",
        "circuit_id": "red_bull_ring",
        "laps": 70,
        "session_key": 9955,
        "podium": [4, 81, 16],
        "top_10": [4, 81, 16, 44, 63, 30, 14, 5, 27, 31],
    },
    12: {
        "name": "Гран-при Великобритании",
        "date": "2025-07-06",
        "circuit_id": "silverstone",
        "laps": 52,
        "session_key": 9947,
        "podium": [4, 81, 27],
        "top_10": [4, 81, 27, 44, 1, 10, 18, 23, 14, 63],
    },
    13: {
        "name": "Гран-при Бельгии",
        "date": "2025-07-27",
        "circuit_id": "spa",
        "laps": 44,
        "sprint": True,
        "session_key": 9939,
        "sprint_session_key": 9934,
        "podium": [81, 4, 16],
        "top_10": [81, 4, 16, 1, 63, 23, 44, 30, 5, 10],
        "sprint_podium": [1, 81, 4],
        "sprint_top_10": [1, 81, 4, 16, 31, 55, 87, 6, 5, 30],
    },
    14: {
        "name": "Гран-при Венгрии",
        "date": "2025-08-03",
        "circuit_id": "hungaroring",
        "laps": 70,
        "session_key": 9928,
        "podium": [4, 81, 63],
        "top_10": [4, 81, 63, 16, 14, 5, 18, 30, 1, 12],
    },
    15: {
        "name": "Гран-при Нидерландов",
        "date": "2025-08-31",
        "circuit_id": "zandvoort",
        "laps": 72,
        "session_key": 9920,
        "podium": [81, 1, 6],
        "top_10": [81, 1, 6, 63, 23, 87, 18, 14, 22, 31],
    },
    16: {
        "name": "Гран-при Италии",
        "date": "2025-09-07",
        "circuit_id": "monza",
        "laps": 53,
        "session_key": 9912,
        "podium": [1, 4, 81],
        "top_10": [1, 4, 81, 16, 63, 44, 23, 5, 12, 6],
    },
    17: {
        "name": "Гран-при Азербайджана",
        "date": "2025-09-21",
        "circuit_id": "baku",
        "laps": 51,
        "session_key": 9904,
        "podium": [1, 63, 55],
        "top_10": [1, 63, 55, 12, 30, 22, 4, 44, 16, 6],
    },
    18: {
        "name": "Гран-при Сингапура",
        "date": "2025-10-05",
        "circuit_id": "marina_bay",
        "laps": 62,
        "session_key": 9896,
        "podium": [63, 1, 4],
        "top_10": [63, 1, 4, 81, 12, 16, 14, 44, 87, 55],
    },
    19: {
        "name": "Гран-при США",
        "date": "2025-10-19",
        "circuit_id": "americas",
        "laps": 56,
        "sprint": True,
        "session_key": 9888,
        "sprint_session_key": 9883,
        "podium": [1, 4, 16],
        "top_10": [1, 4, 16, 44, 81, 63, 22, 27, 87, 14],
        "sprint_podium": [1, 63, 55],
        "sprint_top_10": [1, 63, 55, 44, 16, 23, 22, 12, 30, 10],
    },
    20: {
        "name": "Гран-при Мексики",
        "date": "2025-10-26",
        "circuit_id": "rodriguez",
        "laps": 71,
        "session_key": 9877,
        "podium": [4, 16, 1],
        "top_10": [4, 16, 1, 87, 81, 12, 63, 44, 31, 5],
    },
    21: {
        "name": "Гран-при Бразилии",
        "date": "2025-11-09",
        "circuit_id": "interlagos",
        "laps": 71,
        "sprint": True,
        "session_key": 9869,
        "sprint_session_key": 9864,
        "podium": [4, 12, 1],
        "top_10": [4, 12, 1, 63, 81, 87, 30, 6, 27, 10],
        "sprint_podium": [4, 12, 63],
        "sprint_top_10": [4, 12, 63, 1, 16, 14, 44, 10, 18, 6],
    },
    22: {
        "name": "Гран-при Лас-Вегаса",
        "date": "2025-11-23",
        "circuit_id": "vegas",
        "laps": 50,
        "session_key": 9858,
        "podium": [1, 63, 12],
        "top_10": [1, 63, 12, 16, 55, 6, 27, 44, 31, 87],
    },
    23: {
        "name": "Гран-при Катара",
        "date": "2025-11-30",
        "circuit_id": "losail",
        "laps": 57,
        "sprint": True,
        "session_key": 9850,
        "sprint_session_key": 9845,
        "podium": [1, 81, 55],
        "top_10": [1, 81, 55, 4, 12, 63, 14, 16, 30, 22],
        "sprint_podium": [81, 63, 4],
        "sprint_top_10": [81, 63, 4, 1, 22, 12, 14, 55, 6, 23],
    },
    24: {
        "name": "Гран-при Абу-Даби",
        "date": "2025-12-07",
        "circuit_id": "yas_marina",
        "laps": 58,
        "session_key": 9839,
        "podium": [1, 81, 4],
        "top_10": [1, 81, 4, 16, 63, 14, 31, 44, 27, 18],
    },
}
