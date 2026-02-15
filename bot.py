"""
F1 Hub — Telegram Bot
Handles /start, notifications, and scheduled tasks.
"""

import os
import json
import logging
import asyncio
from datetime import datetime, timedelta

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
from telegram.ext import (
    Application, CommandHandler, ContextTypes, JobQueue
)
from telegram.constants import ParseMode

from config import TELEGRAM_TOKEN, WEBAPP_URL, ADMIN_IDS
import database as db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("f1hub.bot")


# ============ COMMAND HANDLERS ============

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command — show welcome message with WebApp button."""
    user = update.effective_user

    # Register user in DB
    db.get_or_create_user(
        user_id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
    )

    keyboard = [[
        InlineKeyboardButton(
            "🏎️ Открыть F1 Hub",
            web_app={"url": WEBAPP_URL}
        )
    ]]

    welcome_text = (
        "🏎️ *F1 Hub* — твой пит\\-уолл в Telegram\n\n"
        "Представь: ты — главный стратег\\. "
        "У тебя есть все данные, все графики, "
        "и никто не орёт в рацию\\.\n\n"
        "⚡ *Live тайминги* — секторы, шины, гэпы в реальном времени\n"
        "🧠 *AI Стратегия* — моделирование пит\\-стопов \\(точность ≈ Ferrari\\)\n"
        "📻 *Радио* — слушай как пилоты ругаются на инженеров\n"
        "🌧 *Радар осадков* — работает лучше чем у FIA\n"
        "🔮 *Прогнозы* — докажи что ты умнее букмекеров\n"
        "🏆 *Чемпионат* — standings, карточки, команды\n"
        "📰 *Новости* — свежее с championat\\.com\n"
        "🔬 *Телеметрия* — скорость, газ, тормоз двух пилотов\n"
        "📅 *Календарь* — 2025 \\+ 2026, время МСК\n\n"
        "_22 пилота · 11 команд · 24 гонки · 47MB RAM · 0 багов \\(наверное\\)_\n\n"
        "Жми кнопку\\. Bwoah\\. 👇"
    )

    await update.message.reply_text(
        welcome_text,
        parse_mode=ParseMode.MARKDOWN_V2,
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /stats — show user's quick stats."""
    user = update.effective_user
    stats = db.get_user_stats(user.id)

    if not stats:
        await update.message.reply_text("Сначала открой приложение через /start")
        return

    rank = db.get_user_rank(user.id) or "—"

    text = (
        f"📊 *Твоя статистика*\n\n"
        f"💰 Очки: *{stats['points']}*\n"
        f"🏆 Рейтинг: *#{rank}*\n"
        f"🔮 Прогнозов: {stats['predictions_total']} "
        f"(✅ {stats['predictions_correct']})\n"
        f"🔥 Серия: {stats['streak']}\n"
        f"🎮 Игр: {stats.get('total_games', 0)}\n"
        f"🏅 Достижений: {len(json.loads(stats.get('achievements', '[]')))}"
    )

    keyboard = [[
        InlineKeyboardButton("🏎️ Открыть F1 Hub", web_app={"url": WEBAPP_URL})
    ]]

    await update.message.reply_text(
        text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command."""
    text = (
        "🏁 *F1 Hub — Помощь*\n\n"
        "Команды:\n"
        "/start — Открыть приложение\n"
        "/stats — Твоя статистика\n"
        "/help — Эта справка\n\n"
        "В приложении:\n"
        "🏠 *Главная* — Следующий гран-при, таймер\n"
        "🏁 *Live* — Позиции и тайминги во время сессии\n"
        "📅 *Гран-при* — Календарь сезона\n"
        "🏆 *Чемпионат* — Таблица пилотов и конструкторов\n"
        "🔮 *Прогнозы* — Сделай прогноз на гонку\n"
        "👤 *Профиль* — Достижения и лидерборд"
    )

    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)


async def cmd_admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin commands."""
    user = update.effective_user
    if user.id not in ADMIN_IDS:
        return

    text = (
        "🔧 *Admin Panel*\n\n"
        f"👥 Пользователей: {len(db.execute('SELECT user_id FROM users'))}\n"
        f"🔮 Прогнозов: {len(db.execute('SELECT id FROM predictions'))}\n"
        f"🎮 Игр: {len(db.execute('SELECT id FROM games'))}\n"
    )

    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)


