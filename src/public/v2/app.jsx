// F1 Hub v2 — Public site redesign (in progress)
// First migrated page: Race Detail. Other routes show a stub linking back to old site.
const { useState, useEffect, useMemo, useRef, useCallback, Fragment } = React;

// ============ CONSTANTS ============
const TEAMS = {
  'McLaren':          { short:'MCL', color:'#FF8000', dark:'#A55200' },
  'Ferrari':          { short:'FER', color:'#E8002D', dark:'#9B001E' },
  'Mercedes':         { short:'MER', color:'#27F4D2', dark:'#0F8A77' },
  'Red Bull':         { short:'RBR', color:'#3671C6', dark:'#1F3F73' },
  'Red Bull Racing':  { short:'RBR', color:'#3671C6', dark:'#1F3F73' },
  'Aston Martin':     { short:'AMR', color:'#229971', dark:'#13593F' },
  'Williams':         { short:'WIL', color:'#64C4FF', dark:'#3A85B6' },
  'RB':               { short:'RB',  color:'#6692FF', dark:'#395CB6' },
  'Racing Bulls':     { short:'RB',  color:'#6692FF', dark:'#395CB6' },
  'Sauber':           { short:'SAU', color:'#52E252', dark:'#2A8A2A' },
  'Kick Sauber':      { short:'SAU', color:'#52E252', dark:'#2A8A2A' },
  'Haas':             { short:'HAS', color:'#B6BABD', dark:'#737578' },
  'Haas F1 Team':     { short:'HAS', color:'#B6BABD', dark:'#737578' },
  'Alpine':           { short:'ALP', color:'#0093CC', dark:'#005C80' },
  'Alpine F1 Team':   { short:'ALP', color:'#0093CC', dark:'#005C80' },
  'Audi':             { short:'AUD', color:'#E63946', dark:'#7A1B25' },
  'Audi F1 Team':     { short:'AUD', color:'#E63946', dark:'#7A1B25' },
  'Cadillac':         { short:'CAD', color:'#F0F0F0', dark:'#5B5B5B' },
  'Cadillac F1 Team': { short:'CAD', color:'#F0F0F0', dark:'#5B5B5B' },
};
const teamInfo = (name) => TEAMS[name] || { short: (name||'').slice(0,3).toUpperCase(), color:'#888', dark:'#444' };

const FLAG_MAP = {
  albert_park:'au',shanghai:'cn',suzuka:'jp',miami:'us',villeneuve:'ca',monaco:'mc',
  catalunya:'es',red_bull_ring:'at',silverstone:'gb',spa:'be',hungaroring:'hu',
  zandvoort:'nl',monza:'it',madring:'es',baku:'az',marina_bay:'sg',americas:'us',
  rodriguez:'mx',interlagos:'br',vegas:'us',losail:'qa',yas_marina:'ae',
  bahrain:'bh',jeddah:'sa',sakhir:'bh',imola:'it',
  australia:'au',japan:'jp',china:'cn',spain:'es',canada:'ca',austria:'at',
  great_britain:'gb',hungary:'hu',belgium:'be',netherlands:'nl',italy:'it',
  azerbaijan:'az',singapore:'sg',united_states:'us',mexico:'mx',brazil:'br',
  las_vegas:'us',qatar:'qa',abu_dhabi:'ae',saudi_arabia:'sa',emilia_romagna:'it',
  us:'us',gb:'gb',ae:'ae',usa:'us',uk:'gb',uae:'ae',
  au:'au',cn:'cn',jp:'jp',ca:'ca',mc:'mc',es:'es',at:'at',be:'be',hu:'hu',
  nl:'nl',it:'it',az:'az',sg:'sg',mx:'mx',br:'br',qa:'qa',sa:'sa',bh:'bh',
};
const flagUrl = (code) => {
  if (!code) return null;
  const iso = FLAG_MAP[String(code).toLowerCase().replace(/[\s-]+/g,'_')];
  return iso ? 'https://flagcdn.com/w80/' + iso + '.png' : null;
};

const COUNTRY_RU = {
  AU:'Австралия', CN:'Китай', JP:'Япония', US:'США', CA:'Канада', MC:'Монако',
  ES:'Испания', AT:'Австрия', GB:'Британия', HU:'Венгрия', BE:'Бельгия',
  NL:'Нидерланды', IT:'Италия', AZ:'Азербайджан', SG:'Сингапур', MX:'Мексика',
  BR:'Бразилия', QA:'Катар', AE:'ОАЭ', SA:'Саудия', BH:'Бахрейн',
};
const shortRaceName = (r) => {
  if (!r) return '';
  const cc = (r.country_code || '').toUpperCase();
  if (COUNTRY_RU[cc]) return COUNTRY_RU[cc];
  return (r.name || '').replace(/^Гран-при\s+/i, '');
};

const SESSION_ORDER = ['sprint_qualifying','sprint','qualifying','race','review'];
const SESSION_LABELS = { sprint_qualifying:'Спринт-квалификация', sprint:'Спринт', qualifying:'Квалификация', race:'Гонка', review:'Обзор' };
const SESSION_ICONS  = { sprint_qualifying:'⚡', sprint:'🏁', qualifying:'⏱️', race:'🏆', review:'📺' };

// ============ AUTH ============
const _getAuthHeaders = () => {
  const token = localStorage.getItem('f1hub_auth_token');
  return token ? { 'Authorization': 'TgLogin ' + token } : {};
};
const api = {
  get: async (url) => {
    try {
      const res = await fetch(url, { headers: _getAuthHeaders() });
      if (res.status === 401) { window.dispatchEvent(new CustomEvent('f1:auth-expired')); return null; }
      if (!res.ok) return null;
      return await res.json();
    } catch (err) { console.error('GET ' + url, err); return null; }
  },
  post: async (url, body) => {
    try {
      const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', ..._getAuthHeaders() }, body:JSON.stringify(body || {}) });
      if (res.status === 401) { window.dispatchEvent(new CustomEvent('f1:auth-expired')); return null; }
      if (!res.ok) return null;
      return await res.json();
    } catch (err) { console.error('POST ' + url, err); return null; }
  },
};

// ============ HELPERS ============
// Bumps F1 CDN image to higher resolution + forces best-quality auto-encoding.
// Cloudinary URL params: ...c_fill,g_north,ar_1:1,w_200/q_auto/v.../path.webp
const hiResImg = (url, targetW = 800) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('media.formula1.com/image/upload/')) return url;
  let out = url.replace(/w_\d+/g, 'w_' + targetW).replace(/h_\d+/g, 'h_' + Math.round(targetW * 0.75));
  out = out.replace(/\/q_auto(\/|,)/g, '/q_auto:best$1');
  return out;
};

// Tight face crop for small round avatars (Cloudinary g_face + z_ zoom).
// Replaces `c_fill,g_north,ar_1:1,w_X` (or similar) with `c_thumb,g_face,z_0.75,ar_1:1,w_W`.
const faceImg = (url, targetW = 400) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('media.formula1.com/image/upload/')) return url;
  let out = url
    .replace(/c_fill[^/]*?(?=\/)/g, `c_thumb,g_face,z_0.75,ar_1:1,w_${targetW}`)
    .replace(/c_thumb[^/]*?(?=\/)/g, `c_thumb,g_face,z_0.75,ar_1:1,w_${targetW}`);
  out = out.replace(/\/q_auto(\/|,)/g, '/q_auto:best$1');
  return out;
};

const FlagImg = ({ code, size = 48 }) => {
  const src = flagUrl(code);
  if (!src) return <span style={{ fontSize: size * 0.55 }}>🏁</span>;
  return <img src={src} alt="" loading="lazy" style={{ width: size, height: size * 0.75, objectFit:'cover', borderRadius:4 }}/>;
};

const DriverPhoto = ({ url, size = 42, stripe }) => {
  const src = url ? (size >= 28 ? faceImg(url, Math.max(400, size * 6)) : url) : null;
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', overflow:'hidden', background:'#13131a', position:'relative', flexShrink:0 }}>
      {src
        ? <img src={src} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center' }}/>
        : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted-2)', fontSize: size * 0.4 }}>?</div>
      }
      {stripe && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background: stripe }}/>}
    </div>
  );
};

const Loader = () => (
  <div className="loader"><div className="dot"/><div className="dot"/><div className="dot"/></div>
);

const Empty = ({ children }) => <div className="empty">{children}</div>;

// ============ COUNTDOWN ============
const useCountdown = (targetDate) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const diff = Math.max(0, Math.floor((target.getTime() - now) / 1000));
  return { total: diff, days: Math.floor(diff/86400), hours: Math.floor((diff%86400)/3600), minutes: Math.floor((diff%3600)/60), seconds: diff%60 };
};

// ============ VIDEO ============
const buildEmbedSrc = (embedUrl, videoUrl) => {
  const direct = embedUrl || videoUrl || '';
  if (!direct) return null;
  if (/\/embed\/|video_ext\.php|play\/embed/.test(direct)) return { src: direct, kind:'iframe' };
  const yt = direct.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { src: `https://www.youtube.com/embed/${yt[1]}?rel=0&playsinline=1&autoplay=1`, kind:'iframe', provider:'youtube', id: yt[1], thumb: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` };
  const rt = direct.match(/rutube\.ru\/(?:video|play\/embed)\/([a-f0-9]+)/);
  if (rt) return { src: `https://rutube.ru/play/embed/${rt[1]}?autoStart=true`, kind:'iframe', provider:'rutube', id: rt[1] };
  const vk = direct.match(/(?:vk\.com|vkvideo\.ru)\/(?:[^?]*[?&]z=)?video(-?\d+)_(\d+)/);
  if (vk) return { src: `https://vk.com/video_ext.php?oid=${vk[1]}&id=${vk[2]}&hd=2&autoplay=1`, kind:'iframe', provider:'vk', id:`${vk[1]}_${vk[2]}` };
  return { src: direct, kind:'external' };
};

const VideoPlayer = ({ embedUrl, videoUrl, title }) => {
  const [playing, setPlaying] = useState(false);
  const resolved = buildEmbedSrc(embedUrl, videoUrl);
  if (!resolved) return null;
  if (resolved.kind === 'external') {
    return <a href={resolved.src} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop:4 }}>▶ Смотреть запись</a>;
  }
  if (!playing) {
    const prov = resolved.provider === 'youtube' ? 'YouTube' : resolved.provider === 'rutube' ? 'Rutube' : resolved.provider === 'vk' ? 'VK' : 'Видео';
    return (
      <button className="vplayer" onClick={() => setPlaying(true)}>
        <div className="ratio"/>
        {resolved.thumb && <img src={resolved.thumb} alt="" loading="lazy"/>}
        <div className="grad"/>
        <div className="play"><div className="circle"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div></div>
        <div className="meta">
          <span className="prov">{prov}</span>
          {title && <span className="title">{title}</span>}
        </div>
      </button>
    );
  }
  return (
    <div className="vframe">
      <div className="ratio"/>
      <iframe src={resolved.src} allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock; accelerometer; gyroscope" allowFullScreen title={title || 'Video'}/>
    </div>
  );
};

// ============ BROADCAST ACCORDION ============
const BroadcastList = ({ broadcasts, hasSprint }) => {
  const types = hasSprint ? SESSION_ORDER : SESSION_ORDER.filter(t => t !== 'sprint_qualifying' && t !== 'sprint');
  const byType = {};
  (broadcasts || []).forEach(b => { byType[b.session_type] = b; });
  const items = types.map(t => ({ type:t, broadcast: byType[t] || null }));
  const [activeType, setActiveType] = useState(null);

  useEffect(() => {
    const first = items.find(i => i.broadcast);
    if (!activeType && first) setActiveType(first.type);
  }, [broadcasts]);

  if (broadcasts && broadcasts.length === 0) return <Empty>Записей пока нет</Empty>;
  if (broadcasts === null) return <Loader/>;

  const active = items.find(i => i.type === activeType) || items.find(i => i.broadcast);
  const activeB = active?.broadcast;
  const ytMatch = activeB && (activeB.video_url || activeB.embed_url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  const ytId = ytMatch ? ytMatch[1] : null;
  const sourceName = activeB ? (
    (activeB.video_url || '').includes('youtube') || (activeB.video_url || '').includes('youtu.be') ? 'YouTube'
    : (activeB.video_url || '').includes('vk.com') ? 'VK Video'
    : (activeB.video_url || '').includes('rutube') ? 'Rutube'
    : (activeB.video_url || '').includes('twitch') ? 'Twitch'
    : 'Видео'
  ) : '';

  const thumbFor = (b) => {
    if (!b) return null;
    if (b.thumbnail_url) return b.thumbnail_url;
    const m = (b.video_url || b.embed_url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    return m ? ('https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg') : null;
  };

  return (
    <div className="rec-cinema">
      {/* Main player */}
      <div className="rec-stage">
        {activeB ? (
          <Fragment>
            <div className="rec-player">
              {ytId ? (
                <iframe src={'https://www.youtube.com/embed/' + ytId + '?rel=0'} title={activeB.title || SESSION_LABELS[active.type]} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>
              ) : activeB.embed_url ? (
                <iframe src={activeB.embed_url} title={activeB.title || SESSION_LABELS[active.type]} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>
              ) : (
                <div className="rec-noembed">
                  <div className="ic">{SESSION_ICONS[active.type]}</div>
                  <div>Видео нельзя встроить</div>
                  <a className="btn btn-red" href={activeB.video_url} target="_blank" rel="noreferrer">Смотреть на {sourceName} →</a>
                </div>
              )}
            </div>
            <div className="rec-meta">
              <div className="rec-meta-left">
                <span className="rec-pill">{SESSION_ICONS[active.type]} {SESSION_LABELS[active.type]}</span>
                {activeB.title && activeB.title !== SESSION_LABELS[active.type] && <span className="rec-title">{activeB.title}</span>}
                {!!activeB.is_live && <span className="rec-live"><span className="live-dot"/> LIVE</span>}
              </div>
              <div className="rec-meta-right">
                <span className="rec-src">{sourceName}</span>
                {activeB.video_url && <a href={activeB.video_url} target="_blank" rel="noreferrer" className="rec-ext">Открыть оригинал ↗</a>}
              </div>
            </div>
          </Fragment>
        ) : (
          <div className="rec-empty">
            <div className="ic">🎬</div>
            <div className="t">Выбери сессию ниже</div>
            <div className="s">Запись появится, когда будет добавлена админом</div>
          </div>
        )}
      </div>

      {/* Thumbnails row */}
      <div className="rec-strip">
        {items.map(it => {
          const b = it.broadcast;
          const thumb = thumbFor(b);
          const isActive = activeType === it.type;
          return (
            <div key={it.type} className="rec-tile" data-active={isActive ? '1' : '0'} data-empty={b ? '0' : '1'}
                 onClick={() => b && setActiveType(it.type)}>
              <div className="rec-thumb">
                {thumb ? <img src={thumb} alt="" loading="lazy" onError={e => e.target.style.display='none'}/> : null}
                <div className="rec-tile-over">
                  {b ? <div className="rec-tile-play">▶</div> : <div className="rec-tile-empty">Скоро</div>}
                  {!!b?.is_live && <span className="rec-tile-live"><span className="live-dot"/> LIVE</span>}
                </div>
              </div>
              <div className="rec-tile-body">
                <span className="ic">{SESSION_ICONS[it.type]}</span>
                <span className="lbl">{SESSION_LABELS[it.type]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============ SPOILER CARD ============
const SpoilerCard = ({ onReveal, label = 'Результаты скрыты' }) => (
  <div className="spoiler">
    <div className="icon">🙈</div>
    <div className="title">Антиспойлер включён</div>
    <div className="sub">{label}</div>
    <button className="btn btn-red btn-sm" onClick={onReveal}>Показать</button>
  </div>
);

// ============ LOGIN MODAL ============
const TG_BOT_NAME = 'F1_egor_bot';
const LoginModal = ({ onClose, onLoggedIn }) => {
  const [mode, setMode] = useState('widget');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const widgetRef = useRef(null);

  // Telegram Login Widget
  useEffect(() => {
    if (!widgetRef.current) return;
    window.onTelegramAuth = (user) => {
      const params = new URLSearchParams();
      Object.keys(user).forEach(k => params.append(k, user[k]));
      localStorage.setItem('f1hub_auth_token', params.toString());
      onLoggedIn && onLoggedIn();
    };
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.async = true;
    s.setAttribute('data-telegram-login', TG_BOT_NAME);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '10');
    s.setAttribute('data-userpic', 'false');
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    s.setAttribute('data-request-access', 'write');
    widgetRef.current.innerHTML = '';
    widgetRef.current.appendChild(s);
    return () => { delete window.onTelegramAuth; };
  }, [onLoggedIn]);

  const submitCode = async (e) => {
    e?.preventDefault();
    const c = code.trim();
    if (!/^\d{6}$/.test(c)) { setErr('Введите 6-значный код из бота'); return; }
    setSubmitting(true); setErr('');
    const res = await api.post('/api/auth/code', { code: c });
    if (res?.token) {
      localStorage.setItem('f1hub_auth_token', res.token);
      onLoggedIn && onLoggedIn();
    } else {
      setErr(res?.error || 'Неверный или истёкший код');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="close" onClick={onClose}>✕</button>
        <h2>Вход в F1 HUB</h2>
        <div className="lead">Нажми кнопку — бот мгновенно пришлёт 6-значный код. Введи его ниже.</div>
        <a href={'https://t.me/' + TG_BOT_NAME + '?start=code'} target="_blank" rel="noreferrer" className="btn btn-red" style={{ width:'100%', justifyContent:'center', marginBottom:14, padding:'14px 22px' }}>Получить код в Telegram →</a>
        <form onSubmit={submitCode}>
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" inputMode="numeric" maxLength={6} disabled={submitting}/>
          <div className="err">{err}</div>
          <button type="submit" className="btn btn-red" style={{ width:'100%', justifyContent:'center' }} disabled={submitting}>{submitting ? 'Проверка…' : 'Войти по коду'}</button>
        </form>
        <div className="or">или</div>
        <div className="tg-widget" ref={widgetRef}/>
      </div>
    </div>
  );
};

// ============ TOP NAV ============
const NAV_LINKS = [
  { id:'home',      label:'Главная',    href:'/',                     internal:true  },
  { id:'calendar',  label:'Календарь',  href:'/calendar',             internal:true  },
  { id:'standings', label:'Чемпионат',  href:'/standings',            internal:true  },
  { id:'predict',   label:'Прогнозы',   href:'/predict',              internal:true  },
  { id:'games', label:'Игры', href:'/games',internal:true },
  { id:'news', label:'Новости', href:'/news',internal:true },
  { id:'highlights', label:'Обзоры', href:'/highlights',internal:true },
  { id:'profile', label:'Профиль', href:'/profile',internal:true },
];
const TopNav = ({ activeId, user, spoilerFree, onToggleSpoiler, onLogin, onLogout, onNavigate }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = mobileOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [mobileOpen]);
  const handleClick = (e, link) => {
    setMobileOpen(false);
    if (link.internal) {
      e.preventDefault();
      onNavigate(link.href);
    }
  };
  return (
    <Fragment>
      <header className="topnav">
        <div className="cnt row">
          <button className="burger" aria-label="Меню" onClick={() => setMobileOpen(true)}>
            <span/><span/><span/>
          </button>
          <a href="/" className="logo" onClick={e => { e.preventDefault(); onNavigate("/"); }}><img src="/static/logo-f1hub.png" alt="F1 HUB" style={{ height:28, width:"auto", display:"block" }}/></a>
          <nav>
            {NAV_LINKS.map(l => (
              <a key={l.id} href={l.href} data-active={activeId === l.id ? 'true' : 'false'} onClick={e => handleClick(e, l)}>{l.label}</a>
            ))}
          </nav>
          <div style={{ flex:1 }}/>
          <button className="spoiler-tog" data-on={spoilerFree ? '1' : '0'} onClick={onToggleSpoiler} title="Антиспойлер">
            <span className="pill"/><span>Спойлеры</span>
          </button>
          {user
            ? <button className="btn btn-ghost btn-sm" onClick={onLogout} title="Выйти">@{user.username || user.first_name || 'me'}</button>
            : <button className="btn btn-red btn-sm" onClick={onLogin}>Войти</button>}
        </div>
      </header>
      {mobileOpen && (
        <Fragment>
          <div className="mobile-backdrop" onClick={() => setMobileOpen(false)}/>
          <aside className="mobile-drawer">
            <div className="drawer-head">
              <img src="/static/logo-f1hub.png" alt="F1 HUB" style={{ height:30, width:"auto", display:"block" }}/>
              <button className="drawer-close" onClick={() => setMobileOpen(false)} aria-label="Закрыть">✕</button>
            </div>
            <nav className="drawer-nav">
              {NAV_LINKS.map(l => (
                <a key={l.id} href={l.href} data-active={activeId === l.id ? 'true' : 'false'} onClick={e => handleClick(e, l)}>{l.label}</a>
              ))}
            </nav>
            <div className="drawer-foot">
              <button className="spoiler-tog" data-on={spoilerFree ? '1' : '0'} onClick={onToggleSpoiler} title="Антиспойлер">
                <span className="pill"/><span>Спойлеры</span>
              </button>
              {user
                ? <button className="btn btn-ghost btn-sm" onClick={() => { setMobileOpen(false); onLogout(); }}>@{user.username || user.first_name || 'me'} · Выйти</button>
                : <button className="btn btn-red btn-sm" onClick={() => { setMobileOpen(false); onLogin(); }}>Войти</button>}
            </div>
          </aside>
        </Fragment>
      )}
    </Fragment>
  );
};

// ============ RACE DETAIL PAGE ============
const RaceHero = ({ race, isPast, sessionStart, onBack }) => {
  const cd = useCountdown(isPast ? null : sessionStart);
  return (
    <section className="race-hero fade-up">
      {race?.circuit_image && <img className="bg" src={hiResImg(race.circuit_image, 1800)} alt=""/>}
      <div className="overlay"/>
      <div className="cnt content">
        <a className="back" onClick={onBack}>← Назад</a>
        {cd && cd.total > 0 && (
          <div className="countdown-block">
            <span className="live-dot"/>
            <span className="eyebrow" style={{ color:'#fff', opacity:.85 }}>Старт через</span>
            <span className="num">{cd.days}д · {String(cd.hours).padStart(2,'0')}:{String(cd.minutes).padStart(2,'0')}:{String(cd.seconds).padStart(2,'0')}</span>
          </div>
        )}
        <div className="eyebrow eyebrow-red">{isPast ? 'РАУНД ' + String(race?.round || '').padStart(2,'0') + ' / ' + (race?.season || '2026') : 'СЛЕДУЮЩИЙ ГРАН-ПРИ · РАУНД ' + String(race?.round || '').padStart(2,'0')}</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:18, flexWrap:'wrap' }}>
          <FlagImg code={race?.country_code || race?.circuit_id} size={56}/>
          <h1>{race?.name}</h1>
        </div>
        <div className="sub">
          {race?.circuit && <span>{race.circuit}</span>}
          {race?.locality && <><span className="dot"/><span>{race.locality}</span></>}
          {race?.date && <><span className="dot"/><span>{formatDateRu(race.date)}</span></>}
        </div>
        <div className="chips">
          {race?.sprint && <span className="chip chip-red">⚡ Спринт-уикенд</span>}
          {race?.is_night && <span className="chip">Ночная гонка</span>}
          {isPast && <span className="chip chip-gold">🏆 Архив</span>}
        </div>
      </div>
    </section>
  );
};

const formatDateRu = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'long', year:'numeric' });
  } catch (e) { return iso; }
};
const formatTimeRu = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
  } catch (e) { return ''; }
};
const formatDayRu = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { weekday:'short', day:'2-digit', month:'short' });
  } catch (e) { return iso; }
};

