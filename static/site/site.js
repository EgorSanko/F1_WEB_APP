/* ═══════════════════════════════════════════════════════════════
   F1 HUB — общий движок сайта: шапка, футер, антиспойлер, данные.
   Подключается на каждой странице до её собственного скрипта.
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const API = '';                                   // тот же домен
const M  = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MS = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

const CITY = {albert_park:'Мельбурн',shanghai:'Шанхай',suzuka:'Судзука',miami:'Майами',villeneuve:'Монреаль',
  monaco:'Монако',catalunya:'Барселона',red_bull_ring:'Шпильберг',silverstone:'Сильверстоун',spa:'Спа',
  hungaroring:'Будапешт',zandvoort:'Зандвоорт',monza:'Монца',madring:'Мадрид',baku:'Баку',
  sepang:'Куала-Лумпур',marina_bay:'Сингапур',americas:'Остин',rodriguez:'Мехико',interlagos:'Сан-Паулу',
  vegas:'Лас-Вегас',losail:'Лусаил',yas_marina:'Абу-Даби',bahrain:'Сахир',jeddah:'Джидда',imola:'Имола'};
const COUNTRY = {Italy:'Италия',Spain:'Испания',Netherlands:'Нидерланды',Belgium:'Бельгия',Hungary:'Венгрия',
  Azerbaijan:'Азербайджан',Singapore:'Сингапур',USA:'США',Mexico:'Мексика',Brazil:'Бразилия',Japan:'Япония',
  UK:'Великобритания',Monaco:'Монако',Canada:'Канада',Austria:'Австрия',Qatar:'Катар',UAE:'ОАЭ',
  Australia:'Австралия',China:'Китай',Bahrain:'Бахрейн',Malaysia:'Малайзия','Saudi Arabia':'Саудовская Аравия'};
const KM = {monza:'5.793',zandvoort:'4.259',spa:'7.004',silverstone:'5.891',monaco:'3.337',baku:'6.003',
  suzuka:'5.807',interlagos:'4.309',americas:'5.513',rodriguez:'4.304',vegas:'6.201',losail:'5.419',
  yas_marina:'5.281',hungaroring:'4.381',catalunya:'4.657',villeneuve:'4.361',red_bull_ring:'4.318',
  bahrain:'5.412',jeddah:'6.174',albert_park:'5.278',shanghai:'5.451',miami:'5.412',imola:'4.909',
  madring:'5.474',sepang:'5.543',marina_bay:'4.940'};

/* ——— утилиты ——— */
const esc = s => String(s ?? '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const j = p => fetch(API + p).then(r => r.ok ? r.json() : null).catch(() => null);
const plural = (n,a,b,c) => { const x=n%100, y=n%10; return x>4&&x<20?c : y===1?a : y>1&&y<5?b : c; };
const cityOf = r => CITY[(r?.circuit_id || '').toLowerCase()] || r?.locality || '';
const countryOf = r => COUNTRY[r?.country] || r?.country || '';
const kmOf = r => KM[(r?.circuit_id || '').toLowerCase()] || null;
const flagOf = cc => cc ? '/static/img/flags/' + String(cc).toLowerCase() + '.png' : '';
const mapOf = cid => cid ? '/static/img/tracks/' + cid + '.png' : '';
const clean = t => String(t || '').replace(/https?:\/\/\S+/g,'').replace(/#[\wА-Яа-яЁё]+/g,'')
  .replace(/(YouTube|ВКонтакте|Rutube|Telegram|Дзен)\s*:?/gi,'').replace(/\s{2,}/g,' ').trim();

const dayRange = r => {
  const d = new Date(r.date + 'T00:00:00Z'); if (isNaN(d)) return '';
  const f = r.sessions?.fp1?.date ? new Date(r.sessions.fp1.date + 'T00:00:00Z') : null;
  return f ? f.getUTCDate() + '–' + d.getUTCDate() + ' ' + MS[d.getUTCMonth()]
           : d.getUTCDate() + ' ' + MS[d.getUTCMonth()];
};
const fullDate = r => {
  const d = new Date(r.date + 'T00:00:00Z'); if (isNaN(d)) return '';
  return d.getUTCDate() + ' ' + M[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
};
const mskTime = r => {
  if (!r?.date || !r?.time) return '';
  const d = new Date(r.date + 'T' + r.time.replace('Z','') + 'Z'); if (isNaN(d)) return '';
  return d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit', timeZone:'Europe/Moscow'}) + ' МСК';
};
// картинка с мягкой деградацией: не грузится — просто исчезает, вёрстка держится
const img = (src, cls, alt, fb) => src
  ? '<img class="' + cls + '" src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy"' +
    (fb ? ' data-fb="' + esc(fb) + '"' : '') + ' onerror="F1.imgFail(this)">'
  : '<span class="' + cls + '"></span>';

/* ——— АНТИСПОЙЛЕР ——— */
const SPOILER_KEY = 'f1hub_spoiler_free';
let spoilerFree = false;
try { spoilerFree = localStorage.getItem(SPOILER_KEY) === 'true'; } catch (e) {}
const spoilerListeners = [];

function renderSpoilerBtn() {
  document.querySelectorAll('.spoiler-btn').forEach(b => {
    b.classList.toggle('on', spoilerFree);
    const label = b.querySelector('span');
    if (label) label.textContent = spoilerFree ? 'Антиспойлер вкл' : 'Антиспойлер выкл';
    b.title = spoilerFree ? 'Результаты скрыты — нажмите, чтобы показать' : 'Скрыть результаты гонок';
  });
}
function toggleSpoiler() {
  spoilerFree = !spoilerFree;
  try { localStorage.setItem(SPOILER_KEY, spoilerFree); } catch (e) {}
  renderSpoilerBtn();
  spoilerListeners.forEach(fn => { try { fn(spoilerFree); } catch (e) {} });
}
// заглушка вместо результата
const spoilerVeil = (text) =>
  '<div class="spoiler-veil">' +
    '<img src="/static/antispoiler.png" alt="">' +
    '<h3>Антиспойлер включён</h3>' +
    '<p>' + esc(text || 'Результаты скрыты, чтобы не испортить просмотр. Их можно открыть в любой момент.') + '</p>' +
    '<button class="btn btn-red" onclick="F1.toggleSpoiler()">Показать результаты</button>' +
  '</div>';

/* ——— ШАПКА И ФУТЕР ——— */
const NAV = [
  ['/static/site/index.html',       'Главное'],
  ['/static/site/races.html',       'Гонки'],
  ['/static/site/standings.html',   'Чемпионат'],
  ['/static/site/drivers.html',     'Пилоты'],
  ['/static/site/teams.html',       'Команды'],
  ['/static/site/videos.html',      'Видео'],
  ['/static/site/predictions.html', 'Прогнозы'],
];
// не влезает в шапку — прячем под «Ещё», чтобы меню не ломалось на две строки
const MORE = [
  ['/static/site/games.html', 'Игры'],
  ['/static/site/hall.html',  'Зал славы'],
  ['/static/site/login.html', 'Вход'],
];

function mountChrome(active) {
  const here = location.pathname.split('/').pop() || 'index.html';
  const header = document.querySelector('header .hd');
  if (header) {
    header.innerHTML =
      '<a href="/static/site/index.html" class="slot logo slot--bare" aria-label="F1 HUB"></a>' +
      '<nav class="nav">' + NAV.map(([href, name]) => {
        const on = (active ? name === active : href.endsWith(here)) ? ' class="on"' : '';
        return '<a href="' + href + '"' + on + '>' + name + '</a>';
      }).join('') +
        '<div class="more-nav">' +
          '<button type="button" class="more-toggle' +
            (MORE.some(([h]) => h.endsWith(here)) ? ' on' : '') + '">Ещё' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>' +
          '</button>' +
          '<div class="more-menu">' + MORE.map(([h, nm]) =>
            '<a href="' + h + '"' + (h.endsWith(here) ? ' class="on"' : '') + '>' + nm + '</a>').join('') + '</div>' +
        '</div>' +
      '</nav>' +
      '<div class="hd-right">' +
        '<button class="spoiler-btn" onclick="F1.toggleSpoiler()">' +
          '<img src="/static/antispoiler.png" alt=""><span>Антиспойлер выкл</span></button>' +
        '<a href="/static/site/login.html" class="enter" id="authLink">Войти</a>' +
        '<a href="/static/site/videos.html" class="btn btn-red">Смотреть</a>' +
      '</div>';
    renderSpoilerBtn();
    const moreBox = header.querySelector('.more-nav');
    if (moreBox) {
      const toggle = moreBox.querySelector('.more-toggle');
      toggle.onclick = e => { e.stopPropagation(); moreBox.classList.toggle('open'); };
      document.addEventListener('click', () => moreBox.classList.remove('open'));
      document.addEventListener('keydown', e => { if (e.key === 'Escape') moreBox.classList.remove('open'); });
    }
  }
  const footer = document.querySelector('footer .wrap');
  if (footer) {
    footer.innerHTML =
      '<div class="f-top">' +
        '<div class="slot slot--bare" style="width:112px;height:32px"></div>' +
        '<nav class="f-nav">' + NAV.slice(1).concat(MORE).map(([h,n]) => '<a href="' + h + '">' + n + '</a>').join('') +
        '<a href="https://t.me/F1_egor_bot" target="_blank" rel="noopener">Приложение</a></nav>' +
      '</div>' +
      '<p class="f-note">Фотографии: Steffen Prößdorf (CC BY-SA 4.0), Gian Luca Sgaggero (CC BY 2.0) — Wikimedia Commons. ' +
      'Данные и официальные изображения — Formula 1.<br>' +
      'F1 HUB — независимый фанатский проект о Формуле-1. Не связан с Formula One World Championship Limited ' +
      'и не является официальным ресурсом чемпионата.</p>';
  }
}

/* ——— публичный интерфейс ——— */
window.F1 = {
  API, M, MS, CITY, COUNTRY, KM,
  esc, j, plural, cityOf, countryOf, kmOf, flagOf, mapOf, clean, dayRange, fullDate, mskTime, img,
  get spoilerFree() { return spoilerFree; },
  toggleSpoiler,
  onSpoiler(fn) { spoilerListeners.push(fn); },
  spoilerVeil,
  mountChrome,
  imgFail(el) {
    const fb = el.dataset.fb;
    if (fb && el.src.indexOf(fb) === -1) { el.src = fb; return; }
    el.style.visibility = 'hidden';
  },
  // общий набор атмосферных фото — для карточек, где своей картинки нет
  stock: ['/static/img/site/story-1.jpg','/static/img/site/story-2.jpg','/static/img/site/story-3.jpg',
          '/static/img/site/news-lead.jpg','/static/img/site/hero-race.jpg'],
  stockAt(i) { return this.stock[Math.abs(i) % this.stock.length]; }
};

document.addEventListener('DOMContentLoaded', () => {
  mountChrome();
  // если вход уже выполнен — в шапке показываем имя вместо «Войти»
  let token = null;
  try { token = localStorage.getItem('f1hub_auth_token'); } catch (e) {}
  if (!token) return;
  fetch('/api/user/me', {headers: {'Authorization': 'TgLogin ' + token}})
    .then(r => r.ok ? r.json() : null)
    .then(me => {
      const link = document.getElementById('authLink');
      if (me && link) link.textContent = me.first_name || me.username || 'Профиль';
    })
    .catch(() => {});
});
})();
