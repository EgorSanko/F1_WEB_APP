// F1 Hub — Public Site (Desktop)
// Full-featured desktop site with all webapp features
const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ==== CONSTANTS ====
const TEAM_COLORS = {
  'Red Bull':'#3671C6','Ferrari':'#E8002D','Mercedes':'#27F4D2','McLaren':'#FF8000',
  'Aston Martin':'#229971','Alpine':'#0093CC','Williams':'#64C4FF','RB':'#6692FF',
  'Kick Sauber':'#52E252','Haas':'#B6BABD',
  'Red Bull Racing':'#3671C6','Racing Bulls':'#6692FF','Audi':'#52E252',
  'red_bull':'#3671C6','ferrari':'#E8002D','mercedes':'#27F4D2','mclaren':'#FF8000',
  'aston_martin':'#229971','alpine':'#0093CC','williams':'#64C4FF','rb':'#6692FF',
  'sauber':'#52E252','haas':'#B6BABD',
};
const teamColor = (t) => TEAM_COLORS[t] || TEAM_COLORS[t?.toLowerCase()?.replace(/\s+/g,'_')] || '#666';

// ==== AUTH ====
const _getAuthHeaders = () => {
  const token = localStorage.getItem('f1hub_auth_token');
  return token ? { 'Authorization': 'TgLogin ' + token } : {};
};

// ==== API CLIENT ====
const api = {
  get: async (url) => {
    try {
      const res = await fetch(url, { headers: _getAuthHeaders() });
      if (res.status === 401) { window.dispatchEvent(new CustomEvent('f1:auth-expired')); return null; }
      if (!res.ok) return null;
      return await res.json();
    } catch (err) { console.error('API GET ' + url + ':', err); return null; }
  },
  post: async (url, body) => {
    try {
      const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', ..._getAuthHeaders() }, body:JSON.stringify(body) });
      if (res.status === 401) { window.dispatchEvent(new CustomEvent('f1:auth-expired')); return null; }
      if (!res.ok) return null;
      return await res.json();
    } catch (err) { console.error('API POST ' + url + ':', err); return null; }
  }
};

// ==== FLAGS ====
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
  de:'de',fi:'fi',fr:'fr',dk:'dk',th:'th',ar:'ar',nz:'nz',pt:'pt',pl:'pl',
  se:'se',no:'no',il:'il',co:'co',in:'in',ch:'ch',ie:'ie',
  gbr:'gb',ned:'nl',ger:'de',fin:'fi',fra:'fr',den:'dk',tha:'th',arg:'ar',
  nzl:'nz',chn:'cn',jpn:'jp',mon:'mc',esp:'es',can:'ca',aus:'au',
  mex:'mx',bra:'br',aut:'at',bel:'be',hun:'hu',sgp:'sg',ita:'it',
};
const flagUrl = (code) => {
  if (!code) return null;
  const iso = FLAG_MAP[code.toLowerCase().replace(/[\s-]+/g,'_')];
  return iso ? 'https://flagcdn.com/w40/' + iso + '.png' : null;
};
const FlagImg = ({ code, size = 'w-8 h-6' }) => {
  const src = flagUrl(code);
  return src
    ? <img src={src} className={`${size} object-cover rounded-sm inline-block`} alt="" loading="lazy"/>
    : <span className="text-base">🏁</span>;
};

// ==== DRIVER PHOTO ====
// Upscale F1 CDN image URL to higher resolution.
// `media.formula1.com/image/upload/c_fill,...,w_200/...` → bumps w_/h_ params.
const hiResImg = (url, targetW = 800) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('media.formula1.com/image/upload/')) return url;
  return url
    .replace(/(\b)w_\d+/g, `$1w_${targetW}`)
    .replace(/(\b)h_\d+/g, `$1h_${Math.round(targetW * 0.75)}`);
};

const DriverPhoto = ({ url, size = 36, className = '', name = '' }) => {
  const [failed, setFailed] = useState(false);
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '';
  if (!url || failed) return (
    <div className={`rounded-full bg-f1-card flex-shrink-0 flex items-center justify-center text-f1-muted font-bold ${className}`}
      style={{width:size, height:size, fontSize: size * 0.35}}>
      {initials || <svg width={size*0.4} height={size*0.4} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
    </div>
  );
  // Bump CDN resolution for any size ≥40px (covers most non-tiny avatar uses)
  const finalUrl = size >= 40 ? hiResImg(url, Math.max(200, size * 4)) : url;
  return <img src={finalUrl} className={`rounded-full object-cover bg-f1-card flex-shrink-0 ${className}`}
    style={{width:size, height:size}} alt="" loading="lazy" onError={() => setFailed(true)}/>;
};

// ==== HELPERS ====
const fmtDate = (d) => { if(!d) return ''; const dt=new Date(d); return dt.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}); };
const fmtTime = (s) => { if(s==null) return '—'; const m=Math.floor(s/60); const sec=(s%60).toFixed(3); return m>0?m+':'+sec.padStart(6,'0'):sec; };
const fmtMSK = (d, t) => {
  if (!d) return '';
  try {
    const dt = new Date(t ? d+'T'+t : d);
    return dt.toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}) + ' МСК';
  } catch { return fmtDate(d); }
};

// ==== ICONS (inline SVG) ====
const IconHome = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg>;
const IconLive = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14"/></svg>;
const IconNews = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>;
const IconCalendar = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconTrophy = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 9H4.5a2.5 2.5 0 010-5H6m12 5h1.5a2.5 2.5 0 000-5H18M6 9v7a4 4 0 004 4h4a4 4 0 004-4V9M6 9h12M9 21h6"/></svg>;
const IconPredict = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>;
const IconUser = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>;
const IconGame = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const IconMenu = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>;
const IconPlay = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>;

// ==== HOOKS ====
const useCountdown = (targetDate) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  if (!targetDate) return { days:0, hours:0, minutes:0, seconds:0 };
  const target = new Date(targetDate);
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  return { days: Math.floor(diff/86400), hours: Math.floor((diff%86400)/3600), minutes: Math.floor((diff%3600)/60), seconds: diff%60 };
};

// ==== SIDEBAR ====
const Sidebar = ({ active, onChange, collapsed, onToggle, mobileOpen, onMobileClose }) => {
  const links = [
    { id:'home', icon:<IconHome/>, label:'Dashboard' },
    { id:'news', icon:<IconNews/>, label:'Новости' },
    { id:'schedule', icon:<IconCalendar/>, label:'Календарь' },
    { id:'standings', icon:<IconTrophy/>, label:'Чемпионат' },
    { id:'predict', icon:<IconPredict/>, label:'Прогнозы' },
    { id:'games', icon:<IconGame/>, label:'Игры' },
    { id:'profile', icon:<IconUser/>, label:'Профиль' },
  ];
  const handleNav = (id) => { onChange(id); if (onMobileClose) onMobileClose(); };
  return (
    <React.Fragment>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={onMobileClose}/>}
      <aside className={`fixed left-0 top-0 h-full z-50 bg-f1-surface/95 backdrop-blur-2xl border-r border-f1-border flex flex-col transition-all duration-300 ${mobileOpen ? 'translate-x-0 w-[220px]' : '-translate-x-full w-[220px]'} md:translate-x-0 ${collapsed ? 'md:w-[68px]' : 'md:w-[220px]'}`}>
        <div className="flex items-center gap-3 px-4 h-16 border-b border-f1-border flex-shrink-0">
          <div className="w-8 h-8 bg-f1-red rounded-lg flex items-center justify-center font-black text-sm text-white flex-shrink-0">F1</div>
          {(!collapsed || mobileOpen) && <span className="font-black text-lg tracking-tight">Hub</span>}
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {links.map(l => (
            <button key={l.id} onClick={() => handleNav(l.id)}
              className={`w-full sidebar-link ${active===l.id ? 'sidebar-link-active' : ''} ${collapsed && !mobileOpen ? 'md:justify-center md:px-0' : ''}`}
              title={collapsed ? l.label : undefined}>
              <span className="flex-shrink-0">{l.icon}</span>
              {(!collapsed || mobileOpen) && <span>{l.label}</span>}
            </button>
          ))}
        </nav>
        <button onClick={onToggle} aria-label="Свернуть меню" className="hidden md:block px-4 py-4 border-t border-f1-border text-f1-muted hover:text-white transition-colors">
          <svg className={`w-5 h-5 mx-auto transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
        </button>
      </aside>
    </React.Fragment>
  );
};

// ==== TOP BAR ====
const TopBar = ({ user, onLogin, onMenuToggle, spoilerFree, onToggleSpoiler }) => (
  <header className="sticky top-0 z-30 h-14 bg-f1-bg/80 backdrop-blur-xl border-b border-f1-border flex items-center justify-between px-4 md:px-6">
    <div className="flex items-center gap-3">
      <button onClick={onMenuToggle} aria-label="Меню" className="text-f1-muted hover:text-white">
        <IconMenu/>
      </button>
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-6 h-6 bg-f1-red rounded-md flex items-center justify-center font-black text-[10px] text-white">F1</div>
        <span className="font-black text-sm tracking-tight">Hub</span>
      </div>
      <button onClick={onToggleSpoiler}
        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${spoilerFree ? 'bg-f1-red/20 text-f1-red' : 'bg-f1-card text-f1-muted hover:text-white'}`}>
        {spoilerFree ? '🙈 Антиспойлер вкл' : '👁️ Антиспойлер выкл'}
      </button>
    </div>
    <div className="flex-1"/>
    {user ? (
      <div className="flex items-center gap-3">
        <DriverPhoto url={user.photo_url} size={32}/>
        <span className="text-sm font-semibold hidden sm:inline">{user.first_name}</span>
      </div>
    ) : (
      <button onClick={onLogin} className="text-sm font-semibold text-f1-red hover:text-white transition-colors">
        Войти через Telegram
      </button>
    )}
  </header>
);

// ==== UI COMPONENTS ====
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex gap-1.5">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="w-3 h-3 rounded-full bg-f1-red" style={{animation:`pulseLight 1.2s ease-in-out ${i*0.15}s infinite`}}/>
      ))}
    </div>
  </div>
);

const CountdownBlock = ({ value, label }) => (
  <div className="glass-card text-center px-3 py-3 min-w-[72px]">
    <div className="text-3xl font-black data-mono bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent leading-none">
      {String(value).padStart(2,'0')}
    </div>
    <div className="text-[10px] font-bold uppercase tracking-widest text-f1-muted mt-1">{label}</div>
  </div>
);

const TyreDot = ({ compound }) => {
  const colors = { SOFT:'#FF3333', MEDIUM:'#FFD700', HARD:'#CCCCCC', INTERMEDIATE:'#39B54A', WET:'#0067FF' };
  return <span className="inline-block w-3.5 h-3.5 rounded-full border-2 flex-shrink-0" style={{borderColor:colors[compound]||'#666'}}/>;
};

