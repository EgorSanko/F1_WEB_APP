#!/usr/bin/env python3
"""
Auto-settle predictions for completed F1 races.
Run via cron every 30 minutes: */30 * * * * python3 /opt/f1-hub/settle_predictions.py
"""

import sqlite3
import json
import urllib.request
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
log = logging.getLogger(__name__)

DB_PATH = "/opt/f1-hub/data/f1hub.db"
API_BASE = "http://localhost:8002"

PREDICTION_POINTS = {
    "winner": {"correct": 50},
    "podium": {"all_3": 100, "2_of_3": 30, "1_of_3": 10},
    "fastest_lap": {"correct": 30},
    "dnf_count": {"exact": 40, "off_by_1": 15},
    "safety_car": {"correct": 20},
}


def api_get(path):
    try:
        r = urllib.request.urlopen(f"{API_BASE}{path}", timeout=30)
        return json.loads(r.read())
    except Exception as e:
        log.error(f"API error {path}: {e}")
        return None


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Find rounds with pending predictions
    pending_rounds = conn.execute(
        "SELECT DISTINCT race_round, season FROM predictions WHERE status = 'pending'"
    ).fetchall()

    if not pending_rounds:
        log.info("No pending predictions")
        conn.close()
        return

    for pr in pending_rounds:
        race_round = pr["race_round"]
        season = pr["season"]
        log.info(f"Checking R{race_round} S{season}...")

        # Get race results via API
        results = api_get(f"/api/race/{race_round}/results?season={season}")
        if not results or not results.get("results"):
            log.info(f"  No results yet for R{race_round}")
            continue

        race_results = results["results"]
        if race_results[0].get("laps", 0) < 10:
            log.info(f"  R{race_round} not enough laps, skipping")
            continue

        winner = race_results[0]["driver_number"]
        podium = [r["driver_number"] for r in race_results[:3]]
        dnf_count = results.get("dnf_count", 0)
        fastest_lap_driver = results.get("fastest_lap_driver")

        # Safety car - check live_race_control DB table first, fallback to API
        had_safety_car = True  # Default to True
        sc_from_db = conn.execute(
            """SELECT COUNT(*) as cnt FROM live_race_control rc
               JOIN live_sessions s ON rc.session_id = s.id
               WHERE rc.category IN ('SafetyCar', 'VirtualSafetyCar')
               AND s.session_type = 'Race'
               ORDER BY s.ended_at DESC LIMIT 1"""
        ).fetchone()
        if sc_from_db and sc_from_db["cnt"] is not None:
            # We have DB data — use it
            had_safety_car = sc_from_db["cnt"] > 0
        else:
            # Fallback: try API
            rc_data = api_get("/api/live/dashboard")
            if rc_data and rc_data.get("race_control", {}).get("messages"):
                msgs = rc_data["race_control"]["messages"]
                has_sc = any(
                    m.get("category") in ("SafetyCar", "VirtualSafetyCar")
                    for m in msgs
                )
                if msgs:
                    had_safety_car = has_sc

        predictions = conn.execute(
            "SELECT * FROM predictions WHERE race_round = ? AND season = ? AND status = 'pending'",
            (race_round, season)
        ).fetchall()

        if not predictions:
            continue

        settled = 0
        for pred in predictions:
            points = 0
            status = "incorrect"
            ptype = pred["prediction_type"]
            try:
                pvalue = json.loads(pred["prediction_value"])
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

            conn.execute(
                "UPDATE predictions SET status=?, points_won=?, resolved_at=CURRENT_TIMESTAMP WHERE id=?",
                (status, points, pred["id"])
            )
            if points > 0:
                conn.execute(
                    "UPDATE users SET points=points+? WHERE user_id=?",
                    (points, pred["user_id"])
                )
            if status == "correct":
                conn.execute(
                    "UPDATE users SET predictions_correct=predictions_correct+1, streak=streak+1, max_streak=MAX(max_streak,streak+1) WHERE user_id=?",
                    (pred["user_id"],)
                )
            elif status == "incorrect":
                conn.execute(
                    "UPDATE users SET streak=0 WHERE user_id=?",
                    (pred["user_id"],)
                )
            settled += 1

        conn.commit()
        # Clear leaderboard cache
        conn.execute("DELETE FROM leaderboard_cache")
        conn.commit()
        log.info(f"  Settled {settled} predictions for R{race_round}")

    conn.close()
    log.info("Done")


if __name__ == "__main__":
    main()
