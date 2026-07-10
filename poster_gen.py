#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""F1 Hub — генератор постеров Гран-при (v3: шаблоны юзера, 4:5, 4 стиля).

Стили: cinematic (24ч) | retro (1ч) | fans (5мин) | official (универсальный).
Типографику в постере рисует модель (латиница, по шаблонам); опция --overlay
добавляет русскую шапку кодом поверх (для стилей без текста).

  python3 poster_gen.py --auto                     # cron-режим
  python3 poster_gen.py --style official --send-to <id>
Ключ: poster.env; SOCKS: f1hub-socks (NL) + fallback CF Worker.
"""
import argparse
import base64
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
API = "http://localhost:8002"
OUT_DIR = os.path.join(HERE, "data", "posters")
FONTS = os.path.join(HERE, "fonts")
MODEL = "openai/gpt-5.4-image-2"
SOCKS = os.environ.get("POSTER_SOCKS", "127.0.0.1:1080")
CF_URL = os.environ.get("POSTER_CF_URL", "https://or-proxy.egor3sanko22.workers.dev")

# ---------- данные по странам: трасса EN, landmark, цвета флага, погода, характер ----------
C = {
    "Australia":    dict(track="Albert Park Circuit", landmark="Melbourne skyline and the Yarra river", colors="green and gold", weather="bright autumn morning light", desc="fast flowing parkland circuit"),
    "China":        dict(track="Shanghai International Circuit", landmark="Shanghai skyline with the Oriental Pearl Tower", colors="red and gold", weather="hazy spring afternoon", desc="modern technical circuit with the long snail corner"),
    "Japan":        dict(track="Suzuka Circuit", landmark="Mount Fuji and cherry blossom trees", colors="white and red", weather="clear spring day with drifting sakura petals", desc="legendary figure-eight high-speed temple"),
    "USA":          dict(track="Miami International Autodrome", landmark="Miami skyline with palm trees and art-deco district", colors="red, white and blue", weather="hot sunny day with turquoise sky", desc="modern street-style circuit"),
    "Canada":       dict(track="Circuit Gilles Villeneuve", landmark="Montreal skyline across the St Lawrence river", colors="red and white", weather="fresh summer day", desc="fast island circuit famous for the Wall of Champions"),
    "Monaco":       dict(track="Circuit de Monaco", landmark="Monte Carlo harbor with super-yachts and the Casino", colors="red and white", weather="glamorous golden riviera evening", desc="the tightest and most prestigious street circuit"),
    "Spain":        dict(track="Circuit de Barcelona-Catalunya", landmark="Sagrada Familia silhouette", colors="red and yellow", weather="warm Mediterranean sunshine", desc="classic all-round technical circuit"),
    "Austria":      dict(track="Red Bull Ring", landmark="green Styrian alpine hills", colors="red and white", weather="crisp mountain air with dramatic clouds", desc="short fast circuit with big elevation"),
    "UK":           dict(track="Silverstone Circuit", landmark="British countryside and heritage hangars", colors="red, white and blue", weather="moody British sky with breaking sunlight", desc="the high-speed home of British motorsport"),
    "Great Britain":dict(track="Silverstone Circuit", landmark="British countryside and heritage hangars", colors="red, white and blue", weather="moody British sky with breaking sunlight", desc="the high-speed home of British motorsport"),
    "Belgium":      dict(track="Spa-Francorchamps", landmark="misty Ardennes pine forest and the Eau Rouge hill", colors="black, yellow and red", weather="dramatic rain clouds and wet asphalt", desc="legendary forest circuit with huge elevation changes"),
    "Hungary":      dict(track="Hungaroring", landmark="Hungarian Parliament Building over the Danube in Budapest", colors="red, white and green", weather="warm summer sunset", desc="tight technical circuit like a go-kart track"),
    "Netherlands":  dict(track="Circuit Zandvoort", landmark="North Sea dunes and a Dutch windmill", colors="orange and the red-white-blue tricolor", weather="breezy seaside day with orange smoke", desc="banked dune circuit with the orange army"),
    "Italy":        dict(track="Autodromo Nazionale Monza", landmark="Monza royal park and the Duomo di Milano", colors="green, white and red", weather="golden late-summer light", desc="the temple of speed"),
    "Azerbaijan":   dict(track="Baku City Circuit", landmark="Flame Towers and the medieval Old City walls", colors="blue, red and green", weather="warm dusk with city lights", desc="fastest street circuit with a castle section"),
    "Singapore":    dict(track="Marina Bay Street Circuit", landmark="Marina Bay Sands and the neon skyline", colors="red and white", weather="tropical night under floodlights", desc="night street circuit"),
    "Mexico":       dict(track="Autodromo Hermanos Rodriguez", landmark="Dia de los Muertos marigolds, papel picado and Aztec motifs", colors="green, white and red", weather="high-altitude golden evening", desc="stadium circuit with the foro sol arena"),
    "Brazil":       dict(track="Interlagos", landmark="Sao Paulo skyline", colors="green and yellow", weather="dramatic storm light", desc="legendary anticlockwise circuit of carnival passion"),
    "Qatar":        dict(track="Lusail International Circuit", landmark="Doha skyline and desert dunes", colors="maroon and white", weather="desert night under floodlights", desc="fast flowing night circuit"),
    "UAE":          dict(track="Yas Marina Circuit", landmark="Yas Hotel with its glowing LED shell", colors="red, green, white and black", weather="twilight fading into night", desc="season finale marina circuit"),
    "Abu Dhabi":    dict(track="Yas Marina Circuit", landmark="Yas Hotel with its glowing LED shell", colors="red, green, white and black", weather="twilight fading into night", desc="season finale marina circuit"),
    "Saudi Arabia": dict(track="Jeddah Corniche Circuit", landmark="Jeddah corniche along the Red Sea", colors="green and white", weather="night race with city glow", desc="fastest street circuit on the calendar"),
    "Bahrain":      dict(track="Bahrain International Circuit", landmark="desert palm groves and the Sakhir tower", colors="red and white", weather="desert dusk", desc="abrasive desert circuit"),
}
ADJ = {
    "Australia": "AUSTRALIAN", "China": "CHINESE", "Japan": "JAPANESE",
    "USA": "MIAMI", "Canada": "CANADIAN", "Monaco": "MONACO",
    "Spain": "SPANISH", "Austria": "AUSTRIAN", "UK": "BRITISH",
    "Great Britain": "BRITISH", "Belgium": "BELGIAN", "Hungary": "HUNGARIAN",
    "Netherlands": "DUTCH", "Italy": "ITALIAN", "Azerbaijan": "AZERBAIJAN",
    "Singapore": "SINGAPORE", "Mexico": "MEXICO CITY", "Brazil": "SAO PAULO",
    "Qatar": "QATAR", "UAE": "ABU DHABI", "Abu Dhabi": "ABU DHABI",
    "Saudi Arabia": "SAUDI ARABIAN", "Bahrain": "BAHRAIN",
}

DEFAULT_C = dict(track="the circuit", landmark="iconic national landmarks", colors="national flag colors", weather="dramatic cinematic weather", desc="challenging grand prix circuit")

STYLES = {
    "cinematic": """Create an ultra-premium cinematic Formula 1 Grand Prix poster. Portrait 4:5.
