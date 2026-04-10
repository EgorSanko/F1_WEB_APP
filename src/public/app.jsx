// F1 Hub — Public Site (Desktop)
// Separate entry from webapp, desktop-first design with Tailwind
const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ==== CONSTANTS ====
const TEAM_COLORS = {
  'Red Bull':'#3671C6','Ferrari':'#E8002D','Mercedes':'#27F4D2','McLaren':'#FF8000',
  'Aston Martin':'#229971','Alpine':'#0093CC','Williams':'#64C4FF','RB':'#6692FF',
  'Kick Sauber':'#52E252','Haas':'#B6BABD',
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
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) { console.error('API GET ' + url + ':', err); return null; }
  },
  post: async (url, body) => {
    try {
      const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', ..._getAuthHeaders() }, body:JSON.stringify(body) });
      if (res.status === 401) { window.dispatchEvent(new CustomEvent('f1:auth-expired')); return null; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) { console.error('API POST ' + url + ':', err); return null; }
  }
};

// ==== HELPERS ====
const FLAG_MAP = {
  // circuit_ids
  albert_park:'au',shanghai:'cn',suzuka:'jp',miami:'us',villeneuve:'ca',monaco:'mc',
  catalunya:'es',red_bull_ring:'at',silverstone:'gb',spa:'be',hungaroring:'hu',
  zandvoort:'nl',monza:'it',madring:'es',baku:'az',marina_bay:'sg',americas:'us',
  rodriguez:'mx',interlagos:'br',vegas:'us',losail:'qa',yas_marina:'ae',
  bahrain:'bh',jeddah:'sa',sakhir:'bh',imola:'it',
  // country names
  australia:'au',japan:'jp',china:'cn',spain:'es',canada:'ca',austria:'at',
  great_britain:'gb',hungary:'hu',belgium:'be',netherlands:'nl',italy:'it',
  azerbaijan:'az',singapore:'sg',united_states:'us',mexico:'mx',brazil:'br',
  las_vegas:'us',qatar:'qa',abu_dhabi:'ae',saudi_arabia:'sa',emilia_romagna:'it',
  // ISO 2/3 letter codes
  us:'us',gb:'gb',ae:'ae',usa:'us',uk:'gb',uae:'ae',
  au:'au',cn:'cn',jp:'jp',ca:'ca',mc:'mc',es:'es',at:'at',be:'be',hu:'hu',
  nl:'nl',it:'it',az:'az',sg:'sg',mx:'mx',br:'br',qa:'qa',sa:'sa',bh:'bh',
  de:'de',fi:'fi',fr:'fr',dk:'dk',th:'th',ar:'ar',nz:'nz',pt:'pt',pl:'pl',
  se:'se',no:'no',il:'il',co:'co',in:'in',ch:'ch',ie:'ie',
  gbr:'gb',ned:'nl',ger:'de',fin:'fi',fra:'fr',den:'dk',tha:'th',arg:'ar',
  nzl:'nz',chn:'cn',jpn:'jp',mon:'mc',esp:'es',can:'ca',aus:'au',
  mex:'mx',bra:'br',aut:'at',bel:'be',hun:'hu',sgp:'sg',ita:'it',por:'pt',pol:'pl',
  swe:'se',nor:'no',isr:'il',col:'co',ind:'in',rus:'ru',che:'ch',aze:'az',
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
    : <span className="text-xl">🏁</span>;
};
const fmtDate = (d) => { if(!d) return ''; const dt=new Date(d); return dt.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}); };
const fmtTime = (s) => { if(s==null) return '—'; const m=Math.floor(s/60); const sec=(s%60).toFixed(3); return m>0?m+':'+sec.padStart(6,'0'):sec; };