// ==== SPOILER ====
const SpoilerCard = ({ onReveal, children }) => (
  <div className="glass-card p-8 text-center relative overflow-hidden">
    <div className="absolute inset-0 backdrop-blur-xl bg-f1-card/90 flex flex-col items-center justify-center z-10">
      <div className="text-3xl mb-3">🙈</div>
      <div className="font-bold text-sm mb-1">Антиспойлер включён</div>
      <div className="text-f1-muted text-xs mb-4">Результаты скрыты</div>
      <button onClick={onReveal} className="px-5 py-2 bg-f1-red text-white text-sm font-bold rounded-xl hover:bg-f1-red-dark transition-colors">
        Показать результаты
      </button>
    </div>
    <div className="filter blur-lg pointer-events-none select-none">{children}</div>
  </div>
);

// ==== DRIVER ROW ====
const DriverRow = ({ pos, driver, team, points, maxPts, onClick }) => {
  const color = teamColor(team);
  return (
    <div onClick={onClick} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer group">
      <div className="w-7 text-center">
        <span className={`font-black text-sm data-mono ${pos<=3 ? 'text-white' : 'text-f1-muted'}`}>{pos}</span>
      </div>
      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{background:color}}/>
      <DriverPhoto url={driver?.photo_url} size={36}/>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate">{driver?.name || driver?.last_name || '—'}</div>
        <div className="text-xs text-f1-muted truncate">{team}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-black text-sm data-mono">{points}</div>
        <div className="w-20 h-1.5 bg-f1-card rounded-full mt-1 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{width:`${maxPts ? (points/maxPts)*100 : 0}%`, background:color}}/>
        </div>
      </div>
    </div>
  );
};