The main focus is a modern Formula 1 car driving directly toward the viewer at high speed, dramatic low angle, motion blur, sparks, flying spray, glowing brake discs, tire smoke, reflections, cinematic lighting.
The race takes place at {track}. In the background seamlessly blend the most iconic landmark of {country}: {landmark}. The landmark must feel naturally integrated, not pasted.
Use the national colors of {country} throughout: {colors}. Atmosphere of this Grand Prix: {desc}. Weather: {weather}.
Realistic grandstands packed with passionate fans waving national flags. Dramatic volumetric lighting, racing smoke, sparks, reflections on asphalt.
Composition like an official Formula One promotional artwork. Typography occupies around 20% of the poster. Large bold modern title: 'FORMULA 1' then '{country_upper} GRAND PRIX' then '2026'. Below smaller: '{track_upper}' and '{dates}'. Exact spelling matters, check every letter. Premium Formula 1 branding style.
Ultra cinematic color grading, high contrast, HDR, deep blacks, orange-blue lighting mixed with national colors. Photorealistic, sharp focus, 8K, award-winning poster. No extra logos, no sponsors, no watermark.""",

    "retro": """Create a vintage-inspired Formula 1 Grand Prix poster in the style of classic European motorsport travel advertisements from the 1950s-1970s. Portrait 4:5.
Feature a beautiful classic Formula One race car driving through the famous {track}. In the background place the iconic landmark of {country}: {landmark}.
Authentic retro illustration aesthetics: painted textures, aged paper, slightly faded colors, screen print effect, vintage typography, subtle imperfections. Incorporate the national colors of {country}: {colors}.
Warm nostalgic lighting, elegant composition, golden sunset, classic racing atmosphere celebrating the heritage of Formula One.
Typography like premium vintage travel posters. Large title: '{country_upper} GRAND PRIX' then '2026'. Subtitle: 'FORMULA 1'. Bottom: '{track_upper}' and '{dates}'. Exact spelling matters, check every letter.
Highly detailed, museum-quality illustration. No sponsors, no watermark, no modern advertising.""",

    "fans": """Create an epic Formula 1 Grand Prix poster focused on the atmosphere and passion of the fans. Portrait 4:5.
