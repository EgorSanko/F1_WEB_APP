# 🏎️ F1 Hub — Telegram Mini App

Telegram Mini App для фанатов Формулы 1: live-тайминги, прогнозы, чемпионат, мини-игры.

## Быстрый старт

### 1. Подготовка
```bash
# Клонируй репозиторий
git clone <your-repo-url> f1-hub
cd f1-hub

# Создай .env из примера
cp .env.example .env
# Заполни TELEGRAM_TOKEN и WEBAPP_URL
```

### 2. Получи Telegram Bot Token
- Напиши @BotFather в Telegram
- `/newbot` → придумай имя → получи токен
- `/setmenubutton` → выбери бота → установи URL WebApp

### 3. Деплой
```bash
# Настрой SSL (Telegram WebApp требует HTTPS!)
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com

# Замени yourdomain.com в nginx.conf на свой домен

# Запусти
docker compose up -d --build

# Проверь
curl https://yourdomain.com/api/health
```

### 4. Разработка (локально)
```bash
pip install -r requirements.txt

# Запусти API
DEBUG=true uvicorn api:app --reload --port 8000

# В другом терминале — бот
python bot.py
```

## Структура
```
f1-hub/
├── api.py           # FastAPI бэкенд (30+ эндпоинтов)
├── bot.py           # Telegram бот
├── database.py      # SQLite ORM
├── config.py        # Конфигурация, данные пилотов/команд
├── index.html       # React SPA (фронтенд)
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── requirements.txt
└── .env.example
```

## API Документация
После запуска: `https://yourdomain.com/docs` (Swagger UI)

## Фазы разработки
- [x] Фаза 1: Скелет (структура, БД, бот, базовый UI)
- [ ] Фаза 2: Данные (OpenF1 + Ergast интеграция)
- [ ] Фаза 3: Live (real-time позиции, тайминги)
- [ ] Фаза 4: Прогнозы (6 типов, авторасчёт)
- [ ] Фаза 5: Игры (Pit Stop, Guess Track, Reaction, Quiz)
- [ ] Фаза 6: Полировка (лидерборд, уведомления, оптимизация)
