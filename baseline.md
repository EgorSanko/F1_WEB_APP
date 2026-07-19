# F1 Hub Baseline — Phase 0

**Date:** 2026-04-10
**Tag:** `f1-baseline` (commit `387ca03`)
**Branch:** `pre-migration`

## HTML & Bundle Size

| Asset | Size |
|-------|------|
| index.html (single-file monolith) | 363 KB |
| Babel standalone (CDN) | ~3.1 MB |
| Tailwind CSS (CDN) | ~3.0 MB |
| React 18 (CDN) | ~130 KB |
| ReactDOM 18 (CDN) | ~130 KB |
| Chart.js (CDN) | ~200 KB |
| HLS.js (CDN) | ~70 KB |
| Plyr (CDN) | ~80 KB |
| Google Fonts (CDN) | ~20 KB |
| Total external CDN payload | ~6.7 MB |

## External CDN Dependencies

- `unpkg.com/@babel/standalone/babel.min.js`
- `unpkg.com/react@18/umd/react.production.min.js`
- `unpkg.com/react-dom@18/umd/react-dom.production.min.js`
- `cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css`
- `cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js`
- `cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js`
- `cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.min.js` + CSS
- `fonts.googleapis.com` (Titillium Web)
- `telegram.org/js/telegram-web-app.js` (keep)

## Lighthouse (Mobile, headless Chrome)

| Metric | Value |
|--------|-------|
| **Performance Score** | **27** |
| First Contentful Paint | 8.8s |
| Largest Contentful Paint | 9.8s |
| Time to Interactive | 13.2s |
| Speed Index | 9.5s |
| Total Blocking Time | 4,360ms |
| Cumulative Layout Shift | 0 |

## Endpoint Timing (localhost, internal)

### Cold (first request after restart)

| Endpoint | Time |
|----------|------|
| /api/health | 1.5ms |
| /api/home | **3,618ms** |
| /api/schedule | 3.2ms |
| /api/race/next | 1.3ms |
| /api/live/session | 227ms |
| /api/live/status | 1.4ms |
| /api/standings/drivers | 2.9ms |
| /api/drivers | 2.3ms |
| /api/news | 73ms |
| /api/leaderboard | 34ms |

### Warm (cached)

| Endpoint | Time |
|----------|------|
| /api/health | 1.3ms |
| /api/home | **3.1ms** |
| /api/schedule | 3.7ms |
| /api/race/next | 1.6ms |
| /api/live/session | 1.6ms |
| /api/live/status | 2.2ms |
| /api/standings/drivers | 2.9ms |
| /api/drivers | 2.4ms |
| /api/news | 2.3ms |
| /api/leaderboard | 1.7ms |

**Key finding:** `/api/home` cold = 3.6s (needs prewarmer), warm = 3ms.

## API Endpoints Inventory

**Total: 76 endpoints**

### Categories:
- **Static/Health:** 4 (/, /{filename}.html, /api/health, /api/admin/cache/clear)
- **User:** 5 (/api/user/me, favorite, predictions, achievements, is-admin)
- **Schedule/Races:** 8 (/api/schedule, race/next, race/{n}/results, qualifying, positions, tyres, race/last, season/{n}/results)
- **Live (SignalR + OpenF1):** 12 (/api/live/status, session, positions, timing, weather, race-control, track-status, radio, pit-stops, dashboard, car-data, track-map)
- **Standings:** 3 (drivers, constructors, points-progression)
- **Drivers/Teams:** 3 (/api/drivers, driver/{n}, teams)
- **Predictions:** 4 (available, make, results + admin settle)
- **Games/Quiz:** 4 (status, result, quiz/question, quiz/answer)
- **Leaderboard:** 1
- **News:** 2 (/api/news, /api/news/article)
- **Streams/Video:** 7 (streams, past-races-vk, vk-embed, rutube-stream, youtube-stream, proxy-stream, broadcasts)
- **Broadcasts Admin:** 4 (CRUD)
- **Analytics:** 10 (strategy, positions, laptimes, degradation, telemetry/drivers, telemetry, strategy-prediction, weather-radar, lap-time-series, race-trace, speed-traps)
- **Demo:** 3 (sessions, set, clear)
- **Misc:** 1 (head-to-head)

