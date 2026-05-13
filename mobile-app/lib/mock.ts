/**
 * Mock data for visual development.
 * Replace with api.calendar() / api.home() calls once backend endpoints are wired.
 */

export type Race = {
  round: number;
  name: string;
  short: string;
  flag: string;
  dates: string;
  circuit: string;
  image: string;
  status: 'upcoming' | 'past' | 'next';
};

const circuitImg = (slug: string) =>
  `https://media.formula1.com/image/upload/c_lfill,w_1440/q_auto/v1740000000/fom-website/2018-redesign-assets/Circuit%20maps%2016x9/${slug}_Circuit`;

export const RACES: Race[] = [
  { round: 7, name: 'Гран-при Канады', short: 'Канада', flag: '🇨🇦', dates: '13–15 июня', circuit: 'Монреаль', image: circuitImg('Canada'), status: 'next' },
  { round: 8, name: 'Гран-при Австрии', short: 'Австрия', flag: '🇦🇹', dates: '27–29 июня', circuit: 'Ред Булл Ринг', image: circuitImg('Austria'), status: 'upcoming' },
  { round: 9, name: 'Гран-при Великобритании', short: 'Великобритания', flag: '🇬🇧', dates: '4–6 июля', circuit: 'Сильверстоун', image: circuitImg('Great_Britain'), status: 'upcoming' },
  { round: 10, name: 'Гран-при Венгрии', short: 'Венгрия', flag: '🇭🇺', dates: '18–20 июля', circuit: 'Будапешт', image: circuitImg('Hungary'), status: 'upcoming' },
  { round: 11, name: 'Гран-при Бельгии', short: 'Бельгия', flag: '🇧🇪', dates: '25–27 июля', circuit: 'Спа-Франкоршам', image: circuitImg('Belgium'), status: 'upcoming' },
  { round: 12, name: 'Гран-при Нидерландов', short: 'Нидерланды', flag: '🇳🇱', dates: '29–31 августа', circuit: 'Зандворт', image: circuitImg('Netherlands'), status: 'upcoming' },
  { round: 13, name: 'Гран-при Италии', short: 'Италия', flag: '🇮🇹', dates: '5–7 сентября', circuit: 'Монца', image: circuitImg('Italy'), status: 'upcoming' },
];

export const NEXT_RACE = RACES[0];

export const VIDEOS = [
  { id: 1, title: 'Обзор Гран-при Испании 2025', ago: '2 дня назад', duration: null, category: 'Обзоры', image: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg' },
  { id: 2, title: 'Обзор квалификации\nГран-при Монако', ago: '3 дня назад', duration: '8:47', category: 'Обзоры', image: '' },
  { id: 3, title: 'Лучшие моменты\nГран-при Эмилии-Романьи', ago: '1 неделя назад', duration: '12:31', category: 'Обзоры', image: '' },
  { id: 4, title: 'Пресс-конференция\nпилотов', ago: '2 недели назад', duration: '15:20', category: 'Обзоры', image: '' },
];

export const SCHEDULE = [
  {
    day: 'Пятница, 13 июня',
    sessions: [
      { time: '18:30', label: 'Свободная практика 1' },
      { time: '22:00', label: 'Свободная практика 2' },
    ],
  },
  {
    day: 'Суббота, 14 июня',
    sessions: [
      { time: '17:30', label: 'Свободная практика 3' },
      { time: '21:00', label: 'Квалификация' },
    ],
  },
  {
    day: 'Воскресенье, 15 июня',
    sessions: [{ time: '20:00', label: 'Гонка' }],
  },
];

export const PROFILE = {
  name: 'Александр',
  username: '@papito007',
  badge: 'ПРОФИ',
  points: 5680,
  predictions: 24,
  accuracy: 87,
  achievements: 4,
};

export const PREDICT_RULES = [
  { icon: 'trophy' as const, label: 'Победитель гонки', points: 25 },
  { icon: 'podium' as const, label: 'Топ-3 финишеров', points: 30 },
  { icon: 'flag' as const, label: 'Поул-позиция', points: 15 },
  { icon: 'timer' as const, label: 'Быстрый круг', points: 10 },
];