# ============ NOTIFICATION HELPERS ============

async def send_notification(app: Application, user_id: int, text: str,
                            keyboard=None):
    """Send a notification to a user. Silently fails if user blocked the bot."""
    try:
        reply_markup = InlineKeyboardMarkup(keyboard) if keyboard else None
        await app.bot.send_message(
            chat_id=user_id,
            text=text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup,
        )
    except Exception as e:
        logger.warning(f"Failed to notify user {user_id}: {e}")


async def broadcast(app: Application, text: str, keyboard=None):
    """Send a message to all users."""
    users = db.execute("SELECT user_id FROM users")
    sent = 0
    for u in users:
        await send_notification(app, u["user_id"], text, keyboard)
        sent += 1
        # Respect Telegram rate limits
        if sent % 30 == 0:
            await asyncio.sleep(1)
    logger.info(f"Broadcast sent to {sent} users")


# ============ SCHEDULED JOBS ============

# Track which reminders we already sent (session_key:window -> True)
_sent_reminders = {}


async def check_session_reminder(context: ContextTypes.DEFAULT_TYPE):
    """
    Runs every 5 minutes. Check if any F1 session starts soon and
    send reminders at 24h, 1h, and 10min before.
    """
    try:
        import requests
        r = requests.get(f"{WEBAPP_URL}/api/race/next", timeout=10)
        if r.status_code != 200:
            return

        race = r.json()
        if "sessions" not in race:
            return

        now = datetime.utcnow()
        session_names = {
            "fp1": "FP1", "fp2": "FP2", "fp3": "FP3",
            "qualifying": "Квалификация", "race": "ГОНКА",
            "sprint": "Спринт", "sprint_qualifying": "Спринт-квалификация",
        }

        # Define reminder windows: (label, min_seconds, max_seconds, emoji)
        windows = [
            ("24h", 23*3600, 25*3600, "📅"),
            ("1h", 55*60, 65*60, "⏰"),
            ("10min", 8*60, 12*60, "🚦"),
        ]

        for session_key, session_info in race.get("sessions", {}).items():
            if not session_info.get("date") or not session_info.get("time"):
                continue

            try:
                session_dt = datetime.fromisoformat(
                    f"{session_info['date']}T{session_info['time']}".replace("Z", "")
                )
            except (ValueError, TypeError):
                continue

            diff = (session_dt - now).total_seconds()
            name = session_names.get(session_key, session_key)

            for window_label, min_s, max_s, emoji in windows:
                reminder_key = f"{session_key}:{session_info['date']}:{window_label}"

                if min_s <= diff <= max_s and reminder_key not in _sent_reminders:
                    # Only send 24h reminder for race/qualifying/sprint
                    if window_label == "24h" and session_key not in ("race", "qualifying", "sprint"):
                        continue

                    time_text = {"24h": "через 24 часа", "1h": "через 1 час", "10min": "через 10 минут"}[window_label]

                    text = (
                        f"{emoji} *{name}* {time_text}!\n\n"
                        f"🏎️ {race.get('name', 'Гран-при')}\n"
                        f"📍 {race.get('circuit', '')}"
                    )

                    if window_label == "10min":
                        text += "\n\n_Приготовься! Lights out and away we go!_ 🏁"

                    keyboard = [[InlineKeyboardButton("🏎️ Открыть F1 Hub", web_app={"url": WEBAPP_URL})]]
                    await broadcast(context.application, text, keyboard)
                    _sent_reminders[reminder_key] = True
                    logger.info(f"Sent {window_label} reminder for {name}")

        # Clean up old reminders (older than 48 hours)
        keys_to_remove = []
        for key in _sent_reminders:
            parts = key.split(":")
            if len(parts) >= 2:
                try:
                    d = datetime.fromisoformat(parts[1])
                    if (now - d).total_seconds() > 48 * 3600:
                        keys_to_remove.append(key)
                except ValueError:
                    pass
        for key in keys_to_remove:
            del _sent_reminders[key]

    except Exception as e:
        logger.error(f"Session reminder error: {e}")


