# -*- coding: utf-8 -*-
"""Рассылка «обновите приложение» пользователям RuStore-версии.
По умолчанию — ТОЛЬКО владельцу (проба). Массовая отправка — с явным --all."""
import sys, json, sqlite3, urllib.request, time
sys.path.insert(0, '/opt/f1-hub')
from config import TELEGRAM_TOKEN

OWNER = 1697882482
RUSTORE = "https://www.rustore.ru/catalog/app/ru.leadseek.f1hub"
TEXT = (
    "🏁 <b>Вышла F1 Hub 2.0</b>\n\n"
    "Приложение полностью переделано:\n"
    "• новый дизайн — как в мини-аппе\n"
    "• прогнозы на гонки и лига участников\n"
    "• трансляции и обзоры по каждому Гран-при\n"
    "• Зал славы, игры, 3D-трассы\n\n"
    "Старая версия больше не показывает данные — обновитесь, "
    "это займёт полминуты."
)
KB = {"inline_keyboard": [[{"text": "⬇️ Обновить в RuStore", "url": RUSTORE}]]}

def send(uid):
    body = json.dumps({
        "chat_id": uid, "text": TEXT, "parse_mode": "HTML",
        "reply_markup": KB, "disable_web_page_preview": False,
    }).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
        data=body, headers={"Content-Type": "application/json"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=20))
        return r.get("ok", False), ""
    except Exception as e:
        return False, str(e)[:70]

targets = []
if "--all" in sys.argv:
    c = sqlite3.connect('/opt/f1-hub/data/f1hub.db')
    targets = [r[0] for r in c.execute(
        "SELECT user_id FROM users WHERE platform='rustore' AND user_id != ?", (OWNER,))]
    print(f'массовая рассылка: {len(targets)} получателей')
else:
    targets = [OWNER]
    print('проба: отправляю только владельцу')

ok = fail = 0
for uid in targets:
    good, err = send(uid)
    if good: ok += 1
    else: fail += 1; print(f'  ✗ {uid}: {err}')
    time.sleep(0.12)                    # бережём лимиты Telegram
print(f'отправлено: {ok}, ошибок: {fail}')
