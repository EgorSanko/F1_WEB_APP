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
               last_name = COALESCE(?, last_name)
               WHERE user_id = ?""",
            (username, first_name, last_name, user_id)
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


# ============ INIT ============

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
