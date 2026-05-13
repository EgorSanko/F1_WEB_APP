/**
 * F1 Hub API client.
 * Backend uses Telegram Login Widget style auth: each request includes
 *   Authorization: TgLogin <query_string_with_hash>
 * The query string is the OAuth payload returned by Telegram (id, first_name,
 * username, photo_url, auth_date, hash). Backend re-verifies HMAC on every
 * request — no JWT, no refresh, no expiry except 30 days from auth_date.
 */
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_BASE =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? 'https://f1hub.lead-seek.ru';

const AUTH_KEY = 'f1hub.tg_auth';

export async function setTgAuth(authQueryString: string) {
  await SecureStore.setItemAsync(AUTH_KEY, authQueryString);
}

export async function getTgAuth(): Promise<string | null> {
  return SecureStore.getItemAsync(AUTH_KEY);
}

export async function clearTgAuth() {
  await SecureStore.deleteItemAsync(AUTH_KEY);
}

type RequestOpts = RequestInit & { auth?: boolean };

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = new Headers(opts.headers);
  if (!headers.has('Content-Type') && opts.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (opts.auth !== false) {
    const tgAuth = await getTgAuth();
    if (tgAuth) headers.set('Authorization', `TgLogin ${tgAuth}`);
  }

  const res = await fetch(url, { ...opts, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${text.slice(0, 200)}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ============ DOMAIN TYPES ============

export type Session = { type: string; datetime: string };

export type Race = {
  round: number;
  name: string;
  circuit: string;
  circuit_id: string;
  circuit_image?: string;
  country: string;
  country_code?: string;
  locality?: string;
  lat?: number;
  lng?: number;
  date: string;
  time?: string;
  race_datetime: string;
  sessions?: Session[];
  sprint?: { datetime?: string } | null;
};

export type Driver = {
  driver_number: number;
  name: string;
  first_name?: string;
  last_name?: string;
  code?: string;
  team?: string;
  team_color?: string;
  country?: string;
  photo_url?: string;
  card_photo_url?: string;
  card_photo_position?: string;
  photo_url_large?: string;
  position?: number;
  points?: number;
  wins?: number;
};

export type DriverSeasonResult = {
  round: number;
  race: string;
  position?: number;
  grid?: number;
  points: number;
  status?: string;
};

export type DriverProfile = Driver & {
  season_stats: {
    races: number;
    points: number;
    wins: number;
    podiums: number;
    dnfs: number;
    best_finish: number;
    results: DriverSeasonResult[];
  };
  teammate?: Driver;
};

export type DriverStanding = Driver & {
  position: number;
  points: number;
  gap_to_leader?: number;
};

export type ConstructorStanding = {
  position: number;
  team: string;
  team_color?: string;
  points: number;
  gap_to_leader?: number;
  wins?: number;
  nationality?: string;
  drivers?: Driver[];
};

export type RaceResultDriver = Driver & {
  position: number;
  grid?: number;
  laps?: number;
  status?: string;
  is_dnf?: boolean;
  points: number;
  time?: string;
  gap?: string;
  fastest_lap_time?: string;
  fastest_lap_rank?: number;
  fastest_lap_lap?: number;
};

export type RaceResults = {
  round: number;
  name: string;
  circuit?: string;
  country?: string;
  date: string;
  results: RaceResultDriver[];
};

export type QualifyingDriver = Driver & {
  position: number;
  q1?: string;
  q2?: string;
  q3?: string;
};

export type QualifyingResults = {
  round: number;
  name: string;
  date: string;
  results: QualifyingDriver[];
};

export type NewsPost = {
  url: string;
  title: string;
  preview?: string;
  image?: string;
  photo?: string;
  source?: string;
  published_at?: string;
};

export type HomeData = {
  next_race: Race;
  last_race?: Race & { results?: unknown[] };
  standings_top3?: DriverStanding[];
  season: number;
};

export type User = {
  user_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  points?: number;
  predictions_correct?: number;
  predictions_total?: number;
  streak?: number;
  max_streak?: number;
  rank?: number;
  achievements_list?: string[];
  achievements_count?: number;
  achievements_total?: number;
  favorite_driver?: number;
  favorite_team?: string;
};

// ============ ENDPOINTS ============

export const api = {
  // Public
  home: () => apiFetch<HomeData>('/api/home', { auth: false }),
  schedule: (season = 2026) =>
    apiFetch<{ races: Race[]; season: number }>(`/api/schedule?season=${season}`, {
      auth: false,
    }),
  raceNext: () => apiFetch<Race>('/api/race/next', { auth: false }),
  raceLast: () => apiFetch<Race>('/api/race/last', { auth: false }),
  raceResults: (round: number) =>
    apiFetch<RaceResults>(`/api/race/${round}/results`, { auth: false }),
  raceQualifying: (round: number) =>
    apiFetch<QualifyingResults>(`/api/race/${round}/qualifying`, { auth: false }),
  raceTyres: (round: number) =>
    apiFetch<{ detail?: string; strategies?: unknown[] }>(
      `/api/race/${round}/tyres`,
      { auth: false },
    ),
  standingsDrivers: () =>
    apiFetch<{ standings: DriverStanding[] }>('/api/standings/drivers', {
      auth: false,
    }),
  standingsConstructors: () =>
    apiFetch<{ standings: ConstructorStanding[] }>(
      '/api/standings/constructors',
      { auth: false },
    ),
  news: () => apiFetch<{ posts: NewsPost[] }>('/api/news', { auth: false }),
  driver: (number: number) =>
    apiFetch<DriverProfile>(`/api/driver/${number}`, { auth: false }),
  broadcasts: () => apiFetch('/api/broadcasts', { auth: false }),

  // Auth
  authWidget: (authData: string) =>
    apiFetch<{ ok: true; user: User }>('/api/auth/widget', {
      method: 'POST',
      body: JSON.stringify({ auth_data: authData }),
      auth: false,
    }),
  authCode: (code: string) =>
    apiFetch<{ ok: true; token: string; user: User }>('/api/auth/code', {
      method: 'POST',
      body: JSON.stringify({ code }),
      auth: false,
    }),

  // Authenticated
  me: () => apiFetch<User>('/api/user/me'),
  isAdmin: () => apiFetch<{ is_admin: boolean }>('/api/user/is-admin'),
  myPredictions: () => apiFetch('/api/user/predictions'),
  predictionsAvailable: () => apiFetch('/api/predictions/available'),
  predictMake: (payload: {
    race_round: number;
    prediction_type: string;
    prediction_value: unknown;
  }) =>
    apiFetch('/api/predictions/make', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  achievements: () => apiFetch('/api/user/achievements'),
  leaderboard: () => apiFetch('/api/leaderboard'),
  setFavorite: (payload: { driver?: number; team?: string }) =>
    apiFetch('/api/user/favorite', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Admin
  adminBroadcasts: () => apiFetch('/api/admin/broadcasts'),
  adminBroadcastCreate: (payload: {
    race_round: number;
    session_type: string;
    video_url: string;
    title?: string;
    is_live?: boolean;
  }) =>
    apiFetch('/api/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminBroadcastEnd: (id: number) =>
    apiFetch(`/api/admin/broadcast/${id}/end`, { method: 'POST' }),
  adminBroadcastDelete: (id: number) =>
    apiFetch(`/api/admin/broadcast/${id}`, { method: 'DELETE' }),
  adminSettle: (round: number) =>
    apiFetch(`/api/admin/settle/${round}`, { method: 'POST' }),
  adminCacheClear: () =>
    apiFetch('/api/admin/cache/clear', { method: 'POST' }),
};

export { API_BASE };
