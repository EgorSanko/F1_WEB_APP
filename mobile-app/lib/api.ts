/**
 * F1 Hub API client.
 * Talks to FastAPI at f1hub.lead-seek.ru. JWT goes in Authorization header.
 * Token refresh on 401 is handled by the interceptor below.
 */
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_BASE = (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? 'https://f1hub.lead-seek.ru';

const ACCESS_KEY = 'f1hub.access_token';
const REFRESH_KEY = 'f1hub.refresh_token';

export type TokenPair = { access: string; refresh: string };

export async function setTokens(p: TokenPair) {
  await SecureStore.setItemAsync(ACCESS_KEY, p.access);
  await SecureStore.setItemAsync(REFRESH_KEY, p.refresh);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refresh) return null;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    await clearTokens();
    return null;
  }
  const data = (await res.json()) as TokenPair;
  await setTokens(data);
  return data.access;
}

type RequestOpts = RequestInit & { auth?: boolean };

export async function apiFetch<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = new Headers(opts.headers);
  if (!headers.has('Content-Type') && opts.body) headers.set('Content-Type', 'application/json');

  if (opts.auth !== false) {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(url, { ...opts, headers });

  if (res.status === 401 && opts.auth !== false) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      headers.set('Authorization', `Bearer ${fresh}`);
      res = await fetch(url, { ...opts, headers });
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${text.slice(0, 200)}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ============ DOMAIN ENDPOINTS ============

export type Race = {
  round: number;
  name: string;
  circuit_name: string;
  circuit_image?: string;
  country: string;
  race_datetime: string;
  is_past?: boolean;
  is_next?: boolean;
};

export type HomeData = {
  next_race: Race;
  last_race?: Race;
  news?: { title: string; source?: string; url?: string; photo?: string }[];
};

export const api = {
  home: () => apiFetch<HomeData>('/api/home', { auth: false }),
  calendar: (season = 2026) => apiFetch<Race[]>(`/api/calendar?season=${season}`, { auth: false }),
  standings: (kind: 'drivers' | 'constructors' = 'drivers', season = 2026) =>
    apiFetch(`/api/standings/${kind}?season=${season}`, { auth: false }),
  videos: () => apiFetch('/api/videos', { auth: false }),

  authTelegram: (payload: Record<string, string | number>) =>
    apiFetch<TokenPair>('/auth/telegram-mobile', {
      method: 'POST',
      body: JSON.stringify(payload),
      auth: false,
    }),
  authApple: (identityToken: string, nonce: string) =>
    apiFetch<TokenPair>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identity_token: identityToken, nonce }),
      auth: false,
    }),
  me: () => apiFetch('/auth/me'),
  deleteAccount: () => apiFetch('/account', { method: 'DELETE' }),

  registerPushToken: (token: string, platform: 'ios' | 'android') =>
    apiFetch('/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),

  submitPredict: (raceRound: number, picks: Record<string, unknown>) =>
    apiFetch('/api/predict/submit', {
      method: 'POST',
      body: JSON.stringify({ race_round: raceRound, picks }),
    }),
};

export { API_BASE };
