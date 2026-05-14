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

export type SessionEntry = { date: string; time: string };

export type SessionsMap = {
  fp1?: SessionEntry;
  fp2?: SessionEntry;
  fp3?: SessionEntry;
  qualifying?: SessionEntry;
  sprint_qualifying?: SessionEntry;
  sprint?: SessionEntry;
  race?: SessionEntry;
};

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
  sessions?: SessionsMap;
  sprint?: SessionEntry | null;
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

export type PredictionType =
  | 'winner'
  | 'podium'
  | 'fastest_lap'
  | 'dnf_count'
  | 'safety_car';

export type PredictionTypeInfo = {
  type: PredictionType;
  label: string;
  description: string;
  max_points: number;
  already_predicted: boolean;
};

export type PredictionsAvailable = {
  available: true;
  race: Race;
  predictions: PredictionTypeInfo[];
  drivers: Driver[];
};

export type PredictionsUnavailable = { available: false; message?: string };

export type Prediction = {
  id: number;
  race_round: number;
  season: number;
  prediction_type: PredictionType;
  prediction_value: unknown;
  points_bet?: number;
  points_won?: number;
  status: 'pending' | 'correct' | 'incorrect' | 'partial';
  created_at?: string;
  resolved_at?: string;
};

export type Team = {
  name: string;
  color?: string;
  logo_url?: string;
  car_url?: string;
  drivers?: Driver[];
};

export type H2HPilot = {
  name: string; // code like "ANT"
  full_name: string;
  number: number;
  points: number;
  wins: number;
  photo_url?: string;
};

export type H2HPair = {
  team: string;
  color?: string;
  driver1: H2HPilot;
  driver2: H2HPilot;
};

export type PointsProgressionDriver = {
  driver_number: number;
  code: string;
  name: string;
  team: string;
  team_color?: string;
  total_points: number;
  progression: { round: number; cumulative: number }[];
};

export type PointsProgression = {
  drivers: PointsProgressionDriver[];
  rounds: number[];
  total_rounds: number;
  season: number;
};

export type Broadcast = {
  id: number;
  race_round: number;
  season: number;
  session_type: string; // race | qualifying | sprint | sprint_qualifying | fp1 | fp2 | fp3
  title?: string;
  video_url: string;
  embed_url?: string;
  is_live: 0 | 1 | boolean;
  started_at?: string;
  ended_at?: string | null;
  created_by?: number | null;
  created_at?: string;
};

export type LeaderboardEntry = {
  user_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  points: number;
  rank: number;
  predictions_correct?: number;
  predictions_total?: number;
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
  drivers: (season = 2026) =>
    apiFetch<{ drivers: Driver[] }>(`/api/drivers?season=${season}`, { auth: false }),
  teams: (season = 2026) =>
    apiFetch<{ teams: Team[]; season: number }>(`/api/teams?season=${season}`, {
      auth: false,
    }),
  headToHead: (season = 2026) =>
    apiFetch<{ season: number; head_to_head: H2HPair[] }>(
      `/api/head-to-head?season=${season}`,
      { auth: false },
    ),
  pointsProgression: (season = 2026) =>
    apiFetch<PointsProgression>(
      `/api/standings/points-progression?season=${season}`,
      { auth: false },
    ),
  broadcasts: () =>
    apiFetch<{ broadcasts: Broadcast[] }>('/api/broadcasts', { auth: false }),
  broadcastsLive: () =>
    apiFetch<{ broadcasts: Broadcast[] }>('/api/broadcasts/live', { auth: false }),

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

  // Push notifications prefs
  pushPrefsGet: () =>
    apiFetch<{ notify_race: boolean; notify_review: boolean }>('/push/prefs'),
  pushPrefsSet: (payload: { notify_race: boolean; notify_review: boolean }) =>
    apiFetch<{ notify_race: boolean; notify_review: boolean }>('/push/prefs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Authenticated
  me: () => apiFetch<User>('/api/user/me'),
  isAdmin: () => apiFetch<{ is_admin: boolean }>('/api/user/is-admin'),
  myPredictions: () =>
    apiFetch<{ settled: Prediction[]; pending: Prediction[]; total_won: number }>(
      '/api/predictions/results',
    ),
  predictionsAvailable: () =>
    apiFetch<PredictionsAvailable | PredictionsUnavailable>(
      '/api/predictions/available',
    ),
  predictMake: (payload: {
    race_round: number;
    season?: number;
    prediction_type: PredictionType;
    prediction_value: unknown;
    points_bet?: number;
  }) =>
    apiFetch<{ status: 'ok'; prediction_id: number; new_achievements?: string[] }>(
      '/api/predictions/make',
      {
        method: 'POST',
        body: JSON.stringify({ season: 2026, points_bet: 0, ...payload }),
      },
    ),
  achievements: () => apiFetch('/api/user/achievements'),
  leaderboard: () =>
    apiFetch<{ leaderboard: LeaderboardEntry[] } | LeaderboardEntry[]>(
      '/api/leaderboard',
    ),
  setFavorite: (payload: { driver?: number; team?: string }) =>
    apiFetch('/api/user/favorite', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Admin
  adminBroadcasts: () =>
    apiFetch<{ broadcasts: Broadcast[] }>('/api/admin/broadcasts'),
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