async def check_prediction_results(context: ContextTypes.DEFAULT_TYPE):
    """
    Runs every 30 minutes. Check if any predictions were recently settled
    and notify users of their results.
    """
    try:
        # Get users with recently settled predictions (last 2 hours)
        settled = db.execute(
            "SELECT DISTINCT user_id FROM predictions "
            "WHERE status != 'pending' AND settled_at > datetime('now', '-2 hours')"
        )
        if not settled:
            return

        for row in settled:
            uid = row["user_id"]
            # Check if we already notified (use a simple flag in context)
            notify_key = f"pred_notify:{uid}"
            if context.bot_data.get(notify_key):
                continue

            recent = db.execute(
                "SELECT prediction_type, status, points_won, race_round "
                "FROM predictions WHERE user_id = ? AND status != 'pending' "
                "AND settled_at > datetime('now', '-2 hours') "
                "ORDER BY settled_at DESC LIMIT 5",
                (uid,)
            )
            if not recent:
                continue

            correct = sum(1 for p in recent if p["status"] == "correct")
            total_pts = sum(p.get("points_won", 0) or 0 for p in recent)

            text = f"🔮 *Результаты прогнозов*\n\n"
            for p in recent:
                emoji = "✅" if p["status"] == "correct" else "❌" if p["status"] == "incorrect" else "🟡"
                pts = f"+{p.get('points_won', 0)}" if p.get("points_won", 0) else "0"
                text += f"{emoji} R{p['race_round']} {p['prediction_type']}: {pts} очков\n"

            if total_pts > 0:
                text += f"\n🎯 Итого: *+{total_pts} очков*"

            keyboard = [[InlineKeyboardButton("🏎️ Открыть F1 Hub", web_app={"url": WEBAPP_URL})]]
            await send_notification(context.application, uid, text, keyboard)
            context.bot_data[notify_key] = True
            logger.info(f"Sent prediction results to user {uid}")

    except Exception as e:
        logger.error(f"Prediction results notification error: {e}")


async def update_leaderboard_job(context: ContextTypes.DEFAULT_TYPE):
    """Runs every 30 minutes. Update leaderboard cache."""
    try:
        db.update_leaderboard()
        logger.info("Leaderboard updated")
    except Exception as e:
        logger.error(f"Leaderboard update error: {e}")


# ============ SETUP ============

async def post_init(app: Application):
    """Set bot commands after initialization."""
    await app.bot.set_my_commands([
        BotCommand("start", "Открыть F1 Hub"),
        BotCommand("stats", "Моя статистика"),
        BotCommand("help", "Помощь"),
    ])


def main():
    """Start the bot."""
    if not TELEGRAM_TOKEN:
        logger.error("TELEGRAM_TOKEN not set!")
        return

    # Initialize database
    db.init_db()

    # Build application
    app = Application.builder().token(TELEGRAM_TOKEN).post_init(post_init).build()

    # Register handlers
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("admin", cmd_admin))

    # Schedule jobs
    job_queue = app.job_queue
    if job_queue:
        # Check for session reminders every 5 minutes (24h, 1h, 10min before)
        job_queue.run_repeating(check_session_reminder, interval=300, first=60)
        # Check for prediction results every 30 minutes
        job_queue.run_repeating(check_prediction_results, interval=1800, first=300)
        # Update leaderboard every 30 minutes
        job_queue.run_repeating(update_leaderboard_job, interval=1800, first=120)

    logger.info("F1 Hub Bot started")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
