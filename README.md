<div align="center">

# 🏎️ F1 Hub — Telegram Mini App

### Всё о Формуле 1 в одном приложении

[![Telegram Bot](https://img.shields.io/badge/Telegram-@F1__egor__bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/F1_egor_bot)
[![Live](https://img.shields.io/badge/🌐_Live-f1.lead--seek.ru-E10600?style=for-the-badge)](https://f1.lead-seek.ru)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)

<br/>

<img src="https://media.formula1.com/image/upload/f_auto,c_limit,w_1440,q_auto/f_auto/q_auto/content/dam/fom-website/2018-redesign-assets/Racehub%20header%20images/Australia" width="100%" style="border-radius: 16px" alt="F1 Banner"/>

<br/>

**Live тайминги** · **Прогнозы** · **Чемпионат** · **Новости** · **Аналитика** · **Мини-игры**

---

</div>

## ✨ О проекте

**F1 Hub** — полноценное Telegram Mini App для фанатов Формулы 1. Открывается внутри Telegram через бота, работает как SPA с бэкендом, базой данных и интеграцией с внешними API.

> 🏁 Live позиции и тайминги во время сессий  
> 🔮 Система прогнозов с очками и лидербордом  
> 📊 Аналитика стратегий (шины, позиции, темпы)  
> 📰 Новости с championat.com в реальном времени  
> 📺 Видео с YouTube + записи трансляций VK  
> 🏆 Чемпионат пилотов и конструкторов  

---

## 🖼️ Скриншоты

<div align="center">
<table>
<tr>
<td align="center"><b>🏠 Главная</b><br/><sub>Следующий ГП, таймер, подиум, чемпионат</sub></td>
<td align="center"><b>🏁 Live тайминги</b><br/><sub>Позиции, секторы, шины, гэпы</sub></td>
<td align="center"><b>📊 Аналитика</b><br/><sub>Стратегия шин, позиции, темпы</sub></td>
</tr>
<tr>
<td align="center"><b>🏆 Чемпионат</b><br/><sub>Пилоты, конструкторы, карточки, команды</sub></td>
<td align="center"><b>📰 Новости</b><br/><sub>Championat.com + Telegram</sub></td>
<td align="center"><b>👤 Профиль</b><br/><sub>Статистика, достижения, лидерборд</sub></td>
</tr>
</table>
</div>

---

## 🛠️ Стек технологий

<div align="center">

| Слой | Технология | Описание |
|:---:|:---|:---|
| 🎨 | **React 18 + Tailwind CSS** | SPA в одном HTML · Babel standalone · Мгновенная загрузка |
| ⚡ | **FastAPI (Python 3.11)** | Async API · Автодокументация Swagger · Один файл |
| 🗃️ | **SQLite (WAL mode)** | Встроена в Python · Один файл .db · Легко бэкапить |
| 🐳 | **Docker Compose** | API + Bot + Nginx · Let's Encrypt SSL |
| 📡 | **OpenF1 API** | Live данные: позиции, круги, шины, радио, погода |
| 📈 | **Ergast / Jolpica** | Историческая статистика, standings, расписание |
| 📰 | **Championat.com** | Парсинг новостей F1 в реальном времени |
| 📺 | **YouTube RSS** | Видео Formula 1 Official без API ключа |

</div>

---

## 🏗️ Архитектура

```
┌──────────────────────────────────────────────────┐
│           Telegram Mini App (WebApp)              │
│        React 18 · Tailwind · Babel · SPA          │
│            index.html (~5000 строк)               │
├──────────────────────────────────────────────────┤
│              FastAPI Backend (api.py)              │
│          Python 3.11 · Uvicorn · async             │
├────────┬──────────┬──────────┬───────────────────┤
│ OpenF1 │ Jolpica  │Telegram  │ YouTube RSS       │
│ (live) │(history) │ Bot API  │ Championat.com    │
├────────┴──────────┴──────────┴───────────────────┤
│                 SQLite Database                    │
│      users · predictions · games · achievements   │
└──────────────────────────────────────────────────┘
```

---

## 📦 Структура проекта

```
f1-hub/
├── 🐍 api.py              # FastAPI бэкенд (30+ эндпоинтов)
├── 🤖 bot.py              # Telegram бот
├── 📊 f1_data.py          # Класс работы с данными F1
├── ⚙️ config.py            # Конфигурация, пилоты, команды, цвета
├── 🗃️ database.py          # SQLite ORM
├── 🎨 index.html           # React SPA (весь фронтенд)
├── 🐳 Dockerfile
├── 🐳 docker-compose.yml
├── 🌐 nginx.conf
├── 📋 requirements.txt
├── 🔒 .env.example
└── 📖 README.md
```

---

## 🚀 Возможности

### 🏠 Главная страница
- Карточка следующего Гран-при с обратным отсчётом
- Подиум последней гонки (2-1-3 с фотографиями пилотов)
- Топ-3 чемпионата с большими фото и цветами команд
- Карусель видео с YouTube

### 🏁 Live тайминги
- Позиции пилотов в реальном времени (обновление каждые 10 сек)
- Секторы: зелёный = personal best, фиолетовый = session best
- Текущие шины каждого пилота (SOFT / MEDIUM / HARD / INTER / WET)
- Пит-стопы с временем и количеством
- Командное радио (аудио)
- Сообщения дирекции гонки (флаги, штрафы, SC/VSC)
- Погода на трассе

### 📊 Аналитика
- **Стратегия шин** — визуализация стинтов всех пилотов (Chart.js)
- **Позиции по кругам** — линейный график изменения позиций
- **Темпы** — сравнение времён кругов

### 🏆 Чемпионат (4 вкладки)
- **Пилоты** — топ-3 увеличенные карточки с золотым/серебряным/бронзовым, progress bars
- **Кубок конструкторов** — лого, два пилота с фото, очки
- **Карточки пилотов** — сетка 2×N с большими фото, gradient overlay цвета команды
- **Команды** — фото болида, лого, пилоты, позиция в чемпионате

### 📰 Новости
- Парсинг championat.com (до 25 статей)
- Фото, заголовок, превью, дата
- Fallback на Telegram канал

### 🔮 Прогнозы
- 6 типов: победитель, подиум, топ-10, быстрый круг, DNF, Safety Car
- Система очков за точность
- Автоматический расчёт после гонки

### 📺 Видео и трансляции
- YouTube RSS (Formula 1 Official)
- Ссылки на VK Video, YouTube, Telegram каналы
- Записи прошлых трансляций (VK Video @stanizlavskylive)

### 👤 Профиль
- Статистика: прогнозы, точность, серия, очки
- 12 достижений
- Глобальный лидерборд

---

## 📅 Расписание

- Большая карточка следующего ГП с обратным отсчётом
- Разделение: «Прошедшие» / «Предстоящие»
- Победитель с фото у прошлых гонок
- Кнопка 📺 «Запись» — ссылка на VK Video трансляцию

---

## ⚡ Быстрый старт

### Требования

- Docker & Docker Compose
- Домен с SSL (Telegram WebApp **требует** HTTPS)
- Telegram Bot Token (от [@BotFather](https://t.me/BotFather))

### 1. Клонируй репозиторий

```bash
git clone https://github.com/EgorSanko/F1_WEB_APP.git
cd F1_WEB_APP
```

### 2. Настрой окружение

```bash
cp .env.example .env
nano .env
```

```env
TELEGRAM_TOKEN=your_bot_token_here
WEBAPP_URL=https://yourdomain.com
ADMIN_IDS=your_telegram_id
```

### 3. SSL сертификат

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

### 4. Запусти

```bash
docker compose up -d --build
```

### 5. Проверь

```bash
curl https://yourdomain.com/api/health
# {"status": "ok", "timestamp": "..."}
```

---

## 🔌 API Endpoints

<details>
<summary><b>👤 Пользователи</b></summary>

| Метод | Эндпоинт | Описание |
|:---:|:---|:---|
| GET | `/api/user/me` | Текущий пользователь |
| POST | `/api/user/favorite` | Установить любимого пилота |
| GET | `/api/user/predictions` | Мои прогнозы |
| GET | `/api/user/achievements` | Мои достижения |
| GET | `/api/avatar/{user_id}` | Аватарка |

</details>

<details>
<summary><b>🏁 Live данные</b></summary>

| Метод | Эндпоинт | Описание |
|:---:|:---|:---|
| GET | `/api/live/session` | Текущая сессия |
| GET | `/api/live/positions` | Позиции в реальном времени |
| GET | `/api/live/timing` | Секторы, лучшие круги, гэпы |
| GET | `/api/live/tyres` | Текущие шины |
| GET | `/api/live/weather` | Погода на трассе |
| GET | `/api/live/race-control` | Сообщения дирекции |
| GET | `/api/live/radio` | Командное радио |
| GET | `/api/live/pit-stops` | Пит-стопы |

</details>

<details>
<summary><b>📅 Расписание и результаты</b></summary>

| Метод | Эндпоинт | Описание |
|:---:|:---|:---|
| GET | `/api/schedule` | Календарь сезона |
| GET | `/api/race/next` | Следующий ГП + таймер |
| GET | `/api/race/last` | Последний результат |
| GET | `/api/race/{round}/results` | Результаты гонки |

</details>

<details>
<summary><b>🏆 Чемпионат</b></summary>

| Метод | Эндпоинт | Описание |
|:---:|:---|:---|
| GET | `/api/standings/drivers` | Чемпионат пилотов |
| GET | `/api/standings/constructors` | Чемпионат конструкторов |
| GET | `/api/drivers` | Все пилоты с фото |
| GET | `/api/driver/{number}` | Карточка пилота |
| GET | `/api/teams` | Все команды |

</details>

<details>
<summary><b>🔮 Прогнозы и игры</b></summary>

| Метод | Эндпоинт | Описание |
|:---:|:---|:---|
| GET | `/api/predictions/available` | Доступные прогнозы |
| POST | `/api/predictions/make` | Сделать прогноз |
| GET | `/api/predictions/results` | Результаты |
| POST | `/api/games/result` | Результат мини-игры |
| GET | `/api/leaderboard` | Рейтинг пользователей |

</details>

<details>
<summary><b>📰 Контент</b></summary>

| Метод | Эндпоинт | Описание |
|:---:|:---|:---|
| GET | `/api/news` | Новости (championat.com) |
| GET | `/api/streams` | Видео (YouTube RSS) |
| GET | `/api/past-races-vk` | Записи трансляций VK |
| GET | `/api/analytics/strategy` | Стратегия шин |
| GET | `/api/analytics/positions` | Позиции по кругам |
| GET | `/api/analytics/pace` | Темпы |

</details>

---

## 🎨 Дизайн

Приложение использует фирменную палитру F1:

| Цвет | Hex | Использование |
|:---:|:---:|:---|
| 🔴 | `#E10600` | F1 Red — акценты, кнопки, активные элементы |
| ⬛ | `#15151E` | Dark — основной фон |
| ⬜ | `#FFFFFF` | White — текст |
| 🔵 | `#3671C6` | Red Bull Racing |
| 🟢 | `#27F4D2` | Mercedes |
| 🔴 | `#E8002D` | Ferrari |
| 🟠 | `#FF8000` | McLaren |
| 🟢 | `#229971` | Aston Martin |

### Цвета шин

| Тип | Цвет | Hex |
|:---:|:---:|:---:|
| 🔴 SOFT | Красный | `#FF3333` |
| 🟡 MEDIUM | Жёлтый | `#FFD700` |
| ⚪ HARD | Белый | `#CCCCCC` |
| 🟢 INTER | Зелёный | `#39B54A` |
| 🔵 WET | Синий | `#0067FF` |

---

## 🗄️ База данных

```sql
users              — Telegram пользователи, очки, любимый пилот
predictions        — Прогнозы на гонки (6 типов)
games              — Результаты мини-игр
achievements       — Разблокированные достижения
leaderboard_cache  — Кэш рейтинга
```

---

## 🔧 Конфигурация

Все настройки в `config.py`:

- **20 пилотов** сезона 2025 с номерами, командами, странами
- **10 команд** с HEX-цветами
- **24 трассы** с координатами, изображениями, часовыми поясами
- **Ассеты команд** — логотипы и фото болидов с formula1.com
- **48 записей трансляций** VK Video (2024 + 2025 сезоны)
- **12 достижений** — от «Первый прогноз» до «Непобедимый»
- **Система очков** прогнозов с коэффициентами

---

## 📡 Источники данных

| API | Тип | Auth | Лимиты |
|:---|:---|:---:|:---|
| [OpenF1](https://openf1.org) | Live данные | ❌ Не нужна | Без жёсткого лимита |
| [Jolpica/Ergast](https://github.com/jolpica/jolpica-f1) | Историческая статистика | ❌ Не нужна | 4 req/sec, 200/час |
| [Championat.com](https://www.championat.com/auto/_f1.html) | Новости F1 | ❌ Не нужна | HTML парсинг |
| [YouTube RSS](https://www.youtube.com/feeds/videos.xml) | Видео | ❌ Не нужна | Без лимита |
| [Formula1.com](https://formula1.com) | Фото, ассеты | ❌ Не нужна | CDN |

---

## 📝 Кэширование

| Данные | TTL | Описание |
|:---|:---:|:---|
| Live позиции | 10 сек | Во время активной сессии |
| Погода | 5 мин | Обновляется часто |
| Standings | 15 мин | Обновляется после гонок |
| Расписание | 1 час | Редко меняется |
| Новости | 15 мин | Championat.com |
| Видео | 30 мин | YouTube RSS |
| Результаты гонок | 1 час | Не меняются |
| Пилоты/команды | 24 часа | Стабильные данные |

---

## 🤝 Благодарности

- [OpenF1](https://openf1.org) — за бесплатный live API Формулы 1
- [Jolpica](https://github.com/jolpica/jolpica-f1) — за поддержку зеркала Ergast API
- [Championat.com](https://www.championat.com) — за качественные новости F1
- [@stanizlavskylive](https://vkvideo.ru/@stanizlavskylive) — за трансляции гонок
- [Formula 1](https://formula1.com) — за медиа-ассеты

---

<div align="center">

### Сделано с ❤️ и 🏎️

[![Telegram](https://img.shields.io/badge/Открыть_бота-Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/F1_egor_bot)

<sub>© 2025 F1 Hub · Не аффилирован с Formula 1 или FIA</sub>

</div>
