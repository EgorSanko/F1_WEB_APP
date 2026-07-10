#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""F1 Hub — генератор постеров Гран-при.

Пайплайн: расписание -> промпт с национальным колоритом -> OpenRouter
(gpt-5.4-image-2, фон БЕЗ текста) -> фирменная типографика Pillow (Exo 2)
-> PNG в data/posters/ -> (опц.) отправка в Telegram.

Использование:
  python3 poster_gen.py                          # следующая гонка, стиль city
  python3 poster_gen.py --style retro            # city | retro | fans
  python3 poster_gen.py --round 10 --style fans --send-to 1697882482

Ключ: /opt/f1-hub/poster.env  (OPENROUTER_KEY=sk-or-...)
Шрифты: /opt/f1-hub/fonts/Exo2-Black.ttf, Exo2-Bold.ttf
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

# ---------- национальный колорит по стране (fallback: по городу/трассе) ----------
FLAVOR = {
    "Australia": "Melbourne skyline across Albert Park lake, black swans, golden morning light, Australian flag brush stroke",
    "China": "Shanghai skyline with Oriental Pearl Tower, red lanterns and dragon motifs, red-gold palette, Chinese flag brush stroke",
    "Japan": "Mount Fuji and cherry blossom petals swirling over Suzuka, torii gate silhouette, ukiyo-e wave patterns, Japanese flag brush stroke",
    "USA": "Miami skyline, palm trees, turquoise-pink sunset, art-deco vibes, American flag brush stroke",
    "Canada": "Montreal skyline across the St Lawrence river, maple leaves flying, Canadian red-white flag brush stroke",
    "Monaco": "Monte Carlo harbor with super-yachts, casino belle-epoque facade, riviera glamour, red-white Monaco flag brush stroke",
    "Spain": "Barcelona: Sagrada Familia silhouette, Gaudi mosaic patterns, warm Mediterranean light, red-yellow Spanish flag brush stroke",
    "Austria": "Styrian green alpine hills around the Red Bull Ring, edelweiss, crisp mountain air, red-white-red Austrian flag brush stroke",
    "UK": "Silverstone under moody British sky, Union Jack brush stroke, classic racing green accents, heritage vibes",
    "Great Britain": "Silverstone under moody British sky, Union Jack brush stroke, classic racing green accents, heritage vibes",
    "Belgium": "the legendary Eau Rouge uphill at Spa surrounded by misty Ardennes pine forest, light rain, Belgian black-yellow-red flag brush stroke",
    "Hungary": "the illuminated Hungarian Parliament over the Danube in Budapest at dusk, Hungarian red-white-green flag brush stroke",
    "Netherlands": "Zandvoort dunes and North Sea, orange army smoke, windmill silhouette, orange and Dutch tricolor brush strokes",
    "Italy": "Monza royal park autumn trees, tifosi red smoke, Italian green-white-red flag brush stroke, passionate atmosphere",
    "Azerbaijan": "Baku old city walls and Flame Towers glowing at dusk, carpet patterns, Azerbaijani flag brush stroke",
    "Singapore": "Marina Bay night skyline, neon reflections, tropical night race under floodlights, Singapore flag brush stroke",
    "Mexico": "Mexico City: Dia de los Muertos marigolds and papel picado, Aztec patterns, vibrant colors, Mexican flag brush stroke",
    "Brazil": "Interlagos with Sao Paulo skyline, carnival energy, samba colors, Brazilian green-yellow flag brush stroke",
    "Qatar": "Lusail circuit glowing at night in the desert, falcon silhouette, arabesque patterns, Qatari maroon-white flag brush stroke",
    "UAE": "Yas Marina twilight, futuristic hotel lights, desert dunes, UAE flag brush stroke",
    "Abu Dhabi": "Yas Marina twilight, futuristic hotel lights, desert dunes, UAE flag brush stroke",
    "Saudi Arabia": "Jeddah corniche at night along the Red Sea, old town lattice windows, Saudi green flag brush stroke",
    "Bahrain": "Bahrain desert circuit at dusk, palm groves, pearl monument motif, Bahraini red-white flag brush stroke",
}

STYLES = {
    "city": (
        "Vertical 9:16 Formula 1 poster artwork, premium modern promo style. "
        "A dynamic modern F1 car at speed in the foreground, motion blur and spray. Scene: {flavor}. "
        "Huge expressive flag brush strokes sweep diagonally across a dark moody sky as a graphic element. "
        "Keep the upper third dark and uncluttered (title space). Dramatic cinematic lighting. "
        "NO text, NO typography, NO letters, NO logos anywhere."
    ),
    "retro": (
        "Vertical 9:16 vintage 1950s-60s grand prix racing poster, aged paper texture, muted warm gouache colors, screen-print feel. "
        "A classic vintage open-wheel race car with a driver in a leather helmet. Scene: {flavor}. "
        "Ornate but restrained composition, collectible heritage art print. Keep the upper third calm for a title. "
        "NO text, NO typography, NO letters, NO logos anywhere."
    ),
    "fans": (
        "Vertical 9:16 Formula 1 poster celebrating fan passion, premium promo style. "
        "A roaring packed grandstand: thousands of fans waving national flags, colored smoke flares, golden evening light, "
        "an F1 car blurring past in the foreground bottom. Scene: {flavor}. "
        "Giant national flag brush stroke across the dark sky. Keep the upper third dark for a title. Energy, emotion. "
        "NO text, NO typography, NO letters, NO logos anywhere."
    ),
}