Foreground: thousands of passionate Formula One fans celebrating in the grandstands, waving huge national flags of {country}. Colored smoke fills the sky in the national colors: {colors}. Flares, fireworks, confetti, banners.
In the distance a Formula 1 car races through {track} at incredible speed. The iconic landmark of {country} ({landmark}) appears in the background, beautifully integrated.
Golden sunset light mixed with dramatic stadium lighting. Speed, passion, celebration, Formula One culture. Very dynamic wide-angle cinematic perspective, volumetric smoke, flying confetti, motion blur.
Official Formula One promotional artwork style. Typography occupies around 20%: large title 'FORMULA 1' then '{country_upper} GRAND PRIX' then '2026'. Bottom: '{track_upper}' and '{dates}'. Exact spelling matters, check every letter.
Ultra realistic, HDR, extremely detailed, 8K, professional color grading, award-winning sports poster. No sponsors, no watermark, no extra logos.""",

    "official": """Create a minimalist premium Formula 1 season-poster in the style of official Formula1.com promotional artwork (F1 75 aesthetic). Portrait 4:5.
Clean modern composition with generous negative space on a deep near-black background with a subtle asphalt texture. One modern Formula 1 car rendered in crisp studio-quality detail, positioned dynamically in the lower half, subtle motion streaks.
A single elegant graphic element: a glowing ribbon in the national colors of {country} ({colors}) flowing through the composition like a stylized racing line of {track}. A minimal, abstract hint of {landmark} in thin elegant linework.
Sophisticated grid-based layout. Typography is the hero, around 25% of the poster, Swiss design: huge bold condensed 'FORMULA 1' wordmark, below it '{country_upper} GRAND PRIX', a large red '2026', small caps '{track_upper} · {dates}'. Exact spelling matters, check every letter.
Premium, expensive, restrained. Perfect kerning. High contrast. Subtle red #E10600 accents. Looks indistinguishable from official Formula 1 season promo art. No sponsors, no watermark, no extra logos.""",
}

MONTHS_EN = ["", "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
             "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"]


def http_json(url, payload=None, headers=None, timeout=180):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers or {})
    if payload is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def load_key():
    envf = os.path.join(HERE, "poster.env")
    if os.path.exists(envf):
        for line in open(envf):
            if line.startswith("OPENROUTER_KEY="):
                return line.split("=", 1)[1].strip()
    return os.environ.get("OPENROUTER_KEY", "")


def next_race(round_override=None):
    sched = http_json(API + "/api/schedule", timeout=60)
    races = sched.get("races", [])
    if round_override:
        for r in races:
            if r.get("round") == round_override:
                return r
        raise SystemExit(f"round {round_override} not found")
    from datetime import datetime
    now = datetime.utcnow()
    for r in races:
        dt = r.get("race_datetime")
        if dt and datetime.fromisoformat(dt.replace("Z", "")) > now:
            return r
    raise SystemExit("no upcoming race")


def build_prompt(race, style):
    from datetime import datetime, timedelta
    c = C.get(race.get("country", ""), DEFAULT_C)
    country = race.get("country") or "the host country"
    dt = datetime.fromisoformat((race.get("race_datetime") or "").replace("Z", ""))
    start = dt - timedelta(days=2)
    if start.month == dt.month:
        dates = f"{start.day}-{dt.day} {MONTHS_EN[dt.month]} {dt.year}"
    else:
        dates = f"{start.day} {MONTHS_EN[start.month]} - {dt.day} {MONTHS_EN[dt.month]} {dt.year}"
    return STYLES[style].format(
        country=country, country_upper=ADJ.get(country, country.upper()),
        track=c["track"], track_upper=c["track"].upper(),
        landmark=c["landmark"], colors=c["colors"],
        weather=c["weather"], desc=c["desc"], dates=dates)