// ==== ICONS (inline SVG) ====
const IconHome = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg>;
const IconLive = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14"/></svg>;
const IconNews = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>;
const IconCalendar = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconTrophy = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 9H4.5a2.5 2.5 0 010-5H6m12 5h1.5a2.5 2.5 0 000-5H18M6 9v7a4 4 0 004 4h4a4 4 0 004-4V9M6 9h12M9 21h6"/></svg>;
const IconPredict = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>;
const IconUser = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>;
const IconGame = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const IconChevron = ({dir='right'}) => <svg className={`w-4 h-4 transition-transform ${dir==='down'?'rotate-90':''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>;
const IconMenu = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>;
const IconX = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>;

// ==== COUNTDOWN HOOK ====
const useCountdown = (targetDate) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  if (!targetDate) return { days:0, hours:0, minutes:0, seconds:0 };
  // Handle both ISO and separate date+time formats
  let target;
  if (typeof targetDate === 'string' && targetDate.includes('T')) target = new Date(targetDate);
  else target = new Date(targetDate);
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  return { days: Math.floor(diff/86400), hours: Math.floor((diff%86400)/3600), minutes: Math.floor((diff%3600)/60), seconds: diff%60 };
};

// ==== SIDEBAR ====
const Sidebar = ({ active, onChange, collapsed, onToggle }) => {
  const links = [
    { id:'home', icon:<IconHome/>, label:'Dashboard' },
    { id:'live', icon:<IconLive/>, label:'Live Timing' },
    { id:'news', icon:<IconNews/>, label:'Новости' },
    { id:'schedule', icon:<IconCalendar/>, label:'Календарь' },
    { id:'standings', icon:<IconTrophy/>, label:'Чемпионат' },
    { id:'predict', icon:<IconPredict/>, label:'Прогнозы' },
    { id:'games', icon:<IconGame/>, label:'Игры' },
    { id:'profile', icon:<IconUser/>, label:'Профиль' },
  ];
  return (
    <aside className={`fixed left-0 top-0 h-full z-40 bg-f1-surface/95 backdrop-blur-2xl border-r border-f1-border flex flex-col transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[220px]'}`}>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-f1-border flex-shrink-0">
        <div className="w-8 h-8 bg-f1-red rounded-lg flex items-center justify-center font-black text-sm text-white flex-shrink-0">F1</div>
        {!collapsed && <span className="font-black text-lg tracking-tight">Hub</span>}
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {links.map(l => (
          <button key={l.id} onClick={() => onChange(l.id)}
            className={`w-full sidebar-link ${active===l.id ? 'sidebar-link-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? l.label : undefined}>
            <span className="flex-shrink-0">{l.icon}</span>
            {!collapsed && <span>{l.label}</span>}
          </button>
        ))}
      </nav>
      <button onClick={onToggle} aria-label="Свернуть меню" className="px-4 py-4 border-t border-f1-border text-f1-muted hover:text-white transition-colors">
        <svg className={`w-5 h-5 mx-auto transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
      </button>
    </aside>
  );
};

// ==== TOP BAR ====
const TopBar = ({ user, onLogin, onMenuToggle }) => (
  <header className="sticky top-0 z-30 h-14 bg-f1-bg/80 backdrop-blur-xl border-b border-f1-border flex items-center justify-between px-6">
    <button onClick={onMenuToggle} aria-label="Меню" className="lg:hidden text-f1-muted hover:text-white mr-4">
      <IconMenu/>
    </button>
    <div className="flex-1"/>
    {user ? (
      <div className="flex items-center gap-3">
        {user.photo_url && <img src={user.photo_url} className="w-8 h-8 rounded-full object-cover" alt="" width="32" height="32" loading="lazy"/>}
        <span className="text-sm font-semibold hidden sm:inline">{user.first_name}</span>
      </div>
    ) : (
      <button onClick={onLogin} className="text-sm font-semibold text-f1-red hover:text-white transition-colors">
        Войти через Telegram
      </button>
    )}
  </header>
);

// ==== LOADING ====
const Skeleton = ({className=''}) => <div className={`animate-pulse bg-f1-card rounded-xl ${className}`}/>;
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex gap-1.5">
      {[0,1,2,3,4].map(i => (
        <div key={i} className="w-3 h-3 rounded-full bg-f1-red" style={{animation:`pulseLight 1.2s ease-in-out ${i*0.15}s infinite`}}/>
      ))}
    </div>
  </div>
);

// ==== COUNTDOWN BLOCK ====
const CountdownBlock = ({ value, label }) => (
  <div className="glass-card text-center px-3 py-3 min-w-[72px]">
    <div className="text-3xl font-black data-mono bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent leading-none">
      {String(value).padStart(2,'0')}
    </div>
    <div className="text-[10px] font-bold uppercase tracking-widest text-f1-muted mt-1">{label}</div>
  </div>
);

// ==== DRIVER ROW ====
const DriverRow = ({ pos, driver, team, points, maxPts, onClick }) => {
  const color = teamColor(team);
  return (
    <div onClick={onClick} className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer group">
      <div className="w-8 text-center">
        <span className={`font-black text-base data-mono ${pos<=3 ? 'text-white' : 'text-f1-muted'}`}>{pos}</span>
      </div>
      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{background:color}}/>
      {driver?.photo_url ? (
        <img src={driver.photo_url} className="w-9 h-9 rounded-full object-cover bg-f1-card flex-shrink-0" alt="" width="36" height="36" loading="lazy"/>
      ) : (
        <div className="w-9 h-9 rounded-full bg-f1-card flex-shrink-0"/>
      )}
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

// ==== RACE CARD ====
const RaceCard = ({ race, isNext, isPast, onClick }) => {
  return (
    <div onClick={onClick}
      className={`glass-card-hover p-5 cursor-pointer relative overflow-hidden ${isNext ? 'ring-1 ring-f1-red/40 shadow-lg shadow-f1-red/10' : ''}`}>
      {isNext && <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-f1-red text-white px-2 py-0.5 rounded-md">Следующая</div>}
      <div className="flex items-start gap-4">
        <FlagImg code={race?.circuit_id || race?.country_code || race?.Circuit?.circuitId} size="w-10 h-7"/>
        <div className="flex-1 min-w-0">
          <div className="font-black text-base leading-tight">{race?.name || race?.raceName}</div>
          <div className="text-f1-muted text-xs mt-1">{race?.circuit || race?.Circuit?.circuitName}</div>
          <div className="text-f1-secondary text-xs mt-2 data-mono">
            {fmtDate(race?.date)} {race?.time ? '· ' + race.time.slice(0,5) + ' МСК' : ''}
          </div>
        </div>
        <div className="text-f1-muted flex-shrink-0 self-center">
          <span className="font-black text-2xl data-mono text-f1-card-hover">R{race?.round}</span>
        </div>
      </div>
      {isPast && race?.results?.[0] && (
        <div className="mt-3 pt-3 border-t border-f1-border flex items-center gap-2 text-xs">
          <span className="text-yellow-400">🏆</span>
          <span className="font-semibold">{race.results[0].name || race.results[0].driver}</span>
        </div>
      )}
    </div>
  );
};

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
  const order = [1, 0, 2]; // P2, P1, P3
  const heights = ['h-28', 'h-36', 'h-20'];
  const labels = ['2nd', '1st', '3rd'];
  return (
    <div className="flex items-end justify-center gap-3 mt-6">
      {order.map((idx, i) => {
        const r = results[idx];
        const color = teamColor(r?.team);
        return (
          <div key={i} className="flex flex-col items-center animate-fade-up" style={{animationDelay:`${i*0.1}s`}}>
            <div className="mb-2"><FlagImg code={r?.nationality || r?.country || r?.country_code} size="w-8 h-6"/></div>
            <div className="font-black text-sm">{r?.name || r?.last_name}</div>
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

// ==== TYRE DOT ====
const TyreDot = ({ compound }) => {
  const colors = { SOFT:'#FF3333', MEDIUM:'#FFD700', HARD:'#CCCCCC', INTERMEDIATE:'#39B54A', WET:'#0067FF' };
  return <span className="inline-block w-3.5 h-3.5 rounded-full border-2 flex-shrink-0" style={{borderColor:colors[compound]||'#666'}}/>;
};

// ============================================================
// PAGES
// ============================================================

// ==== DASHBOARD ====
const DashboardPage = ({ nextRace, lastRace, standings, schedule, seasonResults, news, onNavigate }) => {
  const cd = useCountdown(nextRace?.race_datetime || nextRace?.date);
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero — Next Race */}
      {nextRace && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-f1-card via-f1-surface to-f1-bg border border-f1-border p-8 animate-glow">
          <div className="absolute top-0 right-0 w-64 h-64 bg-f1-red/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"/>
          <div className="relative">
            <div className="section-title">Следующий Гран-При</div>
            <div className="flex items-start gap-4 mb-6">
              <FlagImg code={nextRace.circuit_id || nextRace.country_code} size="w-14 h-10"/>
              <div>
                <h1 className="text-2xl font-black leading-tight">{nextRace.name}</h1>
                <div className="text-f1-secondary text-sm mt-1">{nextRace.circuit} · Раунд {nextRace.round}</div>
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
        </div>
      </div>

      {/* Last Race Result */}
      {lastRace && (
        <div>
          <div className="section-title">Последний результат · {lastRace.name}</div>
          <div className="glass-card p-6">
            <Podium results={lastRace.results}/>
            <div className="mt-6 space-y-0">
              {(lastRace.results || []).slice(0, 10).map((r, i) => (
                <div key={i} className="flex items-center gap-4 py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <span className={`w-7 text-center font-black text-sm data-mono ${i<3?'text-white':'text-f1-muted'}`}>{r.position || i+1}</span>
                  <div className="w-1 h-6 rounded-full flex-shrink-0" style={{background:teamColor(r.team)}}/>
                  <span className="flex-1 text-sm font-semibold">{r.name}</span>
                  <span className="text-xs text-f1-muted data-mono">{r.team}</span>
                  <span className="text-xs data-mono w-20 text-right">{r.time || (i===0 ? 'Winner' : '')}</span>
                  <span className="text-xs font-bold data-mono w-8 text-right text-f1-secondary">{r.points || 0}</span>
                </div>
              ))}
            </div>
          </div>
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
const StandingsPage = ({ driversStandings, constructorsStandings, season }) => {
  const [tab, setTab] = useState('drivers');
  const drivers = Array.isArray(driversStandings) ? driversStandings : (driversStandings?.standings || []);
  const constructors = Array.isArray(constructorsStandings) ? constructorsStandings : (constructorsStandings?.standings || []);
  const maxPts = drivers[0]?.points || 1;

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Чемпионат {season}</h1>
      <div className="flex gap-1 bg-f1-card rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => setTab('drivers')} className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab==='drivers'?'bg-f1-red text-white':'text-f1-muted hover:text-white'}`}>Пилоты</button>
        <button onClick={() => setTab('constructors')} className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab==='constructors'?'bg-f1-red text-white':'text-f1-muted hover:text-white'}`}>Команды</button>
      </div>

      {tab === 'drivers' ? (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-f1-muted uppercase tracking-wider border-b border-f1-border">
                <th className="py-3 px-4 text-left w-12">#</th>
                <th className="py-3 px-4 text-left">Пилот</th>
                <th className="py-3 px-4 text-left hidden md:table-cell">Команда</th>
                <th className="py-3 px-4 text-right w-20">Очки</th>
                <th className="py-3 px-4 text-right w-32 hidden lg:table-cell">Прогресс</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => {
                const color = teamColor(d.team);
                return (
                  <tr key={i} className="border-b border-f1-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <span className={`font-black data-mono ${i<3?'text-white':'text-f1-muted'}`}>{i+1}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-8 rounded-full flex-shrink-0" style={{background:color}}/>
                        <div>
                          <div className="font-bold text-sm">{d.name || d.last_name}</div>
                          <div className="text-xs text-f1-muted md:hidden">{d.team}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-f1-secondary hidden md:table-cell">{d.team}</td>
                    <td className="py-3 px-4 text-right font-black data-mono">{d.points}</td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <div className="w-full h-2 bg-f1-bg rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000" style={{width:`${(d.points/maxPts)*100}%`, background:color}}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-f1-muted uppercase tracking-wider border-b border-f1-border">
                <th className="py-3 px-4 text-left w-12">#</th>
                <th className="py-3 px-4 text-left">Команда</th>
                <th className="py-3 px-4 text-right w-20">Очки</th>
              </tr>
            </thead>
            <tbody>
              {constructors.map((c, i) => {
                const color = teamColor(c.name);
                return (
                  <tr key={i} className="border-b border-f1-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4"><span className={`font-black data-mono ${i<3?'text-white':'text-f1-muted'}`}>{i+1}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-8 rounded-full flex-shrink-0" style={{background:color}}/>
                        <span className="font-bold text-sm">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-black data-mono">{c.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ==== SCHEDULE ====
const SchedulePage = ({ schedule, seasonResults, season, onRaceClick }) => {
  const races = schedule?.races || seasonResults?.races || [];
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Календарь {season}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {races.map(r => (
          <RaceCard key={r.round} race={r} isPast={r.is_past} isNext={r.is_next}
            onClick={() => onRaceClick(r.round)}/>
        ))}
      </div>
    </div>
  );
};

// ==== RACE DETAIL ====
const RaceDetailPage = ({ race, season, onBack }) => {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('race');
  useEffect(() => {
    if (!race?.round) return;
    Promise.all([
      api.get('/api/race/' + race.round + '/results?season=' + season),
      api.get('/api/race/' + race.round + '/qualifying?season=' + season),
      api.get('/api/race/' + race.round + '/pitstops?season=' + season),
    ]).then(([res, qual, pits]) => setData({ results: res, qualifying: qual, pitstops: pits }));
  }, [race?.round, season]);

  const results = tab === 'race' ? (data?.results?.results || data?.results) : (data?.qualifying?.results || data?.qualifying);

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="text-f1-muted hover:text-white text-sm font-semibold mb-4 transition-colors">← Назад к календарю</button>
      <div className="flex items-center gap-4 mb-6">
        <FlagImg code={race?.circuit_id || race?.country_code} size="w-12 h-9"/>
        <div>
          <h1 className="text-2xl font-black">{race?.name || race?.raceName}</h1>
          <div className="text-f1-muted text-sm">{race?.circuit} · Раунд {race?.round}</div>
        </div>
      </div>

      <div className="flex gap-1 bg-f1-card rounded-xl p-1 mb-6 w-fit">
        {['race','qualifying','pitstops'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${tab===t?'bg-f1-red text-white':'text-f1-muted hover:text-white'}`}>
            {t === 'race' ? 'Гонка' : t === 'qualifying' ? 'Квалификация' : 'Пит-стопы'}
          </button>
        ))}
      </div>

      {!data ? <PageLoader/> : tab === 'pitstops' ? (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-f1-muted uppercase tracking-wider border-b border-f1-border">
                <th className="py-3 px-4 text-left">Пилот</th>
                <th className="py-3 px-4 text-right">Круг</th>
                <th className="py-3 px-4 text-right">Время</th>
                <th className="py-3 px-4 text-right">Стоп</th>
              </tr>
            </thead>
            <tbody>
              {(data?.pitstops?.pit_stops || []).map((p, i) => (
                <tr key={i} className="border-b border-f1-border/50">
                  <td className="py-2 px-4 text-sm font-semibold">{p.driver}</td>
                  <td className="py-2 px-4 text-sm data-mono text-right">{p.lap}</td>
                  <td className="py-2 px-4 text-sm data-mono text-right">{p.duration}s</td>
                  <td className="py-2 px-4 text-sm data-mono text-right">#{p.stop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-f1-muted uppercase tracking-wider border-b border-f1-border">
                <th className="py-3 px-4 text-left w-12">Поз</th>
                <th className="py-3 px-4 text-left">Пилот</th>
                <th className="py-3 px-4 text-left hidden md:table-cell">Команда</th>
                <th className="py-3 px-4 text-right">{tab==='race' ? 'Время/Интервал' : 'Лучший круг'}</th>
                {tab==='race' && <th className="py-3 px-4 text-right w-12 hidden sm:table-cell">Очки</th>}
              </tr>
            </thead>
            <tbody>
              {(results || []).map((r, i) => {
                const color = teamColor(r.team);
                return (
                  <tr key={i} className="border-b border-f1-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-4">
                      <span className={`font-black data-mono ${i<3?'text-white':'text-f1-muted'}`}>{r.position || i+1}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-6 rounded-full" style={{background:color}}/>
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
          {articles.map((a, i) => (
            <NewsCard key={i} article={a} onClick={() => onArticleClick(a.url)}/>
          ))}
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
          {article.image && <img src={article.image} className="w-full rounded-2xl mb-6 max-h-96 object-cover" alt="" width="800" height="400" loading="lazy"/>}
          <h1 className="text-2xl font-black leading-tight mb-4">{article.title}</h1>
          <div className="text-f1-muted text-sm mb-6">{article.published} · {article.source}</div>
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
  const [predictions, setPredictions] = useState(null);
  useEffect(() => { if(user) api.get('/api/predictions/active').then(setPredictions); }, [user]);

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

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Прогнозы</h1>
      {!predictions ? <PageLoader/> : (
        <div className="glass-card p-6">
          <div className="text-f1-muted text-sm">Активные прогнозы и лидерборд будут здесь</div>
        </div>
      )}
    </div>
  );
};

// ==== GAMES PAGE ====
const GamesPage = ({ user, onLogin }) => {
  if (!user) return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Игры</h1>
      <div className="glass-card p-12 text-center">
        <div className="text-4xl mb-4">🎮</div>
        <div className="font-bold text-lg mb-2">Войдите, чтобы играть</div>
        <button onClick={onLogin} className="mt-4 px-6 py-3 bg-f1-red text-white font-bold rounded-xl hover:bg-f1-red-dark transition-colors">Войти через Telegram</button>
      </div>
    </div>
  );
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Игры</h1>
      <div className="glass-card p-6 text-f1-muted text-sm">Мини-игры доступны в Telegram WebApp</div>
    </div>
  );
};

// ==== PROFILE PAGE ====
const ProfilePage = ({ user, onLogin }) => {
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
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-black mb-6">Профиль</h1>
      <div className="glass-card p-8">
        <div className="flex items-center gap-6 mb-8">
          {user.photo_url ? (
            <img src={user.photo_url} className="w-20 h-20 rounded-2xl object-cover" alt="" width="80" height="80" loading="lazy"/>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-f1-card flex items-center justify-center text-3xl">👤</div>
          )}
          <div>
            <div className="text-xl font-black">{user.first_name} {user.last_name || ''}</div>
            {user.username && <div className="text-f1-muted text-sm">@{user.username}</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label:'Очки', value:user.points || 0 },
            { label:'Прогнозы', value:user.predictions_count || 0 },
            { label:'Точность', value:(user.accuracy ? user.accuracy+'%' : '—') },
            { label:'Ранг', value:user.rank || '—' },
          ].map((s,i) => (
            <div key={i} className="glass-card p-4 text-center">
              <div className="text-2xl font-black data-mono">{s.value}</div>
              <div className="text-xs text-f1-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==== LOGIN MODAL ====
const LoginModal = ({ onClose }) => {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
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
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="glass-card p-8 max-w-sm w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
        <div className="text-2xl font-black mb-2">F1 <span className="text-f1-red">Hub</span></div>
        <div className="text-f1-muted text-sm mb-6">Войдите через Telegram для полного доступа</div>
        <div ref={containerRef} className="flex justify-center mb-4"/>
        <button onClick={onClose} className="text-sm text-f1-muted hover:text-white transition-colors">Отмена</button>
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
  const [showLogin, setShowLogin] = useState(false);

  // Data
  const [nextRace, setNextRace] = useState(null);
  const [lastRace, setLastRace] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [driversStandings, setDriversStandings] = useState(null);
  const [constructorsStandings, setConstructorsStandings] = useState(null);
  const [seasonResults, setSeasonResults] = useState(null);
  const [news, setNews] = useState(null);

  // Sub-page state
  const [selectedRound, setSelectedRound] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Auth
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

  // Load data
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
    window.scrollTo(0, 0);
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

  const sidebarW = sidebarCollapsed ? 'pl-[68px]' : 'pl-[220px]';

  const renderPage = () => {
    switch(tab) {
      case 'home': return <DashboardPage nextRace={nextRace} lastRace={lastRace} standings={driversStandings} schedule={schedule} seasonResults={seasonResults} news={news} onNavigate={navigate}/>;
      case 'live': return <LivePage/>;
      case 'news': return <NewsPage onArticleClick={(url) => navigate('article', {url})}/>;
      case 'article': return <ArticlePage url={selectedArticle} onBack={() => setTab('news')}/>;
      case 'schedule': return <SchedulePage schedule={schedule} seasonResults={seasonResults} season={season} onRaceClick={(round) => navigate('raceDetail', {round})}/>;
      case 'raceDetail': return <RaceDetailPage race={[...(seasonResults?.races||[]), ...(schedule?.races||[])].find(r => String(r.round) === String(selectedRound))} season={season} onBack={() => setTab('schedule')}/>;
      case 'standings': return <StandingsPage driversStandings={driversStandings} constructorsStandings={constructorsStandings} season={season}/>;
      case 'predict': return <PredictionsPage user={user} onLogin={() => setShowLogin(true)}/>;
      case 'games': return <GamesPage user={user} onLogin={() => setShowLogin(true)}/>;
      case 'profile': return <ProfilePage user={user} onLogin={() => setShowLogin(true)}/>;
      default: return null;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar active={tab} onChange={(t) => { setTab(t); setSelectedRound(null); setSelectedArticle(null); }} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}/>
      <div className={`flex-1 ${sidebarW} transition-all duration-300`}>
        <TopBar user={user} onLogin={() => setShowLogin(true)} onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}/>
        <main className="h-[calc(100dvh-56px)] overflow-y-auto p-6 lg:p-8">
          {renderPage()}
        </main>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)}/>}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
