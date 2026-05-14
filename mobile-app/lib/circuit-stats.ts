/**
 * Статика F1-трасс: длина круга, дистанция гонки, число кругов, рекорд круга.
 * Бэк это не возвращает; хардкодим по circuit_id (его F1 API возвращает).
 * Источник: формула1.com / wikipedia. Рекорды круга на 2026 сезон.
 */

export type CircuitStats = {
  lengthKm: number;
  laps: number;
  distanceKm: number;
  lapRecord?: {
    time: string;
    driver: string;
    year: number;
  };
};

export const CIRCUIT_STATS: Record<string, CircuitStats> = {
  albert_park: {
    lengthKm: 5.278,
    laps: 58,
    distanceKm: 306.124,
    lapRecord: { time: '1:19.813', driver: 'C. Leclerc', year: 2022 },
  },
  bahrain: {
    lengthKm: 5.412,
    laps: 57,
    distanceKm: 308.238,
    lapRecord: { time: '1:31.447', driver: 'P. Gasly', year: 2018 },
  },
  jeddah: {
    lengthKm: 6.174,
    laps: 50,
    distanceKm: 308.45,
    lapRecord: { time: '1:30.734', driver: 'L. Hamilton', year: 2021 },
  },
  shanghai: {
    lengthKm: 5.451,
    laps: 56,
    distanceKm: 305.066,
    lapRecord: { time: '1:32.238', driver: 'M. Schumacher', year: 2004 },
  },
  miami: {
    lengthKm: 5.412,
    laps: 57,
    distanceKm: 308.326,
    lapRecord: { time: '1:29.708', driver: 'M. Verstappen', year: 2023 },
  },
  imola: {
    lengthKm: 4.909,
    laps: 63,
    distanceKm: 309.049,
    lapRecord: { time: '1:15.484', driver: 'L. Hamilton', year: 2020 },
  },
  monaco: {
    lengthKm: 3.337,
    laps: 78,
    distanceKm: 260.286,
    lapRecord: { time: '1:12.909', driver: 'L. Hamilton', year: 2021 },
  },
  villeneuve: {
    lengthKm: 4.361,
    laps: 70,
    distanceKm: 305.27,
    lapRecord: { time: '1:13.078', driver: 'V. Bottas', year: 2019 },
  },
  catalunya: {
    lengthKm: 4.657,
    laps: 66,
    distanceKm: 307.236,
    lapRecord: { time: '1:16.330', driver: 'M. Verstappen', year: 2023 },
  },
  red_bull_ring: {
    lengthKm: 4.318,
    laps: 71,
    distanceKm: 306.452,
    lapRecord: { time: '1:05.619', driver: 'C. Sainz', year: 2020 },
  },
  silverstone: {
    lengthKm: 5.891,
    laps: 52,
    distanceKm: 306.198,
    lapRecord: { time: '1:27.097', driver: 'M. Verstappen', year: 2020 },
  },
  hungaroring: {
    lengthKm: 4.381,
    laps: 70,
    distanceKm: 306.63,
    lapRecord: { time: '1:16.627', driver: 'L. Hamilton', year: 2020 },
  },
  spa: {
    lengthKm: 7.004,
    laps: 44,
    distanceKm: 308.052,
    lapRecord: { time: '1:44.701', driver: 'S. Pérez', year: 2024 },
  },
  zandvoort: {
    lengthKm: 4.259,
    laps: 72,
    distanceKm: 306.587,
    lapRecord: { time: '1:11.097', driver: 'L. Hamilton', year: 2021 },
  },
  monza: {
    lengthKm: 5.793,
    laps: 53,
    distanceKm: 306.72,
    lapRecord: { time: '1:21.046', driver: 'R. Barrichello', year: 2004 },
  },
  baku: {
    lengthKm: 6.003,
    laps: 51,
    distanceKm: 306.049,
    lapRecord: { time: '1:43.009', driver: 'C. Leclerc', year: 2019 },
  },
  marina_bay: {
    lengthKm: 4.94,
    laps: 62,
    distanceKm: 306.143,
    lapRecord: { time: '1:35.867', driver: 'L. Hamilton', year: 2023 },
  },
  americas: {
    lengthKm: 5.513,
    laps: 56,
    distanceKm: 308.405,
    lapRecord: { time: '1:36.169', driver: 'C. Leclerc', year: 2019 },
  },
  rodriguez: {
    lengthKm: 4.304,
    laps: 71,
    distanceKm: 305.354,
    lapRecord: { time: '1:17.774', driver: 'V. Bottas', year: 2021 },
  },
  interlagos: {
    lengthKm: 4.309,
    laps: 71,
    distanceKm: 305.879,
    lapRecord: { time: '1:10.540', driver: 'V. Bottas', year: 2018 },
  },
  vegas: {
    lengthKm: 6.201,
    laps: 50,
    distanceKm: 309.958,
    lapRecord: { time: '1:34.876', driver: 'O. Piastri', year: 2024 },
  },
  losail: {
    lengthKm: 5.419,
    laps: 57,
    distanceKm: 308.611,
    lapRecord: { time: '1:24.319', driver: 'M. Verstappen', year: 2023 },
  },
  yas_marina: {
    lengthKm: 5.281,
    laps: 58,
    distanceKm: 306.183,
    lapRecord: { time: '1:25.637', driver: 'K. Magnussen', year: 2024 },
  },
  suzuka: {
    lengthKm: 5.807,
    laps: 53,
    distanceKm: 307.471,
    lapRecord: { time: '1:30.983', driver: 'L. Hamilton', year: 2019 },
  },
};

export function getCircuitStats(circuitId?: string): CircuitStats | null {
  if (!circuitId) return null;
  return CIRCUIT_STATS[circuitId] ?? null;
}
