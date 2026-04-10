"""
F1 Hub — Database Layer
SQLite with WAL mode, connection pooling, and all CRUD operations.
"""

import sqlite3
import json
import os
import threading
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

from config import DATABASE_PATH, INITIAL_USER_POINTS, GAME_COOLDOWN_SECONDS


# ============ CONNECTION MANAGEMENT ============

_local = threading.local()


def _get_connection() -> sqlite3.Connection:
    """Get thread-local database connection."""
    if not hasattr(_local, "conn") or _local.conn is None:
        os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
        conn = sqlite3.connect(DATABASE_PATH, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return _local.conn


@contextmanager
def get_db():
    """Context manager for database operations with auto-commit/rollback."""
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def execute(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Execute a query and return list of dicts."""
    with get_db() as conn:
        cursor = conn.execute(query, params)
        if cursor.description:
            return [dict(row) for row in cursor.fetchall()]
        return []


def execute_one(query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    """Execute a query and return a single dict or None."""
    rows = execute(query, params)
    return rows[0] if rows else None


def execute_write(query: str, params: tuple = ()) -> int:
    """Execute a write query and return lastrowid."""
    with get_db() as conn:
        cursor = conn.execute(query, params)
        return cursor.lastrowid


# ============ SCHEMA ============

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    photo_url TEXT,
    favorite_driver INTEGER,
    favorite_team TEXT,
    points INTEGER DEFAULT {initial_points},
    predictions_correct INTEGER DEFAULT 0,
    predictions_total INTEGER DEFAULT 0,
    achievements TEXT DEFAULT '[]',
    streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    race_round INTEGER NOT NULL,
    season INTEGER NOT NULL,
    prediction_type TEXT NOT NULL,
    prediction_value TEXT NOT NULL,
    points_bet INTEGER DEFAULT 0,
    points_won INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE(user_id, race_round, season, prediction_type)
);

CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_type TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    details TEXT,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_key TEXT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE(user_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS leaderboard_cache (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    photo_url TEXT,
    total_points INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    rank INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_race ON predictions(race_round, season);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_type_time ON games(user_id, game_type, played_at);
CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);

CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    race_round INTEGER NOT NULL,
    season INTEGER NOT NULL,
    session_type TEXT NOT NULL,
    title TEXT,
    video_url TEXT NOT NULL,
    embed_url TEXT,
    is_live BOOLEAN DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_race ON broadcasts(race_round, season);
CREATE INDEX IF NOT EXISTS idx_broadcasts_live ON broadcasts(is_live);

CREATE TABLE IF NOT EXISTS live_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT,
    meeting_name TEXT,
    session_name TEXT,
    session_type TEXT,
    circuit_short_name TEXT,
    country_name TEXT,
    status TEXT DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    signalr_data TEXT
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_key ON live_sessions(session_key);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);

CREATE TABLE IF NOT EXISTS live_race_control (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    category TEXT,
    flag TEXT,
    message TEXT,
    scope TEXT,
    sector INTEGER,
    lap_number INTEGER,
    driver_number INTEGER,
    ts TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES live_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_live_rc_session ON live_race_control(session_id);
CREATE INDEX IF NOT EXISTS idx_live_rc_category ON live_race_control(category);

CREATE TABLE IF NOT EXISTS live_timing_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    driver_number INTEGER,
    position INTEGER,
    gap_to_leader TEXT,
    interval TEXT,
    last_lap_time TEXT,
    best_lap_time TEXT,
    num_laps INTEGER,
    status TEXT,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES live_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_live_timing_session ON live_timing_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_live_timing_driver ON live_timing_snapshots(session_id, driver_number);
""".format(initial_points=INITIAL_USER_POINTS)


def init_db():
    """Initialize database schema."""
    with get_db() as conn:
        conn.executescript(SCHEMA)
    print(f"[DB] Database initialized at {DATABASE_PATH}")


# ============ USER OPERATIONS ============

def get_or_create_user(user_id: int, username: str = None,
                       first_name: str = None, last_name: str = None,
                       photo_url: str = None) -> Dict[str, Any]:
    """Get existing user or create a new one. Updates last_active."""
    user = execute_one("SELECT * FROM users WHERE user_id = ?", (user_id,))

    if user:
        # Update last_active and basic info
        execute_write(
            """UPDATE users SET last_active = CURRENT_TIMESTAMP,
               username = COALESCE(?, username),
               first_name = COALESCE(?, first_name),
               last_name = COALESCE(?, last_name),
               photo_url = COALESCE(?, photo_url)
               WHERE user_id = ?""",
            (username, first_name, last_name, photo_url, user_id)
        )
        user = execute_one("SELECT * FROM users WHERE user_id = ?", (user_id,))
    else:
        execute_write(
            """INSERT INTO users (user_id, username, first_name, last_name, photo_url)
               VALUES (?, ?, ?, ?, ?)""",
            (user_id, username, first_name, last_name, photo_url)
        )
        user = execute_one("SELECT * FROM users WHERE user_id = ?", (user_id,))

    return user


def update_user_favorite(user_id: int, driver: int = None, team: str = None):
    """Set user's favorite driver and/or team."""
    if driver is not None:
        execute_write("UPDATE users SET favorite_driver = ? WHERE user_id = ?", (driver, user_id))
    if team is not None:
        execute_write("UPDATE users SET favorite_team = ? WHERE user_id = ?", (team, user_id))


def add_user_points(user_id: int, points: int):
    """Add points to user. Points can be negative."""
    execute_write("UPDATE users SET points = MAX(0, points + ?) WHERE user_id = ?", (points, user_id))


def get_user_stats(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user with full statistics."""
    return execute_one(
        """SELECT u.*,
           (SELECT COUNT(*) FROM predictions WHERE user_id = u.user_id AND status = 'correct') as wins,
           (SELECT COUNT(*) FROM predictions WHERE user_id = u.user_id AND status != 'pending') as total_settled,
           (SELECT COUNT(*) FROM games WHERE user_id = u.user_id) as total_games
           FROM users u WHERE u.user_id = ?""",
        (user_id,)
    )


# ============ PREDICTION OPERATIONS ============

def create_prediction(user_id: int, race_round: int, season: int,
                      prediction_type: str, prediction_value: Any,
                      points_bet: int = 0) -> int:
    """Create a new prediction. Returns prediction id."""
    value_json = json.dumps(prediction_value) if not isinstance(prediction_value, str) else prediction_value
    return execute_write(
        """INSERT INTO predictions (user_id, race_round, season, prediction_type, prediction_value, points_bet)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, race_round, season, prediction_type)
           DO UPDATE SET prediction_value = excluded.prediction_value,
                         points_bet = excluded.points_bet,
                         status = 'pending',
                         created_at = CURRENT_TIMESTAMP""",
        (user_id, race_round, season, prediction_type, value_json, points_bet)
    )


def get_user_predictions(user_id: int, race_round: int = None,
                         season: int = None) -> List[Dict[str, Any]]:
    """Get user's predictions, optionally filtered by race."""
    if race_round and season:
        return execute(
            "SELECT * FROM predictions WHERE user_id = ? AND race_round = ? AND season = ? ORDER BY created_at DESC",
            (user_id, race_round, season)
        )
    return execute(
        "SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        (user_id,)
    )


def get_pending_predictions(race_round: int, season: int) -> List[Dict[str, Any]]:
    """Get all pending predictions for a race."""
    return execute(
        "SELECT * FROM predictions WHERE race_round = ? AND season = ? AND status = 'pending'",
        (race_round, season)
    )


def resolve_prediction(prediction_id: int, status: str, points_won: int):
    """Resolve a prediction with result."""
    execute_write(
        """UPDATE predictions SET status = ?, points_won = ?, resolved_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (status, points_won, prediction_id)
    )


# ============ GAME OPERATIONS ============

def record_game(user_id: int, game_type: str, score: int,
                points_earned: int, details: str = None) -> int:
    """Record a game result."""
    execute_write(
        "UPDATE users SET games_played = games_played + 1, points = points + ? WHERE user_id = ?",
        (points_earned, user_id)
    )
    return execute_write(
        "INSERT INTO games (user_id, game_type, score, points_earned, details) VALUES (?, ?, ?, ?, ?)",
        (user_id, game_type, score, points_earned, details)
    )


def can_play_game(user_id: int, game_type: str) -> Dict[str, Any]:
    """Check if user can play a game (cooldown)."""
    last = execute_one(
        "SELECT played_at FROM games WHERE user_id = ? AND game_type = ? ORDER BY played_at DESC LIMIT 1",
        (user_id, game_type)
    )

    if not last:
        return {"can_play": True, "seconds_left": 0}

    last_time = datetime.fromisoformat(last["played_at"])
    now = datetime.utcnow()
    elapsed = (now - last_time).total_seconds()
    remaining = max(0, GAME_COOLDOWN_SECONDS - elapsed)

    return {
        "can_play": remaining <= 0,
        "seconds_left": int(remaining),
        "next_available": (last_time + timedelta(seconds=GAME_COOLDOWN_SECONDS)).isoformat()
    }


def get_game_history(user_id: int, game_type: str = None, limit: int = 20) -> List[Dict[str, Any]]:
    """Get user's game history."""
    if game_type:
        return execute(
            "SELECT * FROM games WHERE user_id = ? AND game_type = ? ORDER BY played_at DESC LIMIT ?",
            (user_id, game_type, limit)
        )
    return execute(
        "SELECT * FROM games WHERE user_id = ? ORDER BY played_at DESC LIMIT ?",
        (user_id, limit)
    )


# ============ ACHIEVEMENT OPERATIONS ============

def unlock_achievement(user_id: int, achievement_key: str) -> bool:
    """Unlock an achievement for a user. Returns True if newly unlocked."""
    existing = execute_one(
        "SELECT id FROM achievements WHERE user_id = ? AND achievement_key = ?",
        (user_id, achievement_key)
    )
    if existing:
        return False

    execute_write(
        "INSERT INTO achievements (user_id, achievement_key) VALUES (?, ?)",
        (user_id, achievement_key)
    )

    # Update user's achievements JSON
    user_achievements = get_user_achievements(user_id)
    keys = [a["achievement_key"] for a in user_achievements]
    execute_write(
        "UPDATE users SET achievements = ? WHERE user_id = ?",
        (json.dumps(keys), user_id)
    )
    return True


def get_user_achievements(user_id: int) -> List[Dict[str, Any]]:
    """Get all achievements for a user."""
    return execute(
        "SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC",
        (user_id,)
    )


def check_and_award_achievements(user_id: int) -> List[str]:
    """Check and award any newly earned achievements. Returns list of newly unlocked keys."""
    user = get_user_stats(user_id)
    if not user:
        return []

    newly_unlocked = []

    # Points-based
    if user["points"] >= 500:
        if unlock_achievement(user_id, "points_500"):
            newly_unlocked.append("points_500")
    if user["points"] >= 1000:
        if unlock_achievement(user_id, "points_1000"):
            newly_unlocked.append("points_1000")

    # Prediction-based
    if user["predictions_total"] >= 1:
        if unlock_achievement(user_id, "first_prediction"):
            newly_unlocked.append("first_prediction")
    if user["predictions_correct"] >= 1:
        if unlock_achievement(user_id, "first_win"):
            newly_unlocked.append("first_win")

    # Streak-based
    if user["streak"] >= 3:
        if unlock_achievement(user_id, "streak_3"):
            newly_unlocked.append("streak_3")
    if user["streak"] >= 5:
        if unlock_achievement(user_id, "streak_5"):
            newly_unlocked.append("streak_5")
    if user["streak"] >= 10:
        if unlock_achievement(user_id, "streak_10"):
            newly_unlocked.append("streak_10")

    # Games-based
    if user.get("total_games", 0) >= 10:
        if unlock_achievement(user_id, "games_10"):
            newly_unlocked.append("games_10")

    # Check all prediction types
    pred_types = execute(
        "SELECT DISTINCT prediction_type FROM predictions WHERE user_id = ?",
        (user_id,)
    )
    if len(pred_types) >= 5:
        if unlock_achievement(user_id, "all_predictions"):
            newly_unlocked.append("all_predictions")

    return newly_unlocked


# ============ LEADERBOARD ============

def update_leaderboard():
    """Rebuild the leaderboard cache."""
    execute_write("DELETE FROM leaderboard_cache")
    execute_write(
        """INSERT INTO leaderboard_cache (user_id, username, first_name, photo_url,
           total_points, correct_predictions, rank, updated_at)
           SELECT u.user_id, u.username, u.first_name, u.photo_url,
                  u.points, u.predictions_correct,
                  ROW_NUMBER() OVER (ORDER BY u.points DESC),
                  CURRENT_TIMESTAMP
           FROM users u
           ORDER BY u.points DESC
           LIMIT 100"""
    )


def get_leaderboard(limit: int = 50) -> List[Dict[str, Any]]:
    """Get leaderboard, refreshing if stale."""
    latest = execute_one("SELECT updated_at FROM leaderboard_cache ORDER BY updated_at DESC LIMIT 1")

    if not latest or (datetime.utcnow() - datetime.fromisoformat(latest["updated_at"])).total_seconds() > 300:
        update_leaderboard()

    return execute(
        "SELECT * FROM leaderboard_cache ORDER BY rank ASC LIMIT ?",
        (limit,)
    )


def get_user_rank(user_id: int) -> Optional[int]:
    """Get user's rank in leaderboard."""
    row = execute_one("SELECT rank FROM leaderboard_cache WHERE user_id = ?", (user_id,))
    return row["rank"] if row else None


# ============ BROADCAST OPERATIONS ============

def upsert_broadcast(race_round, season, session_type, video_url,
                     embed_url=None, title=None, is_live=False, created_by=None):
    existing = execute_one(
        "SELECT id FROM broadcasts WHERE race_round=? AND season=? AND session_type=?",
        (race_round, season, session_type)
    )
    if existing:
        execute_write(
            "UPDATE broadcasts SET video_url=?,embed_url=?,title=?,is_live=?,created_by=COALESCE(?,created_by) WHERE id=?",
            (video_url, embed_url, title, int(is_live), created_by, existing["id"])
        )
        return existing["id"]
    return execute_write(
        "INSERT INTO broadcasts(race_round,season,session_type,video_url,embed_url,title,is_live,created_by) VALUES(?,?,?,?,?,?,?,?)",
        (race_round, season, session_type, video_url, embed_url, title, int(is_live), created_by)
    )


def get_broadcasts(race_round=None, season=None, is_live=None):
    query = "SELECT * FROM broadcasts WHERE 1=1"
    params = []
    if race_round is not None:
        query += " AND race_round=?"; params.append(race_round)
    if season is not None:
        query += " AND season=?"; params.append(season)
    if is_live is not None:
        query += " AND is_live=?"; params.append(int(is_live))
    query += " ORDER BY race_round DESC, session_type ASC"
    return execute(query, tuple(params))


def end_broadcast(broadcast_id):
    execute_write("UPDATE broadcasts SET is_live=0,ended_at=CURRENT_TIMESTAMP WHERE id=?", (broadcast_id,))


def delete_broadcast(broadcast_id):
    execute_write("DELETE FROM broadcasts WHERE id=?", (broadcast_id,))


def get_live_broadcasts():
    return execute("SELECT * FROM broadcasts WHERE is_live=1 ORDER BY started_at DESC")


def auto_end_stale_broadcasts(hours=4):
    execute_write(
        "UPDATE broadcasts SET is_live=0,ended_at=CURRENT_TIMESTAMP WHERE is_live=1 AND started_at<datetime('now','-'||?||' hours')",
        (str(hours),)
    )


# ============ LIVE SESSION OPERATIONS ============

def create_live_session(meeting_name: str, session_name: str,
                        session_type: str = None, circuit_short_name: str = None,
                        country_name: str = None, session_key: str = None,
                        signalr_data: str = None) -> int:
    """Create a new live session record. Returns session id."""
    return execute_write(
        """INSERT INTO live_sessions
           (session_key, meeting_name, session_name, session_type,
            circuit_short_name, country_name, signalr_data)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (session_key, meeting_name, session_name, session_type,
         circuit_short_name, country_name, signalr_data)
    )


def get_active_live_session() -> Optional[Dict[str, Any]]:
    """Get the currently active live session."""
    return execute_one(
        "SELECT * FROM live_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1"
    )


def end_live_session(session_id: int):
    """Mark a live session as ended."""
    execute_write(
        "UPDATE live_sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
        (session_id,)
    )


def end_all_live_sessions():
    """End all active sessions (used on reconnect with new SessionInfo)."""
    execute_write(
        "UPDATE live_sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE status = 'active'"
    )


def save_race_control_message(session_id: int, category: str = None,
                               flag: str = None, message: str = None,
                               scope: str = None, sector: int = None,
                               lap_number: int = None, driver_number: int = None,
                               ts: str = None):
    """Save a race control message."""
    execute_write(
        """INSERT INTO live_race_control
           (session_id, category, flag, message, scope, sector, lap_number, driver_number, ts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (session_id, category, flag, message, scope, sector, lap_number, driver_number, ts)
    )


def get_race_control_messages(session_id: int, category: str = None) -> List[Dict[str, Any]]:
    """Get race control messages for a session, optionally filtered by category."""
    if category:
        return execute(
            "SELECT * FROM live_race_control WHERE session_id = ? AND category = ? ORDER BY ts ASC",
            (session_id, category)
        )
    return execute(
        "SELECT * FROM live_race_control WHERE session_id = ? ORDER BY ts ASC",
        (session_id,)
    )


def has_safety_car(session_id: int) -> bool:
    """Check if a session had a safety car or VSC deployment."""
    row = execute_one(
        """SELECT COUNT(*) as cnt FROM live_race_control
           WHERE session_id = ? AND category IN ('SafetyCar', 'VirtualSafetyCar')""",
        (session_id,)
    )
    return (row["cnt"] if row else 0) > 0


def save_timing_snapshot(session_id: int, driver_number: int, position: int = None,
                         gap_to_leader: str = None, interval: str = None,
                         last_lap_time: str = None, best_lap_time: str = None,
                         num_laps: int = None, status: str = None):
    """Save a timing snapshot for a driver."""
    execute_write(
        """INSERT INTO live_timing_snapshots
           (session_id, driver_number, position, gap_to_leader, interval,
            last_lap_time, best_lap_time, num_laps, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (session_id, driver_number, position, gap_to_leader, interval,
         last_lap_time, best_lap_time, num_laps, status)
    )


def get_latest_timing(session_id: int) -> List[Dict[str, Any]]:
    """Get the latest timing snapshot for each driver in a session."""
    return execute(
        """SELECT t.* FROM live_timing_snapshots t
           INNER JOIN (
               SELECT driver_number, MAX(id) as max_id
               FROM live_timing_snapshots
               WHERE session_id = ?
               GROUP BY driver_number
           ) latest ON t.id = latest.max_id
           ORDER BY t.position ASC""",
        (session_id,)
    )


def get_latest_session_for_round(race_round: int, season: int) -> Optional[Dict[str, Any]]:
    """Find the most recent live session matching a race round/season (by meeting name heuristic)."""
    return execute_one(
        """SELECT * FROM live_sessions
           WHERE status = 'ended' AND session_type = 'Race'
           ORDER BY ended_at DESC LIMIT 1"""
    )


# ============ INIT ============

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
