# -*- coding: utf-8 -*-
"""Досылка тем, кто не получил из-за таймаута сети.
Telegram с этого VPS режется провайдером — поэтому две попытки:
напрямую, затем через SOCKS-туннель f1hub-socks (127.0.0.1:1080)."""
import sys, json, subprocess, time
sys.path.insert(0, '/opt/f1-hub')
from config import TELEGRAM_TOKEN

RUSTORE = "https://www.rustore.ru/catalog/app/ru.leadseek.f1hub"
TEXT = ("🏁 <b>Вышла F1 Hub 2.0</b>\n\n"
        "Приложение полностью переделано:\n"
        "• новый дизайн — как в мини-аппе\n"
        "• прогнозы на гонки и лига участников\n"
        "• трансляции и обзоры по каждому Гран-при\n"
        "• Зал славы, игры, 3D-трассы\n\n"
        "Старая версия больше не показывает данные — обновитесь, "
        "это займёт полминуты.")
KB = {"inline_keyboard": [[{"text": "⬇️ Обновить в RuStore", "url": RUSTORE}]]}

RETRY = [320780747, 826846980, 5907193318, 6337682235, 7221343124, 7761043098]

def send(uid, via_proxy):
    payload = json.dumps({"chat_id": uid, "text": TEXT, "parse_mode": "HTML",
                          "reply_markup": KB}, ensure_ascii=False)
    cmd = ["curl", "-s", "--max-time", "25", "-X", "POST",
           "-H", "Content-Type: application/json", "-d", payload,
           f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"]
    if via_proxy:
        cmd[1:1] = ["--socks5-hostname", "127.0.0.1:1080"]
    try:
        out = subprocess.run(cmd, capture_output=True, timeout=40).stdout.decode()
        d = json.loads(out or "{}")
        return d.get("ok", False), (d.get("description") or "")[:60]
    except Exception as e:
        return False, str(e)[:60]

ok = fail = 0
for uid in RETRY:
    good, err = send(uid, via_proxy=False)
    how = "напрямую"
    if not good:
        good, err = send(uid, via_proxy=True)
        how = "через прокси"
    if good:
        ok += 1; print(f'  ✓ {uid} — доставлено ({how})')
    else:
        fail += 1; print(f'  ✗ {uid} — {err}')
    time.sleep(0.3)
print(f'\nдослано: {ok}, не доставлено: {fail}')