def gen_background(race, style, key):
    """OpenRouter блокирует RU-IP: SOCKS-туннель (NL) -> fallback CF Worker."""
    import subprocess, tempfile
    prompt = build_prompt(race, style)
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "modalities": ["image", "text"],
        "image_config": {"aspect_ratio": "4:5"},
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(body, f)
        bf = f.name

    def _curl(extra, base):
        return subprocess.run(
            ["curl", "-s", *extra, "-m", "240",
             "-H", "Authorization: Bearer " + key,
             "-H", "Content-Type: application/json",
             "-H", "HTTP-Referer: https://f1hub.lead-seek.ru",
             "-H", "X-Title: f1hub-poster",
             "-d", "@" + bf,
             base + "/api/v1/chat/completions"],
            capture_output=True, text=True, timeout=300)

    try:
        out = _curl(["--socks5-hostname", SOCKS], "https://openrouter.ai")
        m = re.search(r"data:image/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)", out.stdout or "")
        if not m:
            print("socks path failed, retry via CF worker...")
            out = _curl([], CF_URL)
            m = re.search(r"data:image/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)", out.stdout or "")
    finally:
        os.unlink(bf)
    if not m:
        raise SystemExit("no image in response: " + (out.stdout or out.stderr or "")[:400])
    return base64.b64decode(m.group(1))


def save_poster(bg_bytes, race, style):
    out = os.path.join(OUT_DIR, f"round{race['round']}-{style}.png")
    os.makedirs(OUT_DIR, exist_ok=True)
    open(out, "wb").write(bg_bytes)
    return out


def send_photo(chat_id, path, caption):
    sys.path.insert(0, HERE)
    from config import TELEGRAM_TOKEN
    import mimetypes, uuid
    boundary = uuid.uuid4().hex
    fields = {"chat_id": str(chat_id), "caption": caption}
    body = b""
    for k, v in fields.items():
        body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").encode()
    fname = os.path.basename(path)
    body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"{fname}\"\r\n"
             f"Content-Type: {mimetypes.guess_type(fname)[0] or 'image/png'}\r\n\r\n").encode()
    body += open(path, "rb").read() + b"\r\n" + f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode()).get("ok")


def all_user_ids():
    import sqlite3
    conn = sqlite3.connect(os.path.join(HERE, "data", "f1hub.db"))
    ids = [r[0] for r in conn.execute("SELECT user_id FROM users").fetchall()]
    conn.close()
    return ids


def broadcast(path, caption):
    ok = fail = 0
    for uid in all_user_ids():
        try:
            if send_photo(uid, path, caption):
                ok += 1
            else:
                fail += 1
        except Exception:
            fail += 1
    print(f"broadcast: ok={ok} fail={fail}")
    return ok


AUTO_WINDOWS = [
    (23.5 * 3600, 24.5 * 3600, "cinematic",
     "\U0001F3C1 {name} — уже завтра!\nДелай прогноз в приложении \U0001F449 @F1_egor_bot"),
    (0.75 * 3600, 1.25 * 3600, "retro",
     "\U0001F3C6 {name} — старт через час!\nПрогнозы закрываются со стартом гонки!"),
    (2 * 60, 10 * 60, "fans",
     "\U0001F525 {name} — LIGHTS OUT через 5 минут!\nСмотрим \U0001F440"),
]


def run_auto():
    from datetime import datetime
    race = next_race()
    dt = datetime.fromisoformat(race["race_datetime"].replace("Z", ""))
    left = (dt - datetime.utcnow()).total_seconds()
    for lo, hi, style, cap_tpl in AUTO_WINDOWS:
        if lo <= left <= hi:
            flag = os.path.join(OUT_DIR, f"sent-r{race['round']}-{style}.flag")
            if os.path.exists(flag):
                print(f"window {style}: already sent")
                return
            key = load_key()
            print(f"auto: R{race['round']} {race['name']}, {left/3600:.2f}h left -> {style}")
            bg = gen_background(race, style, key)
            out = save_poster(bg, race, style)
            broadcast(out, cap_tpl.format(name=race["name"]))
            open(flag, "w").write("1")
            return
    print(f"auto: no window ({left/3600:.2f}h to race)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", type=int, default=None)
    ap.add_argument("--style", choices=list(STYLES), default="cinematic")
    ap.add_argument("--send-to", type=int, default=None)
    ap.add_argument("--caption", default=None)
    ap.add_argument("--auto", action="store_true")
    args = ap.parse_args()

    if args.auto:
        run_auto()
        return

    key = load_key()
    if not key:
        raise SystemExit("no OPENROUTER_KEY (poster.env)")
    race = next_race(args.round)
    print(f"race: R{race['round']} {race['name']} @ {race.get('race_datetime')}")
    print(f"style: {args.style}, generating via {MODEL}...")
    bg = gen_background(race, args.style, key)
    out = save_poster(bg, race, args.style)
    print("poster:", out)
    if args.send_to:
        ok = send_photo(args.send_to, out, args.caption or f"{race['name']} — {args.style}")
        print("sent:", ok)


if __name__ == "__main__":
    main()