MONTHS_RU = ["", "ЯНВАРЯ", "ФЕВРАЛЯ", "МАРТА", "АПРЕЛЯ", "МАЯ", "ИЮНЯ",
             "ИЮЛЯ", "АВГУСТА", "СЕНТЯБРЯ", "ОКТЯБРЯ", "НОЯБРЯ", "ДЕКАБРЯ"]


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


def gen_background(race, style, key):
    flavor = FLAVOR.get(race.get("country", ""), f"iconic landmarks and atmosphere of {race.get('country','the host country')}, national flag brush stroke")
    prompt = STYLES[style].format(flavor=flavor)
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "modalities": ["image", "text"],
        "image_config": {"aspect_ratio": "9:16"},
    }
    j = http_json("https://openrouter.ai/api/v1/chat/completions", body,
                  {"Authorization": "Bearer " + key, "HTTP-Referer": "https://f1hub.lead-seek.ru", "X-Title": "f1hub-poster"})
    m = re.search(r"data:image/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)", json.dumps(j))
    if not m:
        raise SystemExit("no image in response: " + json.dumps(j)[:400])
    return base64.b64decode(m.group(1))


def overlay(bg_bytes, race, out_path):
    from io import BytesIO
    from PIL import Image, ImageDraw, ImageFont

    img = Image.open(BytesIO(bg_bytes)).convert("RGB")
    W, H = img.size

    # затемняющий градиент сверху — текст читается на любом фоне
    grad = Image.new("L", (1, H), 0)
    for y in range(H):
        grad.putpixel((0, y), int(200 * max(0, 1 - (y / H) * 3.2)))
    img = Image.composite(Image.new("RGB", (W, H), (5, 5, 10)), img, grad.resize((W, H)))

    black = ImageFont.truetype(os.path.join(FONTS, "Exo2-Black.ttf"), int(W * 0.135))
    year_f = ImageFont.truetype(os.path.join(FONTS, "Exo2-Black.ttf"), int(W * 0.105))
    sub_f = ImageFont.truetype(os.path.join(FONTS, "Exo2-Bold.ttf"), int(W * 0.030))
    f1_f = ImageFont.truetype(os.path.join(FONTS, "Exo2-Black.ttf"), int(W * 0.055))
    hub_f = ImageFont.truetype(os.path.join(FONTS, "Exo2-Bold.ttf"), int(W * 0.032))

    def skewed(text, font, fill, skew=0.22):
        bbox = font.getbbox(text)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        pad = int(th * skew) + 8
        layer = Image.new("RGBA", (tw + pad * 2, th + 16), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((pad - bbox[0], 8 - bbox[1]), text, font=font, fill=fill)
        return layer.transform(layer.size, Image.AFFINE,
                               (1, skew, -skew * layer.size[1] / 2, 0, 1, 0), resample=Image.BICUBIC)

    # тексты из данных гонки
    name = (race.get("name") or "").strip()
    m = re.match(r"^Гран[- ]при\s+(.+)$", name, re.I)
    title1, title2 = ("ГРАН-ПРИ", m.group(1).upper()) if m else (name.upper(), "")
    from datetime import datetime
    dt = datetime.fromisoformat((race.get("race_datetime") or "").replace("Z", ""))
    sub = f"{(race.get('circuit') or race.get('locality') or '').upper()[:26]} · {dt.day} {MONTHS_RU[dt.month]}"
    year = str(dt.year)

    M = int(W * 0.065)
    y = int(H * 0.045)
    f1 = skewed("F1", f1_f, (225, 6, 0), skew=0.3)
    img.paste(f1, (M, y), f1)
    hub = skewed("HUB", hub_f, (255, 255, 255), skew=0.3)
    img.paste(hub, (M + f1.size[0] + 6, y + f1.size[1] - hub.size[1] - int(W * 0.012)), hub)
    y += f1.size[1] + int(H * 0.012)

    t1 = skewed(title1, black, (255, 255, 255))
    img.paste(t1, (M, y), t1)
    y += int(t1.size[1] * 0.92)
    if title2:
        t2 = skewed(title2, black, (255, 255, 255))
        img.paste(t2, (M, y), t2)
        y += int(t2.size[1] * 0.98)

    yr = skewed(year, year_f, (225, 6, 0))
    img.paste(yr, (M, y), yr)
    y += yr.size[1] + int(H * 0.008)

    sb = skewed(sub, sub_f, (235, 235, 240), skew=0.0)
    img.paste(sb, (M + 2, y), sb)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, "PNG")
    return out_path


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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", type=int, default=None)
    ap.add_argument("--style", choices=list(STYLES), default="city")
    ap.add_argument("--send-to", type=int, default=None)
    ap.add_argument("--caption", default=None)
    args = ap.parse_args()

    key = load_key()
    if not key:
        raise SystemExit("no OPENROUTER_KEY (poster.env)")

    race = next_race(args.round)
    print(f"race: R{race['round']} {race['name']} @ {race.get('race_datetime')}")
    print(f"style: {args.style}, generating background via {MODEL}...")
    bg = gen_background(race, args.style, key)
    out = os.path.join(OUT_DIR, f"round{race['round']}-{args.style}.png")
    overlay(bg, race, out)
    print("poster:", out)

    if args.send_to:
        cap = args.caption or f"{race['name']} — постер ({args.style})"
        ok = send_photo(args.send_to, out, cap)
        print("sent:", ok)


if __name__ == "__main__":
    main()
