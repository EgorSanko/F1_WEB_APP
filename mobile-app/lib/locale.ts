/**
 * Русские названия городов и стран F1-календаря.
 * Бэк возвращает английские названия; рендерим по-русски, с фолбэком на оригинал.
 */

const CITY_RU: Record<string, string> = {
  Sakhir: 'Сахир',
  Jeddah: 'Джидда',
  Melbourne: 'Мельбурн',
  Suzuka: 'Судзука',
  Shanghai: 'Шанхай',
  Miami: 'Майами',
  Imola: 'Имола',
  Monaco: 'Монако',
  'Monte Carlo': 'Монте-Карло',
  Montréal: 'Монреаль',
  Montreal: 'Монреаль',
  Barcelona: 'Барселона',
  Spielberg: 'Шпильберг',
  Silverstone: 'Сильверстоун',
  Spa: 'Спа',
  'Spa-Francorchamps': 'Спа',
  Budapest: 'Будапешт',
  Mogyoród: 'Будапешт',
  Zandvoort: 'Зандворт',
  Monza: 'Монца',
  Baku: 'Баку',
  Singapore: 'Сингапур',
  Austin: 'Остин',
  'Mexico City': 'Мехико',
  'São Paulo': 'Сан-Паулу',
  'Sao Paulo': 'Сан-Паулу',
  'Las Vegas': 'Лас-Вегас',
  Lusail: 'Лусаил',
  'Yas Marina': 'Абу-Даби',
  'Abu Dhabi': 'Абу-Даби',
};

const COUNTRY_RU: Record<string, string> = {
  Bahrain: 'Бахрейн',
  'Saudi Arabia': 'Саудовская Аравия',
  Australia: 'Австралия',
  Japan: 'Япония',
  China: 'Китай',
  USA: 'США',
  'United States': 'США',
  Italy: 'Италия',
  Monaco: 'Монако',
  Canada: 'Канада',
  Spain: 'Испания',
  Austria: 'Австрия',
  UK: 'Великобритания',
  'United Kingdom': 'Великобритания',
  'Great Britain': 'Великобритания',
  Belgium: 'Бельгия',
  Hungary: 'Венгрия',
  Netherlands: 'Нидерланды',
  Azerbaijan: 'Азербайджан',
  Singapore: 'Сингапур',
  Mexico: 'Мексика',
  Brazil: 'Бразилия',
  Qatar: 'Катар',
  UAE: 'ОАЭ',
  'United Arab Emirates': 'ОАЭ',
};

/** «Австралии» из «Гран-при Австралии» — для верхней капс-строки. */
const COUNTRY_GENITIVE_RU: Record<string, string> = {
  Bahrain: 'Бахрейна',
  'Saudi Arabia': 'Саудовской Аравии',
  Australia: 'Австралии',
  Japan: 'Японии',
  China: 'Китая',
  USA: 'США',
  'United States': 'США',
  Italy: 'Италии',
  Monaco: 'Монако',
  Canada: 'Канады',
  Spain: 'Испании',
  Austria: 'Австрии',
  UK: 'Великобритании',
  'United Kingdom': 'Великобритании',
  'Great Britain': 'Великобритании',
  Belgium: 'Бельгии',
  Hungary: 'Венгрии',
  Netherlands: 'Нидерландов',
  Azerbaijan: 'Азербайджана',
  Singapore: 'Сингапура',
  Mexico: 'Мексики',
  Brazil: 'Бразилии',
  Qatar: 'Катара',
  UAE: 'ОАЭ',
  'United Arab Emirates': 'ОАЭ',
};

export function ruCity(city?: string): string {
  if (!city) return '';
  return CITY_RU[city] ?? city;
}

export function ruCountry(country?: string): string {
  if (!country) return '';
  return COUNTRY_RU[country] ?? country;
}

export function ruPlace(locality?: string, country?: string): string {
  const l = locality ? ruCity(locality) : undefined;
  const c = country ? ruCountry(country) : undefined;
  if (l && c) return `${l}, ${c}`;
  return l || c || '';
}

/** Родительный падеж для строки «ГРАН-ПРИ {Австралии}». Берёт по `country`,
 * а если нет — пытается выдернуть из `name` (after «Гран-при »). */
export function ruRaceTitle(country?: string, name?: string): string {
  if (country && COUNTRY_GENITIVE_RU[country]) return COUNTRY_GENITIVE_RU[country];
  if (name) {
    const m = name.match(/^Гран[- ]при\s+(.+)$/i);
    if (m) return m[1];
  }
  return name ?? '';
}
