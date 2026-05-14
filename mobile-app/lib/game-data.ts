/**
 * Shared static data for the games.
 * Ported from web /opt/f1-hub/src/public/v2/app.jsx (F1_CARDS,
 * REACTION_FACTS, STAT_LABELS). Updated for 2026 where applicable.
 */

export type GameStat = 'speed' | 'racecraft' | 'experience' | 'wins' | 'points';

export const STAT_LABELS: Record<GameStat, { label: string; icon: string }> = {
  speed: { label: 'Скорость', icon: '⚡' },
  racecraft: { label: 'Мастерство', icon: '🏎️' },
  experience: { label: 'Опыт', icon: '📅' },
  wins: { label: 'Победы', icon: '🏆' },
  points: { label: 'Очки', icon: '🔢' },
};

export type GameDriver = {
  name: string;
  code: string;
  number: number;
  team: string;
  teamColor: string;
  country: string; // emoji
  photo: string;
  stats: Record<GameStat, number>;
};

export const F1_CARDS: GameDriver[] = [
  { name: 'Макс Ферстаппен', code: 'VER', number: 1, team: 'Red Bull Racing', teamColor: '#3671C6', country: '🇳🇱', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/verstappen.jpg.img.640.medium.jpg/1738086499498.jpg', stats: { speed: 98, racecraft: 97, experience: 85, wins: 63, points: 437 } },
  { name: 'Льюис Хэмилтон', code: 'HAM', number: 44, team: 'Ferrari', teamColor: '#E8002D', country: '🇬🇧', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/hamilton.jpg.img.640.medium.jpg/1738086522tried.jpg', stats: { speed: 93, racecraft: 96, experience: 100, wins: 105, points: 198 } },
  { name: 'Шарль Леклер', code: 'LEC', number: 16, team: 'Ferrari', teamColor: '#E8002D', country: '🇲🇨', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/leclerc.jpg.img.640.medium.jpg/1738086534424.jpg', stats: { speed: 95, racecraft: 90, experience: 70, wins: 8, points: 280 } },
  { name: 'Ландо Норрис', code: 'NOR', number: 4, team: 'McLaren', teamColor: '#FF8000', country: '🇬🇧', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/norris.jpg.img.640.medium.jpg/1738086505498.jpg', stats: { speed: 94, racecraft: 89, experience: 65, wins: 4, points: 350 } },
  { name: 'Оскар Пиастри', code: 'PIA', number: 81, team: 'McLaren', teamColor: '#FF8000', country: '🇦🇺', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/piastri.jpg.img.640.medium.jpg/1738086516198.jpg', stats: { speed: 91, racecraft: 86, experience: 40, wins: 3, points: 268 } },
  { name: 'Карлос Сайнс', code: 'SAI', number: 55, team: 'Williams', teamColor: '#64C4FF', country: '🇪🇸', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/sainz.jpg.img.640.medium.jpg/1738086546752.jpg', stats: { speed: 89, racecraft: 88, experience: 75, wins: 4, points: 120 } },
  { name: 'Джордж Расселл', code: 'RUS', number: 63, team: 'Mercedes', teamColor: '#27F4D2', country: '🇬🇧', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/russell.jpg.img.640.medium.jpg/1738086527564.jpg', stats: { speed: 92, racecraft: 87, experience: 60, wins: 3, points: 195 } },
  { name: 'Кими Антонелли', code: 'ANT', number: 12, team: 'Mercedes', teamColor: '#27F4D2', country: '🇮🇹', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/antonelli.jpg.img.640.medium.jpg/1738086593898.jpg', stats: { speed: 88, racecraft: 78, experience: 15, wins: 0, points: 95 } },
  { name: 'Фернандо Алонсо', code: 'ALO', number: 14, team: 'Aston Martin', teamColor: '#229971', country: '🇪🇸', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/alonso.jpg.img.640.medium.jpg/1738086558245.jpg', stats: { speed: 85, racecraft: 95, experience: 100, wins: 32, points: 65 } },
  { name: 'Лэнс Стролл', code: 'STR', number: 18, team: 'Aston Martin', teamColor: '#229971', country: '🇨🇦', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/stroll.jpg.img.640.medium.jpg/1738086563648.jpg', stats: { speed: 78, racecraft: 72, experience: 65, wins: 0, points: 30 } },
  { name: 'Юки Цунода', code: 'TSU', number: 22, team: 'Red Bull Racing', teamColor: '#3671C6', country: '🇯🇵', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/tsunoda.jpg.img.640.medium.jpg/1738086573898.jpg', stats: { speed: 87, racecraft: 82, experience: 55, wins: 0, points: 105 } },
  { name: 'Пьер Гасли', code: 'GAS', number: 10, team: 'Alpine', teamColor: '#0093CC', country: '🇫🇷', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/gasly.jpg.img.640.medium.jpg/1738086580148.jpg', stats: { speed: 86, racecraft: 83, experience: 70, wins: 1, points: 52 } },
  { name: 'Эстебан Окон', code: 'OCO', number: 31, team: 'Haas', teamColor: '#B6BABD', country: '🇫🇷', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/ocon.jpg.img.640.medium.jpg/1738086587248.jpg', stats: { speed: 83, racecraft: 80, experience: 68, wins: 1, points: 38 } },
  { name: 'Александр Албон', code: 'ALB', number: 23, team: 'Williams', teamColor: '#64C4FF', country: '🇹🇭', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/albon.jpg.img.640.medium.jpg/1738086540298.jpg', stats: { speed: 84, racecraft: 82, experience: 58, wins: 0, points: 42 } },
  { name: 'Нико Хюлькенберг', code: 'HUL', number: 27, team: 'Sauber', teamColor: '#52E252', country: '🇩🇪', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/hulkenberg.jpg.img.640.medium.jpg/1738086599898.jpg', stats: { speed: 82, racecraft: 84, experience: 82, wins: 0, points: 28 } },
  { name: 'Лиам Лоусон', code: 'LAW', number: 30, team: 'Racing Bulls', teamColor: '#6692FF', country: '🇳🇿', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/lawson.jpg.img.640.medium.jpg/1738086569348.jpg', stats: { speed: 85, racecraft: 79, experience: 30, wins: 0, points: 45 } },
  { name: 'Исаак Хаджар', code: 'HAD', number: 6, team: 'Racing Bulls', teamColor: '#6692FF', country: '🇫🇷', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/hadjar.jpg.img.640.medium.jpg/1738086605898.jpg', stats: { speed: 86, racecraft: 78, experience: 15, wins: 0, points: 62 } },
  { name: 'Оливер Бирман', code: 'BEA', number: 7, team: 'Haas', teamColor: '#B6BABD', country: '🇬🇧', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/bearman.jpg.img.640.medium.jpg/1738086611898.jpg', stats: { speed: 84, racecraft: 77, experience: 15, wins: 0, points: 36 } },
  { name: 'Франко Колапинто', code: 'COL', number: 43, team: 'Alpine', teamColor: '#0093CC', country: '🇦🇷', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/colapinto.jpg.img.640.medium.jpg/1738086617898.jpg', stats: { speed: 83, racecraft: 76, experience: 20, wins: 0, points: 18 } },
  { name: 'Габриэль Бортолето', code: 'BOR', number: 5, team: 'Sauber', teamColor: '#52E252', country: '🇧🇷', photo: 'https://media.formula1.com/content/dam/fom-website/drivers/2025Drivers/bortoleto.jpg.img.640.medium.jpg/1738086623898.jpg', stats: { speed: 82, racecraft: 75, experience: 10, wins: 0, points: 15 } },
];

export const REACTION_FACTS: { max: number; text: string }[] = [
  { max: 150, text: 'Быстрее моргания глаза (150мс)! Ты вообще человек?' },
  { max: 150, text: 'Уровень рефлекса — мозг даже не успел подумать!' },
  { max: 150, text: 'Как бросок мантис-креветки — 150мс и удар!' },
  { max: 220, text: 'Реакция уровня пилота F1 на стартовых огнях!' },
  { max: 220, text: 'Ферстаппен на старте Гран-при — примерно так же!' },
  { max: 220, text: 'Гепард реагирует на добычу за ~200мс — ты на его уровне!' },
  { max: 220, text: 'Льюис Хэмилтон: средняя реакция на старте ~210мс.' },
  { max: 220, text: 'Шумахер славился реакцией ~220мс. Легендарный уровень!' },
  { max: 300, text: 'Реакция боксёра на джеб — примерно 250мс!' },
  { max: 300, text: 'Как вратарь на пенальти — прыжок начинается за ~250мс!' },
  { max: 300, text: 'Джокович принимает подачу за ~250мс — ты в этой лиге!' },
  { max: 300, text: 'Атака кобры длится 200-300мс — ты примерно так же быстр!' },
  { max: 300, text: 'Топовые киберспортсмены CS2 — 200-250мс. Почти!' },
  { max: 300, text: 'Бейсболист видит мяч и решает бить за ~275мс!' },
  { max: 400, text: 'Средняя реакция человека — 250мс. Чуть медленнее, но нормально!' },
  { max: 400, text: 'Лягушка ловит муху за 300-400мс — вы примерно одинаковы!' },
  { max: 400, text: 'Хоккейный вратарь реагирует на шайбу за ~380мс!' },
  { max: 400, text: 'После кофе реакция улучшается на ~10%. Может, заварить?' },
  { max: 500, text: 'Время реакции водителя на светофор — 400-500мс!' },
  { max: 500, text: 'После 6 часов без сна реакция падает до ~450мс!' },
  { max: 500, text: 'Кофеин улучшает реакцию на 10-15%. Стоит попробовать!' },
  { max: 500, text: 'Казуальный геймер — 400-500мс. Норма для нетренированного!' },
  { max: 500, text: 'Штраф за фальстарт в F1 — 10 секунд. Лучше подождать!' },
  { max: 700, text: 'Ленивец одобряет твой дзен-подход!' },
  { max: 700, text: 'Заморожен? В холоде реакция падает на 40%!' },
  { max: 700, text: 'После плотного обеда реакция замедляется. Это нормально!' },
  { max: 700, text: 'С такой реакцией в F1 ты бы терял 3-4 позиции на каждом старте!' },
  { max: 99999, text: 'Ты точно смотрел на экран? Попробуй ещё!' },
  { max: 99999, text: 'Улитка проползает 1мм за то время что ты думал!' },
  { max: 99999, text: 'За {time}мс болид F1 проезжает {dist} метров!' },
];

/** Pick a fact suitable for the reaction time, with templating. */
export function pickReactionFact(rt: number, used: Set<string> = new Set()): string {
  let pool = REACTION_FACTS.filter((f) => rt <= f.max && !used.has(f.text));
  if (pool.length === 0) {
    used.clear();
    pool = REACTION_FACTS.filter((f) => rt <= f.max);
  }
  pool.sort((a, b) => a.max - b.max);
  const top = pool.slice(0, Math.min(5, pool.length));
  const fact = top[Math.floor(Math.random() * top.length)];
  used.add(fact.text);
  return fact.text.replace('{time}', String(rt)).replace('{dist}', String(Math.round(rt * 0.0972)));
}