const PodiumThree = ({ results }) => {
  if (!results || results.length < 3) return null;
  // Display: 2nd, 1st, 3rd visually but reorder to keep visual hierarchy
  const order = [1, 0, 2];
  const medals = ['🥈', '🥇', '🥉'];
  return (
    <div className="podium-3">
      {order.map((idx, i) => {
        const r = results[idx];
        if (!r) return <div key={i}/>;
        const ti = teamInfo(r.team);
        const grad = `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0) 35%, ${ti.dark}cc 80%, ${ti.dark} 100%)`;
        return (
          <div key={i} className={'card ' + (i === 1 ? 'card-2' : '')} style={{ background: ti.dark }}>
            <div className="photo">
              {r.photo_url && <img src={hiResImg(r.photo_url, 800)} alt="" loading="lazy"/>}
            </div>
            <div className="grad" style={{ background: grad }}/>
            <div className="pos">{idx + 1}</div>
            <div className="medal">{medals[i]}</div>
            <div className="content">
              <div style={{ minWidth:0 }}>
                <div className="first">{r.first_name || (r.name || '').split(' ').slice(0, -1).join(' ')}</div>
                <h4>{r.last_name || (r.name || '').split(' ').slice(-1)[0]}</h4>
                <span className="team-pill" style={{ background: ti.color, color:'#000' }}>{r.team}</span>
              </div>
              <div className="stat">
                <div className="num">{r.points || 0}</div>
                <div className="l">очков</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ResultsTable = ({ results, mode }) => {
  // mode: 'race' | 'qualifying' | 'sprint' | 'sprint_qualifying'
  const isQual = mode === 'qualifying' || mode === 'sprint_qualifying';
  return (
    <div className="r-table">
      <div className="head">
        <span>Поз</span>
        <span className="h-num">№</span>
        <span>Пилот</span>
        <span className="h-team">Команда</span>
        <span style={{ textAlign:'right' }}>{isQual ? 'Лучший круг' : 'Время / отставание'}</span>
        <span style={{ textAlign:'right' }}>{isQual ? '' : 'Очки'}</span>
      </div>
      {results.map((r, i) => {
        const ti = teamInfo(r.team);
        const pos = r.position || (i + 1);
        const time = isQual
          ? (r.q3 || r.q2 || r.q1 || r.Q3 || r.Q2 || r.Q1 || r.time || '—')
          : (r.time || r.status || '—');
        const isStatus = !isQual && !r.time && r.status;
        return (
          <div key={i} className="row" data-top={i < 3 ? '1' : '0'}>
            <span className="pos">{pos}</span>
            <span className="num-cell">{r.number || ''}</span>
            <div className="driver">
              <DriverPhoto url={r.photo_url} size={42} stripe={ti.color}/>
              <div className="name">
                <span className="first">{r.first_name || (r.name||'').split(' ').slice(0,-1).join(' ')}</span>
                <span>{r.last_name || (r.name||'').split(' ').slice(-1)[0] || r.name}</span>
              </div>
            </div>
            <div className="team"><span className="swatch" style={{ background: ti.color }}/>{r.team}</div>
            <span className={'time' + (isStatus ? ' status' : '')}>{time}</span>
            {isQual ? <span/> : <span className={'pts ' + (!r.points ? 'zero' : '')}>{r.points || 0}</span>}
          </div>
        );
      })}
    </div>
  );
};

const sessionIso = (s) => {
  if (!s) return null;
  if (typeof s === 'string') return s;
  if (s.date && s.time) return s.date + 'T' + s.time;
  if (s.date) return s.date + 'T12:00:00Z';
  return null;
};
const SessionScheduleList = ({ sessions }) => {
  if (!sessions) return <Empty>Расписание сессий появится ближе к уикенду</Empty>;
  const order = [
    ['fp1', 'Свободная практика 1', 'FP1'],
    ['fp2', 'Свободная практика 2', 'FP2'],
    ['fp3', 'Свободная практика 3', 'FP3'],
    ['sprint_qualifying', 'Спринт-квалификация', 'SQ'],
    ['sprint', 'Спринт', 'SPR'],
    ['qualifying', 'Квалификация', 'QUAL'],
    ['race', 'Гонка', 'RACE'],
  ];
  const now = Date.now();
  const upcoming = order
    .map(([k, label, sub]) => ({ k, label, sub, iso: sessionIso(sessions[k]) }))
    .filter(x => x.iso);
  if (upcoming.length === 0) return <Empty>Расписание сессий появится ближе к уикенду</Empty>;
  const nextIdx = upcoming.findIndex(x => new Date(x.iso).getTime() > now);
  return (
    <div className="sess-list">
      {upcoming.map((x, i) => (
        <div key={x.k} className="item" data-soon={i === nextIdx ? '1' : '0'}>
          <div className="lbl">{x.label}<span className="sub">{x.sub}</span></div>
          <div className="when">
            <div className="day">{formatDayRu(x.iso)}</div>
            <div className="time">{formatTimeRu(x.iso)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const RaceDetailPage = ({ round, season, spoilerFree, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [race, setRace] = useState(null);
  const [raceRes, setRaceRes] = useState(null);
  const [qualRes, setQualRes] = useState(null);
  const [broadcasts, setBroadcasts] = useState(null);
  const [tab, setTab] = useState(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let cancel = false;
    const s = season || new Date().getFullYear();
    setLoading(true);
    (async () => {
      const sched = await api.get('/api/schedule?season=' + s);
      if (cancel) return;
      const list = sched?.races || sched || [];
      const r = list.find(x => Number(x.round) === Number(round));
      if (!r) { setRace(null); setLoading(false); return; }
      setRace({ ...r, season: s });
      setTab(r.is_past ? 'race' : 'schedule');
      setLoading(false);
      const bcRes = await api.get('/api/broadcasts?race_round=' + round + '&season=' + s);
      if (!cancel) setBroadcasts(bcRes?.broadcasts || []);
      if (r.is_past) {
        const [rr, qq] = await Promise.all([
          api.get('/api/race/' + round + '/results?season=' + s),
          api.get('/api/race/' + round + '/qualifying?season=' + s),
        ]);
        if (cancel) return;
        setRaceRes(rr || { results: [] });
        setQualRes(qq || { results: [] });
      }
    })();
    return () => { cancel = true; };
  }, [round, season]);

  if (loading) return (
    <div className="cnt section">
      <a className="btn-link" onClick={onBack} style={{ marginBottom:24, cursor:'pointer' }}>Назад</a>
      <Loader/>
    </div>
  );
  if (!race) return (
    <div className="cnt section">
      <Empty>Гонка не найдена</Empty>
      <div style={{ textAlign:'center', marginTop:18 }}><a className="btn btn-ghost btn-sm" onClick={onBack} style={{ cursor:'pointer' }}>← К календарю</a></div>
    </div>
  );

  const isPast = !!race.is_past;
  const hasSprint = !!race.sprint;
  const showSpoiler = spoilerFree && isPast && !revealed;
  const sessionsObj = race.sessions || {};
  const firstSession = ['fp1','sprint_qualifying','qualifying','sprint','race']
    .map(k => sessionIso(sessionsObj[k])).find(Boolean) || race.race_datetime || race.date;

  const tabs = isPast
    ? [['qualifying', 'Квалификация'], ['race', 'Гонка'], ['broadcasts', 'Записи']]
    : [['schedule', 'Расписание'], ['broadcasts', 'Записи']];

  const renderTab = () => {
    if (tab === 'schedule') return <SessionScheduleList sessions={sessionsObj}/>;
    if (tab === 'broadcasts') {
      if (broadcasts === null) return <Loader/>;
      return <BroadcastList broadcasts={broadcasts} hasSprint={hasSprint}/>;
    }
    if (showSpoiler) return <SpoilerCard onReveal={() => setRevealed(true)}/>;
    const res = tab === 'race' ? raceRes : qualRes;
    if (res === null) return <Loader/>;
    const list = res?.results || [];
    if (list.length === 0) return <Empty>Результаты пока не опубликованы</Empty>;
    return (
      <Fragment>
        {tab === 'race' && list.length >= 3 && <PodiumThree results={list.slice(0, 3)}/>}
        <ResultsTable results={list} mode={tab}/>
      </Fragment>
    );
  };

  return (
    <Fragment>
      <RaceHero race={race} isPast={isPast} sessionStart={firstSession} onBack={onBack}/>
      <section className="section">
        <div className="cnt">
          <div className="tabs">
            {tabs.map(([k, label]) => (
              <button key={k} data-on={tab === k ? '1' : '0'} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          {renderTab()}
        </div>
      </section>
    </Fragment>
  );
};

// ============ STANDINGS PAGE ============
const StandingsPage = ({ season, spoilerFree, onDriverPick, onTeamPick }) => {
  const [tab, setTab] = useState('drivers');
  const [revealed, setRevealed] = useState(false);
  const [drivers, setDrivers] = useState(null);
  const [constructors, setConstructors] = useState(null);
  const [h2h, setH2h] = useState(null);
  const [progress, setProgress] = useState(null);
  const [allDrivers, setAllDrivers] = useState(null);
  const [teamsData, setTeamsData] = useState(null);
  const chartRef = useRef(null);
  const chartInst = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/standings/drivers?season=' + season).then(d => {
        // Background prefetch career stats — warms cache before user clicks
        try {
          const drvs = d?.standings || [];
          drvs.forEach((dr, idx) => {
            const ergId = (dr.ergast_id || (dr.last_name || '').toLowerCase()).replace(/\s+/g, '_');
            if (ergId) setTimeout(() => fetch('/api/driver/career/' + ergId).catch(() => {}), idx * 250);
          });
        } catch(_){}
        return d;
      }),
      api.get('/api/standings/constructors?season=' + season).then(d => {
        try {
          const TEAM_IDS = { 'Mercedes':'mercedes', 'Ferrari':'ferrari', 'McLaren':'mclaren', 'Red Bull':'red_bull', 'Red Bull Racing':'red_bull', 'Aston Martin':'aston_martin', 'Williams':'williams', 'RB':'rb', 'Racing Bulls':'rb', 'Sauber':'sauber', 'Kick Sauber':'sauber', 'Haas':'haas', 'Haas F1 Team':'haas', 'Alpine':'alpine', 'Alpine F1 Team':'alpine' };
          (d?.standings || []).forEach((c, idx) => {
            const id = TEAM_IDS[c.team];
            if (id) setTimeout(() => fetch('/api/team/career/' + id).catch(() => {}), 6000 + idx * 400);
          });
        } catch(_){}
        return d;
      }),
    ]).then(([d, c]) => {
      setDrivers(d?.standings || []);
      setConstructors(c?.standings || []);
    });
  }, [season]);

  useEffect(() => {
    if (tab === 'h2h' && !h2h) api.get('/api/head-to-head?season=' + season).then(d => setH2h(d || { head_to_head: [] }));
    if (tab === 'progress' && !progress) api.get('/api/standings/points-progression?season=' + season).then(d => setProgress(d || { drivers: [] }));
    if (tab === 'cards' && !allDrivers) Promise.all([api.get('/api/drivers?season=' + season), api.get('/api/standings/drivers?season=' + season)]).then(([dr, st]) => { const stMap = {}; (st?.standings || []).forEach(x => { stMap[x.driver_number] = x; }); const baseList = (dr?.drivers || []).map(d => ({ ...d, ...(stMap[d.driver_number] || {}), code: d.code || stMap[d.driver_number]?.code })); setAllDrivers(baseList); Promise.all(baseList.map(d => api.get('/api/driver/' + d.driver_number).then(x => x?.season_stats ? { ...d, ...x.season_stats } : d))).then(setAllDrivers); });
    if (tab === 'teams' && !teamsData) api.get('/api/teams?season=' + season).then(d => setTeamsData(d?.teams || []));
  }, [tab, season]);

  // Chart.js init for progress tab
  useEffect(() => {
    if (tab !== 'progress' || !progress?.drivers?.length || !chartRef.current || typeof Chart === 'undefined') return;
    if (chartInst.current) chartInst.current.destroy();
    const ctx = chartRef.current.getContext('2d');
    chartInst.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: progress.drivers.map(d => ({
          label: d.code,
          data: d.progression.map(p => ({ x: p.round, y: p.cumulative })),
          borderColor: d.team_color || '#888',
          backgroundColor: d.team_color || '#888',
          borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.15, fill: false,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#a0a0b0', boxWidth: 12, font: { size: 11, family: 'Manrope' } } },
          tooltip: { mode: 'nearest', intersect: false, backgroundColor: '#1c1c28', titleColor: '#fafafa', bodyColor: '#a0a0b0', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1 },
        },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'Раунд', color: '#6b6b7b', font: { family: 'Manrope' } }, ticks: { color: '#6b6b7b', stepSize: 1, font: { family: 'Manrope' } }, grid: { color: 'rgba(255,255,255,.04)' } },
          y: { title: { display: true, text: 'Очки', color: '#6b6b7b', font: { family: 'Manrope' } }, ticks: { color: '#6b6b7b', font: { family: 'Manrope' } }, grid: { color: 'rgba(255,255,255,.04)' }, min: 0 },
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
      },
    });
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; } };
  }, [tab, progress]);

  const tabs = [
    ['drivers',      'Пилоты'],
    ['constructors', 'Кубок'],
    ['cards',        'Карточки'],
    ['teams',        'Команды'],
    ['h2h',          'H2H'],
    ['progress',     'Прогресс'],
  ];

  const renderContent = () => {
    if (spoilerFree && !revealed) return <SpoilerCard onReveal={() => setRevealed(true)} label={`Чемпионат ${season} скрыт`}/>;
    if (tab === 'drivers') {
      if (drivers === null) return <Loader/>;
      if (!drivers.length) return <Empty>Стандинги недоступны</Empty>;
      return <DriversBoard drivers={drivers} onPick={onDriverPick}/>;
    }
    if (tab === 'constructors') {
      if (constructors === null) return <Loader/>;
      if (!constructors.length) return <Empty>Стандинги недоступны</Empty>;
      return <ConstructorsBoard constructors={constructors} drivers={drivers || []} onPick={onDriverPick} onPickTeam={onTeamPick}/>;
    }
    if (tab === 'h2h') {
      if (h2h === null) return <Loader/>;
      if (!h2h.head_to_head?.length) return <Empty>Нет данных для H2H</Empty>;
      return <H2HBoard pairs={h2h.head_to_head} onPick={onDriverPick}/>;
    }
    if (tab === 'cards') {
      if (allDrivers === null) return <Loader/>;
      if (!allDrivers.length) return <Empty>Карточки недоступны</Empty>;
      return <DriverCardsGrid drivers={allDrivers} onPick={onDriverPick}/>;
    }
    if (tab === 'teams') {
      if (teamsData === null) return <Loader/>;
      if (!teamsData.length) return <Empty>Данные команд недоступны</Empty>;
      return <TeamsBoard teams={teamsData} constructors={constructors || []} onPick={onDriverPick} onPickTeam={onTeamPick}/>;
    }
    if (tab === 'progress') {
      if (progress === null) return <Loader/>;
      if (!progress.drivers?.length) return <Empty>Прогресс будет доступен после первой гонки</Empty>;
      return (
        <Fragment>
          <div className="progress-wrap"><canvas ref={chartRef}/></div>
          <div className="st-list" style={{ marginTop:16 }}>
            {progress.drivers.map((d, i) => (
              <div key={d.driver_number} className="row" data-top={i < 3 ? '1' : '0'}>
                <span className="pos">{i + 1}</span>
                <div className="driver">
                  <div className="stripe" style={{ background: d.team_color || '#888', height:28 }}/>
                  <div className="nm"><span className="f" style={{ color: d.team_color }}>{d.code}</span><span className="l">{d.name}</span></div>
                </div>
                <div className="team"><span className="swatch" style={{ background: d.team_color }}/>{d.team}</div>
                <div className="pts-col"><div className="v">{d.total_points}</div></div>
              </div>
            ))}
          </div>
        </Fragment>
      );
    }
    return null;
  };

  return (
    <section className="standings-page fade-up">
      <div className="cnt">
        <div className="standings-hero">
          <div className="lead">
            <div className="eyebrow eyebrow-red">РАЗДЕЛ 03 · ЧЕМПИОНАТ</div>
            <h1>Сезон <span className="yr">{season}</span></h1>
          </div>
        </div>
        <div className="tabs">
          {tabs.map(([k, l]) => (
            <button key={k} data-on={tab === k ? '1' : '0'} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {renderContent()}
      </div>
    </section>
  );
};

const DriversBoard = ({ drivers, onPick }) => {
  const leaderPts = drivers[0]?.points || 1;
  const top3 = drivers.slice(0, 3);
  const rest = drivers.slice(3);
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <Fragment>
      <div className="drv-podium-3">
        {top3.map((d, i) => {
          const ti = teamInfo(d.team);
          const color = d.team_color || ti.color;
          const dark = ti.dark;
          const grad = `linear-gradient(180deg, rgba(0,0,0,.18) 0%, transparent 25%, ${dark}aa 55%, ${dark} 85%)`;
          return (
            <div key={i} className="card" onClick={() => onPick && onPick(d)} style={{ background: dark, cursor: onPick ? 'pointer' : 'default' }}>
              <div className="photo">{d.photo_url && <img src={hiResImg(d.card_photo_url || d.photo_url, 700)} alt="" loading="lazy" style={{ objectPosition: d.card_photo_position || 'top center' }}/>}</div>
              <div className="grad" style={{ background: grad }}/>
              <div className="pos">{i + 1}</div>
              <div className="medal">{medals[i]}</div>
              <div className="content">
                <div className="first">{d.first_name}</div>
                <h4>{d.last_name}</h4>
                <span className="team-pill" style={{ background: color, color:'#000' }}>{d.team}</span>
                <div className="pts-row">
                  <div>
                    <div className="num">{d.points}</div>
                    <div style={{ fontSize:10, opacity:.8, letterSpacing:'.14em', textTransform:'uppercase', marginTop:3 }}>очков</div>
                  </div>
                  {i > 0 && <div className="l" style={{ textAlign:'right' }}>{leaderPts - d.points} от 1-го</div>}
                </div>
                <div className="bar"><div className="fill" style={{ width: Math.max(8, (d.points / leaderPts) * 100) + '%', background: color }}/></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="st-list">
        {rest.map((d, i) => {
          const ti = teamInfo(d.team);
          const color = d.team_color || ti.color;
          const flagSrc = d.country ? 'https://flagcdn.com/w40/' + d.country.toLowerCase() + '.png' : null;
          return (
            <div key={d.driver_number || i} className="row drv-row-hover" onClick={() => onPick && onPick(d)} style={{ position:'relative', cursor: onPick ? 'pointer' : 'default' }}>
              <span className="pos">{i + 4}</span>
              <div className="driver">
                <div className="stripe" style={{ background: color }}/>
                <DriverPhoto url={d.photo_url} size={56} stripe={null}/>
                <div className="nm"><span className="f">{d.first_name}</span><span className="l">{d.last_name}</span></div>
              </div>
              <div className="team"><span className="swatch" style={{ background: color }}/>{d.team}</div>
              <div className="pts-col">
                <div className="v">{d.points}</div>
                {d.gap_to_leader > 0 && <div className="gap">−{d.gap_to_leader}</div>}
              </div>
              <div className="drv-row-tip" style={{ borderColor: color }}>
                <div className="t-head">
                  <span className="t-pos" style={{ background: color }}>#{i + 4}</span>
                  <span className="t-code">{d.code || (d.last_name || '').slice(0,3).toUpperCase()}</span>
                  {flagSrc && <img src={flagSrc} alt={d.country} className="t-flag"/>}
                </div>
                <div className="t-rows">
                  <div><span>Очки</span><b>{d.points ?? 0}</b></div>
                  <div><span>Победы</span><b>{d.wins ?? 0}</b></div>
                  <div><span>Отрыв</span><b>−{d.gap_to_leader || 0}</b></div>
                  <div><span>Команда</span><b>{(d.team || '').replace(/F1 Team/, '').trim()}</b></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Fragment>
  );
};

const ConstructorsBoard = ({ constructors, drivers, onPick, onPickTeam }) => {
  const leaderPts = constructors[0]?.points || 1;
  return (
    <div className="con-list">
      {constructors.map((c, i) => {
        const ti = teamInfo(c.team);
        const color = c.team_color || ti.color;
        const carDrivers = (c.drivers || []).map(cd => {
          const matched = drivers.find(x => x.driver_number === cd.driver_number);
          return { ...cd, points: matched?.points || cd.points || 0 };
        });
        const total = carDrivers.reduce((s, x) => s + (x.points || 0), 0) || 1;
        return (
          <div key={i} className="con-card" data-top={i < 3 ? '1' : '0'} style={{ borderLeftColor: color }}>
            <div className="row">
              <div className="pos">{i + 1}</div>
              <div className="body">
                <div className="team-name" onClick={() => onPickTeam && onPickTeam({ name: c.team, color, logo_url: c.logo_url, points: c.points, position: i + 1 })} style={{ cursor: onPickTeam ? 'pointer' : 'default' }}>
                  {c.logo_url && <img className="logo" src={hiResImg(c.logo_url, 64)} alt="" loading="lazy" onError={e => e.target.style.display='none'}/>}
                  <span style={{ color }}>{c.team}</span>
                </div>
                {carDrivers.length > 0 && (
                  <div className="drvs">
                    {carDrivers.map((d, j) => (
                      <div key={j} className="drv-pill" onClick={() => { const full = drivers.find(x => x.driver_number === d.driver_number) || d; onPick && onPick(full); }} style={{ cursor: onPick ? 'pointer' : 'default' }}>
                        <div className="ph">{d.photo_url && <img src={faceImg(d.photo_url, 320)} alt="" loading="lazy"/>}</div>
                        <div className="lbl">
                          <span className="code">{d.code || d.last_name?.toUpperCase().slice(0,3)}</span>
                          <span className="pp">{d.points} очк.</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {c.points > 0 && carDrivers.length > 0 && (
                  <div className="bar">
                    {carDrivers.map((d, j) => (
                      <div key={j} className="seg" style={{ width: Math.max(4, (d.points / total) * 100) + '%', background: j === 0 ? color : color + '99' }}/>
                    ))}
                  </div>
                )}
              </div>
              <div className="pts-col">
                <div className="v">{c.points}</div>
                {i > 0 && <div className="gap">−{leaderPts - c.points}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const H2HBoard = ({ pairs, onPick }) => (
  <div className="h2h-grid">
    {pairs.map((p, i) => {
      const d1 = p.driver1, d2 = p.driver2;
      const totalPts = (d1.points + d2.points) || 1;
      const d1Pct = (d1.points / totalPts) * 100;
      const d2Pct = (d2.points / totalPts) * 100;
      const totalW = (d1.wins + d2.wins) || 1;
      const d1WPct = (d1.wins / totalW) * 100;
      return (
        <div key={i} className="h2h-card" style={{ borderLeftColor: p.color }}>
          <div className="head" style={{ color: p.color }}>{p.team}</div>
          <div className="body">
            <div className="pair-row">
              <div className="who" onClick={() => onPick && onPick({ ...d1, first_name: (d1.full_name || d1.name || "").split(" ")[0], last_name: (d1.full_name || d1.name || "").split(" ").slice(1).join(" ") || d1.name, team: p.team, team_color: p.color })} style={{ cursor: onPick ? 'pointer' : 'default' }}>
                <div className="ph" style={{ borderColor: p.color }}>{d1.photo_url && <img src={faceImg(d1.photo_url, 500)} alt="" loading="lazy"/>}</div>
                <div>
                  <div className="name">{d1.name}</div>
                  <div className="sub">{d1.full_name}</div>
                </div>
              </div>
              <div className="vs">VS</div>
              <div className="who right" onClick={() => onPick && onPick({ ...d2, first_name: (d2.full_name || d2.name || "").split(" ")[0], last_name: (d2.full_name || d2.name || "").split(" ").slice(1).join(" ") || d2.name, team: p.team, team_color: p.color })} style={{ cursor: onPick ? 'pointer' : 'default' }}>
                <div>
                  <div className="name">{d2.name}</div>
                  <div className="sub">{d2.full_name}</div>
                </div>
                <div className="ph" style={{ borderColor: p.color }}>{d2.photo_url && <img src={faceImg(d2.photo_url, 500)} alt="" loading="lazy"/>}</div>
              </div>
            </div>
            <div className="metric">
              <div className="lbl-row"><span>{d1.points} очков</span><span className="mid">Очки</span><span>{d2.points} очков</span></div>
              <div className="bar"><div className="seg" style={{ width: d1Pct + '%', background: p.color }}/><div className="seg" style={{ width: d2Pct + '%', background: p.color + '55' }}/></div>
            </div>
            {(d1.wins > 0 || d2.wins > 0) && (
              <div className="metric">
                <div className="lbl-row"><span>{d1.wins} побед</span><span className="mid">Победы</span><span>{d2.wins} побед</span></div>
                <div className="bar"><div className="seg" style={{ width: d1WPct + '%', background: '#FFD700' }}/><div className="seg" style={{ width: (100 - d1WPct) + '%', background: '#FFD70044' }}/></div>
              </div>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

const DriverCardsGrid = ({ drivers, onPick }) => {
  // Flat grid sorted by team (drivers from same team next to each other)
  const sorted = [...drivers].sort((a, b) => {
    const t = (a.team || '').localeCompare(b.team || '');
    if (t !== 0) return t;
    return (a.position || 99) - (b.position || 99);
  });
  return (
    <div className="drv-cards">
      {sorted.map(d => {
        const ti = teamInfo(d.team);
        const color = d.team_color || ti.color;
        const big = hiResImg(d.card_photo_url || d.photo_url, 800);
        return (
          <div key={d.driver_number} className="drv-card" onClick={() => onPick && onPick(d)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
            <div className="photo" style={{ background: 'linear-gradient(180deg, ' + color + '22, ' + color + '08)' }}>
              <div className="num" style={{ color }}>{d.driver_number}</div>
              {big && <img src={big} alt="" loading="lazy" style={{ objectPosition: d.card_photo_position || 'top center' }} onError={e => e.target.style.display='none'}/>}
              <div className="grad" style={{ background: 'linear-gradient(180deg, transparent 45%, ' + color + 'DD)' }}/>
              <div className="info">
                <div className="first">{d.first_name || (d.name || '').split(' ')[0]}</div>
                <div className="last">{d.last_name || (d.name || '').split(' ').slice(1).join(' ')}</div>
              </div>
            </div>
            <div className="foot">
              <span style={{ color }}>{(d.team || '').replace(/F1 Team/, '').trim()}</span>
              <span style={{ display:'flex', gap:8, alignItems:'center', fontSize:11, color:'var(--muted)' }}>
                {d.country && <img src={'https://flagcdn.com/w40/' + d.country.toLowerCase() + '.png'} alt={d.country} style={{ width:18, height:13, objectFit:'cover', borderRadius:2 }}/>}
                <span>#{d.driver_number}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TeamsBoard = ({ teams, constructors, onPick, onPickTeam }) => {
  const ptsByTeam = {};
  const posByTeam = {};
  (constructors || []).forEach((c, ci) => {
    ptsByTeam[c.team] = c.points;
    posByTeam[c.team] = c.position || (ci + 1);
  });
  const sorted = [...teams].sort((a, b) => (posByTeam[a.name || a.team] || 99) - (posByTeam[b.name || b.team] || 99));
  return (
    <div className="team-cards">
    {sorted.map((t, i) => {
      const ti = teamInfo(t.name || t.team);
      const color = t.color || t.team_color || ti.color;
      const tname = t.name || t.team;
      const pts = ptsByTeam[tname] ?? t.points;
      const pos = posByTeam[tname] || t.position || (i + 1);
      return (
        <div key={i} className="team-card">
          {t.car_url && (
            <div className="car" onClick={() => onPickTeam && onPickTeam({ name: tname, color, logo_url: t.logo_url, car_url: t.car_url, points: pts, position: pos })} style={{ background: 'linear-gradient(135deg, ' + color + '22, var(--surface-2))', cursor: onPickTeam ? 'pointer' : 'default' }}>
              <img src={hiResImg(t.car_url, 1000)} alt="" loading="lazy" onError={e => e.target.style.display='none'}/>
            </div>
          )}
          <div className="body">
            <div className="top-row">
              {t.logo_url && <img className="logo" src={hiResImg(t.logo_url, 128)} alt="" loading="lazy" onError={e => e.target.style.display='none'}/>}
              <div className="name" style={{ color }}>{tname}</div>
              <div className="pts-col">
                <div className="v">{pts != null ? pts : '—'}</div>
                <div className="pp">P{pos}</div>
              </div>
            </div>
            <div className="drv-row">
              {(t.drivers || []).map((d, j) => (
                <div key={j} className="drv" onClick={() => onPick && onPick(d)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
                  <div className="ph" style={{ borderColor: color }}>{d.photo_url && <img src={faceImg(d.photo_url, 400)} alt="" loading="lazy"/>}</div>
                  <div className="nm">
                    <span className="c">{d.code}</span>
                    <span className="l">{d.last_name || (d.name || '').split(' ').pop()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    })}
    </div>
  );
};

// ============ PREDICTIONS PAGE ============
const PRED_ICONS = { winner:'🏆', podium:'🥇', fastest_lap:'⚡', safety_car:'🚗', dnf_count:'💥' };
const PRED_TYPE_LABELS = { winner:'Победитель', podium:'Подиум', fastest_lap:'Быстрый круг', safety_car:'Safety Car', dnf_count:'Сходы' };

const DriverPickButton = ({ d, selected, idx, onClick, disabled }) => (
  <button onClick={() => onClick(d.driver_number)} disabled={disabled} data-sel={selected || idx ? '1' : '0'}>
    <span className="stripe" style={{ background: d.team_color || '#888' }}/>
    <div className="ph">{d.photo_url && <img src={faceImg(d.photo_url, 240)} alt="" loading="lazy"/>}</div>
    <span className="code">{d.code || d.last_name?.toUpperCase().slice(0, 3) || d.name?.split(' ').pop()?.toUpperCase()}</span>
    {idx && <span className="idx">{idx}</span>}
  </button>
);

const PredictionsPage = ({ user, onLogin }) => {
  const [avail, setAvail] = useState(null);
  const [myPredictions, setMyPredictions] = useState(null);
  const [podiumPicks, setPodiumPicks] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { ok, msg }

  const showToast = (msg, ok = true) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 2500);
  };

  const refreshMine = () => api.get('/api/user/predictions').then(d => setMyPredictions(d?.predictions || []));

  useEffect(() => {
    if (!user) return;
    api.get('/api/predictions/available').then(d => { if (d) setAvail(d); });
    refreshMine();
  }, [user?.user_id || user?.id]);

  if (!user) return (
    <section className="predict-page fade-up">
      <div className="cnt">
        <div className="predict-hero">
          <div className="eyebrow eyebrow-red">РАЗДЕЛ 04 · ПРОГНОЗЫ</div>
          <h1>Прогнозы</h1>
        </div>
        <div className="auth-gate">
          <div className="ic">🎯</div>
          <h2>Войдите, чтобы делать прогнозы</h2>
          <p>Угадывайте победителя гонки, подиум, быстрый круг, шансы safety car и количество сходов. Очки добавляются в общий рейтинг.</p>
          <button className="btn btn-red" onClick={onLogin}>Войти через Telegram</button>
        </div>
      </div>
    </section>
  );

  if (!avail) return (
    <section className="predict-page">
      <div className="cnt"><Loader/></div>
    </section>
  );

  if (!avail.available) return (
    <section className="predict-page fade-up">
      <div className="cnt">
        <div className="predict-hero">
          <div className="eyebrow eyebrow-red">РАЗДЕЛ 04 · ПРОГНОЗЫ</div>
          <h1>Прогнозы</h1>
        </div>
        <div className="auth-gate">
          <div className="ic">⏳</div>
          <h2>{avail.message || 'Прогнозы временно закрыты'}</h2>
          {avail.race && <p>Следующая гонка: <b>{avail.race.name}</b></p>}
        </div>
        {myPredictions?.length > 0 && <PredictionsHistory items={myPredictions}/>}
      </div>
    </section>
  );

  const race = avail.race || {};
  const drivers = avail.drivers || [];
  const types = avail.predictions || [];
  const driverByNum = Object.fromEntries(drivers.map(d => [d.driver_number, d]));

  const submit = async (type, value) => {
    setSubmitting(true);
    const res = await api.post('/api/predictions/make', {
      race_round: race.round, season: race.season || new Date().getFullYear(),
      prediction_type: type, prediction_value: value,
    });
    if (res && !res.error) {
      showToast('✓ Прогноз принят', true);
      if (type === 'podium') setPodiumPicks([]);
      refreshMine();
    } else {
      showToast(res?.error || 'Не удалось сохранить', false);
    }
    setSubmitting(false);
  };

  const togglePodium = (num) => {
    setPodiumPicks(p => {
      if (p.includes(num)) return p.filter(x => x !== num);
      if (p.length >= 3) return p;
      return [...p, num];
    });
  };

  const existingByType = {};
  (myPredictions || []).filter(p => p.race_round === race.round).forEach(p => { existingByType[p.prediction_type] = p; });

  const displayValue = (type, value) => {
    if (Array.isArray(value)) return value.map(n => driverByNum[n]?.code || n).join(' → ');
    if (type === 'safety_car') return (value === true || value === 'yes') ? 'Да' : 'Нет';
    if (type === 'winner' || type === 'fastest_lap') return driverByNum[value]?.name || value;
    return String(value ?? '');
  };

  return (
    <Fragment>
      <section className="predict-page fade-up">
        <div className="cnt">
          <div className="predict-hero">
            <div className="eyebrow eyebrow-red">РАЗДЕЛ 04 · ПРОГНОЗЫ</div>
            <h1>Прогнозы</h1>
            <div className="race-sub">
              <span>{race.name}</span>
              <span className="dot"/>
              <span>Раунд {String(race.round || '').padStart(2, '0')}</span>
              {race.date && <><span className="dot"/><span>{formatDateRu(race.date)}</span></>}
            </div>
          </div>

          <div className="pred-list">
            {types.map(pt => {
              const existing = existingByType[pt.type];
              const done = pt.already_predicted || !!existing;
              return (
                <div key={pt.type} className="pred-card">
                  <div className="head">
                    <span className="ic">{PRED_ICONS[pt.type] || '🎯'}</span>
                    <span className="label">{pt.label}</span>
                    <span className="max">макс. {pt.max_points} очк.</span>
                    {done && <span className="done-tag">сделан</span>}
                  </div>
                  <div className="desc">{pt.description}</div>

                  {done ? (
                    <div className="your-pick">
                      <span className="lbl">Ваш выбор:</span>
                      <span className="val">{displayValue(pt.type, existing?.prediction_value)}</span>
                    </div>
                  ) : pt.type === 'safety_car' ? (
                    <div className="yn-row">
                      <button onClick={() => submit('safety_car', 'yes')} disabled={submitting}>Да</button>
                      <button onClick={() => submit('safety_car', 'no')} disabled={submitting}>Нет</button>
                    </div>
                  ) : pt.type === 'dnf_count' ? (
                    <div className="num-row">
                      {[0,1,2,3,4,5,6].map(n => (
                        <button key={n} onClick={() => submit('dnf_count', n)} disabled={submitting}>{n}</button>
                      ))}
                    </div>
                  ) : pt.type === 'podium' ? (
                    <Fragment>
                      <div className="drv-pick">
                        {drivers.map(d => {
                          const idx = podiumPicks.indexOf(d.driver_number);
                          return <DriverPickButton key={d.driver_number} d={d} idx={idx >= 0 ? idx + 1 : null} onClick={togglePodium} disabled={submitting}/>;
                        })}
                      </div>
                      <div className="podium-confirm">
                        <div className="info">
                          Выбрано <b>{podiumPicks.length}/3</b>
                          {podiumPicks.length > 0 && ' — ' + podiumPicks.map(n => driverByNum[n]?.code || n).join(' → ')}
                        </div>
                        <button className="btn btn-red btn-sm" onClick={() => submit('podium', podiumPicks)} disabled={submitting || podiumPicks.length !== 3}>Подтвердить</button>
                      </div>
                    </Fragment>
                  ) : (
                    <div className="drv-pick">
                      {drivers.map(d => (
                        <DriverPickButton key={d.driver_number} d={d} onClick={(n) => submit(pt.type, n)} disabled={submitting}/>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {myPredictions?.length > 0 && <PredictionsHistory items={myPredictions} driverByNum={driverByNum}/>}
        </div>
      </section>
      {toast && <div className={'toast ' + (toast.ok ? 'ok' : 'err')}>{toast.msg}</div>}
    </Fragment>
  );
};

const PredictionsHistory = ({ items, driverByNum = {} }) => {
  const grouped = {};
  items.filter(p => p.status !== 'pending').forEach(p => { (grouped[p.race_round] = grouped[p.race_round] || []).push(p); });
  const rounds = Object.keys(grouped).map(Number).sort((a, b) => b - a);
  if (!rounds.length) return null;

  const displayValue = (type, value) => {
    if (Array.isArray(value)) return value.map(n => driverByNum[n]?.code || n).join(' → ');
    if (type === 'safety_car') return (value === true || value === 'yes') ? 'Да' : 'Нет';
    if (type === 'winner' || type === 'fastest_lap') return driverByNum[value]?.name || value;
    return String(value ?? '');
  };

  return (
    <div className="hist-section">
      <div className="h-section" style={{ marginBottom:18 }}>История прогнозов</div>
      <div className="hist-list">
        {rounds.map(r => {
          const list = grouped[r];
          const raceName = list[0]?.race_name || ('Гран-при · Раунд ' + r);
          const total = list.reduce((s, p) => s + (p.points_won ?? p.points_earned ?? 0), 0);
          const correct = list.filter(p => p.status === 'correct').length;
          return (
            <div key={r} className="hist-card">
              <div className="head">
                <div className="r-tag">R{r}</div>
                <div className="title">
                  <div className="nm">{raceName}</div>
                  <div className="sub">{correct}/{list.length} угадано</div>
                </div>
                <div className="total">
                  <div className="num" style={{ color: total > 0 ? '#27F4D2' : 'var(--muted-2)' }}>{total}</div>
                  <div className="lbl">очков</div>
                </div>
              </div>
              {list.map((p, i) => {
                const pts = p.points_won ?? p.points_earned ?? 0;
                const color = p.status === 'correct' ? '#27F4D2' : p.status === 'partial' ? '#FFD700' : p.status === 'incorrect' ? '#E10600' : 'var(--muted-2)';
                return (
                  <div key={i} className="item">
                    <span className="ic">{PRED_ICONS[p.prediction_type] || '•'}</span>
                    <div className="descr">
                      <span className="ptype">{PRED_TYPE_LABELS[p.prediction_type] || p.prediction_type}</span>
                      <span className="val">{displayValue(p.prediction_type, p.prediction_value)}</span>
                    </div>
                    <span className="pts" style={{ color }}>{pts > 0 ? '+' + pts : '—'}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============ STUB PAGE ============
const StubPage = ({ kicker, title, hint }) => (
  <section className="stub fade-up">
    <div className="cnt">
      <div className="kk">{kicker}</div>
      <h1>{title}</h1>
      <p>Эта страница пока в разработке в новом дизайне. Перейди на старую версию сайта или подожди — мы переносим всё постранично.</p>
      <a href="/" className="ghost-link">← К старой версии</a>
    </div>
  </section>
);



// ============ PREMIUM EMBED FRAMES ============
const usePremiumFrame = (embedUrl, navigate) => {
  const ref = useRef(null);
  const [height, setHeight] = useState(800);
  useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'f1hub-prem-height' && typeof e.data.h === 'number') {
        setHeight(Math.max(800, e.data.h + 40));
      }
      if (e.data.type === 'f1hub-prem-play' && e.data.ytId) {
        window.dispatchEvent(new CustomEvent('f1hub-play-yt', { detail:{ ytId: e.data.ytId, title: e.data.title }}));
      }
      if (e.data.type === 'f1hub-prem-nav' && e.data.href) {
        const v2Map = {
          '/': '/',
          '/redesign': '/',
          '/redesign/v2': '/',
          '/redesign/calendar': '/calendar',
          '/redesign/v2/calendar': '/calendar',
        };
        const target = v2Map[e.data.href] || (e.data.href.startsWith('/redesign/v2/') ? e.data.href.replace('/redesign/v2', '') : e.data.href);
        navigate(target);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [navigate]);
  return { ref, height };
};

const HomePremiumFrame = ({ navigate, spoilerFree }) => {
  const { ref, height } = usePremiumFrame('/home-embed', navigate);
  const onLoad = (e) => { try { e.target.contentWindow.postMessage({ type:'f1hub-prem-set-spoiler', value: !!spoilerFree }, '*'); } catch(_){} };
  return <iframe ref={ref} onLoad={onLoad} src="/home-embed" title="F1 HUB" style={{ width:'100%', border:0, display:'block', height: height + 'px' }} scrolling="no"/>;
};
const CalendarPremiumFrame = ({ navigate, spoilerFree }) => {
  const { ref, height } = usePremiumFrame('/calendar-embed', navigate);
  const onLoad = (e) => { try { e.target.contentWindow.postMessage({ type:'f1hub-prem-set-spoiler', value: !!spoilerFree }, '*'); } catch(_){} };
  return <iframe ref={ref} onLoad={onLoad} src="/calendar-embed" title="F1 HUB Calendar" style={{ width:'100%', border:0, display:'block', height: height + 'px' }} scrolling="no"/>;
};



// ============ HIGHLIGHTS PAGE ============
const videoThumb = (url) => {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return 'https://i.ytimg.com/vi/' + yt[1] + '/hqdefault.jpg';
  return null;
};
const SESSION_LBL_HL = { race:'Гонка', qualifying:'Квалификация', sprint:'Спринт', sprint_qualifying:'Спринт-квали', review:'Обзор' };

const HighlightsPage = ({ onPlay }) => {
  const [bcs, setBcs] = useState(null);
  const [schedule, setSchedule] = useState([]);
  useEffect(() => {
    Promise.all([api.get('/api/broadcasts?season=2026'), api.get('/api/schedule?season=2026')]).then(([b, sc]) => {
      const reviews = (b?.broadcasts || []).filter(x => x.session_type === 'review').sort((a, c) => c.race_round - a.race_round);
      setBcs(reviews);
      setSchedule(sc?.races || []);
    });
  }, []);
  if (!bcs) return <section className="cnt" style={{ padding:'48px 0' }}><Loader/></section>;
  const raceName = (round) => schedule.find(r => r.round === round)?.name || ('Раунд ' + round);
  if (!bcs) return <section className="cnt" style={{ padding:'48px 0' }}><Loader/></section>;
  return (
    <section className="cnt" style={{ padding:'40px 0 80px' }}>
      <div className="eyebrow eyebrow-red" style={{ marginBottom:8 }}>Раздел · Видео-обзоры 2026</div>
      <h1 className="h-display" style={{ fontSize:38, margin:'4px 0 8px', letterSpacing:'-.02em' }}>Обзоры гран-при</h1>
      <p style={{ color:'var(--muted)', margin:'0 0 28px', fontSize:14 }}>{bcs.length} {bcs.length === 1 ? 'обзор' : bcs.length < 5 ? 'обзора' : 'обзоров'} · последние сверху</p>
      {bcs.length === 0 && <div style={{ color:'var(--muted)' }}>Пока нет обзоров.</div>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:18 }}>
        {bcs.map(b => {
          const ytm = (b.video_url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
          const thumb = ytm ? ('https://i.ytimg.com/vi/' + ytm[1] + '/hqdefault.jpg') : null;
          return (
            <div key={b.id} onClick={() => { if (ytm && onPlay) onPlay(ytm[1], raceName(b.race_round)); else if (b.video_url) window.open(b.video_url, '_blank'); }} style={{ cursor:'pointer', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:14, overflow:'hidden', transition:'transform .2s, border-color .2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--line-strong)'; }} onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--line)'; }}>
              <div style={{ position:'relative', aspectRatio:'16/9', background:'linear-gradient(135deg, var(--surface-2), var(--surface))' }}>
                {thumb && <img src={thumb} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => e.target.style.display='none'}/>}
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 50%, rgba(0,0,0,.65))', display:'flex', alignItems:'flex-end', justifyContent:'space-between', padding:14 }}>
                  <span style={{ background:'var(--red)', color:'#fff', padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase' }}>R{String(b.race_round).padStart(2,'0')} · Обзор</span>
                  <div style={{ width:54, height:54, borderRadius:'50%', background:'rgba(225,6,0,.95)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:22, boxShadow:'0 4px 16px rgba(225,6,0,.4)' }}>▶</div>
                </div>
              </div>
              <div style={{ padding:'14px 16px 16px' }}>
                <div style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>{raceName(b.race_round)}</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{b.title || 'Видео-обзор'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};




// ============ TEAM MODAL ============
const TEAM_ERGAST_ID = {
  'Mercedes':'mercedes', 'Ferrari':'ferrari', 'McLaren':'mclaren', 'Red Bull':'red_bull',
  'Red Bull Racing':'red_bull', 'Aston Martin':'aston_martin', 'Williams':'williams',
  'RB':'rb', 'Racing Bulls':'rb', 'Sauber':'sauber', 'Kick Sauber':'sauber',
  'Haas':'haas', 'Haas F1 Team':'haas', 'Alpine':'alpine', 'Alpine F1 Team':'alpine',
  'Audi':'audi', 'Audi F1 Team':'audi', 'Cadillac':'cadillac',
};
const TeamModal = ({ team, onClose }) => {
  const [career, setCareer] = useState(null);
  useEffect(() => {
    if (!team) return;
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const ergId = TEAM_ERGAST_ID[team.name] || team.name.toLowerCase().replace(/\s+/g, '_');
    api.get('/api/team/career/' + ergId).then(setCareer);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [team, onClose]);
  if (!team) return null;
  const color = team.color || '#888';
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ background:'rgba(0,0,0,.85)' }}>
      <div onClick={e => e.stopPropagation()} className="team-modal">
        <button onClick={onClose} className="x">✕</button>
        <div className="hero" style={{ background: 'linear-gradient(135deg, ' + color + '50, var(--surface-2))' }}>
          {team.car_url && <img src={team.car_url} alt="" className="car"/>}
          {team.logo_url && <img src={team.logo_url} alt="" className="logo"/>}
          <h2 style={{ color }}>{team.name}</h2>
          {(team.points != null) && (
            <div className="strip">
              <span>P{team.position || '—'}</span>
              <span><b>{team.points}</b> очков</span>
            </div>
          )}
        </div>
        <div className="sections">
          <div className="sec">
            <h3>История в F1</h3>
            {!career && <div style={{ color:'var(--muted)', fontSize:13 }}>Загрузка карьерной статистики…</div>}
            {career && (
              <Fragment>
                <div className="stats-grid">
                  <div><span>Чемпионств</span><b>{career.career?.championships ?? 0}</b></div>
                  <div><span>Побед</span><b>{career.career?.wins ?? 0}</b></div>
                  <div><span>Поулов</span><b>{career.career?.poles ?? 0}</b></div>
                  <div><span>Гран-при</span><b>{career.career?.races ?? 0}</b></div>
                  <div><span>Сезонов</span><b>{career.career?.seasons_count ?? 0}</b></div>
                  <div><span>Дебют</span><b>{career.career?.debut_season ?? '—'}</b></div>
                </div>
                {career.nationality && <div className="bio-row"><span>🌍 {career.nationality}</span></div>}
                {career.wiki_url && <a href={career.wiki_url} target="_blank" rel="noreferrer" className="wiki-link">История на Wikipedia →</a>}
              </Fragment>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ DRIVER MODAL (full profile) ============
const DriverModal = ({ driver, onClose }) => {
  const [career, setCareer] = useState(null);
  const [season, setSeason] = useState(null);
  useEffect(() => {
    if (!driver) return;
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // Season stats
    if (driver.driver_number) {
      api.get('/api/driver/' + driver.driver_number).then(d => setSeason(d?.season_stats));
    }
    // Career: prefer ergast_id, fall back to last_name lowercased
    const ergId = (driver.ergast_id || (driver.last_name || '').toLowerCase()).replace(/\s+/g, '_');
    if (ergId) {
      api.get('/api/driver/career/' + ergId).then(setCareer);
    }
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [driver, onClose]);
  if (!driver) return null;
  const ti = teamInfo(driver.team);
  const color = driver.team_color || ti.color;
  const flag = driver.country ? 'https://flagcdn.com/w80/' + driver.country.toLowerCase() + '.png' : null;
  const photo = hiResImg(driver.photo_url_large || driver.card_photo_url || driver.photo_url, 800);
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ background:'rgba(0,0,0,.85)' }}>
      <div onClick={e => e.stopPropagation()} className="drv-modal">
        <button onClick={onClose} className="x">✕</button>
        <div className="hero" style={{ background: 'linear-gradient(180deg, ' + color + '60, ' + color + '20 60%, var(--surface))' }}>
          {photo && <img src={photo} alt="" className="ph" data-tried="0" onError={e => { const fb = [driver.card_photo_url, driver.photo_url].filter(Boolean); const i = parseInt(e.target.dataset.tried || '0', 10); if (i < fb.length) { e.target.dataset.tried = i + 1; e.target.src = fb[i]; } else { e.target.style.display = 'none'; } }}/>}
          <div className="num" style={{ color }}>{driver.driver_number || ''}</div>
          <div className="bio">
            {flag && <img src={flag} alt={driver.country} className="flag"/>}
            <div>
              <div className="first">{driver.first_name || (driver.name || '').split(' ')[0]}</div>
              <h2>{driver.last_name || (driver.name || '').split(' ').slice(1).join(' ')}</h2>
              <span className="team-pill" style={{ background: color, color: '#000' }}>{driver.team}</span>
            </div>
          </div>
        </div>
        <div className="sections">
          <div className="sec">
            <h3>Сезон 2026</h3>
            <div className="stats-grid">
              <div><span>Позиция</span><b>{driver.position ? '#' + driver.position : '—'}</b></div>
              <div><span>Очки</span><b>{driver.points ?? season?.points ?? '—'}</b></div>
              <div><span>Победы</span><b>{driver.wins ?? season?.wins ?? 0}</b></div>
              <div><span>Подиумы</span><b>{season?.podiums ?? '—'}</b></div>
              <div><span>Лучшая</span><b>{season?.best_finish ? '#' + season.best_finish : '—'}</b></div>
              <div><span>DNF</span><b>{season?.dnfs ?? '—'}</b></div>
            </div>
          </div>
          <div className="sec">
            <h3>Карьера в F1</h3>
            {!career && <div style={{ color:'var(--muted)', fontSize:13 }}>Загрузка карьерной статистики…</div>}
            {career && (
              <Fragment>
                <div className="stats-grid">
                  <div><span>Чемпионств</span><b>{career.career?.championships ?? 0}</b></div>
                  <div><span>Побед</span><b>{career.career?.wins ?? 0}</b></div>
                  <div><span>Подиумов</span><b>{career.career?.podiums ?? 0}</b></div>
                  <div><span>Поулов</span><b>{career.career?.poles ?? 0}</b></div>
                  <div><span>Гран-при</span><b>{career.career?.races ?? 0}</b></div>
                  <div><span>Сезонов</span><b>{career.career?.seasons_count ?? 0}</b></div>
                </div>
                {(career.date_of_birth || career.career?.debut_season) && (
                  <div className="bio-row">
                    {career.date_of_birth && <span>📅 {career.date_of_birth}</span>}
                    {career.career?.debut_season && <span>🏁 Дебют: {career.career.debut_season}</span>}
                    {career.nationality && <span>🌍 {career.nationality}</span>}
                  </div>
                )}
                {career.wiki_url && <a href={career.wiki_url} target="_blank" rel="noreferrer" className="wiki-link">Биография на Wikipedia →</a>}
              </Fragment>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// YouTube embed modal
const YtModal = ({ ytId, title, onClose }) => {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  if (!ytId) return null;
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ background:'rgba(0,0,0,.85)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'min(1100px, 94vw)', position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:-46, right:0, background:'rgba(255,255,255,.08)', border:'1px solid var(--line-strong)', borderRadius:'50%', width:38, height:38, color:'#fff', fontSize:20, cursor:'pointer' }}>✕</button>
        {title && <div style={{ position:'absolute', top:-42, left:0, color:'#fff', fontSize:14, fontWeight:700 }}>{title}</div>}
        <div style={{ aspectRatio:'16/9', background:'#000', borderRadius:14, overflow:'hidden', boxShadow:'0 14px 60px rgba(0,0,0,.7)' }}>
          <iframe width="100%" height="100%" src={'https://www.youtube.com/embed/' + ytId + '?autoplay=1&rel=0'} title="YouTube player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen></iframe>
        </div>
      </div>
    </div>
  );
};

// ============ HOME / SCHEDULE (ported) ============
const formatCountdown = (targetDate) => {
    const now = new Date();
    const target = new Date(targetDate);
    let diff = Math.max(0, Math.floor((target - now) / 1000));
    const days = Math.floor(diff / 86400); diff %= 86400;
    const hours = Math.floor(diff / 3600); diff %= 3600;
    const minutes = Math.floor(diff / 60);
    const secs = diff % 60;
    return { days, hours, minutes, seconds: secs };
};

const F1Loader = ({text = 'Загрузка...'}) => {
    const [activeLight, setActiveLight] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setActiveLight(prev => (prev + 1) % 6), 400);
        return () => clearInterval(interval);
    }, []);
    return (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',gap:20}}>
            <div style={{display:'flex',gap:12}}>
                {[0,1,2,3,4].map(i => (
                    <div key={i} style={{width:28,height:28,borderRadius:'50%',background:activeLight===5?'#333':i<=activeLight?'#e10600':'#333',boxShadow:(activeLight!==5&&i<=activeLight)?'0 0 15px rgba(225,6,0,0.6)':'none',transition:'all 0.3s ease',border:'2px solid #555'}}/>
                ))}
            </div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',fontWeight:600,letterSpacing:1,animation:'pulse 1.5s ease-in-out infinite'}}>
                {activeLight === 5 ? 'GO!' : text}
            </div>
        </div>
    );
};
// ==== COUNTDOWN ====
const Countdown = ({targetDate}) => {
    const [time, setTime] = useState(formatCountdown(targetDate));
    const [prevSec, setPrevSec] = useState(-1);
    useEffect(() => {
        const iv = setInterval(() => { const t = formatCountdown(targetDate); setPrevSec(time.seconds); setTime(t); }, 1000);
        return () => clearInterval(iv);
    }, [targetDate, time.seconds]);
    return (
        <div style={{display:'flex',gap:8,justifyContent:'center'}}>
            {[{val:time.days,label:'дней'},{val:time.hours,label:'часов'},{val:time.minutes,label:'минут'},{val:time.seconds,label:'секунд'}].map((item,i)=>(
                <div key={i} className="countdown-block">
                    <div className={`countdown-num ${i===3?'flip-anim':''}`} key={i===3?item.val:'s'}>{String(item.val).padStart(2,'0')}</div>
                    <div className="countdown-label">{item.label}</div>
                </div>
            ))}
        </div>
    );
};

const PosBadge = ({pos}) => <div className={`pos-badge ${pos<=3?`pos-${pos}`:'pos-n'}`}>{pos}</div>;
const TyreIcon = ({compound}) => <span className={`tyre-dot tyre-${compound||'UNKNOWN'}`} title={compound}/>;
const SectorBar = ({s1,s2,s3}) => <div className="sector-bar"><div className={`sb-${s1||'normal'}`}/><div className={`sb-${s2||'normal'}`}/><div className={`sb-${s3||'normal'}`}/></div>;
const FlagIcon = ({flag}) => {
    const map = {'GREEN':{cls:'flag-green',text:'G'},'YELLOW':{cls:'flag-yellow',text:'!'},'DOUBLE YELLOW':{cls:'flag-yellow',text:'!!'},'RED':{cls:'flag-red',text:'R'},'CHEQUERED':{cls:'flag-chequered',text:'🏁'}};
    const f = map[flag]||{cls:'',text:'•'};
    return <span className={`flag-icon ${f.cls}`}>{f.text}</span>;
};
const circuitFlags = {
    'albert_park':'🇦🇺','shanghai':'🇨🇳','suzuka':'🇯🇵','bahrain':'🇧🇭',
    'jeddah':'🇸🇦','miami':'🇺🇸','imola':'🇮🇹','monaco':'🇲🇨',
    'catalunya':'🇪🇸','villeneuve':'🇨🇦','red_bull_ring':'🇦🇹','silverstone':'🇬🇧',
    'spa':'🇧🇪','hungaroring':'🇭🇺','zandvoort':'🇳🇱','monza':'🇮🇹',
    'baku':'🇦🇿','marina_bay':'🇸🇬','cota':'🇺🇸','americas':'🇺🇸','rodriguez':'🇲🇽',
    'interlagos':'🇧🇷','las_vegas':'🇺🇸','vegas':'🇺🇸','lusail':'🇶🇦','losail':'🇶🇦','yas_marina':'🇦🇪',
    'madring':'🇪🇸'
};

const countryFlag = (code) => {
    if (!code) return '';
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
};
const toMSK = (utcTime) => {
    if (!utcTime) return '';
    const [h, m] = utcTime.replace('Z','').split(':');
    const msk = (parseInt(h) + 3) % 24;
    return `${String(msk).padStart(2,'0')}:${m} МСК`;
};

const SchedulePage = ({seasonResults, schedule, season, onRaceClick, spoilerFree}) => {
    const races = (seasonResults?.races?.length ? seasonResults.races : null) || schedule?.races || [];
    if (!races.length) return <div className="page-container fade-in" style={{padding:16}}><F1Loader text="Загрузка расписания..."/></div>;

    const now = new Date();
    const lastCompletedRound = races.filter(r => new Date(r.date) < now).pop();
    const isSpoilerActive = spoilerFree && season === 2026;

    return (
        <div className="page-container fade-in" style={{padding:'12px 16px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                <h2 style={{fontSize:22,fontWeight:900}}>Сезон {season}</h2>

            </div>
            <div style={{fontSize:13,color:'var(--f1-text-secondary)',marginBottom:16}}>{races.length} гран-при{seasonResults?.races?.length ? ' · Все результаты' : ''}</div>

            {races.map((race) => {
                const isPast = new Date(race.date) < now;
                const flag = countryFlag(race.country_code) || circuitFlags[race.circuit_id] || '🏁';
                const dateStr = new Date(race.date).toLocaleDateString('ru-RU', {day:'numeric', month:'short'});
                const raceTime = toMSK(race.time);
                const winner = race.winner;
                const shouldHide = isSpoilerActive && isPast;

                return (
                    <div key={race.round} className="card" onClick={() => onRaceClick(race.round)}
                         style={{marginBottom:8, padding:12, cursor: 'pointer', opacity: isPast ? 1 : 0.6, position:'relative', overflow:'hidden'}}>
                        {race.circuit_image && <img src={hiResImg(race.circuit_image, 800)} alt="" style={{position:'absolute',top:0,right:0,width:'40%',height:'100%',objectFit:'cover',opacity:0.12,pointerEvents:'none',borderRadius:'0 12px 12px 0'}} onError={e=>{e.target.style.display='none'}} loading="lazy"/>}
                        <div style={{display:'flex',alignItems:'center',gap:10,position:'relative'}}>
                            <div style={{width:36,height:36,borderRadius:10,background:isPast?'rgba(225,6,0,0.15)':'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:14,flexShrink:0,color:isPast?'var(--f1-red)':'var(--f1-text-muted)'}}>{race.round}</div>
                            <div style={{flex:1,minWidth:0}}>
                                <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                                    {race.country_code ? <FlagImg code={race.country_code} size={20}/> : <span>{circuitFlags[race.circuit_id]||'🏁'}</span>}
                                    <span style={{fontWeight:700,fontSize:14}}>{race.name}</span>
                                    {race.sprint ? (
                                        <span style={{background:'rgba(255,128,0,0.2)',color:'#FF8000',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4,letterSpacing:0.5}}>СПРИНТ + ГОНКА</span>
                                    ) : (
                                        <span style={{background:'rgba(225,6,0,0.15)',color:'var(--f1-red)',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4,letterSpacing:0.5}}>ГОНКА</span>
                                    )}
                                </div>
                                <div style={{fontSize:11,color:'var(--f1-text-muted)'}}>{race.circuit || race.circuit_name} · {dateStr}{raceTime ? ` · ${raceTime}` : ''}</div>
                            </div>
                            {shouldHide ? (
                                null
                            ) : (<>
                                {isPast && winner && (
                                    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                                        {winner.photo_url && <img src={winner.photo_url} alt="" style={{width:28,height:28,borderRadius:'50%',objectFit:'cover',border:'2px solid #FFD700',background:'var(--f1-gray)'}} onError={e=>{e.target.style.display='none'}} loading="lazy"/>}
                                        <div style={{textAlign:'right'}}>
                                            <div style={{fontSize:12,fontWeight:900,color:'#FFD700'}}>{winner.code}</div>
                                            <div style={{fontSize:9,color:'var(--f1-text-muted)'}}>{winner.team?.split(' ')[0]}</div>
                                        </div>
                                    </div>
                                )}
                                {(race.vk_url || race.vk_search_url) && isPast && (
                                    <button onClick={(e)=>{e.stopPropagation();openLink(race.vk_url || race.vk_search_url);}} style={{background:'rgba(0,119,255,0.15)',border:'1px solid rgba(0,119,255,0.3)',borderRadius:8,padding:'4px 8px',color:'#4DA3FF',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>
                                        {race.vk_url ? '📺' : '🔍'}
                                    </button>
                                )}
                            </>)}
                        </div>
                        {isPast && !shouldHide && (
                            <div style={{display:'flex',gap:6,marginTop:8}} onClick={e=>e.stopPropagation()}>
                                <button onClick={()=>onRaceClick(race.round,'race')} style={{flex:1,padding:'6px 0',borderRadius:8,border:'none',fontFamily:'inherit',fontWeight:600,fontSize:11,cursor:'pointer',background:'rgba(225,6,0,0.12)',color:'var(--f1-red)'}}>🏁 Результаты</button>
                                <button onClick={()=>onRaceClick(race.round,'qualifying')} style={{flex:1,padding:'6px 0',borderRadius:8,border:'none',fontFamily:'inherit',fontWeight:600,fontSize:11,cursor:'pointer',background:'rgba(255,255,255,0.08)',color:'var(--f1-text-secondary)'}}>⏱️ Квали</button>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
const HomePage = ({nextRace, lastRace, standings, user, streams, seasonResults, schedule, onChange, season, onSeasonChange, spoilerFree, onToggleSpoiler, onRaceClick, onRefresh, liveBroadcasts}) => {
    const ptr = usePullToRefresh(onRefresh);
    if (!nextRace && !lastRace) return (
        <div className="page-container fade-in" style={{padding:16}}>
            <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{fontSize:12,color:'var(--f1-text-muted)',letterSpacing:3,textTransform:'uppercase'}}>Formula 1 · {season}</div>
                <h1 style={{fontSize:26,fontWeight:900,margin:'4px 0'}}>F1 <span style={{color:'var(--f1-red)'}}>Hub</span></h1>
                <div style={{display:'flex',gap:4,justifyContent:'center',marginTop:8}}>
                    {[2025,2026].map(y=><button key={y} onClick={()=>onSeasonChange(y)} style={{background:season===y?'var(--f1-red)':'rgba(255,255,255,0.06)',border:'1px solid '+(season===y?'var(--f1-red)':'var(--f1-border)'),borderRadius:8,padding:'6px 16px',color:season===y?'white':'var(--f1-text-muted)',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.2s'}}>{y}</button>)}
                </div>
            </div>
            <F1Loader text="Разогрев моторов..."/>
        </div>
    );
    return (
        <div className="page-container fade-in" ref={ptr.containerRef} onTouchStart={ptr.onTouchStart} onTouchMove={ptr.onTouchMove} onTouchEnd={ptr.onTouchEnd} style={{padding:16,display:'flex',flexDirection:'column',gap:16}}>
            {ptr.indicatorEl}
            <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{fontSize:12,color:'var(--f1-text-muted)',letterSpacing:3,textTransform:'uppercase'}}>Formula 1 · {season}</div>
                <h1 style={{fontSize:26,fontWeight:900,margin:'4px 0'}}>F1 <span style={{color:'var(--f1-red)'}}>Hub</span></h1>
                <div style={{display:'flex',gap:4,justifyContent:'center',marginTop:8}}>
                    {[2025,2026].map(y=><button key={y} onClick={()=>onSeasonChange(y)} style={{background:season===y?'var(--f1-red)':'rgba(255,255,255,0.06)',border:'1px solid '+(season===y?'var(--f1-red)':'var(--f1-border)'),borderRadius:8,padding:'6px 16px',color:season===y?'white':'var(--f1-text-muted)',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.2s'}}>{y}</button>)}
                </div>
                <button onClick={onToggleSpoiler} style={{marginTop:8,display:'flex',alignItems:'center',gap:6,margin:'8px auto 0',background:spoilerFree?'rgba(225,6,0,0.15)':'rgba(255,255,255,0.06)',border:'1px solid '+(spoilerFree?'rgba(225,6,0,0.3)':'var(--f1-border)'),borderRadius:8,padding:'5px 14px',color:spoilerFree?'var(--f1-red)':'var(--f1-text-muted)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.2s'}}>
                    {spoilerFree ? '🙈' : '👁️'} Антиспойлер {spoilerFree ? 'вкл' : 'выкл'}
                </button>
            </div>

            {nextRace && nextRace.name && (
                <div className="gradient-card" style={{minHeight:200,background:nextRace.circuit_image?`linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${hiResImg(nextRace.circuit_image, 1200)})`:'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',backgroundSize:'cover',backgroundPosition:'center'}}>
                    <div style={{position:'absolute',right:-20,top:-20,fontSize:120,fontWeight:900,color:'rgba(255,255,255,0.04)',lineHeight:1,pointerEvents:'none',fontFamily:'monospace'}}>{nextRace.round}</div>
                    <div style={{position:'relative',zIndex:1}}>
                        <div style={{fontSize:11,color:'var(--f1-red)',fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,marginBottom:10}}>
                            Следующий гран-при
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                            <FlagImg code={nextRace.country_code} size={28}/>
                            <div>
                                <div style={{fontSize:20,fontWeight:900}}>{nextRace.name}</div>
                                <div style={{fontSize:13,color:'var(--f1-text-secondary)'}}>{nextRace.circuit} · Раунд {nextRace.round}</div>
                            </div>
                        </div>
                        {nextRace.race_datetime && <div style={{marginTop:16}}><Countdown targetDate={nextRace.race_datetime}/></div>}
                        {nextRace.sessions && (
                            <div style={{marginTop:16,display:'flex',flexWrap:'wrap',gap:6}}>
                                {Object.entries(nextRace.sessions).map(([key,val])=>{
                                    const names = {fp1:'FP1',fp2:'FP2',fp3:'FP3',qualifying:'КВАЛИ',race:'ГОНКА',sprint:'СПРИНТ',sprint_qualifying:'СК'};
                                    return (
                                        <div key={key} style={{background:key==='race'?'var(--f1-red)':'rgba(255,255,255,0.05)',borderRadius:8,padding:'6px 10px',fontSize:11,fontWeight:600}}>
                                            <div style={{opacity:0.7}}>{names[key]||key}</div>
                                            <div>{val.date?.slice(5)} {val.time?.slice(0,5)}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Upcoming races */}
            {schedule?.races && (() => {
                const now = new Date();
                const upcoming = schedule.races.filter(r => r.race_datetime && new Date(r.race_datetime.replace('Z','')) > now).slice(0, 5);
                if (!upcoming.length) return null;
                return (
                    <div className="card" style={{padding:'16px 12px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                            <div style={{fontSize:11,color:'var(--f1-text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:1.5}}>Ближайшие гонки</div>
                            <button onClick={()=>onChange('schedule')} style={{background:'none',border:'none',color:'var(--f1-red)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',padding:0}}>Все гонки ›</button>
                        </div>
                        {upcoming.map((race, i) => {
                            const rd = new Date(race.race_datetime.replace('Z',''));
                            const msk = new Date(rd.getTime() + 3*3600000);
                            const dateStr = msk.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
                            const timeStr = msk.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
                            return (
                                <div key={race.round} onClick={()=>onRaceClick(race.round)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:i<upcoming.length-1?'1px solid var(--f1-border)':'none',cursor:'pointer'}}>
                                    <div style={{width:26,textAlign:'center',fontWeight:800,fontSize:13,color:'var(--f1-text-muted)'}}>{race.round}</div>
                                    <FlagImg code={race.country_code} size={18}/>
                                    <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{race.name}</div>
                                        <div style={{fontSize:11,color:'var(--f1-text-muted)'}}>
                                            {dateStr} · {timeStr} МСК
                                            {race.sprint && <span style={{color:'#FF8000',marginLeft:6,fontWeight:700}}>СПРИНТ</span>}
                                        </div>
                                    </div>
                                    <div style={{color:'var(--f1-text-muted)',fontSize:16}}>›</div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* Last race — podium layout */}
            {lastRace && lastRace.results && !spoilerFree && (
                <div className="card" style={{padding:'16px 12px'}}>
                    <div style={{fontSize:11,color:'var(--f1-text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,marginBottom:14}}>🏁 Последний результат · {lastRace.name?.replace('Grand Prix','ГП')}</div>
                    {/* Podium — positions 2, 1, 3 */}
                    <div style={{display:'flex',justifyContent:'center',alignItems:'flex-end',gap:8,marginBottom:16}}>
                        {[1,0,2].map(idx => {
                            const r = lastRace.results[idx]; if(!r) return null;
                            const heights = [120,90,80]; const photoSizes = [56,44,44];
                            const colors = ['#FFD700','#C0C0C0','#CD7F32'];
                            return (
                                <div key={idx} style={{flex:1,maxWidth:110,textAlign:'center'}}>
                                    <div style={{position:'relative',marginBottom:6}}>
                                        {r.photo_url && <img src={hiResImg(r.photo_url, 256)} alt="" style={{width:photoSizes[idx],height:photoSizes[idx],borderRadius:'50%',objectFit:'cover',border:`3px solid ${colors[idx]}`,background:'var(--f1-gray)',margin:'0 auto'}} onError={e=>{e.target.style.display='none'}} loading="lazy"/>}
                                    </div>
                                    <div style={{fontWeight:900,fontSize:idx===0?15:13}}>{r.code || r.name?.split(' ').pop()}</div>
                                    <div style={{fontSize:10,color:'var(--f1-text-muted)'}}>{r.team?.split(' ')[0]}</div>
                                    <div style={{background:`${colors[idx]}22`,borderRadius:'8px 8px 0 0',padding:'10px 0',marginTop:6,height:heights[idx],display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',paddingTop:10}}>
                                        <div style={{fontSize:24,fontWeight:900,color:colors[idx]}}>{r.position}</div>
                                        <div style={{fontSize:10,color:'var(--f1-text-muted)',marginTop:2}}>{r.time||`${r.points} очк.`}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Rest of results */}
                    {lastRace.results.slice(3,8).map((r,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:i<4?'1px solid var(--f1-border)':'none'}}>
                            <div style={{width:24,fontWeight:700,fontSize:13,color:'var(--f1-text-muted)',textAlign:'center'}}>{r.position}</div>
                            <div style={{background:r.team_color,width:3,height:28,borderRadius:2}}/>
                            {r.photo_url && <DriverPhoto url={r.photo_url} size={24}/>}
                            <div style={{flex:1,minWidth:0}}>
                                <span style={{fontWeight:700,fontSize:13}}>{r.code || r.name?.split(' ').pop()}</span>
                                <span style={{fontSize:11,color:'var(--f1-text-muted)',marginLeft:6}}>{r.team?.split(' ')[0]}</span>
                            </div>
                            <div style={{fontWeight:600,fontSize:12,color:'var(--f1-text-secondary)',fontVariantNumeric:'tabular-nums'}}>{r.time||''}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Championship top-3 — bigger photos */}
            {standings?.not_started && (
                <div className="card" style={{padding:'20px 16px',textAlign:'center'}}>
                    <div style={{fontSize:11,color:'var(--f1-text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,marginBottom:12}}>🏆 Чемпионат пилотов</div>
                    <div style={{fontSize:32,marginBottom:8}}>🏁</div>
                    <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>Сезон {season} ещё не начался</div>
                    <div style={{fontSize:13,color:'var(--f1-text-secondary)'}}>Результаты появятся после первой гонки</div>
                </div>
            )}
            {standings?.standings && !spoilerFree && (
                <div className="card" style={{padding:'16px 12px'}}>
                    <div style={{fontSize:11,color:'var(--f1-text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,marginBottom:12}}>🏆 Чемпионат пилотов</div>
                    {standings.standings.slice(0,3).map((s,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:i<2?'1px solid var(--f1-border)':'none'}}>
                            <div style={{fontSize:20,fontWeight:900,color:['#FFD700','#C0C0C0','#CD7F32'][i],minWidth:24,textAlign:'center'}}>{s.position}</div>
                            {s.photo_url && <img src={hiResImg(s.photo_url, 256)} alt="" style={{width:48,height:48,borderRadius:'50%',objectFit:'cover',background:'var(--f1-gray)',border:`3px solid ${s.team_color}`,flexShrink:0}} onError={e=>{e.target.style.display='none'}} loading="lazy"/>}
                            <div style={{flex:1,minWidth:0}}>
                                <div style={{fontWeight:900,fontSize:15}}>{s.name}</div>
                                <div style={{fontSize:11,color:s.team_color,fontWeight:600}}>{s.team}</div>
                            </div>
                            <div style={{textAlign:'right'}}>
                                <div style={{fontWeight:900,fontSize:18,fontVariantNumeric:'tabular-nums'}}>{s.points}</div>
                                <div style={{fontSize:9,color:'var(--f1-text-muted)'}}>очков</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {spoilerFree && (lastRace?.results || standings?.standings) && (
                <div className="card" style={{padding:'20px 16px',textAlign:'center'}}>
                    <div style={{fontSize:32,marginBottom:8}}>🙈</div>
                    <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>Антиспойлер включён</div>
                    <div style={{fontSize:13,color:'var(--f1-text-secondary)'}}>Результаты и чемпионат скрыты</div>
                </div>
            )}

            {/* Live broadcast banner */}
            {liveBroadcasts && liveBroadcasts.length > 0 && (
                <div className="card" onClick={()=>{const b=liveBroadcasts[0];onRaceClick(b.race_round,'broadcast');}} style={{cursor:'pointer',padding:'14px 16px',background:'linear-gradient(135deg,rgba(225,6,0,0.15),var(--f1-card))',border:'1px solid rgba(225,6,0,0.3)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{position:'relative'}}>
                            <div style={{width:10,height:10,borderRadius:'50%',background:'var(--f1-red)',animation:'pulse 1.5s infinite'}}/>
                        </div>
                        <div style={{flex:1}}>
                            <div style={{fontSize:11,color:'var(--f1-red)',fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>В эфире</div>
                            <div style={{fontSize:14,fontWeight:700}}>{liveBroadcasts[0].title || 'Трансляция F1'}</div>
                        </div>
                        <div style={{color:'var(--f1-text-muted)',fontSize:16}}>›</div>
                    </div>
                </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                <div className="gradient-card" onClick={()=>onChange('predict')} style={{textAlign:'center',cursor:'pointer',padding:'18px 8px',background:'linear-gradient(135deg,rgba(225,6,0,0.15),var(--f1-card))'}}>
                    <div style={{fontSize:28}}>&#x1F52E;</div>
                    <div style={{fontSize:13,fontWeight:700,marginTop:4}}>Прогнозы</div>
                    <div style={{fontSize:10,color:'var(--f1-text-muted)'}}>Угадай</div>
                </div>
                <div className="gradient-card" onClick={()=>onChange('games')} style={{textAlign:'center',cursor:'pointer',padding:'18px 8px',background:'linear-gradient(135deg,rgba(255,128,0,0.15),var(--f1-card))'}}>
                    <div style={{fontSize:28}}>🎮</div>
                    <div style={{fontSize:13,fontWeight:700,marginTop:4}}>Игры</div>
                    <div style={{fontSize:10,color:'var(--f1-text-muted)'}}>Пит-стоп, реакция</div>
                </div>
                <div className="gradient-card" onClick={()=>onChange('schedule')} style={{textAlign:'center',cursor:'pointer',padding:'18px 8px',background:'linear-gradient(135deg,rgba(102,146,255,0.15),var(--f1-card))'}}>
                    <div style={{fontSize:28}}>📅</div>
                    <div style={{fontSize:13,fontWeight:700,marginTop:4}}>Календарь</div>
                    <div style={{fontSize:10,color:'var(--f1-text-muted)'}}>Все гонки</div>
                </div>
            </div>
        </div>
    );
};


// ============ MIGRATED PAGES (helpers & stubs) ============
const F1MiniLoader = () => <Loader/>;
const TyreLoader = ({text}) => <Loader text={text || 'Загрузка...'}/>;
const openLink = (url) => { try { window.open(url, '_blank', 'noopener,noreferrer'); } catch(e){} };
const usePullToRefresh = () => ({ containerRef:{ current:null }, onTouchStart:()=>{}, onTouchMove:()=>{}, onTouchEnd:()=>{}, indicatorEl:null });
const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

// Auth gate for restricted routes
const AuthGate = ({onLogin, title}) => (
  <section className="cnt" style={{ padding:'80px 0', textAlign:'center' }}>
    <div className="eyebrow eyebrow-red" style={{ marginBottom:8 }}>{title || 'Раздел недоступен'}</div>
    <h2 className="h-display" style={{ fontSize:32, marginBottom:14 }}>Войди, чтобы продолжить</h2>
    <p style={{ color:'var(--muted)', marginBottom:24, maxWidth:520, margin:'0 auto 24px' }}>Нужен аккаунт Telegram, чтобы синхронизировать прогресс, очки и достижения.</p>
    <button className="btn btn-red" onClick={onLogin}>Войти через Telegram</button>
  </section>
);

const ArticlePage = ({ articleUrl, onBack }) => {
    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!articleUrl) return;
        api.get('/api/news/article?url=' + encodeURIComponent(articleUrl))
            .then(d => { setArticle(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [articleUrl]);

    if (loading) return <div className="page-container fade-in" style={{padding:16}}><TyreLoader text="Загрузка статьи..."/></div>;
    if (!article || article.error) return (
        <div className="page-container fade-in" style={{padding:20,textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:12}}>😕</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Не удалось загрузить статью</div>
            <button className="btn-primary" onClick={()=>openLink(articleUrl)}>Открыть на сайте ↗</button>
        </div>
    );

    const fmtDate = article.date ? new Date(article.date).toLocaleDateString('ru-RU', {day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}) : '';

    return (
        <div className="page-container fade-in" style={{paddingBottom:80}}>
            {article.image && <img src={article.image} style={{width:'100%',maxHeight:250,objectFit:'cover',borderRadius:'0 0 12px 12px'}} onError={e=>{e.target.style.display='none'}}/>}
            <div style={{padding:'16px 16px 0'}}>
                <div style={{fontSize:11,color:'var(--f1-text-muted)',marginBottom:8}}>{article.source} · {fmtDate}</div>
                <h1 style={{fontSize:22,fontWeight:800,lineHeight:1.3,margin:'0 0 16px 0'}}>{article.title}</h1>
                <div style={{fontSize:15,lineHeight:1.7,color:'rgba(255,255,255,0.85)'}}>
                    {article.paragraphs?.map((p,i) => (
                        <p key={i} style={{margin:'0 0 14px 0'}} dangerouslySetInnerHTML={{__html:p}}/>
                    ))}
                </div>
                {article.quotes?.length > 0 && article.quotes.map((q,i) => (
                    <div key={'q'+i} style={{borderLeft:'3px solid var(--f1-red)',padding:'8px 14px',margin:'12px 0',background:'rgba(255,255,255,0.03)',borderRadius:'0 8px 8px 0',fontSize:14,fontStyle:'italic',color:'rgba(255,255,255,0.7)',lineHeight:1.6}}>{q}</div>
                ))}
                <div style={{marginTop:24,padding:16,background:'rgba(255,255,255,0.05)',borderRadius:12,textAlign:'center'}}>
                    <div style={{fontSize:12,color:'var(--f1-text-muted)',marginBottom:8}}>Источник</div>
                    <a href={article.source_url} onClick={e=>{e.preventDefault();openLink(article.source_url);}} style={{color:'var(--f1-red)',fontSize:14,fontWeight:600,textDecoration:'none'}}>Открыть на championat.com ↗</a>
                </div>
            </div>
        </div>
    );
};
const NewsPage = ({ onArticleClick }) => {
    const [news, setNews] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => { api.get('/api/news').then(d => { setNews(d); setLoading(false); }); }, []);
    const ptr = usePullToRefresh(async()=>{const d=await api.get('/api/news');if(d)setNews(d);});

    if (loading) return <div className="page-container fade-in" style={{padding:16}}><F1MiniLoader/></div>;

    return (
        <div className="page-container news-grid fade-in" ref={ptr.containerRef} onTouchStart={ptr.onTouchStart} onTouchMove={ptr.onTouchMove} onTouchEnd={ptr.onTouchEnd} style={{padding:'12px 16px'}}>
            {ptr.indicatorEl}
            <h2 style={{fontSize:22,fontWeight:900,marginBottom:4}}>Новости Ф-1</h2>
            <div style={{fontSize:13,color:'var(--f1-text-secondary)',marginBottom:16,display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'var(--f1-red)',display:'inline-block'}}/>
                {news?.source || 'championat.com'}
            </div>

            {news?.posts?.length > 0 ? (
                news.posts.filter(p => p.title || p.preview).map((post,i) => (
                    <div key={i} className={"news-card " + (post.photo ? "" : "nophoto")} onClick={()=>{if(post.url && onArticleClick) onArticleClick(post.url); else if(post.url) openLink(post.url);}}>
                        {post.photo && <img src={post.photo} alt="" className="news-card-img" onError={e=>{e.target.style.display='none'}} loading="lazy"/>}
                        <div className="news-card-body">
                            {post.title && <div className="news-card-title">{post.title}</div>}
                            {post.preview && <div className="news-card-preview">{post.preview}</div>}
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                <div style={{fontSize:11,color:'var(--f1-text-muted)'}}>{post.date_text || ''}</div>
                                <span style={{fontSize:12,color:'var(--f1-red)',fontWeight:600}}>Читать →</span>
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="card" style={{textAlign:'center',padding:'40px 20px'}}>
                    <div style={{fontSize:48,marginBottom:12}}>📰</div>
                    <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Новости загружаются...</div>
                    <div style={{fontSize:13,color:'var(--f1-text-muted)',marginBottom:16}}>Последние новости Формулы-1</div>
                    <button className="btn-primary" onClick={()=>openLink('https://www.championat.com/auto/_f1.html')}>Открыть championat.com</button>
                </div>
            )}
        </div>
    );
};
const ProfilePage = ({user}) => {
    const [leaderboard, setLeaderboard] = useState(null);
    const [achievements, setAchievements] = useState(null);
    useEffect(() => { api.get('/api/leaderboard').then(setLeaderboard); api.get('/api/user/achievements').then(setAchievements); }, []);
    if (!user) return <div className="page-container fade-in" style={{padding:16}}><F1MiniLoader/></div>;
    return (
        <div className="page-container fade-in" style={{padding:'12px 16px'}}>
            <div className="card" style={{textAlign:'center',marginBottom:16,position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',top:0,left:0,right:0,height:60,background:'linear-gradient(180deg,rgba(225,6,0,0.2),transparent)'}}/>
                {user.photo_url ? (
                    <img src={hiResImg(user.photo_url, 256)} alt="" style={{width:64,height:64,borderRadius:'50%',margin:'0 auto 8px',objectFit:'cover',border:'3px solid var(--f1-red)',boxShadow:'0 4px 16px rgba(225,6,0,0.3)'}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
                ) : null}
                <div style={{width:64,height:64,borderRadius:'50%',margin:'0 auto 8px',background:'linear-gradient(135deg,var(--f1-red),#FF6B00)',alignItems:'center',justifyContent:'center',fontSize:28,fontWeight:900,position:'relative',boxShadow:'0 4px 16px rgba(225,6,0,0.3)',display:user.photo_url?'none':'flex'}}>{user.first_name?.[0]||'?'}</div>
                <div style={{fontSize:20,fontWeight:900}}>{user.first_name}</div>
                {user.username && <div style={{fontSize:13,color:'var(--f1-text-muted)'}}>@{user.username}</div>}
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:16}}>
                    <div><div style={{fontSize:24,fontWeight:900,color:'var(--f1-red)'}}>{user.points}</div><div style={{fontSize:11,color:'var(--f1-text-muted)'}}>Очки</div></div>
                    <div><div style={{fontSize:24,fontWeight:900}}>#{user.rank||'—'}</div><div style={{fontSize:11,color:'var(--f1-text-muted)'}}>Рейтинг</div></div>
                    <div><div style={{fontSize:24,fontWeight:900}}>{user.streak||0}</div><div style={{fontSize:11,color:'var(--f1-text-muted)'}}>🔥 Серия</div></div>
                </div>
            </div>

            <div className="card" style={{marginBottom:16}}>
                <div style={{fontSize:11,color:'var(--f1-text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,marginBottom:12}}>Статистика</div>
                {[{label:'Прогнозов сделано',value:user.predictions_total||0,max:50,color:'var(--f1-red)'},
                  {label:'Прогнозов угадано',value:user.predictions_correct||0,max:user.predictions_total||1,color:'#39B54A'},
                  {label:'Точность',value:user.predictions_total?Math.round(user.predictions_correct/user.predictions_total*100)+'%':'—'},
                  {label:'Макс. серия',value:user.max_streak||0},
                  {label:'Игр сыграно',value:user.games_played||0,max:50,color:'#6692FF'}
                ].map((stat,i)=>(
                    <div key={i} style={{padding:'8px 0',borderBottom:i<4?'1px solid var(--f1-border)':'none'}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:stat.max?4:0}}>
                            <span style={{color:'var(--f1-text-secondary)',fontSize:14}}>{stat.label}</span>
                            <span style={{fontWeight:700,fontSize:14,fontVariantNumeric:'tabular-nums'}}>{stat.value}</span>
                        </div>
                        {stat.max && <div className="progress-bar-bg"><div className="progress-bar-fill" style={{width:`${Math.min(100,(typeof stat.value==='number'?stat.value:0)/stat.max*100)}%`,background:stat.color}}/></div>}
                    </div>
                ))}
            </div>

            {achievements && (
                <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,color:'var(--f1-text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,marginBottom:10}}>Достижения ({achievements.achievements?.length||0}/{achievements.total||0})</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {achievements.all_achievements && Object.entries(achievements.all_achievements).map(([key,ach])=>{
                            const unlocked = achievements.achievements?.some(a=>a.key===key);
                            return (
                                <div key={key} className={`achievement-badge ${unlocked?'':'achievement-locked'}`}>
                                    <span className="achievement-icon">{ach.icon}</span>
                                    <div style={{flex:1}}>
                                        <div style={{fontWeight:700,fontSize:14}}>{ach.name}</div>
                                        <div style={{fontSize:12,color:'var(--f1-text-muted)'}}>{ach.desc}</div>
                                    </div>
                                    {unlocked && <span style={{fontSize:16}}>✅</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {window.__F1_ADMIN_IDS && window.__F1_ADMIN_IDS.includes(user.user_id) && (
                <AdminBroadcastPanel userId={user.user_id}/>
            )}

            {leaderboard?.leaderboard && (
                <div>
                    <div style={{fontSize:11,color:'var(--f1-text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,marginBottom:10}}>Лидерборд</div>
                    <div className="card" style={{padding:0,overflow:'hidden'}}>
                        {leaderboard.leaderboard.slice(0,20).map((entry,i)=>(
                            <div key={entry.user_id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderBottom:'1px solid var(--f1-border)',background:entry.user_id===user.user_id?'rgba(225,6,0,0.08)':'transparent'}}>
                                <div style={{width:28,fontWeight:900,fontSize:14,color:i<3?['#FFD700','#C0C0C0','#CD7F32'][i]:'var(--f1-text-muted)',fontVariantNumeric:'tabular-nums'}}>{entry.rank}</div>
                                {entry.photo_url ? (
                                    <img src={entry.photo_url} alt="" style={{width:36,height:36,borderRadius:'50%',objectFit:'cover',border:i<3?`2px solid ${['#FFD700','#C0C0C0','#CD7F32'][i]}`:'2px solid transparent'}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
                                ) : null}
                                <div style={{width:36,height:36,borderRadius:'50%',background:i<3?`linear-gradient(135deg,${['#FFD700','#C0C0C0','#CD7F32'][i]}33,var(--f1-gray))`:'var(--f1-gray)',display:entry.photo_url?'none':'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'rgba(255,255,255,0.5)'}}>{(entry.first_name||entry.username||'?')[0].toUpperCase()}</div>
                                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{entry.first_name}</div>{entry.username&&<div style={{fontSize:11,color:'var(--f1-text-muted)'}}>@{entry.username}</div>}</div>
                                <div style={{fontWeight:900,fontSize:16,fontVariantNumeric:'tabular-nums'}}>{entry.total_points}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
const AdminBroadcastPanel = ({userId}) => {
    const [broadcasts, setBroadcasts] = useState([]);
    const [form, setForm] = useState({race_round:'',session_type:'race',video_url:'',title:'',is_live:false});
    const [saving, setSaving] = useState(false);
    const [expandedRound, setExpandedRound] = useState(null);
    const [schedule, setSchedule] = useState([]);

    useEffect(() => {
        loadBroadcasts();
        api.get('/api/schedule').then(d => {
            if (d?.races) setSchedule(d.races.filter(r=>r.round));
        });
    }, []);

    const loadBroadcasts = () => api.get('/api/admin/broadcasts').then(d => { if(d?.broadcasts) setBroadcasts(d.broadcasts); });

    const handleSave = async () => {
        if (!form.race_round || !form.video_url) return;
        setSaving(true);
        await api.post('/api/admin/broadcast', {...form, race_round: parseInt(form.race_round)});
        setForm({race_round:'',session_type:'race',video_url:'',title:'',is_live:false});
        await loadBroadcasts();
        setSaving(false);
    };

    const handleEnd = async (id) => {
        await api.post(`/api/admin/broadcast/${id}/end`);
        await loadBroadcasts();
    };

    const handleDelete = async (id) => {
        if (!confirm('Удалить трансляцию?')) return;
        await fetch(`/api/admin/broadcast/${id}`, {method:'DELETE', headers:{'X-Telegram-Init-Data':window.Telegram?.WebApp?.initData||''}});
        await loadBroadcasts();
    };

    const sessionLabels = {race:'Гонка',qualifying:'Квалификация',sprint:'Спринт',sprint_qualifying:'Спринт-квали',review:'Обзор'};

    return (
        <div className="card" style={{marginBottom:16}}>
            <div style={{fontSize:11,color:'var(--f1-red)',fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,marginBottom:12}}>📺 Управление трансляциями</div>

            {/* Add form */}
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16,padding:12,background:'rgba(255,255,255,0.04)',borderRadius:10}}>
                <select value={form.race_round} onChange={e=>setForm(f=>({...f,race_round:e.target.value}))} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--f1-border)',background:'var(--f1-gray)',color:'var(--f1-text)',fontSize:13,fontFamily:'inherit'}}>
                    <option value="">Выберите гран-при...</option>
                    {schedule.map(r=><option key={r.round} value={r.round}>R{r.round} — {r.name}</option>)}
                </select>
                <div style={{display:'flex',gap:6}}>
                    {Object.entries(sessionLabels).map(([k,v])=>(
                        <button key={k} onClick={()=>setForm(f=>({...f,session_type:k}))} style={{flex:1,padding:'6px 0',borderRadius:6,border:'none',fontFamily:'inherit',fontSize:11,fontWeight:700,cursor:'pointer',background:form.session_type===k?'var(--f1-red)':'rgba(255,255,255,0.08)',color:form.session_type===k?'white':'var(--f1-text-muted)'}}>
                            {v}
                        </button>
                    ))}
                </div>
                <input value={form.video_url} onChange={e=>setForm(f=>({...f,video_url:e.target.value}))} placeholder="VK Video URL (vk.com/video...)" style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--f1-border)',background:'var(--f1-gray)',color:'var(--f1-text)',fontSize:13,fontFamily:'inherit'}}/>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Название (необязательно)" style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--f1-border)',background:'var(--f1-gray)',color:'var(--f1-text)',fontSize:13,fontFamily:'inherit'}}/>
                <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--f1-text-secondary)'}}>
                    <input type="checkbox" checked={form.is_live} onChange={e=>setForm(f=>({...f,is_live:e.target.checked}))}/>
                    Сейчас в эфире (Live)
                </label>
                <button onClick={handleSave} disabled={saving||!form.race_round||!form.video_url} style={{padding:'10px 0',borderRadius:8,border:'none',fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer',background:form.race_round&&form.video_url?'var(--f1-red)':'rgba(255,255,255,0.08)',color:form.race_round&&form.video_url?'white':'var(--f1-text-muted)'}}>
                    {saving ? 'Сохранение...' : 'Добавить / Обновить'}
                </button>
            </div>

            {/* List grouped by GP */}
            {(() => {
                if (broadcasts.length === 0) return <div style={{textAlign:'center',padding:12,color:'var(--f1-text-muted)',fontSize:13}}>Нет трансляций</div>;
                const grouped = {};
                broadcasts.forEach(b => {
                    if (!grouped[b.race_round]) grouped[b.race_round] = [];
                    grouped[b.race_round].push(b);
                });
                const rounds = Object.keys(grouped).map(Number).sort((a,b) => b - a);
                const sessionOrder = ['race','qualifying','sprint','sprint_qualifying','review'];
                return rounds.map(round => {
                    const items = grouped[round];
                    const raceName = schedule.find(r => r.round === round)?.name || ('\u0420\u0430\u0443\u043d\u0434 ' + round);
                    const hasLive = items.some(b => b.is_live);
                    const filledSessions = items.map(b => b.session_type);
                    return (
                        <div key={round} style={{marginBottom:10,background:'rgba(255,255,255,0.03)',borderRadius:10,border:'1px solid var(--f1-border)',overflow:'hidden'}}>
                            <div onClick={() => setExpandedRound(r => r === round ? null : round)} style={{padding:'10px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
                                {hasLive && <div style={{width:6,height:6,borderRadius:'50%',background:'var(--f1-red)',animation:'pulse 1.5s infinite',flexShrink:0}}/>}
                                <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:13,fontWeight:700}}>R{round} · {raceName}</div>
                                </div>
                                <div style={{display:'flex',gap:3,flexShrink:0}}>
                                    {sessionOrder.map(s => {
                                        const has = filledSessions.includes(s);
                                        const live = items.find(b => b.session_type === s && b.is_live);
                                        return <div key={s} style={{width:8,height:8,borderRadius:'50%',background:live?'var(--f1-red)':has?'#00C853':'rgba(255,255,255,0.12)'}} title={sessionLabels[s]}/>;
                                    })}
                                </div>
                                <span style={{fontSize:10,color:'var(--f1-text-muted)',flexShrink:0}}>{items.length}/{sessionOrder.length}</span>
                                <span style={{fontSize:11,color:'var(--f1-text-muted)',flexShrink:0}}>{expandedRound===round?'\u25b2':'\u25bc'}</span>
                            </div>
                            {expandedRound === round && (
                                <div style={{padding:'0 12px 10px',borderTop:'1px solid var(--f1-border)'}}>
                                    {sessionOrder.map(sType => {
                                        const b = items.find(x => x.session_type === sType);
                                        if (!b) return (
                                            <div key={sType} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',opacity:0.4}}>
                                                <div style={{width:6,height:6,borderRadius:'50%',background:'rgba(255,255,255,0.15)'}}/>
                                                <span style={{fontSize:12,color:'var(--f1-text-muted)'}}>{sessionLabels[sType]}</span>
                                                <span style={{fontSize:10,color:'var(--f1-text-muted)',marginLeft:'auto'}}>{'\u2014'}</span>
                                            </div>
                                        );
                                        return (
                                            <div key={sType} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0'}}>
                                                <div style={{width:6,height:6,borderRadius:'50%',background:b.is_live?'var(--f1-red)':'#00C853',flexShrink:0}}/>
                                                <div style={{flex:1,minWidth:0}}>
                                                    <div style={{fontSize:12,fontWeight:600}}>{sessionLabels[sType]}{b.is_live ? ' \xb7 LIVE' : ''}</div>
                                                    <div style={{fontSize:10,color:'var(--f1-text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.title || (b.video_url ? b.video_url.substring(0,40)+'...' : '')}</div>
                                                </div>
                                                {b.is_live && <button onClick={()=>handleEnd(b.id)} style={{padding:'3px 8px',borderRadius:5,border:'none',fontFamily:'inherit',fontSize:10,fontWeight:700,cursor:'pointer',background:'rgba(255,128,0,0.2)',color:'#FF8000'}}>{'\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c'}</button>}
                                                <button onClick={()=>handleDelete(b.id)} style={{padding:'3px 6px',borderRadius:5,border:'none',fontFamily:'inherit',fontSize:10,cursor:'pointer',background:'rgba(255,0,0,0.1)',color:'var(--f1-red)'}}>{'\u2715'}</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                });
            })()}
        </div>
    );
};
const Timer = ({startTime}) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const i = setInterval(()=>setNow(Date.now()), 16); return ()=>clearInterval(i); }, []);
    return ((now - startTime) / 1000).toFixed(3);
};

const PitStopGame = ({onBack}) => {
    const [state, setState] = useState('ready');
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [wheels, setWheels] = useState([
        {id:'fl',label:'FL',step:0},{id:'fr',label:'FR',step:0},
        {id:'rl',label:'RL',step:0},{id:'rr',label:'RR',step:0},
    ]);
    const [result, setResult] = useState(null);
    const stepLabels = ['🔩 Открути','🔄 Смени','🔧 Закрути','✅'];
    const stepColors = ['#ff4444','#ffaa00','#44cc44','#27F4D2'];

    const start = () => { setState('playing'); setStartTime(Date.now()); setWheels(w=>w.map(wh=>({...wh,step:0}))); setResult(null); };

    const tapWheel = (id) => {
        if (state !== 'playing') return;
        setWheels(prev => {
            const next = prev.map(w => w.id===id && w.step<3 ? {...w,step:w.step+1} : w);
            if (next.every(w=>w.step>=3)) {
                const time = Date.now() - startTime;
                setEndTime(time);
                setState('finished');
                api.post('/api/games/result',{game_type:'pit_stop',score:time}).then(r=>setResult(r));
            }
            return next;
        });
    };

    const timeStr = (ms) => (ms/1000).toFixed(3)+'s';

    return (
        <div className="page-container fade-in" style={{padding:'20px 16px',textAlign:'center'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <div onClick={onBack} style={{cursor:'pointer',fontSize:14,color:'var(--f1-text-muted)'}}>← Назад</div>
                <div style={{fontWeight:800,fontSize:18}}>🔧 Пит-стоп</div>
                <div style={{width:50}}/>
            </div>
            {state==='ready' && (
                <div>
                    <div style={{fontSize:60,marginBottom:20}}>🏎️</div>
                    <div style={{fontSize:14,color:'var(--f1-text-secondary)',marginBottom:8}}>
                        Тапай по каждому колесу 3 раза:<br/>Открути → Смени → Закрути
                    </div>
                    <div style={{fontSize:12,color:'var(--f1-text-muted)',marginBottom:24}}>
Мировой рекорд Red Bull — 1.80с!
                    </div>
                    <div onClick={start} className="btn-primary" style={{display:'inline-block',fontSize:18,padding:'16px 40px'}}>СТАРТ</div>
                </div>
            )}
            {state==='playing' && (
                <div>
                    <div style={{fontSize:32,fontWeight:800,fontFamily:'monospace',marginBottom:20,color:'var(--f1-red)'}}>
                        <Timer startTime={startTime}/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,maxWidth:300,margin:'0 auto'}}>
                        {wheels.map(w => (
                            <div key={w.id} onClick={()=>tapWheel(w.id)}
                                 style={{padding:'24px 16px',borderRadius:16,
                                     background:w.step>=3?'rgba(39,244,210,0.15)':'rgba(255,255,255,0.06)',
                                     border:`3px solid ${stepColors[w.step]}`,
                                     cursor:w.step<3?'pointer':'default',transition:'all 0.15s',
                                     userSelect:'none',WebkitUserSelect:'none'}}>
                                <div style={{fontSize:13,fontWeight:800,color:'var(--f1-text-muted)',marginBottom:8}}>{w.label}</div>
                                <div style={{fontSize:28}}>{w.step>=3?'✅':'🔴'}</div>
                                <div style={{fontSize:12,fontWeight:700,color:stepColors[w.step],marginTop:8}}>{stepLabels[w.step]}</div>
                                <div style={{display:'flex',gap:4,justifyContent:'center',marginTop:6}}>
                                    {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:'50%',background:i<w.step?stepColors[2]:'rgba(255,255,255,0.15)'}}/>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {state==='finished' && (
                <div>
                    <div style={{fontSize:60,marginBottom:16}}>{endTime<2000?'🏆':endTime<3000?'🥈':'👍'}</div>
                    <div style={{fontSize:40,fontWeight:800,fontFamily:'monospace',color:'#27F4D2'}}>{timeStr(endTime)}</div>
                    <div style={{fontSize:14,color:'rgba(255,255,255,0.4)',marginTop:12}}>
                        {endTime<2000?'Мировой уровень!':endTime<2500?'Отличный пит-стоп!':endTime<3000?'Неплохо!':'Тренируйся!'}
                    </div>
                    {result?.new_achievements?.length>0 && <div style={{fontSize:14,color:'#27F4D2',marginTop:8}}>🏅 Новое достижение!</div>}
                    <div style={{display:'flex',gap:12,justifyContent:'center',marginTop:24}}>
                        <div onClick={start} className="btn-primary" style={{padding:'12px 24px'}}>Ещё раз</div>
                        <div onClick={onBack} style={{padding:'12px 24px',borderRadius:12,background:'rgba(255,255,255,0.08)',fontWeight:700,cursor:'pointer'}}>Назад</div>
                    </div>
                </div>
            )}
        </div>
    );
};

const REACTION_FACTS = [
    {max:150,text:'Быстрее чем моргание глаза (150мс)! Ты вообще человек?'},
    {max:150,text:'Это на уровне рефлекса — мозг даже не успел подумать!'},
    {max:150,text:'Быстрее чем хамелеон выстреливает языком!'},
    {max:220,text:'Реакция уровня пилота F1 на стартовых огнях!'},
    {max:220,text:'Ферстаппен на старте Гран-при — примерно так же!'},
    {max:220,text:'Гепард реагирует на добычу за ~200мс — ты на его уровне!'},
    {max:220,text:'Быстрее чем нервный импульс проходит от ноги до мозга!'},
    {max:220,text:'Снайперская реакция! Олимпийские стрелки завидуют!'},
    {max:220,text:'Льюис Хэмилтон: средняя реакция на старте ~210мс. Ты рядом!'},
    {max:220,text:'Сапсан начинает пикирование с такой же задержкой!'},
    {max:220,text:'Как удар каратиста — тело реагирует раньше мысли!'},
    {max:300,text:'Реакция боксёра на джеб — примерно 250мс!'},
    {max:300,text:'Как вратарь на пенальти — прыжок начинается за ~250мс!'},
    {max:300,text:'Джокович принимает подачу за ~250мс — ты в этой лиге!'},
    {max:300,text:'Профи в настольном теннисе реагируют за ~250мс!'},
    {max:300,text:'Атака кобры длится 200-300мс — ты примерно так же быстр!'},
    {max:300,text:'Топовые киберспортсмены CS2 — 200-250мс. Почти!'},
    {max:300,text:'Механик F1 видит машину в боксах и реагирует за ~250мс!'},
    {max:300,text:'Средний пит-стоп Red Bull — 1.8с, а ты нажал за {time}мс!'},
    {max:300,text:'Средний возраст реакции 20-летнего — 250мс. Норма!'},
    {max:300,text:'Геккон ловит насекомое за ~280мс — вы на равных!'},
    {max:300,text:'Бейсболист видит мяч и решает бить за ~275мс!'},
    {max:400,text:'Средняя реакция человека — 250мс. Чуть медленнее, но нормально!'},
    {max:400,text:'Время реакции для экзамена на права в Германии — 400мс!'},
    {max:400,text:'Лягушка ловит муху за 300-400мс — вы примерно одинаковы!'},
    {max:400,text:'Собака реагирует на команду "сидеть" примерно за 350мс!'},
    {max:400,text:'Боттас однажды среагировал на старт за 340мс. Бывает у всех!'},
    {max:400,text:'После кофе реакция улучшается на ~10%. Может, заварить?'},
    {max:400,text:'Среднее время тапа по уведомлению — 350мс. Ты в норме!'},
    {max:400,text:'Спринтер реагирует на стартовый пистолет за ~150мс. Ещё есть куда расти!'},
    {max:400,text:'Пианист нажимает клавишу по нотам за ~350мс!'},
    {max:400,text:'В 2023 Леклер среагировал на Монце за 360мс. Ты рядом!'},
    {max:500,text:'Время реакции водителя на светофор — 400-500мс!'},
    {max:500,text:'После 6 часов без сна реакция падает до ~450мс!'},
    {max:500,text:'Черепаха втягивает голову за ~400мс. Конкуренция!'},
    {max:500,text:'Кофеин улучшает реакцию на 10-15%. Стоит попробовать!'},
    {max:500,text:'Казуальный геймер — 400-500мс. Норма для нетренированного!'},
    {max:500,text:'Если смотришь в телефон за рулём — реакция ~500мс+!'},
    {max:500,text:'Штраф за фальстарт в F1 — 10 секунд. Лучше подождать!'},
    {max:500,text:'При температуре тела +38° реакция замедляется на ~30%!'},
    {max:700,text:'Может, пора размяться? Средняя реакция — 250мс!'},
    {max:700,text:'Ленивец одобряет твой дзен-подход!'},
    {max:700,text:'Заморожен? В холоде реакция падает на 40%!'},
    {max:700,text:'После плотного обеда реакция замедляется. Это нормально!'},
    {max:700,text:'Сразу после пробуждения реакция ~500мс. Ты только встал?'},
    {max:700,text:'С такой реакцией в F1 ты бы терял 3-4 позиции на каждом старте!'},
    {max:700,text:'Средняя реакция 70-летнего — ~350мс. Так что всё впереди!'},
    {max:99999,text:'Ты точно смотрел на экран? Попробуй ещё!'},
    {max:99999,text:'Улитка проползает 1мм за то время что ты думал!'},
    {max:99999,text:'За {time}мс болид F1 проезжает {dist} метров!'},
    {max:99999,text:'Нервный импульс у динозавра от хвоста до мозга шёл ~1000мс!'},
    {max:99999,text:'Может, второй раз будет лучше? Разминка нужна всем!'},
    {max:150,text:'Как бросок мантис-креветки — 150мс и мощнейший удар!'},
    {max:150,text:'Реакция пилота истребителя на катапультирование!'},
    {max:220,text:'Скорость удара скорпиона — ~230мс. Ты на уровне!'},
    {max:220,text:'Профессиональный барабанщик попадает в бит за ~200мс!'},
    {max:300,text:'Орёл замечает мышь с высоты 1.5 км и реагирует за ~280мс!'},
    {max:300,text:'Шумахер славился реакцией ~220мс. Легендарный уровень!'},
    {max:400,text:'Реакция пешехода на сигнал — около 400мс. В норме!'},
    {max:400,text:'Хоккейный вратарь реагирует на шайбу за ~380мс!'},
    {max:500,text:'С каждым часом без сна реакция замедляется на ~5%!'},
    {max:500,text:'Среднее время ответа техподдержки — быстрее не бывает!'},
    {max:700,text:'Кот реагирует на огурец за ~400мс. Ты чуть медленнее кота!'},
    {max:700,text:'После марафона реакция падает до 600мс. Устал?'},
    {max:99999,text:'Тектонические плиты двигаются быстрее... ну почти!'},
    {max:99999,text:'Между молнией и громом проходит 1 сек на 330м. Далеко!'},
    {max:99999,text:'Попробуй закрыть глаза, сделать глубокий вдох и снова!'},
];

const ReactionGame = ({onBack}) => {
    const [state, setState] = useState('ready');
    const [lights, setLights] = useState(0);
    const [greenTime, setGreenTime] = useState(0);
    const [reaction, setReaction] = useState(0);
    const [result, setResult] = useState(null);
    const timeoutRef = useRef(null);
    const lightsRef = useRef([]);
    const usedFactsRef = useRef(new Set());

    const getReactionFact = (rt) => {
        let suitable = REACTION_FACTS.filter(f => rt <= f.max && !usedFactsRef.current.has(f.text));
        if (suitable.length === 0) {
            usedFactsRef.current.clear();
            suitable = REACTION_FACTS.filter(f => rt <= f.max);
        }
        suitable.sort((a,b) => a.max - b.max);
        const pool = suitable.slice(0, Math.min(5, suitable.length));
        const fact = pool[Math.floor(Math.random() * pool.length)];
        usedFactsRef.current.add(fact.text);
        return fact.text.replace('{time}', rt).replace('{dist}', Math.round(rt * 0.0972));
    };

    const startSequence = () => {
        setState('lights'); setLights(0); setResult(null);
        lightsRef.current.forEach(t=>clearTimeout(t));
        lightsRef.current = [];
        for (let i=1;i<=5;i++) {
            lightsRef.current.push(setTimeout(()=>setLights(i), i*1000));
        }
        const delay = 5000 + 500 + Math.random()*2500;
        timeoutRef.current = setTimeout(()=>{ setState('green'); setGreenTime(Date.now()); }, delay);
    };

    const tap = () => {
        if (state==='ready') return;
        if (state==='lights') {
            clearTimeout(timeoutRef.current);
            lightsRef.current.forEach(t=>clearTimeout(t));
            setState('false_start');
            return;
        }
        if (state==='green') {
            const rt = Date.now() - greenTime;
            setReaction(rt); setState('finished');
            api.post('/api/games/result',{game_type:'reaction',score:rt}).then(r=>setResult(r));
        }
    };

    useEffect(() => () => { clearTimeout(timeoutRef.current); lightsRef.current.forEach(t=>clearTimeout(t)); }, []);

    return (
        <div className="page-container fade-in" style={{padding:'20px 16px',textAlign:'center'}} onClick={tap}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <div onClick={e=>{e.stopPropagation();onBack();}} style={{cursor:'pointer',fontSize:14,color:'var(--f1-text-muted)'}}>← Назад</div>
                <div style={{fontWeight:800,fontSize:18}}>🚦 Реакция</div>
                <div style={{width:50}}/>
            </div>
            <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:40,marginBottom:40}}>
                {[1,2,3,4,5].map(i=>(
                    <div key={i} style={{width:40,height:40,borderRadius:'50%',border:'3px solid #555',
                        background:state==='green'||state==='finished'?'#00ff00':i<=lights?'#e10600':'#222',
                        boxShadow:(state==='green'||state==='finished')?'0 0 20px rgba(0,255,0,0.6)':i<=lights?'0 0 20px rgba(225,6,0,0.5)':'none',
                        transition:'all 0.2s'}}/>
                ))}
            </div>
            {state==='ready' && (
                <div>
                    <div style={{fontSize:14,color:'var(--f1-text-secondary)',marginBottom:8}}>Жди зелёный свет, потом тапни!</div>
                    <div style={{fontSize:12,color:'var(--f1-text-muted)',marginBottom:24}}>Средняя реакция пилота F1 — 200мс</div>
                    <div onClick={e=>{e.stopPropagation();startSequence();}} className="btn-primary" style={{display:'inline-block',fontSize:18,padding:'16px 40px'}}>СТАРТ</div>
                </div>
            )}
            {(state==='lights'||state==='green') && (
                <div style={{fontSize:18,fontWeight:600,color:'var(--f1-text-secondary)',marginTop:20}}>
                    {state==='lights'?'Жди...':'🟢 ТАПНИ!'}
                </div>
            )}
            {state==='false_start' && (
                <div>
                    <div style={{fontSize:48,marginBottom:12}}>❌</div>
                    <div style={{fontSize:22,fontWeight:800,color:'#ff4444'}}>ФАЛЬСТАРТ!</div>
                    <div style={{fontSize:13,color:'var(--f1-text-muted)',marginTop:8}}>Рано нажал!</div>
                    <div onClick={e=>{e.stopPropagation();setState('ready');setLights(0);}} className="btn-primary" style={{display:'inline-block',padding:'12px 24px',marginTop:20}}>Попробовать снова</div>
                </div>
            )}
            {state==='finished' && (() => {
                const factText = getReactionFact(reaction);
                return (
                <div>
                    <div style={{fontSize:48,marginBottom:12}}>{reaction<200?'⚡':reaction<300?'🏎️':'👍'}</div>
                    <div style={{fontSize:40,fontWeight:800,fontFamily:'monospace',color:'#27F4D2'}}>{reaction}ms</div>
                    <div style={{fontSize:14,color:'var(--f1-text-secondary)',marginTop:4}}>
                        {reaction<200?'Нечеловеческая реакция!':reaction<300?'Отличная реакция!':reaction<500?'Неплохо!':'Можно лучше!'}
                    </div>
                    <div style={{background:'rgba(255,255,255,0.06)',borderRadius:14,padding:16,margin:'16px 0',textAlign:'center'}}>
                        <div style={{fontSize:15,fontWeight:600,lineHeight:1.5}}>{factText}</div>
                    </div>
                    {result?.new_achievements?.length>0 && <div style={{fontSize:14,color:'#27F4D2',marginTop:8}}>🏅 Новое достижение!</div>}
                    <div style={{display:'flex',gap:12,justifyContent:'center',marginTop:24}}>
                        <div onClick={e=>{e.stopPropagation();setState('ready');setLights(0);}} className="btn-primary" style={{padding:'12px 24px'}}>Ещё раз</div>
                        <div onClick={e=>{e.stopPropagation();onBack();}} style={{padding:'12px 24px',borderRadius:12,background:'rgba(255,255,255,0.08)',fontWeight:700,cursor:'pointer'}}>Назад</div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

const F1_CARDS = [
    {name:'Макс Ферстаппен',code:'VER',number:1,team:'Red Bull Racing',teamColor:'#3671C6',country:'🇳🇱',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/verstappen.jpg.img.640.medium.jpg/1738086499498.jpg',stats:{speed:98,racecraft:97,experience:85,wins:63,points:437}},
    {name:'Льюис Хэмилтон',code:'HAM',number:44,team:'Ferrari',teamColor:'#E8002D',country:'🇬🇧',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/hamilton.jpg.img.640.medium.jpg/1738086522tried.jpg',stats:{speed:93,racecraft:96,experience:100,wins:105,points:198}},
    {name:'Шарль Леклер',code:'LEC',number:16,team:'Ferrari',teamColor:'#E8002D',country:'🇲🇨',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/leclerc.jpg.img.640.medium.jpg/1738086534424.jpg',stats:{speed:95,racecraft:90,experience:70,wins:8,points:280}},
    {name:'Ландо Норрис',code:'NOR',number:4,team:'McLaren',teamColor:'#FF8000',country:'🇬🇧',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/norris.jpg.img.640.medium.jpg/1738086505498.jpg',stats:{speed:94,racecraft:89,experience:65,wins:4,points:350}},
    {name:'Оскар Пиастри',code:'PIA',number:81,team:'McLaren',teamColor:'#FF8000',country:'🇦🇺',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/piastri.jpg.img.640.medium.jpg/1738086516198.jpg',stats:{speed:91,racecraft:86,experience:40,wins:3,points:268}},
    {name:'Карлос Сайнс',code:'SAI',number:55,team:'Williams',teamColor:'#64C4FF',country:'🇪🇸',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/sainz.jpg.img.640.medium.jpg/1738086546752.jpg',stats:{speed:89,racecraft:88,experience:75,wins:4,points:120}},
    {name:'Джордж Расселл',code:'RUS',number:63,team:'Mercedes',teamColor:'#27F4D2',country:'🇬🇧',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/russell.jpg.img.640.medium.jpg/1738086527564.jpg',stats:{speed:92,racecraft:87,experience:60,wins:3,points:195}},
    {name:'Кими Антонелли',code:'ANT',number:12,team:'Mercedes',teamColor:'#27F4D2',country:'🇮🇹',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/antonelli.jpg.img.640.medium.jpg/1738086593898.jpg',stats:{speed:88,racecraft:78,experience:15,wins:0,points:95}},
    {name:'Фернандо Алонсо',code:'ALO',number:14,team:'Aston Martin',teamColor:'#229971',country:'🇪🇸',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/alonso.jpg.img.640.medium.jpg/1738086558245.jpg',stats:{speed:85,racecraft:95,experience:100,wins:32,points:65}},
    {name:'Лэнс Стролл',code:'STR',number:18,team:'Aston Martin',teamColor:'#229971',country:'🇨🇦',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/stroll.jpg.img.640.medium.jpg/1738086563648.jpg',stats:{speed:78,racecraft:72,experience:65,wins:0,points:30}},
    {name:'Юки Цунода',code:'TSU',number:22,team:'Red Bull Racing',teamColor:'#3671C6',country:'🇯🇵',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/tsunoda.jpg.img.640.medium.jpg/1738086573898.jpg',stats:{speed:87,racecraft:82,experience:55,wins:0,points:105}},
    {name:'Пьер Гасли',code:'GAS',number:10,team:'Alpine',teamColor:'#0093CC',country:'🇫🇷',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/gasly.jpg.img.640.medium.jpg/1738086580148.jpg',stats:{speed:86,racecraft:83,experience:70,wins:1,points:52}},
    {name:'Эстебан Окон',code:'OCO',number:31,team:'Haas',teamColor:'#B6BABD',country:'🇫🇷',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/ocon.jpg.img.640.medium.jpg/1738086587248.jpg',stats:{speed:83,racecraft:80,experience:68,wins:1,points:38}},
    {name:'Александр Албон',code:'ALB',number:23,team:'Williams',teamColor:'#64C4FF',country:'🇹🇭',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/albon.jpg.img.640.medium.jpg/1738086540298.jpg',stats:{speed:84,racecraft:82,experience:58,wins:0,points:42}},
    {name:'Нико Хюлькенберг',code:'HUL',number:27,team:'Sauber',teamColor:'#52E252',country:'🇩🇪',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/hulkenberg.jpg.img.640.medium.jpg/1738086599898.jpg',stats:{speed:82,racecraft:84,experience:82,wins:0,points:28}},
    {name:'Лиам Лоусон',code:'LAW',number:30,team:'Racing Bulls',teamColor:'#6692FF',country:'🇳🇿',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/lawson.jpg.img.640.medium.jpg/1738086569348.jpg',stats:{speed:85,racecraft:79,experience:30,wins:0,points:45}},
    {name:'Исаак Хаджар',code:'HAD',number:6,team:'Racing Bulls',teamColor:'#6692FF',country:'🇫🇷',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/hadjar.jpg.img.640.medium.jpg/1738086605898.jpg',stats:{speed:86,racecraft:78,experience:15,wins:0,points:62}},
    {name:'Оливер Бирман',code:'BEA',number:7,team:'Haas',teamColor:'#B6BABD',country:'🇬🇧',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/bearman.jpg.img.640.medium.jpg/1738086611898.jpg',stats:{speed:84,racecraft:77,experience:15,wins:0,points:36}},
    {name:'Франко Колапинто',code:'COL',number:43,team:'Alpine',teamColor:'#0093CC',country:'🇦🇷',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/colapinto.jpg.img.640.medium.jpg/1738086617898.jpg',stats:{speed:83,racecraft:76,experience:20,wins:0,points:18}},
    {name:'Габриэль Бортолето',code:'BOR',number:5,team:'Sauber',teamColor:'#52E252',country:'🇧🇷',photo:'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/bortoleto.jpg.img.640.medium.jpg/1738086623898.jpg',stats:{speed:82,racecraft:75,experience:10,wins:0,points:15}},
];

const STAT_LABELS = {
    speed:{label:'Скорость',icon:'⚡'},
    racecraft:{label:'Мастерство',icon:'🏎️'},
    experience:{label:'Опыт',icon:'📅'},
    wins:{label:'Победы',icon:'🏆'},
    points:{label:'Очки 2025',icon:'🔢'},
};

const DriverCard = ({driver,isPlayer,isRevealed,selectedStat,wonStat,onSelectStat}) => (
    <div style={{
        width:'100%',borderRadius:14,overflow:'hidden',
        background:`linear-gradient(145deg, ${driver.teamColor}22, #1a1a2e, ${driver.teamColor}11)`,
        border:`2px solid ${driver.teamColor}`,
        boxShadow:`0 6px 24px ${driver.teamColor}33, 0 0 0 1px rgba(255,255,255,0.05)`,
    }}>
        <div style={{position:'relative',height:100,overflow:'hidden'}}>
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:'70%',background:'linear-gradient(transparent, #1a1a2e)',zIndex:2}}/>
            <img src={driver.photo} alt={driver.name} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}} onError={e=>{e.target.style.display='none';}}/>
            <div style={{position:'absolute',top:4,right:6,fontSize:32,fontWeight:900,color:`${driver.teamColor}44`,fontStyle:'italic',zIndex:1,fontFamily:'monospace',lineHeight:1}}>{driver.number}</div>
            <div style={{position:'absolute',top:5,left:5,zIndex:3,padding:'2px 6px',borderRadius:6,fontSize:8,fontWeight:700,background:`${driver.teamColor}cc`,color:'#fff'}}>{driver.team}</div>
            <div style={{position:'absolute',bottom:4,left:6,zIndex:3}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.5)'}}>{driver.country} {driver.code}</div>
                <div style={{fontSize:14,fontWeight:800,color:'#fff',lineHeight:1.2}}>{driver.name}</div>
            </div>
        </div>
        <div style={{padding:'6px 6px 4px'}}>
            {Object.entries(driver.stats).map(([key,value]) => {
                const isSel = selectedStat===key;
                const info = STAT_LABELS[key];
                return (
                    <div key={key} onClick={()=>isPlayer&&onSelectStat&&onSelectStat(key)}
                         style={{
                             display:'flex',alignItems:'center',justifyContent:'space-between',
                             padding:'5px 8px',marginBottom:2,borderRadius:8,
                             cursor:isPlayer&&onSelectStat?'pointer':'default',
                             background:isSel?(wonStat===true?'rgba(0,200,0,0.15)':wonStat===false?'rgba(255,0,0,0.15)':`${driver.teamColor}22`):'rgba(255,255,255,0.03)',
                             border:isSel?`1px solid ${wonStat===true?'#4CAF50':wonStat===false?'#f44336':driver.teamColor}`:'1px solid transparent',
                             transition:'all 0.2s',
                         }}>
                        <div style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.7)'}}>{info.icon} {info.label}</div>
                        <div style={{fontSize:13,fontWeight:800,color:isRevealed||isPlayer?'#fff':'transparent'}}>{isRevealed||isPlayer?value:'?'}</div>
                    </div>
                );
            })}
        </div>
        <div style={{height:3,background:driver.teamColor}}/>
    </div>
);

const CardBack = ({count}) => (
    <div style={{
        width:'100%',height:320,borderRadius:14,overflow:'hidden',
        background:'linear-gradient(145deg, #e10600, #8b0000, #e10600)',
        border:'2px solid #e10600',boxShadow:'0 6px 24px rgba(225,6,0,0.3)',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        position:'relative',
    }}>
        <div style={{position:'absolute',inset:0,opacity:0.1,backgroundImage:'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'}}/>
        <div style={{fontSize:40,marginBottom:6}}>🏎️</div>
        <div style={{fontSize:20,fontWeight:900,color:'#fff',fontStyle:'italic'}}>F1</div>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:6}}>{count} карт</div>
    </div>
);

const TopTrumpsGame = ({onBack}) => {
    const [state, setState] = useState('ready');
    const [playerDeck, setPlayerDeck] = useState([]);
    const [aiDeck, setAiDeck] = useState([]);
    const [playerCard, setPlayerCard] = useState(null);
    const [aiCard, setAiCard] = useState(null);
    const [selectedStat, setSelectedStat] = useState(null);
    const [roundWinner, setRoundWinner] = useState(null);
    const [isRevealed, setIsRevealed] = useState(false);
    const [isPlayerTurn, setIsPlayerTurn] = useState(true);
    const [score, setScore] = useState({player:0,ai:0});
    const [roundNum, setRoundNum] = useState(0);
    const [message, setMessage] = useState('');
    const totalRounds = 10;

    const startGame = () => {
        const shuffled = [...F1_CARDS].sort(()=>Math.random()-0.5);
        const p = shuffled.slice(0,10), a = shuffled.slice(10,20);
        setPlayerDeck(p); setAiDeck(a);
        setPlayerCard(p[0]); setAiCard(a[0]);
        setScore({player:0,ai:0}); setRoundNum(1);
        setIsPlayerTurn(true); setSelectedStat(null);
        setIsRevealed(false); setRoundWinner(null);
        setState('playerTurn'); setMessage('Выбери характеристику!');
    };

    const selectStat = (stat) => {
        if (state!=='playerTurn'||!isPlayerTurn) return;
        setSelectedStat(stat); setState('revealing'); setIsRevealed(true);
        const pVal = playerCard.stats[stat], aVal = aiCard.stats[stat];
        setTimeout(()=>{
            let winner;
            if (pVal>aVal) { winner='player'; setMessage(`${STAT_LABELS[stat].icon} ${pVal} > ${aVal} — Ты выиграл!`); setScore(s=>({...s,player:s.player+1})); }
            else if (aVal>pVal) { winner='ai'; setMessage(`${STAT_LABELS[stat].icon} ${pVal} < ${aVal} — AI выиграл!`); setScore(s=>({...s,ai:s.ai+1})); }
            else { winner='draw'; setMessage(`${STAT_LABELS[stat].icon} ${pVal} = ${aVal} — Ничья!`); }
            setRoundWinner(winner); setState('roundResult');
        }, 1000);
    };

    const nextRound = () => {
        const nextIdx = roundNum;
        if (nextIdx>=totalRounds||nextIdx>=playerDeck.length||nextIdx>=aiDeck.length) { setState('finished'); return; }
        setPlayerCard(playerDeck[nextIdx]); setAiCard(aiDeck[nextIdx]);
        setRoundNum(roundNum+1); setSelectedStat(null); setIsRevealed(false); setRoundWinner(null);
        const aiTurn = roundWinner==='ai';
        setIsPlayerTurn(!aiTurn);
        if (aiTurn) {
            setState('aiThinking'); setMessage('🤖 AI думает...');
            setTimeout(()=>{
                const ac = aiDeck[nextIdx];
                const keys = Object.keys(ac.stats);
                let best=keys[0]; keys.forEach(k=>{if(ac.stats[k]>ac.stats[best])best=k;});
                setSelectedStat(best); setIsRevealed(true); setState('revealing');
                const pV=playerDeck[nextIdx].stats[best], aV=ac.stats[best];
                setTimeout(()=>{
                    let w;
                    if(pV>aV){w='player';setMessage(`AI: ${STAT_LABELS[best].icon} ${aV} < ${pV}. Ты выиграл!`);setScore(s=>({...s,player:s.player+1}));}
                    else if(aV>pV){w='ai';setMessage(`AI: ${STAT_LABELS[best].icon} ${aV} > ${pV}. AI выиграл!`);setScore(s=>({...s,ai:s.ai+1}));}
                    else{w='draw';setMessage('Ничья!');}
                    setRoundWinner(w); setState('roundResult');
                },1000);
            },1500);
        } else { setState('playerTurn'); setMessage('Твой ход! Выбери характеристику.'); }
    };

    return (
        <div className="page-container fade-in" style={{padding:'12px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div onClick={onBack} style={{cursor:'pointer',fontSize:14,color:'rgba(255,255,255,0.5)'}}>← Назад</div>
                <div style={{fontWeight:800,fontSize:17}}>🃏 Top Trumps</div>
                <div style={{width:50}}/>
            </div>
            {state==='ready' && (
                <div style={{textAlign:'center',paddingTop:40}}>
                    <div style={{fontSize:64,marginBottom:16}}>🃏</div>
                    <div style={{fontSize:22,fontWeight:800,marginBottom:8}}>F1 Top Trumps</div>
                    <div style={{fontSize:14,color:'rgba(255,255,255,0.5)',marginBottom:8,lineHeight:1.6}}>20 пилотов F1 · 5 характеристик<br/>Выбирай стат — у кого больше, тот выигрывает!</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,0.3)',marginBottom:28}}>10 раундов · Ты vs AI</div>
                    <div onClick={startGame} style={{padding:'16px 48px',borderRadius:16,background:'linear-gradient(135deg, #e10600, #8b0000)',fontWeight:800,fontSize:18,cursor:'pointer',display:'inline-block',boxShadow:'0 4px 20px rgba(225,6,0,0.4)'}}>РАЗДАТЬ КАРТЫ</div>
                </div>
            )}
            {state!=='ready'&&state!=='finished' && (
                <div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,padding:'6px 12px',borderRadius:10,background:'rgba(255,255,255,0.04)'}}>
                        <div style={{textAlign:'center'}}><div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>Ты</div><div style={{fontSize:20,fontWeight:800,color:'#4CAF50'}}>{score.player}</div></div>
                        <div style={{textAlign:'center'}}><div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)'}}>Раунд {roundNum}/{totalRounds}</div><div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:1}}>{isPlayerTurn?'🟢 Твой ход':'🔴 Ход AI'}</div></div>
                        <div style={{textAlign:'center'}}><div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>AI</div><div style={{fontSize:20,fontWeight:800,color:'#f44336'}}>{score.ai}</div></div>
                    </div>
                    <div style={{textAlign:'center',fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.6)',marginBottom:10,minHeight:18}}>{message}</div>
                    <div style={{display:'flex',gap:6,alignItems:'flex-start'}}>
                        <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:10,fontWeight:700,textAlign:'center',color:'rgba(255,255,255,0.4)',marginBottom:4}}>ТВОЯ КАРТА</div>
                            {playerCard && <DriverCard driver={playerCard} isPlayer={true} isRevealed={true} selectedStat={selectedStat} wonStat={roundWinner==='player'?true:roundWinner==='ai'?false:null} onSelectStat={state==='playerTurn'&&isPlayerTurn?selectStat:null}/>}
                        </div>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:900,color:'#e10600',alignSelf:'center',minWidth:24,flexShrink:0}}>VS</div>
                        <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:10,fontWeight:700,textAlign:'center',color:'rgba(255,255,255,0.4)',marginBottom:4}}>КАРТА AI</div>
                            {aiCard && (isRevealed ? <DriverCard driver={aiCard} isPlayer={false} isRevealed={true} selectedStat={selectedStat} wonStat={roundWinner==='ai'?true:roundWinner==='player'?false:null}/> : <CardBack count={aiDeck.length-roundNum+1}/>)}
                        </div>
                    </div>
                    {state==='roundResult' && (
                        <div style={{textAlign:'center',marginTop:12}}>
                            <div onClick={nextRound} style={{padding:'10px 28px',borderRadius:12,background:roundWinner==='player'?'#4CAF50':roundWinner==='ai'?'#f44336':'#666',fontWeight:700,fontSize:14,cursor:'pointer',display:'inline-block'}}>
                                {roundNum>=totalRounds?'Результат':'Следующий раунд →'}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {state==='finished' && (
                <div style={{textAlign:'center',paddingTop:30}}>
                    <div style={{fontSize:64,marginBottom:12}}>{score.player>score.ai?'🏆':score.player<score.ai?'😤':'🤝'}</div>
                    <div style={{fontSize:28,fontWeight:800,color:score.player>score.ai?'#4CAF50':score.player<score.ai?'#f44336':'#FF9800'}}>{score.player>score.ai?'ПОБЕДА!':score.player<score.ai?'ПОРАЖЕНИЕ':'НИЧЬЯ'}</div>
                    <div style={{fontSize:36,fontWeight:800,marginTop:8}}>{score.player} : {score.ai}</div>
                    <div style={{fontSize:14,color:'rgba(255,255,255,0.4)',marginTop:8}}>{score.player>score.ai?'Ты настоящий стратег!':score.player<score.ai?'AI оказался хитрее. Попробуй ещё!':'Достойная битва!'}</div>
                    <div style={{display:'flex',gap:12,justifyContent:'center',marginTop:24}}>
                        <div onClick={startGame} style={{padding:'14px 28px',borderRadius:12,background:'linear-gradient(135deg, #e10600, #8b0000)',fontWeight:700,cursor:'pointer'}}>Играть снова</div>
                        <div onClick={onBack} style={{padding:'14px 28px',borderRadius:12,background:'rgba(255,255,255,0.08)',fontWeight:700,cursor:'pointer'}}>Назад</div>
                    </div>
                </div>
            )}
        </div>
    );
};

const QUIZ_BANK = [
    {q:'Кто выиграл первый чемпионат мира F1 в 1950?',o:['Хуан Мануэль Фанхио','Джузеппе Фарина','Альберто Аскари','Стирлинг Мосс'],a:1,d:1},
    {q:'Сколько чемпионских титулов у Михаэля Шумахера?',o:['5','6','7','8'],a:2,d:1},
    {q:'Какая команда выиграла больше всего Кубков конструкторов?',o:['McLaren','Mercedes','Ferrari','Williams'],a:2,d:1},
    {q:'В каком году Льюис Хэмилтон стал чемпионом впервые?',o:['2007','2008','2010','2014'],a:1,d:1},
    {q:'Какой гран-при считается самым престижным?',o:['Монако','Сильверстоун','Монца','Спа'],a:0,d:1},
    {q:'Сколько очков даётся за победу в гонке (2025)?',o:['20','25','30','50'],a:1,d:1},
    {q:'Какой цвет флага означает конец гонки?',o:['Красный','Жёлтый','Клетчатый','Синий'],a:2,d:1},
    {q:'Кто самый молодой чемпион мира F1?',o:['Льюис Хэмилтон','Фернандо Алонсо','Себастьян Феттель','Макс Ферстаппен'],a:3,d:1},
    {q:'Какая максимальная скорость болида F1 (примерно)?',o:['280 км/ч','320 км/ч','370 км/ч','420 км/ч'],a:2,d:2},
    {q:'Что такое DRS в Формуле 1?',o:['Система торможения','Подвижное заднее крыло','Система рекуперации','Ограничитель скорости'],a:1,d:2},
    {q:'Сколько поворотов на трассе Монако?',o:['14','17','19','22'],a:2,d:2},
    {q:'Какой пилот имеет рекорд по количеству побед?',o:['Шумахер','Хэмилтон','Ферстаппен','Сенна'],a:1,d:2},
    {q:'Что означает синий флаг?',o:['Опасность','Пропусти быструю машину','Конец сессии','Мокрая трасса'],a:1,d:2},
    {q:'Какой минимальный вес болида F1 (2025)?',o:['650 кг','722 кг','798 кг','850 кг'],a:2,d:2},
    {q:'Сколько передач в коробке болида F1?',o:['6','7','8','10'],a:2,d:2},
    {q:'Что такое пейс-кар (Safety Car)?',o:['Запасной болид','Машина безопасности','Машина врача','Машина судьи'],a:1,d:2},
    {q:'Кто выиграл последний чемпионат с Ferrari до 2025?',o:['Шумахер (2004)','Райкконен (2007)','Алонсо (2006)','Феттель (2013)'],a:1,d:3},
    {q:'Какой пилот погиб в Имоле в 1994?',o:['Ники Лауда','Жиль Вильнёв','Айртон Сенна','Ронни Петерсон'],a:2,d:3},
    {q:'На какой трассе самый длинный круг в календаре 2025?',o:['Джидда','Спа','Баку','Лас-Вегас'],a:1,d:3},
    {q:'Сколько цилиндров в двигателе F1 (с 2014)?',o:['4','6','8','10'],a:1,d:3},
    {q:'Какую перегрузку испытывает пилот при торможении?',o:['2G','4G','6G','8G'],a:2,d:3},
    {q:'Кто единственный выиграл чемпионат посмертно?',o:['Сенна','Риндт','Кларк','Хоторн'],a:1,d:3},
    {q:'В каком году FIA ввела систему гало?',o:['2016','2017','2018','2019'],a:2,d:3},
    {q:'Какой рекорд Ферстаппена в 2023 — побед за сезон?',o:['15','17','19','21'],a:2,d:3},
];

const QuizGame = ({onBack}) => {
    const [state, setState] = useState('ready');
    const [questions, setQuestions] = useState([]);
    const [qIdx, setQIdx] = useState(0);
    const [selected, setSelected] = useState(null);
    const [score, setScore] = useState(0);
    const [result, setResult] = useState(null);
    const totalQ = 5;

    const generateQuestions = () => {
        const easy = QUIZ_BANK.filter(q=>q.d===1).sort(()=>Math.random()-0.5).slice(0,2);
        const med = QUIZ_BANK.filter(q=>q.d===2).sort(()=>Math.random()-0.5).slice(0,2);
        const hard = QUIZ_BANK.filter(q=>q.d===3).sort(()=>Math.random()-0.5).slice(0,1);
        return [...easy,...med,...hard];
    };

    const startGame = () => { setQuestions(generateQuestions()); setQIdx(0); setScore(0); setSelected(null); setResult(null); setState('playing'); };

    const answer = (idx) => {
        if (selected!==null) return;
        setSelected(idx);
        const isCorrect = idx===questions[qIdx].a;
        const newScore = score + (isCorrect?1:0);
        if(isCorrect) setScore(s=>s+1);
        setTimeout(()=>{
            if (qIdx+1<totalQ) { setQIdx(i=>i+1); setSelected(null); }
            else {
                setState('finished');
                api.post('/api/games/result',{game_type:'quiz',score:newScore}).then(res=>setResult(res));
            }
        }, 1200);
    };

    const diffLabel = (d) => d===1?'Легко':d===2?'Средне':'Сложно';
    const diffColor = (d) => d===1?'#27F4D2':d===2?'#FF8000':'#e10600';

    return (
        <div className="page-container fade-in" style={{padding:'20px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <div onClick={onBack} style={{cursor:'pointer',fontSize:14,color:'var(--f1-text-muted)'}}>← Назад</div>
                <div style={{fontWeight:800,fontSize:18}}>🧠 F1 Квиз</div>
                <div style={{width:50}}/>
            </div>
            {state==='ready' && (
                <div style={{textAlign:'center'}}>
                    <div style={{fontSize:60,marginBottom:20}}>🧠</div>
                    <div style={{fontSize:14,color:'var(--f1-text-secondary)',marginBottom:8}}>{totalQ} вопросов об истории F1</div>
                    <div style={{fontSize:12,color:'var(--f1-text-muted)',marginBottom:24}}>2 лёгких · 2 средних · 1 сложный</div>
                    <div onClick={startGame} style={{padding:'16px 40px',borderRadius:14,background:'#6692FF',fontWeight:800,fontSize:18,cursor:'pointer',display:'inline-block',fontFamily:'inherit',border:'none',color:'#fff'}}>СТАРТ</div>
                </div>
            )}
            {state==='playing' && questions[qIdx] && (
                <div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                        <div style={{fontSize:12,color:'var(--f1-text-muted)'}}>Вопрос {qIdx+1}/{totalQ} · Счёт: {score}</div>
                        <div style={{fontSize:10,fontWeight:700,color:diffColor(questions[qIdx].d),background:`${diffColor(questions[qIdx].d)}22`,padding:'3px 8px',borderRadius:6}}>{diffLabel(questions[qIdx].d)}</div>
                    </div>
                    <div style={{fontSize:16,fontWeight:700,marginBottom:20,textAlign:'center',lineHeight:1.4}}>{questions[qIdx].q}</div>
                    {questions[qIdx].o.map((opt,idx)=>{
                        let bg = 'rgba(255,255,255,0.06)';
                        if (selected!==null) { if(idx===questions[qIdx].a) bg='rgba(0,200,0,0.2)'; else if(idx===selected) bg='rgba(255,0,0,0.2)'; }
                        return (
                            <div key={idx} onClick={()=>answer(idx)} style={{padding:'14px 16px',marginBottom:8,borderRadius:12,background:bg,cursor:selected!==null?'default':'pointer',fontWeight:600,fontSize:14,transition:'all 0.2s'}}>
                                {opt}
                            </div>
                        );
                    })}
                </div>
            )}
            {state==='finished' && (
                <div style={{textAlign:'center'}}>
                    <div style={{fontSize:48,marginBottom:12}}>{score>=4?'🏆':score>=2?'👏':'📚'}</div>
                    <div style={{fontSize:32,fontWeight:800,color:'#6692FF'}}>{score}/{totalQ}</div>
                    <div style={{fontSize:14,color:'var(--f1-text-secondary)',marginTop:4}}>{score>=4?'Настоящий знаток!':score>=2?'Неплохо!':'Почитай про F1!'}</div>
                    <div style={{display:'flex',gap:12,justifyContent:'center',marginTop:24}}>
                        <div onClick={startGame} style={{padding:'12px 24px',borderRadius:12,background:'#6692FF',fontWeight:700,cursor:'pointer',color:'#fff'}}>Ещё раз</div>
                        <div onClick={onBack} style={{padding:'12px 24px',borderRadius:12,background:'rgba(255,255,255,0.08)',fontWeight:700,cursor:'pointer'}}>Назад</div>
                    </div>
                </div>
            )}
        </div>
    );
};

const GamesPage = ({onChange}) => {
    const [status, setStatus] = useState(null);
    const [activeGame, setActiveGame] = useState(null);

    useEffect(()=>{ api.get('/api/games/status').then(setStatus); }, []);

    const goBack = () => { setActiveGame(null); api.get('/api/games/status').then(setStatus); };

    if (activeGame==='pit_stop') return <PitStopGame onBack={goBack}/>;
    if (activeGame==='top_trumps') return <TopTrumpsGame onBack={goBack}/>;
    if (activeGame==='reaction') return <ReactionGame onBack={goBack}/>;
    if (activeGame==='quiz') return <QuizGame onBack={goBack}/>;

    const games = [
        {id:'pit_stop',icon:'🔧',name:'Пит-стоп',desc:'Смени шины быстрее всех!',color:'#e10600'},
        {id:'top_trumps',icon:'🃏',name:'Top Trumps',desc:'Карточная битва пилотов F1',color:'#FFD700'},
        {id:'reaction',icon:'🚦',name:'Реакция',desc:'Стартуй по зелёному!',color:'#27F4D2'},
        {id:'quiz',icon:'🧠',name:'F1 Квиз',desc:'Проверь свои знания',color:'#6692FF'},
    ];

    return (
        <div className="page-container fade-in" style={{padding:'12px 16px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                <h2 style={{fontSize:22,fontWeight:900}}>🎮 Мини-игры</h2>
                {onChange && <div onClick={()=>onChange('home')} style={{cursor:'pointer',fontSize:13,color:'var(--f1-text-muted)'}}>← Главная</div>}
            </div>
            {games.map(g => {
                const st = status?.games?.[g.id];
                const canPlay = st?.can_play!==false;
                const cooldown = st?.seconds_left;
                return (
                    <div key={g.id} className="card" onClick={()=>canPlay&&setActiveGame(g.id)}
                         style={{display:'flex',alignItems:'center',gap:14,padding:16,marginBottom:8,
                             borderLeft:`4px solid ${g.color}`,opacity:canPlay?1:0.5,cursor:canPlay?'pointer':'default'}}>
                        <div style={{fontSize:32}}>{g.icon}</div>
                        <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:16}}>{g.name}</div>
                            <div style={{fontSize:12,color:'var(--f1-text-muted)',marginTop:2}}>{g.desc}</div>
                        </div>
                        {!canPlay && cooldown>0 && (
                            <div style={{fontSize:11,color:'var(--f1-text-muted)',textAlign:'right'}}>
                                ⏳ {Math.floor(cooldown/3600)}ч {Math.floor((cooldown%3600)/60)}м
                            </div>
                        )}
                        {canPlay && <div style={{fontSize:13,fontWeight:700,color:g.color}}>ИГРАТЬ →</div>}
                    </div>
                );
            })}
        </div>
    );
};


// ============ ROUTING ============
const parseRoute = (path) => {
  const clean = path.replace(/^\/(redesign\/v2\/?)?/, '');
  if (!clean) return { name:'home' };
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'race' && parts[1]) return { name:'race', round: parseInt(parts[1], 10), season: parts[2] ? parseInt(parts[2], 10) : null };
  if (parts[0] === 'standings') return { name:'standings', season: parts[1] ? parseInt(parts[1], 10) : null };
  if (parts[0] === 'calendar') return { name:'calendar' };
  if (parts[0] === 'predict') return { name:'predict' };
  if (parts[0] === 'profile') return { name:'profile' };
  if (parts[0] === 'games') return { name:'games' };
  if (parts[0] === 'news') return { name:'news' };
  if (parts[0] === 'article') return { name:'article' };
  if (parts[0] === 'highlights') return { name:'highlights' };
  return { name:'home' };
};

// ============ APP ============
const App = () => {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [spoilerFree, setSpoilerFree] = useState(() => localStorage.getItem('f1hub_spoiler_free') === 'true');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [playYt, setPlayYt] = useState(null);
  const [pickedDriver, setPickedDriver] = useState(null);
  const [pickedTeam, setPickedTeam] = useState(null);
  const [homeData, setHomeData] = useState(null);
  const [seasonNum, setSeasonNum] = useState(new Date().getFullYear());

  // Browser nav
  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const onPlay = e => setPlayYt({ ytId: e.detail?.ytId, title: e.detail?.title });
    window.addEventListener('f1hub-play-yt', onPlay);
    return () => window.removeEventListener('f1hub-play-yt', onPlay);
  }, []);

  // Auth init + 401 handler
  useEffect(() => {
    const token = localStorage.getItem('f1hub_auth_token');
    if (token) {
      api.get('/api/user/me').then(u => {
        if (u?.user_id || u?.id) { setUser(u); api.get('/api/user/is-admin').then(d => { if (d?.is_admin) window.__F1_ADMIN_IDS = [u.user_id || u.id]; }); }
        else localStorage.removeItem('f1hub_auth_token');
      });
    }
    const onExpired = () => { localStorage.removeItem('f1hub_auth_token'); setUser(null); };
    window.addEventListener('f1:auth-expired', onExpired);
    return () => window.removeEventListener('f1:auth-expired', onExpired);
  }, []);



  // Home/Calendar data
  useEffect(() => {
    const s = seasonNum;
    Promise.all([
      api.get('/api/home?season=' + s),
      api.get('/api/standings/drivers?season=' + s),
      api.get('/api/standings/constructors?season=' + s),
      api.get('/api/schedule?season=' + s),
      api.get('/api/streams'),
      api.get('/api/season/' + s + '/results'),
      api.get('/api/broadcasts/live'),
    ]).then(([home, ds, cs, sched, str, sr, lb]) => {
      setHomeData({
        nextRace: home?.next_race,
        lastRace: home?.last_race,
        standings: { drivers: ds?.standings || [], constructors: cs?.standings || [] },
        schedule: sched,
        streams: str,
        seasonResults: sr,
        liveBroadcasts: lb?.broadcasts || [],
      });
    });
  }, [seasonNum]);

  const toggleSpoiler = () => {
    const nv = !spoilerFree;
    setSpoilerFree(nv);
    localStorage.setItem('f1hub_spoiler_free', String(nv));
    document.querySelectorAll('iframe').forEach(f => {
      try { f.contentWindow.postMessage({ type:'f1hub-prem-set-spoiler', value: nv }, '*'); } catch(e){}
    });
  };

  const onLoggedIn = () => {
    setShowLogin(false);
    api.get('/api/user/me').then(u => { if (u?.user_id || u?.id) setUser(u); });
  };
  const onLogout = () => {
    localStorage.removeItem('f1hub_auth_token');
    setUser(null);
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else { window.history.pushState({}, '', '/'); setRoute({ name:'home' }); }
  };

  return (
    <Fragment>
      <TopNav
        activeId={route.name}
        user={user}
        spoilerFree={spoilerFree}
        onToggleSpoiler={toggleSpoiler}
        onLogin={() => setShowLogin(true)}
        onLogout={onLogout}
        onNavigate={(href) => { window.history.pushState({}, '', href); setRoute(parseRoute(href)); }}
      />
      <main key={route.name + ':' + (route.round || '')}>
        {route.name === 'race' && <RaceDetailPage round={route.round} season={route.season} spoilerFree={spoilerFree} onBack={goBack}/>}
        {route.name === 'home' && <HomePremiumFrame spoilerFree={spoilerFree} navigate={(href) => { window.history.pushState({}, '', href); setRoute(parseRoute(href)); }}/>}
        {route.name === 'calendar' && <CalendarPremiumFrame spoilerFree={spoilerFree} navigate={(href) => { window.history.pushState({}, '', href); setRoute(parseRoute(href)); }}/>}
        {route.name === 'standings' && <StandingsPage season={route.season || new Date().getFullYear()} spoilerFree={spoilerFree} onDriverPick={setPickedDriver} onTeamPick={setPickedTeam}/>}
        {route.name === 'predict' && <PredictionsPage user={user} onLogin={() => setShowLogin(true)}/>}
        {route.name === 'games' && <GamesPage/>}
        {route.name === 'news' && !selectedArticle && <NewsPage onArticleClick={(url) => { setSelectedArticle(url); window.history.pushState({}, '', '/article'); setRoute({ name:'article' }); }}/>}
        {route.name === 'highlights' && <HighlightsPage onPlay={(ytId, title) => setPlayYt({ ytId, title })}/>}
        {route.name === 'profile' && (user ? <ProfilePage user={user}/> : <AuthGate onLogin={() => setShowLogin(true)} title="Раздел 06 · Профиль"/>)}
        {route.name === 'article' && <ArticlePage articleUrl={selectedArticle} onBack={() => { setSelectedArticle(null); window.history.back(); }}/>}
      </main>
      {playYt && <YtModal ytId={playYt.ytId} title={playYt.title} onClose={() => setPlayYt(null)}/>}
      {pickedDriver && <DriverModal driver={pickedDriver} onClose={() => setPickedDriver(null)}/>}
      {pickedTeam && <TeamModal team={pickedTeam} onClose={() => setPickedTeam(null)}/>}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLoggedIn={onLoggedIn}/>}
    </Fragment>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
