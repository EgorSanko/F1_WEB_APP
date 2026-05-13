import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export const useHome = () =>
  useQuery({ queryKey: ['home'], queryFn: api.home, staleTime: 60_000 });

export const useSchedule = (season = 2026) =>
  useQuery({
    queryKey: ['schedule', season],
    queryFn: () => api.schedule(season),
    staleTime: 5 * 60_000,
  });

export const useDriverStandings = () =>
  useQuery({
    queryKey: ['standings', 'drivers'],
    queryFn: api.standingsDrivers,
    staleTime: 5 * 60_000,
  });

export const useConstructorStandings = () =>
  useQuery({
    queryKey: ['standings', 'constructors'],
    queryFn: api.standingsConstructors,
    staleTime: 5 * 60_000,
  });

export const useRaceResults = (round: number | null) =>
  useQuery({
    queryKey: ['race', round, 'results'],
    queryFn: () => api.raceResults(round!),
    enabled: round != null,
    retry: false,
  });

export const useRaceQualifying = (round: number | null) =>
  useQuery({
    queryKey: ['race', round, 'qualifying'],
    queryFn: () => api.raceQualifying(round!),
    enabled: round != null,
    retry: false,
  });

export const useNews = () =>
  useQuery({ queryKey: ['news'], queryFn: api.news, staleTime: 5 * 60_000 });

export const useDriver = (number: number | null) =>
  useQuery({
    queryKey: ['driver', number],
    queryFn: () => api.driver(number!),
    enabled: number != null,
  });

export const usePredictionsAvailable = (enabled = true) =>
  useQuery({
    queryKey: ['predictions', 'available'],
    queryFn: api.predictionsAvailable,
    enabled,
    staleTime: 30_000,
  });

export const useMyPredictions = (enabled = true) =>
  useQuery({
    queryKey: ['predictions', 'mine'],
    queryFn: api.myPredictions,
    enabled,
  });

export const useLeaderboard = () =>
  useQuery({ queryKey: ['leaderboard'], queryFn: api.leaderboard });

export const useDrivers = (season = 2026) =>
  useQuery({
    queryKey: ['drivers', season],
    queryFn: () => api.drivers(season),
    staleTime: 60 * 60_000,
  });

export const useTeams = (season = 2026) =>
  useQuery({
    queryKey: ['teams', season],
    queryFn: () => api.teams(season),
    staleTime: 60 * 60_000,
  });

export const useHeadToHead = (season = 2026) =>
  useQuery({
    queryKey: ['h2h', season],
    queryFn: () => api.headToHead(season),
    staleTime: 5 * 60_000,
  });

export const usePointsProgression = (season = 2026) =>
  useQuery({
    queryKey: ['progression', season],
    queryFn: () => api.pointsProgression(season),
    staleTime: 5 * 60_000,
  });

/** Country code to flag emoji (works on iOS/Android, fails on Windows). */
export function flagFor(countryCode?: string): string {
  if (!countryCode || countryCode.length !== 2) return '🏁';
  const cc = countryCode.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/** Format ISO 8601 datetime to "13–15 июня" range — needs sessions for end date. */
export function dateRange(race: { date: string; sessions?: { datetime: string }[] }): string {
  const start = new Date(race.date);
  const lastSession = race.sessions?.[race.sessions.length - 1];
  const end = lastSession ? new Date(lastSession.datetime) : start;
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
  const startStr = new Intl.DateTimeFormat('ru-RU', { day: 'numeric' }).format(start);
  const endStr = fmt.format(end);
  return `${startStr}–${endStr}`;
}

/** Countdown helper — returns parts {d,h,m,s} until target ISO datetime, or null if past. */
export function countdownParts(iso: string, now: Date = new Date()): {
  d: string;
  h: string;
  m: string;
  s: string;
  past: boolean;
} {
  const diff = new Date(iso).getTime() - now.getTime();
  if (diff <= 0) return { d: '00', h: '00', m: '00', s: '00', past: true };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { d: pad(days), h: pad(hours), m: pad(minutes), s: pad(seconds), past: false };
}
