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


def _openf1(url):
    try:
        r = urllib.request.urlopen(url, timeout=20)
        return json.loads(r.read())
    except Exception as e:
        log.error(f"openf1 error {url}: {e}")
        return None


def had_safety_car_openf1(season, race_date, country):
    """SC from the race's OWN OpenF1 session race-control history.
    Returns True/False if determinable, None if OpenF1 has no data yet
    (so we keep predictions pending and retry on the next run)."""
    sessions = _openf1(f"https://api.openf1.org/v1/sessions?year={season}&session_name=Race")
    if not isinstance(sessions, list):
        return None
    key = None
    for s in sessions:
        if (s.get("date_start") or "")[:10] == (race_date or "")[:10]:
            key = s.get("session_key"); break
    if key is None and country:
        for s in sessions:
            if s.get("country_name") == country:
                key = s.get("session_key"); break
    if key is None:
        return None
    rc = _openf1(f"https://api.openf1.org/v1/race_control?session_key={key}")
    if not isinstance(rc, list) or not rc:
        return None
    for m in rc:
        msg = (m.get("message", "") or "").upper()
        # FULL Safety Car only — exclude Virtual SC (VSC). OpenF1 tags VSC under
        # category "SafetyCar" with message "VSC DEPLOYED"; match on message text.
        if "SAFETY CAR DEPLOYED" in msg and "VIRTUAL" not in msg and "VSC" not in msg:
            return True
    return False


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

        # Safety car detection from the race's own OpenF1 session history (authoritative).
        # None => OpenF1 has no data yet; safety_car preds stay pending and retry next run.
        _sched = api_get(f"/api/schedule?season={season}") or {}
        _race = next((x for x in _sched.get("races", []) if x.get("round") == race_round), {})
        had_safety_car = had_safety_car_openf1(
            season, (_race.get("race_datetime") or "")[:10], _race.get("country", "")
        )
        log.info(f"  R{race_round} safety_car={had_safety_car}")

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
                if pvalue == podium:
                    # точный порядок P1-P2-P3
                    points, status = PREDICTION_POINTS["podium"]["exact_order"], "correct"
                else:
                    matches = len(set(pvalue) & set(podium))
                    if matches == 3:
                        points, status = PREDICTION_POINTS["podium"]["all_3"], "partial"
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
                if had_safety_car is None:
                    # Skip — keep as pending until manually resolved
                    continue
                predicted_yes = pvalue in (True, "yes", "true")
                if predicted_yes == had_safety_car:
                    points, status = PREDICTION_POINTS["safety_car"]["correct"], "correct"

            # Atomic guard: resolve only if still pending. The in-app
            # _auto_settle_loop may have already settled it — skip to avoid
            # double-awarding points across the two settle processes.
            cur = conn.execute(
                "UPDATE predictions SET status=?, points_won=?, resolved_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'",
                (status, points, pred["id"])
            )
            if cur.rowcount != 1:
                continue
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