// ==== RACE CARD (enhanced) ====
const RaceCard = ({ race, isNext, isPast, onClick }) => (
  <div onClick={onClick}
    className={`glass-card-hover p-5 cursor-pointer relative overflow-hidden ${isNext ? 'ring-1 ring-f1-red/40 shadow-lg shadow-f1-red/10' : ''}`}>
    {race?.circuit_image && (
      <div className="absolute inset-0 opacity-[0.08]">
        <img src={hiResImg(race.circuit_image, 1200)} className="w-full h-full object-cover" alt="" loading="lazy"/>
      </div>
    )}
    <div className="relative">
      {isNext && <div className="absolute top-0 right-0 text-[10px] font-bold uppercase tracking-wider bg-f1-red text-white px-2 py-0.5 rounded-md">Следующая</div>}
      <div className="flex items-start gap-4">
        <FlagImg code={race?.circuit_id || race?.country_code} size="w-10 h-7"/>
        <div className="flex-1 min-w-0">
          <div className="font-black text-base leading-tight">{race?.name || race?.raceName}</div>
          <div className="text-f1-muted text-xs mt-1">{race?.circuit}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-f1-secondary text-xs data-mono">{fmtMSK(race?.date, race?.time)}</span>
            {race?.sprint && <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">СПРИНТ</span>}
          </div>
        </div>
        <span className="font-black text-2xl data-mono text-f1-card-hover flex-shrink-0">R{race?.round}</span>
      </div>
      {isPast && race?.results?.[0] && (
        <div className="mt-3 pt-3 border-t border-f1-border flex items-center gap-2 text-xs">
          <span className="text-yellow-400">🏆</span>
          <DriverPhoto url={race.results[0].photo_url} size={24}/>
          <span className="font-semibold">{race.results[0].name}</span>
          <span className="text-f1-muted ml-auto">{race.results[0].team}</span>
        </div>
      )}
    </div>
  </div>
);

// ==== NEWS CARD ====
const NewsCard = ({ article, onClick }) => (
  <div onClick={onClick} className="glass-card-hover overflow-hidden cursor-pointer group">
    {(article.image || article.photo) && (
      <div className="overflow-hidden">
        <img src={article.image || article.photo} className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105" alt="" width="400" height="192" loading="lazy"/>
      </div>
    )}
    <div className="p-5">
      <h3 className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-f1-red transition-colors">{article.title}</h3>
      {article.preview && <p className="text-f1-muted text-xs mt-2 line-clamp-2 leading-relaxed">{article.preview}</p>}
      <div className="text-f1-muted text-[11px] mt-3">{article.published || article.date_text}</div>
    </div>
  </div>
);

// ==== PODIUM ====
const Podium = ({ results }) => {
  if (!results || results.length < 3) return null;
  const order = [1, 0, 2];
  const heights = ['h-28', 'h-36', 'h-20'];
  const borders = ['border-gray-300', 'border-yellow-400', 'border-amber-600'];
  return (
    <div className="flex items-end justify-center gap-4 mt-6">
      {order.map((idx, i) => {
        const r = results[idx];
        const color = teamColor(r?.team);
        return (
          <div key={i} className="flex flex-col items-center animate-fade-up" style={{animationDelay:`${i*0.1}s`}}>
            <div className={`w-16 h-16 rounded-full border-3 mb-2 overflow-hidden ${borders[i]}`} style={{borderColor: i===1?'#FFD700':i===0?'#C0C0C0':'#CD7F32'}}>
              <DriverPhoto url={r?.photo_url} size={64} className="!rounded-none"/>
            </div>
            <div className="font-black text-sm text-center">{r?.name || r?.last_name}</div>
            <div className="text-xs text-f1-muted mb-2">{r?.time || ''}</div>
            <div className={`${heights[i]} w-24 rounded-t-xl flex items-start justify-center pt-3`}
              style={{background:`linear-gradient(180deg, ${color}40, ${color}15)`}}>
              <span className="text-2xl font-black data-mono" style={{color}}>{idx+1}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ==== VIDEO PLAYER ====
// Inline players for YouTube, Rutube and VK. Everything plays on-page; only
// unknown hosts fall back to an external link.
const buildEmbedSrc = (embedUrl, videoUrl) => {
  const direct = embedUrl || videoUrl || '';
  if (!direct) return null;

  // If admin already supplied a ready embed URL, trust it.
  if (/\/embed\/|video_ext\.php|play\/embed/.test(direct)) return { src: direct, kind: 'iframe' };

  // YouTube: youtube.com/watch?v=ID | youtu.be/ID | youtube.com/embed/ID
  const yt = direct.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { src: `https://www.youtube.com/embed/${yt[1]}?rel=0&playsinline=1&autoplay=1`, kind: 'iframe', provider: 'youtube', id: yt[1], thumb: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` };

  // Rutube: rutube.ru/video/HASH or rutube.ru/play/embed/HASH
  const rt = direct.match(/rutube\.ru\/(?:video|play\/embed)\/([a-f0-9]+)/);
  if (rt) return { src: `https://rutube.ru/play/embed/${rt[1]}?autoStart=true`, kind: 'iframe', provider: 'rutube', id: rt[1] };

  // VK: vk.com/video-OWNER_ID, vkvideo.ru/video-OWNER_ID, or ...?z=video-OWNER_ID
  const vk = direct.match(/(?:vk\.com|vkvideo\.ru)\/(?:[^?]*[?&]z=)?video(-?\d+)_(\d+)/);
  if (vk) return { src: `https://vk.com/video_ext.php?oid=${vk[1]}&id=${vk[2]}&hd=2&autoplay=1`, kind: 'iframe', provider: 'vk', id: `${vk[1]}_${vk[2]}` };

  return { src: direct, kind: 'external' };
};

const VideoPlayer = ({ embedUrl, videoUrl, url, title }) => {
  const [playing, setPlaying] = useState(false);
  const resolved = buildEmbedSrc(embedUrl || url, videoUrl || url);
  if (!resolved) return null;
  if (resolved.kind === 'iframe') {
    if (!playing) {
      const providerLabel = resolved.provider === 'youtube' ? 'YouTube' : resolved.provider === 'rutube' ? 'Rutube' : resolved.provider === 'vk' ? 'VK' : 'Видео';
      return (
        <button onClick={() => setPlaying(true)}
          className="relative w-full rounded-xl overflow-hidden bg-black group cursor-pointer block"
          style={{paddingTop:'56.25%'}}>
          {resolved.thumb && <img src={resolved.thumb} loading="lazy" alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"/>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"/>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-f1-red/90 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
            <span className="text-xs font-bold opacity-80">{providerLabel}</span>
            {title && <span className="text-xs font-semibold truncate ml-2">{title}</span>}
          </div>
        </button>
      );
    }
    return (
      <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{paddingTop:'56.25%'}}>
        <iframe
          src={resolved.src}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock; accelerometer; gyroscope"
          allowFullScreen
          title={title || 'Video'}
        />
      </div>
    );
  }
  return (
    <a href={resolved.src} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-5 py-4 glass-card-hover text-sm font-semibold">
      <IconPlay/> Смотреть запись
    </a>
  );
};

// ==== BROADCAST TAB ====
const SESSION_ORDER = ['sprint_qualifying','sprint','qualifying','race','review'];
const SESSION_LABELS = { sprint_qualifying:'Спринт-квалификация', sprint:'Спринт', qualifying:'Квалификация', race:'Гонка', review:'Обзор' };
const SESSION_ICONS = { sprint_qualifying:'⚡', sprint:'🏁', qualifying:'⏱️', race:'🏆', review:'📺' };

const BroadcastTab = ({ broadcasts, hasSprint }) => {
  const [openIdx, setOpenIdx] = useState(null);
  // Build full hierarchy: include all expected sessions, mark missing
  const types = (hasSprint ? SESSION_ORDER : SESSION_ORDER.filter(t => t !== 'sprint_qualifying' && t !== 'sprint'));
  const byType = {};
  (broadcasts || []).forEach(b => { byType[b.session_type] = b; });
  const items = types.map(t => ({ type: t, broadcast: byType[t] || null }));

  // Auto-open first available
  useEffect(() => {
    const firstWithBroadcast = items.findIndex(i => i.broadcast);
    if (openIdx === null && firstWithBroadcast >= 0) setOpenIdx(firstWithBroadcast);
  }, [broadcasts]);

  const total = items.filter(i => i.broadcast).length;
  if (total === 0) return <div className="glass-card p-8 text-center text-f1-muted text-sm">Записей пока нет</div>;

  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const b = it.broadcast;
        const open = openIdx === i;
        return (
          <div key={it.type} className={`glass-card overflow-hidden transition-all ${b ? 'cursor-pointer' : 'opacity-50'}`}>
            <div onClick={() => b && setOpenIdx(open ? null : i)} className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg">{SESSION_ICONS[it.type]}</span>
              <div className="flex-1">
                <div className="font-bold text-sm">{SESSION_LABELS[it.type]}</div>
                {b?.title && b.title !== SESSION_LABELS[it.type] && <div className="text-xs text-f1-muted truncate">{b.title}</div>}
              </div>
              {!!b?.is_live && <span className="text-[10px] font-bold bg-f1-red text-white px-2 py-0.5 rounded animate-pulse-red">LIVE</span>}
              {!b && <span className="text-[10px] text-f1-muted">Не добавлено</span>}
              {b && <span className="text-f1-muted text-xs">{open ? '▲' : '▼'}</span>}
            </div>
            {b && open && (
              <div className="px-4 pb-4">
                <div className="max-w-2xl">
                  <VideoPlayer embedUrl={b.embed_url} videoUrl={b.video_url} title={b.title}/>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// PAGES
// ============================================================

// ==== DASHBOARD ====
const DashboardPage = ({ nextRace, lastRace, standings, schedule, news, spoilerFree, onNavigate }) => {
  const cd = useCountdown(nextRace?.race_datetime || nextRace?.date);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero — Next Race */}
      {nextRace && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-f1-card via-f1-surface to-f1-bg border border-f1-border p-8 animate-glow">
          {nextRace.circuit_image && <div className="absolute inset-0 opacity-[0.06]"><img src={hiResImg(nextRace.circuit_image, 1600)} className="w-full h-full object-cover" alt="" loading="lazy"/></div>}
          <div className="absolute top-0 right-0 w-64 h-64 bg-f1-red/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"/>
          <div className="relative">
            <div className="section-title">Следующий Гран-При</div>
            <div className="flex items-start gap-4 mb-6">
              <FlagImg code={nextRace.circuit_id || nextRace.country_code} size="w-14 h-10"/>
              <div>
                <h1 className="text-2xl font-black leading-tight">{nextRace.name}</h1>
                <div className="text-f1-secondary text-sm mt-1">{nextRace.circuit} · Раунд {nextRace.round}</div>
                {nextRace.sprint && <span className="inline-block mt-1 text-[10px] font-bold bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">СПРИНТ-УИКЕНД</span>}
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <CountdownBlock value={cd.days} label="Дней"/>
              <CountdownBlock value={cd.hours} label="Часов"/>
              <CountdownBlock value={cd.minutes} label="Минут"/>
              <CountdownBlock value={cd.seconds} label="Секунд"/>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Races */}
        <div className="lg:col-span-2">
          <div className="section-title">Ближайшие гонки</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(schedule?.races || []).filter(r => !r.is_past).slice(0, 4).map(r => (
              <RaceCard key={r.round} race={r} isNext={r.round === nextRace?.round}
                onClick={() => onNavigate('raceDetail', { round: r.round })}/>
            ))}
          </div>
          <button onClick={() => onNavigate('schedule')} className="mt-3 text-xs text-f1-red font-semibold hover:text-white transition-colors">
            Все гонки →
          </button>
        </div>

        {/* Standings Preview */}
        <div>
          <div className="section-title">Чемпионат пилотов</div>
          {spoilerFree && !spoilerRevealed ? (
            <SpoilerCard onReveal={() => setSpoilerRevealed(true)}>
              <div className="h-64"/>
            </SpoilerCard>
          ) : (
            <div className="glass-card p-2">
              {(standings || []).slice(0, 8).map((d, i) => (
                <DriverRow key={i} pos={i+1} driver={d} team={d.team}
                  points={d.points} maxPts={(standings || [])[0]?.points}
                  onClick={() => onNavigate('standings')}/>
              ))}
              <button onClick={() => onNavigate('standings')} className="w-full text-center py-3 text-xs text-f1-red font-semibold hover:text-white transition-colors">
                Полная таблица →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Last Race Result */}
      {lastRace && (
        <div>
          <div className="section-title">Последний результат · {lastRace.name}</div>
          {spoilerFree && !spoilerRevealed ? (
            <SpoilerCard onReveal={() => setSpoilerRevealed(true)}>
              <div className="h-64"/>
            </SpoilerCard>
          ) : (
            <div className="glass-card p-6">
              <Podium results={lastRace.results}/>
              <div className="mt-6 space-y-0">
                {(lastRace.results || []).slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <span className={`w-7 text-center font-black text-sm data-mono ${i<3?'text-white':'text-f1-muted'}`}>{r.position || i+1}</span>
                    <div className="w-1 h-6 rounded-full flex-shrink-0" style={{background:teamColor(r.team)}}/>
                    <DriverPhoto url={r.photo_url} size={28}/>
                    <span className="flex-1 text-sm font-semibold">{r.name}</span>
                    <span className="text-xs text-f1-muted data-mono hidden sm:inline">{r.team}</span>
                    <span className="text-xs data-mono w-20 text-right">{r.time || (i===0 ? 'Winner' : '')}</span>
                    <span className="text-xs font-bold data-mono w-8 text-right text-f1-secondary">{r.points || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* News */}
      {news && news.length > 0 && (
        <div>
          <div className="section-title">Новости Ф-1</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {news.slice(0, 6).map((a, i) => (
              <NewsCard key={i} article={a} onClick={() => onNavigate('article', { url: a.url })}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==== STANDINGS ====
const podiumColors = ['#FFD700','#C0C0C0','#CD7F32'];

const StandingsPage = ({ driversStandings, constructorsStandings, season, spoilerFree }) => {
  const [tab, setTab] = useState('drivers');
  const [revealed, setRevealed] = useState(false);
  const [h2hData, setH2hData] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [allDrivers, setAllDrivers] = useState(null);
  const [teamsData, setTeamsData] = useState(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const drivers = Array.isArray(driversStandings) ? driversStandings : (driversStandings?.standings || []);
  const constructors = Array.isArray(constructorsStandings) ? constructorsStandings : (constructorsStandings?.standings || []);
  const leaderPts = drivers[0]?.points || 1;
  const cLeaderPts = constructors[0]?.points || 1;

  useEffect(() => {
    if (tab === 'h2h' && !h2hData) api.get(`/api/head-to-head?season=${season}`).then(setH2hData);
    if (tab === 'progress' && !progressData) api.get(`/api/standings/points-progression?season=${season}`).then(setProgressData);
    if (tab === 'cards' && !allDrivers) api.get(`/api/drivers?season=${season}`).then(d => setAllDrivers(d?.drivers || []));
    if (tab === 'teams' && !teamsData) api.get(`/api/teams?season=${season}`).then(d => setTeamsData(d?.teams || []));
  }, [tab, season]);

  useEffect(() => {
    if (tab !== 'progress' || !progressData?.drivers?.length || !chartRef.current || typeof Chart === 'undefined') return;
    if (chartInstance.current) chartInstance.current.destroy();
    const ctx = chartRef.current.getContext('2d');
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: progressData.drivers.map(d => ({
          label: d.code,
          data: d.progression.map(p => ({ x: p.round, y: p.cumulative })),
          borderColor: d.team_color || '#888',
          backgroundColor: d.team_color || '#888',
          borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.1, fill: false,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#9A9AAF', boxWidth: 12, font: { size: 11 } } },
          tooltip: { mode: 'nearest', intersect: false, backgroundColor: '#1E1E2C', titleColor: '#fff', bodyColor: '#9A9AAF', borderColor: '#38383F', borderWidth: 1 },
        },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'Раунд', color: '#6B6B80' }, ticks: { color: '#6B6B80', stepSize: 1 }, grid: { color: '#38383F33' } },
          y: { title: { display: true, text: 'Очки', color: '#6B6B80' }, ticks: { color: '#6B6B80' }, grid: { color: '#38383F33' }, min: 0 },
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
      },
    });
    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [tab, progressData]);

  if (spoilerFree && !revealed) return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Чемпионат {season}</h1>
      <SpoilerCard onReveal={() => setRevealed(true)}><div className="h-96"/></SpoilerCard>
    </div>
  );

  const tabs = [
    ['drivers','Пилоты'],['constructors','Кубок'],['h2h','H2H'],
    ['progress','Прогресс'],['cards','Карточки'],['teams','Команды'],
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Чемпионат {season}</h1>
      <div className="flex gap-1 bg-f1-card rounded-xl p-1 mb-6 w-fit flex-wrap">
        {tabs.map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab===id?'bg-f1-red text-white':'text-f1-muted hover:text-white'}`}>{label}</button>
        ))}
      </div>

      {/* DRIVERS */}
      {tab === 'drivers' && (
        <div className="space-y-4">
          {/* Top 3 podium cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {drivers.slice(0,3).map((d, i) => {
              const color = d.team_color || teamColor(d.team);
              return (
                <div key={i} className="glass-card p-5 relative overflow-hidden" style={{borderLeft:`4px solid ${color}`, background:`linear-gradient(135deg, ${color}20, var(--color-f1-card) 70%)`}}>
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-black leading-none" style={{color:podiumColors[i]}}>{i+1}</div>
                    <DriverPhoto url={d.photo_url} size={56}/>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-base truncate">{d.name}</div>
                      <div className="text-xs font-semibold truncate" style={{color}}>{d.team}</div>
                      <div className="mt-1.5 h-1.5 bg-black/30 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${Math.max(5,(d.points/leaderPts)*100)}%`, background:color}}/>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-2xl data-mono">{d.points}</div>
                      <div className="text-[10px] text-f1-muted">очков</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Rest */}
          <div className="glass-card overflow-hidden">
            {drivers.slice(3).map((d, i) => {
              const color = d.team_color || teamColor(d.team);
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-f1-border/50 last:border-0">
                  <div className="w-7 text-center font-black data-mono text-f1-muted">{i+4}</div>
                  <div className="w-1 h-10 rounded-full flex-shrink-0" style={{background:color}}/>
                  <DriverPhoto url={d.photo_url} size={40}/>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{d.name}</div>
                    <div className="text-xs text-f1-muted truncate">{d.team}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-black data-mono">{d.points}</div>
                    {d.gap_to_leader > 0 && <div className="text-[10px] text-f1-muted data-mono">-{d.gap_to_leader}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONSTRUCTORS (Кубок) */}
      {tab === 'constructors' && (
        <div className="space-y-3">
          {constructors.map((c, i) => {
            const color = c.team_color || teamColor(c.team);
            const ds = (c.drivers || []).map(d => {
              const matched = drivers.find(x => x.driver_number === d.driver_number);
              return { ...d, points: matched?.points || 0 };
            });
            const totalPts = c.points || 1;
            return (
              <div key={i} className="glass-card p-5" style={{borderLeft:`4px solid ${color}`}}>
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-black w-8 text-center" style={{color: i<3 ? podiumColors[i] : '#8585a0'}}>{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-base">{c.team}</div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {ds.map((d,j) => (
                        <div key={j} className="flex items-center gap-2 px-2 py-1 bg-white/[0.04] border border-f1-border rounded-lg">
                          <DriverPhoto url={d.photo_url} size={40} name={d.name || d.code}/>
                          <div>
                            <div className="text-xs font-bold leading-tight">{d.code}</div>
                            <div className="text-[10px] text-f1-muted data-mono leading-tight">{d.points} очк.</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {c.points > 0 && (
                      <div className="flex h-1.5 mt-2.5 rounded-full overflow-hidden bg-black/30 gap-0.5">
                        {ds.map((d,j) => {
                          const w = Math.max(3, (d.points / totalPts) * 100);
                          return <div key={j} className="h-full" style={{width:`${w}%`, background: j===0 ? color : color+'99'}}/>;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-black text-2xl data-mono">{c.points}</div>
                    {i>0 && <div className="text-[10px] text-f1-muted data-mono">-{cLeaderPts-c.points}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* H2H */}
      {tab === 'h2h' && (
        !h2hData ? <div className="glass-card p-8 text-center text-f1-muted">Загрузка H2H...</div>
        : !h2hData.head_to_head?.length ? (
          <div className="glass-card p-12 text-center text-f1-muted">
            <div className="text-5xl mb-3">🤝</div>
            <div className="font-bold text-base">Нет данных H2H</div>
          </div>
        ) : (
          <div className="space-y-4">
            {h2hData.head_to_head.map((pair, i) => {
              const d1 = pair.driver1, d2 = pair.driver2;
              const totalPts = (d1.points + d2.points) || 1;
              const d1Pct = (d1.points / totalPts) * 100;
              const d2Pct = (d2.points / totalPts) * 100;
              const totalW = (d1.wins + d2.wins) || 1;
              const d1WPct = (d1.wins / totalW) * 100;
              return (
                <div key={i} className="glass-card overflow-hidden" style={{borderLeft:`4px solid ${pair.color}`}}>
                  <div className="px-5 py-3 border-b border-f1-border"><span className="font-bold text-sm" style={{color:pair.color}}>{pair.team}</span></div>
                  <div className="p-5">
                    <div className="flex justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <DriverPhoto url={d1.photo_url} size={44} className="border-2" style={{borderColor:pair.color}}/>
                        <div>
                          <div className="font-black text-lg">{d1.name}</div>
                          <div className="text-xs text-f1-muted">{d1.full_name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="font-black text-lg">{d2.name}</div>
                          <div className="text-xs text-f1-muted">{d2.full_name}</div>
                        </div>
                        <DriverPhoto url={d2.photo_url} size={44} className="border-2" style={{borderColor:pair.color}}/>
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-f1-muted mb-1"><span>{d1.points} очков</span><span>Очки</span><span>{d2.points} очков</span></div>
                      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                        <div style={{width:`${d1Pct}%`, background:pair.color}}/>
                        <div style={{width:`${d2Pct}%`, background:pair.color+'55'}}/>
                      </div>
                    </div>
                    {(d1.wins > 0 || d2.wins > 0) && (
                      <div>
                        <div className="flex justify-between text-xs text-f1-muted mb-1"><span>{d1.wins} побед</span><span>Победы</span><span>{d2.wins} побед</span></div>
                        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                          <div style={{width:`${d1WPct}%`, background:'#FFD700'}}/>
                          <div style={{width:`${100-d1WPct}%`, background:'#FFD70044'}}/>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* PROGRESS */}
      {tab === 'progress' && (
        !progressData ? <div className="glass-card p-8 text-center text-f1-muted">Загрузка прогресса...</div>
        : !progressData.drivers?.length ? (
          <div className="glass-card p-12 text-center text-f1-muted">
            <div className="text-5xl mb-3">📈</div>
            <div className="font-bold text-base">Нет данных</div>
          </div>
        ) : (
          <div>
            <div className="section-title">Прогресс очков · Топ-10 · Сезон {season}</div>
            <div className="glass-card p-4 mb-4" style={{height:400}}>
              <canvas ref={chartRef}/>
            </div>
            <div className="glass-card overflow-hidden">
              {progressData.drivers.map((d, i) => (
                <div key={d.driver_number} className="flex items-center gap-3 px-4 py-2.5 border-b border-f1-border/50 last:border-0">
                  <div className="w-6 text-center font-black" style={{color: i<3 ? podiumColors[i] : '#8585a0'}}>{i+1}</div>
                  <div className="w-1 h-6 rounded-full" style={{background:d.team_color}}/>
                  <span className="font-bold text-sm w-12" style={{color:d.team_color}}>{d.code}</span>
                  <span className="flex-1 text-sm text-f1-muted truncate">{d.team}</span>
                  <span className="font-black data-mono">{d.total_points}</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* DRIVER CARDS */}
      {tab === 'cards' && (
        !allDrivers ? <div className="glass-card p-8 text-center text-f1-muted">Загрузка карточек...</div> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allDrivers.map(d => {
              const color = d.team_color || teamColor(d.team);
              const bigPhoto = hiResImg(d.card_photo_url || d.photo_url, 800);
              return (
                <div key={d.driver_number} className="rounded-2xl overflow-hidden bg-f1-card border border-f1-border hover:border-f1-border-light transition-all cursor-pointer group">
                  <div className="relative h-56 overflow-hidden" style={{background:`linear-gradient(180deg, ${color}22, ${color}08)`}}>
                    <div className="absolute top-3 right-3 text-5xl font-black z-10 opacity-25" style={{color}}>{d.driver_number}</div>
                    {bigPhoto && <img src={bigPhoto} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style={{objectPosition:d.card_photo_position || 'top center'}} loading="lazy" onError={e => e.target.style.display='none'}/>}
                    <div className="absolute inset-x-0 bottom-0 h-2/3" style={{background:`linear-gradient(transparent, ${color}DD)`}}/>
                    <div className="absolute bottom-3 left-4 right-4 z-10">
                      <div className="text-xs text-white/80">{d.first_name || d.name?.split(' ')[0]}</div>
                      <div className="text-xl font-black text-white drop-shadow">{d.last_name || d.name?.split(' ').slice(1).join(' ')}</div>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <div className="text-xs font-bold truncate" style={{color}}>{d.team?.replace('F1 Team','').trim()}</div>
                    {d.points != null && <div className="px-2 py-1 rounded text-xs font-bold" style={{background:color+'22', color}}>{d.points} очк.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* TEAMS */}
      {tab === 'teams' && (
        !teamsData ? <div className="glass-card p-8 text-center text-f1-muted">Загрузка команд...</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamsData.map((t, i) => {
              const color = t.color || t.team_color;
              return (
                <div key={i} className="glass-card overflow-hidden">
                  {t.car_url && (
                    <div className="relative h-44 overflow-hidden" style={{background:`linear-gradient(135deg, ${color}22, var(--color-f1-card))`}}>
                      <img src={hiResImg(t.car_url, 1200)} alt="" className="w-full h-full object-contain p-3" loading="lazy" onError={e => e.target.style.display='none'}/>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      {t.logo_url && <img src={hiResImg(t.logo_url, 256)} alt="" className="w-10 h-10 object-contain" loading="lazy" onError={e => e.target.style.display='none'}/>}
                      <div className="flex-1">
                        <div className="font-bold text-lg" style={{color}}>{t.name || t.team}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-2xl data-mono">{t.points ?? '—'}</div>
                        <div className="text-[10px] text-f1-muted">P{t.position || i+1}</div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      {(t.drivers || []).map((d, j) => (
                        <div key={j} className="flex items-center gap-2 flex-1 px-3 py-2 bg-white/[0.03] border border-f1-border rounded-xl">
                          <DriverPhoto url={d.photo_url} size={36} className="border-2" style={{borderColor:color}}/>
                          <div>
                            <div className="font-bold text-sm">{d.code}</div>
                            <div className="text-[10px] text-f1-muted truncate">{d.last_name || d.name?.split(' ').pop()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};

// ==== SCHEDULE ====
const SchedulePage = ({ schedule, seasonResults, season, onRaceClick, spoilerFree }) => {
  const races = schedule?.races || [];
  const resultsByRound = useMemo(() => {
    const map = {};
    (seasonResults?.races || []).forEach(r => { if (r.results?.length) map[r.round] = r.results; });
    return map;
  }, [seasonResults]);

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Календарь {season}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {races.map(r => {
          const results = resultsByRound[r.round];
          const raceWithResults = results ? { ...r, results } : r;
          return (
            <RaceCard key={r.round} race={raceWithResults} isPast={r.is_past && !spoilerFree} isNext={r.is_next}
              onClick={() => onRaceClick(r.round)}/>
          );
        })}
      </div>
    </div>
  );
};

// ==== RACE DETAIL ====
const SessionSchedule = ({ sessions, raceTime, raceDate }) => {
  const sessionNames = { fp1:'Практика 1', fp2:'Практика 2', fp3:'Практика 3', sprint_qualifying:'Спринт-квалификация', sprint:'Спринт', qualifying:'Квалификация', race:'Гонка' };
  const sessionIcons = { fp1:'🏎️', fp2:'🏎️', fp3:'🏎️', sprint_qualifying:'⚡', sprint:'🏁', qualifying:'⏱️', race:'🏆' };
  const sessionOrder = ['fp1','sprint_qualifying','fp2','fp3','sprint','qualifying','race'];
  let entries = [];
  if (sessions && typeof sessions === 'object' && !Array.isArray(sessions)) {
    entries = Object.entries(sessions).sort((a,b) => sessionOrder.indexOf(a[0]) - sessionOrder.indexOf(b[0]));
  }
  if (!entries.length && raceDate) {
    entries = [['race', { date: raceDate, time: raceTime }]];
  }
  if (!entries.length) return null;
  return (
    <div className="glass-card p-5">
      <div className="section-title">📅 Расписание сессий</div>
      <div className="divide-y divide-f1-border/50">
        {entries.map(([key, val]) => {
          const dt = val?.date ? new Date(val.date + 'T' + (val.time || '00:00:00').replace('Z','')) : null;
          const msk = dt ? new Date(dt.getTime() + 3*3600000) : null;
          const dayStr = msk ? msk.toLocaleDateString('ru-RU', { weekday:'short', day:'numeric', month:'short' }) : '';
          const timeStr = msk ? msk.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) : '';
          const isRace = key === 'race';
          return (
            <div key={key} className="flex items-center gap-3 py-3">
              <span className="text-lg">{sessionIcons[key] || '•'}</span>
              <span className={`flex-1 text-sm ${isRace ? 'font-black text-f1-red' : 'font-semibold'}`}>{sessionNames[key] || key}</span>
              <div className="text-right">
                <div className="text-xs text-f1-muted">{dayStr}</div>
                {timeStr && <div className="text-sm font-bold data-mono">{timeStr} <span className="text-[10px] text-f1-muted">МСК</span></div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RaceDetailPage = ({ race, season, onBack, spoilerFree }) => {
  const [data, setData] = useState(null);
  const [broadcasts, setBroadcasts] = useState(null);
  const [revealed, setRevealed] = useState(false);

  // Determine if race is upcoming (no results yet)
  const isUpcoming = !race?.is_past;
  const [tab, setTab] = useState(isUpcoming ? 'schedule' : 'race');

  useEffect(() => {
    if (!race?.round) return;
    if (!isUpcoming) {
      Promise.all([
        api.get('/api/race/' + race.round + '/results?season=' + season),
        api.get('/api/race/' + race.round + '/qualifying?season=' + season),
      ]).then(([res, qual]) => setData({ results: res, qualifying: qual }));
    }
    api.get('/api/broadcasts?race_round=' + race.round + '&season=' + season).then(d => setBroadcasts(d?.broadcasts || []));
  }, [race?.round, season, isUpcoming]);

  const results = tab === 'race' ? (data?.results?.results || []) : (data?.qualifying?.results || []);
  const showSpoiler = spoilerFree && !revealed && race?.is_past;

  const tabs = isUpcoming
    ? [['schedule','Расписание'], ['broadcasts','Записи']]
    : [['race','Гонка'], ['qualifying','Квалификация'], ['broadcasts','Записи']];

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="text-f1-muted hover:text-white text-sm font-semibold mb-4 transition-colors">← Назад к календарю</button>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-f1-card via-f1-surface to-f1-bg border border-f1-border p-6 mb-6">
        {race?.circuit_image && <div className="absolute inset-0 opacity-[0.06]"><img src={hiResImg(race.circuit_image, 1600)} className="w-full h-full object-cover" alt="" loading="lazy"/></div>}
        <div className="relative flex items-center gap-4">
          <FlagImg code={race?.circuit_id || race?.country_code} size="w-12 h-9"/>
          <div>
            <h1 className="text-2xl font-black">{race?.name}</h1>
            <div className="text-f1-muted text-sm">{race?.circuit} · Раунд {race?.round}</div>
            {race?.sprint && <span className="inline-block mt-1 text-[10px] font-bold bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">СПРИНТ</span>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-f1-card rounded-xl p-1 mb-6 w-fit flex-wrap">
        {tabs.map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab===t?'bg-f1-red text-white':'text-f1-muted hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'schedule' ? (
        <SessionSchedule sessions={race?.sessions} raceTime={race?.time} raceDate={race?.date}/>
      ) : tab === 'broadcasts' ? (
        <BroadcastTab broadcasts={broadcasts} hasSprint={!!race?.sprint}/>
      ) : showSpoiler ? (
        <SpoilerCard onReveal={() => setRevealed(true)}><div className="h-64"/></SpoilerCard>
      ) : !data ? <PageLoader/> : (
        <div>
          {tab === 'race' && results.length >= 3 && <Podium results={results}/>}
          <div className="glass-card overflow-hidden mt-6">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-f1-muted uppercase tracking-wider border-b border-f1-border">
                  <th className="py-3 px-4 text-left w-12">Поз</th>
                  <th className="py-3 px-4 text-left">Пилот</th>
                  <th className="py-3 px-4 text-left hidden md:table-cell">Команда</th>
                  <th className="py-3 px-4 text-right">{tab==='race' ? 'Время' : 'Лучший круг'}</th>
                  {tab==='race' && <th className="py-3 px-4 text-right w-12 hidden sm:table-cell">Очки</th>}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const color = teamColor(r.team);
                  return (
                    <tr key={i} className="border-b border-f1-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-4"><span className={`font-black data-mono ${i<3?'text-white':'text-f1-muted'}`}>{r.position || i+1}</span></td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-6 rounded-full" style={{background:color}}/>
                          <DriverPhoto url={r.photo_url} size={28}/>
                          <span className="font-semibold text-sm">{r.name || r.driver}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-f1-secondary hidden md:table-cell">{r.team}</td>
                      <td className="py-2.5 px-4 text-right text-sm data-mono">
                        {tab==='race' ? (r.time || r.status || '') : (r.q3 || r.q2 || r.q1 || r.Q3 || r.Q2 || r.Q1 || '')}
                      </td>
                      {tab==='race' && <td className="py-2.5 px-4 text-right text-sm font-bold data-mono hidden sm:table-cell">{r.points || 0}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ==== NEWS PAGE ====
const NewsPage = ({ onArticleClick }) => {
  const [articles, setArticles] = useState(null);
  useEffect(() => { api.get('/api/news').then(d => setArticles(d?.posts || d?.articles || d || [])); }, []);
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Новости Ф-1</h1>
      {!articles ? <PageLoader/> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((a, i) => <NewsCard key={i} article={a} onClick={() => onArticleClick(a.url)}/>)}
        </div>
      )}
    </div>
  );
};

// ==== ARTICLE PAGE ====
const ArticlePage = ({ url, onBack }) => {
  const [article, setArticle] = useState(null);
  useEffect(() => { if(url) api.get('/api/news/article?url=' + encodeURIComponent(url)).then(setArticle); }, [url]);
  return (
    <div className="animate-fade-in max-w-3xl">
      <button onClick={onBack} className="text-f1-muted hover:text-white text-sm font-semibold mb-4 transition-colors">← Назад к новостям</button>
      {!article ? <PageLoader/> : (
        <div>
          {(article.image || article.photo) && <img src={article.image || article.photo} className="w-full rounded-2xl mb-6 max-h-96 object-cover" alt="" loading="lazy"/>}
          <h1 className="text-2xl font-black leading-tight mb-4">{article.title}</h1>
          <div className="text-f1-muted text-sm mb-6">{article.published || article.date_text} · {article.source}</div>
          <div className="text-f1-secondary leading-relaxed text-[15px] space-y-4" dangerouslySetInnerHTML={{__html: article.content || article.text || ''}}/>
        </div>
      )}
    </div>
  );
};

// ==== LIVE PAGE ====
const LivePage = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    const fetch_ = () => api.get('/api/live/dashboard').then(setData);
    fetch_();
    const iv = setInterval(fetch_, data?.session?.is_live ? 10000 : 30000);
    return () => clearInterval(iv);
  }, [data?.session?.is_live]);

  if (!data?.session) return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Live Timing</h1>
      <div className="glass-card p-12 text-center">
        <div className="flex justify-center gap-2 mb-4">
          {[0,1,2,3,4].map(i => <div key={i} className="w-4 h-4 rounded-full bg-f1-card border-2 border-f1-muted"/>)}
        </div>
        <div className="text-f1-muted text-lg font-semibold">Нет активной сессии</div>
        <div className="text-f1-muted text-sm mt-2">Данные появятся во время практики, квалификации или гонки</div>
      </div>
    </div>
  );

  const session = data.session;
  const positions = data.positions || [];
  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-black">Live Timing</h1>
        {session.is_live && <div className="w-2.5 h-2.5 rounded-full bg-f1-red animate-pulse-red"/>}
        <span className="text-f1-muted text-sm">{session.session_name || session.type}</span>
      </div>
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-f1-muted uppercase tracking-wider border-b border-f1-border">
              <th className="py-3 px-4 text-left w-12">Поз</th>
              <th className="py-3 px-4 text-left">Пилот</th>
              <th className="py-3 px-4 text-right hidden md:table-cell">Интервал</th>
              <th className="py-3 px-4 text-right">Время</th>
              <th className="py-3 px-4 text-center w-12 hidden sm:table-cell">Шина</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => {
              const color = teamColor(p.team);
              return (
                <tr key={i} className="border-b border-f1-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-4"><span className={`font-black data-mono ${i<3?'text-white':'text-f1-muted'}`}>{p.position || i+1}</span></td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 rounded-full" style={{background:color}}/>
                      <span className="font-semibold text-sm">{p.driver}</span>
                      <span className="text-xs text-f1-muted hidden lg:inline">{p.team}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right text-sm data-mono text-f1-secondary hidden md:table-cell">{p.interval || ''}</td>
                  <td className="py-2.5 px-4 text-right text-sm data-mono">{p.best_lap || p.last_lap || ''}</td>
                  <td className="py-2.5 px-4 text-center hidden sm:table-cell">{p.tyre && <TyreDot compound={p.tyre}/>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==== PREDICTIONS PAGE ====
const PredictionsPage = ({ user, onLogin }) => {
  const [avail, setAvail] = useState(null);
  const [myPredictions, setMyPredictions] = useState(null);
  const [podiumPicks, setPodiumPicks] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const refreshMine = () => api.get('/api/user/predictions').then(d => setMyPredictions(d?.predictions || []));

  useEffect(() => {
    if (!user) return;
    api.get('/api/predictions/available').then(d => { if (d) setAvail(d); });
    refreshMine();
  }, [user?.user_id || user?.id]);

  if (!user) return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Прогнозы</h1>
      <div className="glass-card p-12 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <div className="font-bold text-lg mb-2">Войдите, чтобы делать прогнозы</div>
        <div className="text-f1-muted text-sm mb-6">Угадывайте результаты гонок и соревнуйтесь с друзьями</div>
        <button onClick={onLogin} className="px-6 py-3 bg-f1-red text-white font-bold rounded-xl hover:bg-f1-red-dark transition-colors">Войти через Telegram</button>
      </div>
    </div>
  );

  if (!avail) return <PageLoader/>;

  if (!avail.available) return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Прогнозы</h1>
      <div className="glass-card p-12 text-center">
        <div className="text-4xl mb-4">⏳</div>
        <div className="font-bold text-lg mb-2">{avail.message || 'Прогнозы временно закрыты'}</div>
        {avail.race && <div className="text-f1-muted text-sm mt-2">Следующая гонка: {avail.race.name}</div>}
      </div>
    </div>
  );

  const race = avail.race || {};
  const drivers = avail.drivers || [];
  const types = avail.predictions || [];
  const driverByNum = Object.fromEntries(drivers.map(d => [d.driver_number, d]));

  const submit = async (type, value) => {
    setSubmitting(true);
    setMsg('');
    const res = await api.post('/api/predictions/make', {
      race_round: race.round, season: race.season || 2026,
      prediction_type: type, prediction_value: value,
    });
    if (res && !res.error) {
      setMsg('✓ Прогноз принят');
      if (type === 'podium') setPodiumPicks([]);
      refreshMine();
    } else {
      setMsg(res?.error || 'Ошибка');
    }
    setSubmitting(false);
    setTimeout(() => setMsg(''), 2500);
  };

  const togglePodium = (num) => {
    setPodiumPicks(p => {
      if (p.includes(num)) return p.filter(x => x !== num);
      if (p.length >= 3) return p;
      return [...p, num];
    });
  };

  const renderDriverGrid = (onClick, selectedNum, highlightMap) => (
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2">
      {drivers.map(d => {
        const isSel = selectedNum === d.driver_number;
        const idx = highlightMap ? highlightMap[d.driver_number] : null;
        return (
          <button key={d.driver_number} onClick={() => onClick(d.driver_number)} disabled={submitting}
            className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all disabled:opacity-50 ${isSel || idx ? 'ring-2 ring-f1-red bg-f1-red/10' : 'bg-f1-card hover:bg-f1-card-hover'}`}>
            {idx && <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-f1-red text-white text-[10px] font-black flex items-center justify-center">{idx}</div>}
            <div className="w-1 h-5 rounded-full" style={{background: d.team_color || '#666'}}/>
            <DriverPhoto url={d.photo_url} size={40}/>
            <span className="text-[10px] font-bold truncate w-full text-center">{d.code || d.name?.split(' ').pop()}</span>
          </button>
        );
      })}
    </div>
  );

  const existingByType = {};
  (myPredictions || []).filter(p => p.race_round === race.round).forEach(p => { existingByType[p.prediction_type] = p; });

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-1">Прогнозы</h1>
      <div className="text-f1-muted text-sm mb-6">{race.name} · Раунд {race.round}</div>
      {msg && <div className="mb-4 px-4 py-2 bg-f1-red/10 border border-f1-red/30 rounded-lg text-sm text-f1-red">{msg}</div>}

      <div className="space-y-4">
        {types.map(pt => {
          const existing = existingByType[pt.type];
          const done = pt.already_predicted || !!existing;
          const icon = pt.type==='winner'?'🏆':pt.type==='podium'?'🥇':pt.type==='fastest_lap'?'⚡':pt.type==='safety_car'?'🚗':'💥';
          return (
            <div key={pt.type} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{icon}</span>
                <span className="font-bold">{pt.label}</span>
                <span className="text-xs text-f1-muted ml-2">макс. {pt.max_points} очк.</span>
                {done && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded ml-auto font-bold">СДЕЛАН</span>}
              </div>
              <div className="text-xs text-f1-muted mb-4">{pt.description}</div>

              {done ? (
                <div className="text-sm text-f1-secondary bg-white/5 rounded-lg px-3 py-2">
                  Ваш выбор: <span className="font-bold text-white">{
                    pt.type === 'podium' && Array.isArray(existing?.prediction_value)
                      ? existing.prediction_value.map(n => driverByNum[n]?.code || n).join(' → ')
                      : pt.type === 'winner' || pt.type === 'fastest_lap'
                      ? (driverByNum[existing?.prediction_value]?.name || existing?.prediction_value)
                      : pt.type === 'safety_car'
                      ? (existing?.prediction_value === true || existing?.prediction_value === 'yes' ? 'Да' : 'Нет')
                      : String(existing?.prediction_value ?? '')
                  }</span>
                </div>
              ) : pt.type === 'safety_car' ? (
                <div className="flex gap-3">
                  {[['Да','yes'],['Нет','no']].map(([lbl,v]) => (
                    <button key={v} onClick={() => submit('safety_car', v)} disabled={submitting}
                      className="px-6 py-3 rounded-xl font-bold bg-f1-card hover:bg-f1-red hover:text-white transition-colors disabled:opacity-50">{lbl}</button>
                  ))}
                </div>
              ) : pt.type === 'dnf_count' ? (
                <div className="flex gap-2 flex-wrap">
                  {[0,1,2,3,4,5,6].map(n => (
                    <button key={n} onClick={() => submit('dnf_count', n)} disabled={submitting}
                      className="w-12 h-12 rounded-xl font-black text-lg bg-f1-card hover:bg-f1-red hover:text-white transition-colors disabled:opacity-50">{n}</button>
                  ))}
                </div>
              ) : pt.type === 'podium' ? (
                <div>
                  {renderDriverGrid(togglePodium, null, Object.fromEntries(podiumPicks.map((n,i) => [n, i+1])))}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-f1-muted">Выбрано {podiumPicks.length}/3 {podiumPicks.length > 0 && '— ' + podiumPicks.map(n => driverByNum[n]?.code || n).join(' → ')}</div>
                    <button onClick={() => submit('podium', podiumPicks)} disabled={submitting || podiumPicks.length !== 3}
                      className="px-5 py-2 rounded-lg bg-f1-red text-white font-bold text-sm disabled:bg-white/10 disabled:text-f1-muted">Подтвердить</button>
                  </div>
                </div>
              ) : (
                renderDriverGrid((n) => submit(pt.type, n), null, null)
              )}
            </div>
          );
        })}
      </div>

      {myPredictions && myPredictions.length > 0 && (
        <div className="mt-8">
          <div className="section-title">История прогнозов</div>
          <div className="space-y-4">
            {(() => {
              const grouped = {};
              myPredictions.filter(p => p.status !== 'pending').forEach(p => { (grouped[p.race_round] = grouped[p.race_round] || []).push(p); });
              const rounds = Object.keys(grouped).map(Number).sort((a,b) => b - a);
              const typeLabels = { winner:'Победитель', podium:'Подиум', fastest_lap:'Быстрый круг', safety_car:'Safety Car', dnf_count:'Сходы' };
              const typeIcons = { winner:'🏆', podium:'🥇', fastest_lap:'⚡', safety_car:'🚗', dnf_count:'💥' };
              return rounds.map(r => {
                const items = grouped[r];
                const raceName = items[0]?.race_name || '';
                const totalEarned = items.reduce((s,p) => s + (p.points_won ?? p.points_earned ?? 0), 0);
                const correctCount = items.filter(p => p.status === 'correct').length;
                return (
                  <div key={r} className="glass-card overflow-hidden">
                    <div className="px-5 py-3 bg-white/[0.03] border-b border-f1-border flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-f1-red/20 text-f1-red flex items-center justify-center font-black text-sm">R{r}</div>
                      <div className="flex-1">
                        <div className="font-bold text-sm">{raceName || 'Гран-при ' + r}</div>
                        <div className="text-[11px] text-f1-muted">{correctCount}/{items.length} угадано</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black data-mono text-lg" style={{color: totalEarned > 0 ? '#27F4D2' : '#8585a0'}}>{totalEarned}</div>
                        <div className="text-[10px] text-f1-muted">очков</div>
                      </div>
                    </div>
                    <div className="divide-y divide-f1-border/50">
                      {items.map((p, i) => {
                        const color = p.status === 'correct' ? '#27F4D2' : p.status === 'partial' ? '#FFD700' : p.status === 'incorrect' ? '#E10600' : '#8585a0';
                        const display = Array.isArray(p.prediction_value)
                          ? p.prediction_value.map(n => driverByNum[n]?.code || n).join(' → ')
                          : (p.prediction_type === 'safety_car'
                            ? (p.prediction_value === true || p.prediction_value === 'yes' ? 'Да' : 'Нет')
                            : (p.prediction_type === 'winner' || p.prediction_type === 'fastest_lap'
                              ? (driverByNum[p.prediction_value]?.name || p.prediction_value)
                              : String(p.prediction_value ?? '')));
                        return (
                          <div key={i} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                            <span className="text-base">{typeIcons[p.prediction_type] || '•'}</span>
                            <div className="text-f1-muted text-xs w-28 shrink-0 hidden sm:block">{typeLabels[p.prediction_type] || p.prediction_type}</div>
                            <div className="flex-1 font-semibold truncate">{display}</div>
                            <div className="font-black data-mono text-sm" style={{color}}>
                              {p.status === 'pending' ? '⏳' : (p.points_won ?? p.points_earned ?? 0) > 0 ? '+' + (p.points_won ?? p.points_earned) : '—'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

// ==== GAMES ====
const GameLeaderboard = ({ gameType, user, refreshKey, unit }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/api/games/leaderboard?game_type=' + gameType).then(d => { if (d) setData(d); });
  }, [gameType, refreshKey]);
  if (!data || !data.leaderboard?.length) return null;
  const medalColors = ['#FFD700','#C0C0C0','#CD7F32'];
  const uid = user?.user_id || user?.id;
  return (
    <div className="mt-6">
      {data.my_best && (
        <div className="glass-card p-4 mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-f1-muted">Ваш рекорд</span>
          <span className="text-2xl font-black data-mono" style={{color:'#27F4D2'}}>{unit === 's' ? (data.my_best/1000).toFixed(2) + 's' : data.my_best + ' мс'}</span>
        </div>
      )}
      <div className="section-title">Рейтинг рекордов</div>
      <div className="glass-card overflow-hidden">
        {data.leaderboard.map((row, i) => {
          const isMe = uid && row.user_id === uid;
          return (
            <div key={row.user_id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-f1-border/50 ${isMe ? 'bg-f1-red/10' : ''}`}>
              <div className="w-7 text-center font-black data-mono text-sm" style={{color: medalColors[i] || '#8585a0'}}>{row.rank}</div>
              <DriverPhoto url={row.photo_url} size={32} name={row.first_name}/>
              <div className="flex-1 font-semibold text-sm truncate">{row.first_name} {row.last_name || ''}{isMe && <span className="ml-2 text-[10px] text-f1-red font-bold">ВЫ</span>}</div>
              <div className="font-black data-mono text-sm">{unit === 's' ? (row.best_score/1000).toFixed(2) + 's' : row.best_score + ' мс'}</div>
              <div className="text-[10px] text-f1-muted w-12 text-right">{row.attempts} игр</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ReactionGame = ({ user, onBack }) => {
  const [phase, setPhase] = useState('ready');
  const [lightsOn, setLightsOn] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [reactionMs, setReactionMs] = useState(0);
  const [refreshLb, setRefreshLb] = useState(0);
  const timeoutRef = useRef(null);

  const startGame = () => {
    setPhase('lights');
    setLightsOn(0);
    let count = 0;
    const lightUp = () => {
      count++;
      setLightsOn(count);
      if (count < 5) timeoutRef.current = setTimeout(lightUp, 800 + Math.random()*400);
      else timeoutRef.current = setTimeout(() => { setPhase('go'); setStartTime(Date.now()); }, 500 + Math.random()*2500);
    };
    timeoutRef.current = setTimeout(lightUp, 500);
  };

  const handleClick = () => {
    if (phase === 'ready') { startGame(); return; }
    if (phase === 'lights') { clearTimeout(timeoutRef.current); setPhase('false_start'); return; }
    if (phase === 'go') {
      const ms = Date.now() - startTime;
      setReactionMs(ms);
      setPhase('result');
      if (user) api.post('/api/games/result', { game_type:'reaction', score:ms }).then(() => setRefreshLb(r => r+1));
    }
  };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  const reset = () => { setPhase('ready'); setLightsOn(0); };

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="text-f1-muted hover:text-white text-sm font-semibold mb-4 transition-colors">← Назад</button>
      <h1 className="text-2xl font-black mb-6">Реакция на старт</h1>
      <div className="glass-card p-8 text-center cursor-pointer select-none" onClick={handleClick}>
        <div className="flex justify-center gap-3 mb-8">
          {[1,2,3,4,5].map(i => (
            <div key={i} className={`w-10 h-10 rounded-full border-2 transition-all duration-200 ${lightsOn >= i && phase !== 'go' ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50' : phase === 'go' ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50' : 'bg-f1-card border-f1-muted'}`}/>
          ))}
        </div>
        {phase === 'ready' && <div className="text-xl font-bold">Нажмите чтобы начать</div>}
        {phase === 'lights' && <div className="text-xl font-bold text-red-400">Ждите...</div>}
        {phase === 'go' && <div className="text-3xl font-black text-green-400">ЖМИТЕ!</div>}
        {phase === 'false_start' && (
          <div>
            <div className="text-2xl font-black text-red-400 mb-2">Фальстарт!</div>
            <button onClick={reset} className="px-6 py-2 bg-f1-red text-white font-bold rounded-xl mt-4">Ещё раз</button>
          </div>
        )}
        {phase === 'result' && (
          <div>
            <div className="text-5xl font-black data-mono mb-2" style={{color: reactionMs < 200 ? '#27F4D2' : reactionMs < 300 ? '#FFD700' : '#FF8000'}}>{reactionMs} мс</div>
            <div className="text-f1-muted text-sm mb-4">{reactionMs < 150 ? 'Невероятно!' : reactionMs < 200 ? 'Отлично!' : reactionMs < 300 ? 'Хорошо!' : reactionMs < 500 ? 'Нормально' : 'Можно лучше'}</div>
            <button onClick={reset} className="px-6 py-2 bg-f1-red text-white font-bold rounded-xl">Ещё раз</button>
          </div>
        )}
      </div>
      <GameLeaderboard gameType="reaction" user={user} refreshKey={refreshLb} unit="ms"/>
    </div>
  );
};

const PitStopGame = ({ user, onBack }) => {
  const [phase, setPhase] = useState('ready');
  const [wheels, setWheels] = useState([0,0,0,0]);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [refreshLb, setRefreshLb] = useState(0);
  const ivRef = useRef(null);
  const labels = ['FL','FR','RL','RR'];
  const colors = ['#FF3333','#FFD700','#CCCCCC','#27F4D2'];
  const stepLabels = ['Открутить','Сменить','Закрутить'];

  const start = () => {
    setPhase('playing');
    setWheels([0,0,0,0]);
    setStartTime(Date.now());
    ivRef.current = setInterval(() => setElapsed(Date.now()), 50);
  };

  const tapWheel = (idx) => {
    if (phase !== 'playing') return;
    setWheels(w => {
      const nw = [...w];
      if (nw[idx] < 3) nw[idx]++;
      if (nw.every(v => v === 3)) {
        clearInterval(ivRef.current);
        setPhase('done');
        const ms = Date.now() - startTime;
        if (user) api.post('/api/games/result', { game_type:'pit_stop', score:ms }).then(() => setRefreshLb(r => r+1));
      }
      return nw;
    });
  };

  useEffect(() => () => clearInterval(ivRef.current), []);

  const time = phase === 'done' ? ((elapsed - startTime)/1000).toFixed(2) : phase === 'playing' ? ((Date.now() - startTime)/1000).toFixed(2) : '0.00';

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="text-f1-muted hover:text-white text-sm font-semibold mb-4 transition-colors">← Назад</button>
      <h1 className="text-2xl font-black mb-6">Пит-стоп</h1>
      <div className="glass-card p-8 text-center">
        <div className="text-4xl font-black data-mono mb-6">{time}s</div>
        {phase === 'ready' && <button onClick={start} className="px-8 py-3 bg-f1-red text-white font-black text-lg rounded-xl hover:bg-f1-red-dark transition-colors">СТАРТ</button>}
        {(phase === 'playing' || phase === 'done') && (
          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
            {wheels.map((step, idx) => (
              <button key={idx} onClick={() => tapWheel(idx)} disabled={step >= 3}
                className={`aspect-square rounded-2xl font-bold text-sm flex flex-col items-center justify-center gap-1 transition-all ${step >= 3 ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'bg-f1-card hover:bg-f1-card-hover border border-f1-border active:scale-95'}`}>
                <div className="w-8 h-8 rounded-full border-4 mb-1" style={{borderColor:colors[idx]}}/>
                <span className="font-black">{labels[idx]}</span>
                <span className="text-[10px] text-f1-muted">{step >= 3 ? '✓' : stepLabels[step]}</span>
              </button>
            ))}
          </div>
        )}
        {phase === 'done' && (
          <div className="mt-6">
            <div className="text-lg font-bold mb-2" style={{color: parseFloat(time) < 3 ? '#27F4D2' : parseFloat(time) < 5 ? '#FFD700' : '#FF8000'}}>
              {parseFloat(time) < 2.5 ? 'Red Bull уровень!' : parseFloat(time) < 4 ? 'Отлично!' : parseFloat(time) < 6 ? 'Хорошо!' : 'Тренируйся ещё!'}
            </div>
            <button onClick={() => { setPhase('ready'); setElapsed(0); }} className="px-6 py-2 bg-f1-red text-white font-bold rounded-xl">Ещё раз</button>
          </div>
        )}
      </div>
      <GameLeaderboard gameType="pit_stop" user={user} refreshKey={refreshLb} unit="s"/>
    </div>
  );
};

const GamesPage = ({ user, onLogin }) => {
  const [activeGame, setActiveGame] = useState(null);

  if (activeGame === 'reaction') return <ReactionGame user={user} onBack={() => setActiveGame(null)}/>;
  if (activeGame === 'pit_stop') return <PitStopGame user={user} onBack={() => setActiveGame(null)}/>;

  const games = [
    { id:'reaction', label:'Реакция на старт', desc:'Поймай зелёный свет!', icon:'🚦', color:'#27F4D2' },
    { id:'pit_stop', label:'Пит-стоп', desc:'Смени колёса быстрее всех!', icon:'🔧', color:'#FF3333' },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Игры</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {games.map(g => (
          <div key={g.id} onClick={() => setActiveGame(g.id)}
            className="glass-card-hover p-6 cursor-pointer">
            <div className="text-3xl mb-3">{g.icon}</div>
            <div className="font-black text-lg" style={{color:g.color}}>{g.label}</div>
            <div className="text-f1-muted text-sm mt-1">{g.desc}</div>
            <div className="text-f1-red font-bold text-sm mt-3">ИГРАТЬ →</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==== PROFILE PAGE ====
// ==== ADMIN: BROADCAST MANAGEMENT ====
const AdminBroadcastPanel = ({ schedule }) => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [form, setForm] = useState({ race_round:'', session_type:'race', video_url:'', title:'', is_live:false });
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const sessionLabels = { race:'Гонка', qualifying:'Квалификация', sprint:'Спринт', sprint_qualifying:'Спринт-квали', review:'Обзор' };
  const sessionOrder = ['race','qualifying','sprint','sprint_qualifying','review'];

  const load = () => api.get('/api/admin/broadcasts').then(d => { if (d?.broadcasts) setBroadcasts(d.broadcasts); });
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.race_round || !form.video_url) return;
    setSaving(true);
    await api.post('/api/admin/broadcast', { ...form, race_round: parseInt(form.race_round) });
    setForm({ race_round:'', session_type:'race', video_url:'', title:'', is_live:false });
    await load();
    setSaving(false);
  };
  const endLive = async (id) => { await api.post(`/api/admin/broadcast/${id}/end`); await load(); };
  const del = async (id) => {
    if (!confirm('Удалить трансляцию?')) return;
    const token = localStorage.getItem('f1hub_auth_token');
    await fetch(`/api/admin/broadcast/${id}`, { method:'DELETE', headers: token ? { 'Authorization': 'TgLogin ' + token } : {} });
    await load();
  };

  const grouped = {};
  broadcasts.forEach(b => { (grouped[b.race_round] ||= []).push(b); });
  const rounds = Object.keys(grouped).map(Number).sort((a,b) => b - a);
  const races = (schedule?.races || []).filter(r => r.round);

  return (
    <div className="glass-card p-6 mt-6">
      <div className="text-xs font-bold uppercase tracking-widest text-f1-red mb-4">📺 Управление трансляциями</div>

      <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-3">
        <select value={form.race_round} onChange={e => setForm(f => ({ ...f, race_round:e.target.value }))} className="w-full bg-f1-card border border-f1-border rounded-lg px-3 py-2 text-sm">
          <option value="">Выберите гран-при...</option>
          {races.map(r => <option key={r.round} value={r.round}>R{r.round} — {r.name}</option>)}
        </select>
        <div className="flex gap-2">
          {Object.entries(sessionLabels).map(([k,v]) => (
            <button key={k} onClick={() => setForm(f => ({ ...f, session_type:k }))}
              className={`flex-1 px-2 py-1.5 rounded-md text-xs font-bold transition-colors ${form.session_type===k ? 'bg-f1-red text-white' : 'bg-white/5 text-f1-muted hover:text-white'}`}>
              {v}
            </button>
          ))}
        </div>
        <input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url:e.target.value }))} placeholder="URL (YouTube / Rutube / VK)" className="w-full bg-f1-card border border-f1-border rounded-lg px-3 py-2 text-sm"/>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))} placeholder="Название (необязательно)" className="w-full bg-f1-card border border-f1-border rounded-lg px-3 py-2 text-sm"/>
        <label className="flex items-center gap-2 text-sm text-f1-secondary">
          <input type="checkbox" checked={form.is_live} onChange={e => setForm(f => ({ ...f, is_live:e.target.checked }))}/>
          Сейчас в эфире (Live)
        </label>
        <button onClick={save} disabled={saving || !form.race_round || !form.video_url}
          className="w-full py-2.5 rounded-lg bg-f1-red text-white font-bold text-sm disabled:bg-white/10 disabled:text-f1-muted">
          {saving ? 'Сохранение...' : 'Добавить / Обновить'}
        </button>
      </div>

      {rounds.length === 0 ? (
        <div className="text-center text-f1-muted text-sm py-3">Нет трансляций</div>
      ) : rounds.map(round => {
        const items = grouped[round];
        const raceName = races.find(r => r.round === round)?.name || ('Раунд ' + round);
        const hasLive = items.some(b => b.is_live);
        const filled = items.map(b => b.session_type);
        return (
          <div key={round} className="mb-2 bg-white/[0.03] border border-f1-border rounded-lg overflow-hidden">
            <div onClick={() => setExpanded(r => r === round ? null : round)} className="px-3 py-2.5 cursor-pointer flex items-center gap-2">
              {hasLive && <div className="w-1.5 h-1.5 rounded-full bg-f1-red animate-pulse-red"/>}
              <div className="flex-1 text-sm font-bold">R{round} · {raceName}</div>
              <div className="flex gap-1">
                {sessionOrder.map(s => {
                  const has = filled.includes(s);
                  const live = items.find(b => b.session_type === s && b.is_live);
                  return <div key={s} title={sessionLabels[s]} className={`w-2 h-2 rounded-full ${live ? 'bg-f1-red' : has ? 'bg-emerald-500' : 'bg-white/10'}`}/>;
                })}
              </div>
              <span className="text-[10px] text-f1-muted">{items.length}/{sessionOrder.length}</span>
              <span className="text-xs text-f1-muted">{expanded===round ? '▲' : '▼'}</span>
            </div>
            {expanded === round && (
              <div className="px-3 pb-2 border-t border-f1-border">
                {items.map(b => (
                  <div key={b.id} className="flex items-center gap-2 py-2 text-xs">
                    <span className="font-bold w-24 shrink-0">{sessionLabels[b.session_type] || b.session_type}</span>
                    <span className="flex-1 truncate text-f1-muted">{b.video_url}</span>
                    {b.is_live && <button onClick={() => endLive(b.id)} className="px-2 py-1 bg-white/10 rounded text-[10px]">Завершить</button>}
                    <button onClick={() => del(b.id)} className="px-2 py-1 bg-f1-red/20 text-f1-red rounded text-[10px]">Удалить</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ProfilePage = ({ user, schedule, onLogin, onLogout }) => {
  const [fullUser, setFullUser] = useState(user);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leaderboard, setLeaderboard] = useState(null);

  useEffect(() => {
    api.get('/api/leaderboard').then(d => setLeaderboard(d?.leaderboard || d?.users || []));
    if (!user) return;
    api.get('/api/user/me').then(u => { if (u) setFullUser(u); });
    api.get('/api/user/is-admin').then(d => setIsAdmin(!!d?.is_admin));
  }, [user?.user_id || user?.id]);

  if (!user) return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Профиль</h1>
      <div className="glass-card p-12 text-center">
        <div className="text-4xl mb-4">👤</div>
        <div className="font-bold text-lg mb-2">Войдите в аккаунт</div>
        <button onClick={onLogin} className="mt-4 px-6 py-3 bg-f1-red text-white font-bold rounded-xl hover:bg-f1-red-dark transition-colors">Войти через Telegram</button>
      </div>
    </div>
  );

  const u = fullUser || user;
  const correct = u.predictions_correct || 0;
  const total = u.predictions_total || 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) + '%' : '—';

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Профиль</h1>
      <div className="glass-card p-8">
        <div className="flex items-center gap-6 mb-8">
          <DriverPhoto url={u.photo_url} size={80} className="rounded-2xl"/>
          <div className="flex-1">
            <div className="text-xl font-black">{u.first_name} {u.last_name || ''}</div>
            {u.username && <div className="text-f1-muted text-sm">@{u.username}</div>}
            {isAdmin && <span className="inline-block mt-1 text-[10px] font-bold bg-f1-red/20 text-f1-red px-2 py-0.5 rounded uppercase tracking-wider">Администратор</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label:'Очки', value:u.points ?? 0 },
            { label:'Прогнозы', value:`${correct}/${total}` },
            { label:'Точность', value:accuracy },
            { label:'Ранг', value:u.rank ? '#' + u.rank : '—' },
            { label:'Стрик', value:u.streak || 0 },
            { label:'Макс. стрик', value:u.max_streak || 0 },
            { label:'Игр', value:u.games_played || 0 },
            { label:'Ачивки', value:`${u.achievements_count || 0}/${u.achievements_total || 0}` },
          ].map((s,i) => (
            <div key={i} className="glass-card p-4 text-center">
              <div className="text-2xl font-black data-mono">{s.value}</div>
              <div className="text-xs text-f1-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <button onClick={onLogout} className="text-sm text-f1-muted hover:text-f1-red transition-colors">Выйти из аккаунта</button>
      </div>
      {isAdmin && <AdminBroadcastPanel schedule={schedule}/>}

      {leaderboard && leaderboard.length > 0 && (
        <div className="mt-8">
          <div className="section-title">🏆 Таблица лидеров</div>
          <div className="glass-card overflow-hidden">
            {leaderboard.slice(0, 20).map((row, i) => {
              const pos = row.rank || i + 1;
              const isMe = (u.user_id || u.id) && (row.user_id === u.user_id || row.user_id === u.id);
              const medalColor = pos === 1 ? '#FFD700' : pos === 2 ? '#C0C0C0' : pos === 3 ? '#CD7F32' : null;
              return (
                <div key={row.user_id || i} className={`flex items-center gap-3 px-4 py-2.5 border-b border-f1-border/50 ${isMe ? 'bg-f1-red/10' : 'hover:bg-white/[0.02]'}`}>
                  <div className="w-8 text-center font-black data-mono" style={{color: medalColor || '#8585a0'}}>{pos}</div>
                  <DriverPhoto url={row.photo_url} size={32}/>
                  <div className="flex-1 font-semibold text-sm truncate">{row.first_name} {row.last_name || ''}{isMe && <span className="ml-2 text-[10px] text-f1-red font-bold">ВЫ</span>}</div>
                  <div className="font-black data-mono text-sm">{row.total_points ?? row.points ?? 0}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ==== LOGIN MODAL ====
const LoginModal = ({ onClose, onCodeLogin }) => {
  const [mode, setMode] = useState('choose'); // choose, widget, code
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (mode !== 'widget' || !containerRef.current) return;
    window.__onTelegramAuth = (tgUser) => {
      const params = new URLSearchParams();
      Object.keys(tgUser).forEach(k => params.set(k, tgUser[k]));
      localStorage.setItem('f1hub_auth_token', params.toString());
      window.location.reload();
    };
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'F1_egor_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', '__onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    containerRef.current.appendChild(script);
  }, [mode]);

  const submitCode = async () => {
    if (!code.trim()) return;
    setCodeSending(true);
    setCodeError('');
    const res = await api.post('/api/auth/code', { code: code.trim() });
    if (res?.token) {
      localStorage.setItem('f1hub_auth_token', res.token);
      window.location.reload();
    } else {
      setCodeError('Неверный код. Получите новый в боте @F1_egor_bot');
    }
    setCodeSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card p-8 max-w-sm w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
        <div className="text-2xl font-black mb-2">F1 <span className="text-f1-red">Hub</span></div>
        <div className="text-f1-muted text-sm mb-6">Войдите для полного доступа</div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <button onClick={() => { window.open('https://t.me/F1_egor_bot?start=code', '_blank'); setMode('code'); }}
              className="w-full px-5 py-3 bg-f1-red text-white font-bold rounded-xl hover:bg-f1-red-dark transition-colors">
              🔑 Получить код от бота
            </button>
            <button onClick={() => setMode('widget')}
              className="w-full px-5 py-3 bg-[#2AABEE] text-white font-bold rounded-xl hover:opacity-90 transition-colors">
              ✈️ Telegram Login Widget
            </button>
          </div>
        )}

        {mode === 'code' && (
          <div>
            <div className="text-f1-secondary text-sm mb-4">
              Бот <a href="https://t.me/F1_egor_bot?start=code" target="_blank" rel="noopener noreferrer" className="text-f1-red font-bold">@F1_egor_bot</a> отправил вам код. Нажмите <span className="font-mono bg-f1-card px-2 py-0.5 rounded">/code</span> если не получили.
            </div>
            <input type="text" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitCode()}
              placeholder="Введите 6-значный код" maxLength={6} inputMode="numeric"
              className="w-full px-4 py-3 bg-f1-card border border-f1-border rounded-xl text-center font-mono text-2xl tracking-[0.3em] focus:outline-none focus:border-f1-red transition-colors mb-3"/>
            {codeError && <div className="text-red-400 text-xs mb-3">{codeError}</div>}
            <button onClick={submitCode} disabled={codeSending || code.trim().length < 6}
              className="w-full px-5 py-3 bg-f1-red text-white font-bold rounded-xl hover:bg-f1-red-dark transition-colors disabled:opacity-50">
              {codeSending ? 'Проверка...' : 'Войти'}
            </button>
            <button onClick={() => setMode('choose')} className="mt-3 text-sm text-f1-muted hover:text-white transition-colors">← Другой способ</button>
          </div>
        )}

        {mode === 'widget' && (
          <div>
            <div ref={containerRef} className="flex justify-center mb-4"/>
            <button onClick={() => setMode('choose')} className="text-sm text-f1-muted hover:text-white transition-colors">← Другой способ</button>
          </div>
        )}

        <button onClick={onClose} className="block mx-auto mt-4 text-sm text-f1-muted hover:text-white transition-colors">Отмена</button>
      </div>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================
const App = () => {
  const [tab, setTab] = useState('home');
  const [season] = useState(2026);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [spoilerFree, setSpoilerFree] = useState(() => localStorage.getItem('f1hub_spoiler_free') === 'true');

  // Data
  const [nextRace, setNextRace] = useState(null);
  const [lastRace, setLastRace] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [driversStandings, setDriversStandings] = useState(null);
  const [constructorsStandings, setConstructorsStandings] = useState(null);
  const [seasonResults, setSeasonResults] = useState(null);
  const [news, setNews] = useState(null);

  const [selectedRound, setSelectedRound] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);

  const toggleSpoiler = () => {
    setSpoilerFree(v => {
      const nv = !v;
      localStorage.setItem('f1hub_spoiler_free', nv);
      return nv;
    });
  };

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('f1hub_auth_token');
      if (token) {
        const u = await api.get('/api/user/me');
        if (u) setUser(u);
        else localStorage.removeItem('f1hub_auth_token');
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const handler = () => { localStorage.removeItem('f1hub_auth_token'); setUser(null); };
    window.addEventListener('f1:auth-expired', handler);
    return () => window.removeEventListener('f1:auth-expired', handler);
  }, []);

  useEffect(() => {
    if (loading) return;
    Promise.all([
      api.get('/api/home?season=' + season),
      api.get('/api/standings/drivers?season=' + season),
      api.get('/api/standings/constructors?season=' + season),
      api.get('/api/schedule?season=' + season),
      api.get('/api/season/' + season + '/results'),
      api.get('/api/news'),
    ]).then(([home, ds, cs, sched, sr, n]) => {
      if (home) { setNextRace(home.next_race); setLastRace(home.last_race); }
      setDriversStandings(ds?.standings || ds);
      setConstructorsStandings(cs?.standings || cs);
      setSchedule(sched);
      setSeasonResults(sr);
      setNews(n?.posts || n?.articles || n || []);
    });
  }, [loading, season]);

  const navigate = (page, params) => {
    if (page === 'raceDetail') { setSelectedRound(params?.round); setTab('raceDetail'); }
    else if (page === 'article') { setSelectedArticle(params?.url); setTab('article'); }
    else setTab(page);
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
  };

  const logout = () => {
    localStorage.removeItem('f1hub_auth_token');
    setUser(null);
    setTab('home');
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl font-black mb-4">F1 <span className="text-f1-red">Hub</span></div>
        <div className="flex gap-1.5 justify-center">
          {[0,1,2,3,4].map(i => <div key={i} className="w-3 h-3 rounded-full bg-f1-red animate-pulse" style={{animationDelay:i*0.15+'s'}}/>)}
        </div>
      </div>
    </div>
  );

  const sidebarW = sidebarCollapsed ? 'md:pl-[68px]' : 'md:pl-[220px]';

  const renderPage = () => {
    switch(tab) {
      case 'home': return <DashboardPage nextRace={nextRace} lastRace={lastRace} standings={driversStandings} schedule={schedule} news={news} spoilerFree={spoilerFree} onNavigate={navigate}/>;
      case 'news': return <NewsPage onArticleClick={(url) => navigate('article', {url})}/>;
      case 'article': return <ArticlePage url={selectedArticle} onBack={() => setTab('news')}/>;
      case 'schedule': return <SchedulePage schedule={schedule} seasonResults={seasonResults} season={season} onRaceClick={(round) => navigate('raceDetail', {round})} spoilerFree={spoilerFree}/>;
      case 'raceDetail': return <RaceDetailPage race={[...(seasonResults?.races||[]), ...(schedule?.races||[])].find(r => String(r.round) === String(selectedRound))} season={season} onBack={() => setTab('schedule')} spoilerFree={spoilerFree}/>;
      case 'standings': return <StandingsPage driversStandings={driversStandings} constructorsStandings={constructorsStandings} season={season} spoilerFree={spoilerFree}/>;
      case 'predict': return <PredictionsPage user={user} onLogin={() => setShowLogin(true)} nextRace={nextRace}/>;
      case 'games': return <GamesPage user={user} onLogin={() => setShowLogin(true)}/>;
      case 'profile': return <ProfilePage user={user} schedule={schedule} onLogin={() => setShowLogin(true)} onLogout={logout}/>;
      default: return null;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar active={tab} onChange={(t) => { setTab(t); setSelectedRound(null); setSelectedArticle(null); }} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)}/>
      <div className={`flex-1 ${sidebarW} transition-all duration-300`}>
        <TopBar user={user} onLogin={() => setShowLogin(true)} onMenuToggle={() => { if (window.innerWidth < 768) setMobileMenuOpen(v => !v); else setSidebarCollapsed(!sidebarCollapsed); }} spoilerFree={spoilerFree} onToggleSpoiler={toggleSpoiler}/>
        <main className="h-[calc(100dvh-56px)] overflow-y-auto p-4 md:p-6 lg:p-8">
          {renderPage()}
        </main>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)}/>}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