### External Data Sources:
- **OpenF1 API** — live timing, positions, car data, radio
- **Jolpica (Ergast successor)** — standings, results, schedules
- **FastF1** — telemetry, lap times, tyre data (analytics)
- **F1 SignalR** — live timing upstream (new, via f1_live.py)
- **VK API** — past race videos
- **Rutube API** — video streams
- **YouTube** — video embeds
- **Groq API** — radio transcription
- **Telegram Bot API** — user avatars

## Current Architecture

- **Frontend:** Single-file `index.html` (363 KB), React 18 + Babel standalone in-browser, Tailwind CDN
- **Backend:** FastAPI + SQLite (WAL mode) + async httpx
- **Deploy:** docker cp + docker restart (api.py, f1_data.py not bind-mounted)
- **SSL:** Let's Encrypt via certbot
- **Domain:** f1.lead-seek.ru only (no public site yet)

## Screen Map

```
App (SPA, tab-based navigation via bottom nav)
├── Home (Главная)
│   ├── Season selector (2025/2026)
│   ├── Anti-spoiler toggle
│   ├── Next race hero + countdown timer
│   └── Upcoming races list → click → Race Detail
├── Live (Онлайн)
│   ├── Session info header (Гран-при, Practice/Quali/Race)
│   ├── Tabs: Позиции | Трасса | Спидометр | Секторы | Пит-стоп
│   ├── Analytics button → Analytics sub-page
│   └── Data placeholder when no session
├── News (Новости)
│   ├── News feed cards (images, titles, sources)
│   └── Click → Article page (in-app webview)
├── Standings (Чемпионат)
│   ├── Anti-spoiler overlay (if enabled)
│   ├── Tabs: Пилоты | Конструкторы
│   └── Points table with team colors
├── Predictions (Прогнозы)
│   ├── Next race prediction cards
│   │   ├── Winner picker (driver grid)
│   │   ├── Podium picker (3-select)
│   │   ├── Fastest lap picker
│   │   ├── DNF count slider
│   │   └── Safety car yes/no
│   └── My predictions history
├── Profile (Профиль)
│   ├── User card (avatar, username, points)
│   ├── Stats (predictions, streak, games)
│   └── Achievements grid
├── Schedule (Расписание, via "Все гонки")
│   └── Full season race list → click → Race Detail
├── Race Detail
│   ├── Race header (circuit image, flag, date)
│   ├── Session schedule
│   ├── Tabs: Гонка | Квали | Стратегия
│   ├── Anti-spoiler card (if past race + enabled)
│   ├── Podium, Top-10 results
│   ├── Qualifying results (Q1/Q2/Q3)
│   ├── Tyre strategy chart
│   └── Broadcasts/streams section
└── Admin (hidden, admin-only)
    ├── Broadcast manager (grouped by GP)
    └── Settle predictions
```

## Playwright Before-Snapshots

Screenshots saved in `snapshots/before/`:
- `01-home.png` — Home with countdown
- `02-live.png` — Live page (offline, "Загрузка данных...")
- `03-news.png` — News feed
- `04-standings.png` — Driver standings (anti-spoiler overlay)
- `05-predictions.png` — Predictions (requires auth)
- `06-profile.png` — Profile (requires auth)
- `07-schedule.png` — Full season schedule
- `08-race-detail.png` — Race detail (Australia GP)

Console errors (anonymous access):
- 401 on /api/user/me, predictions, achievements (expected: no auth)
- 404 on /api/race/1/tyres?season=2026 (no 2026 tyre data yet)

## Key Issues

1. Lighthouse 27 — Babel in-browser compilation kills performance
2. 6.7 MB CDN payload before any app code runs
3. Single 363 KB HTML file — no code splitting
4. /api/home cold start 3.6s — no prewarmer
5. No public-facing site (SEO = 0)
6. api.py/f1_data.py not bind-mounted — manual docker cp on every deploy
7. test-*.html debug files in production directory
