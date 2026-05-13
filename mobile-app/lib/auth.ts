/**
 * Telegram OAuth flow for the native app.
 *
 * Flow:
 * 1. App opens oauth.telegram.org/auth with return_to=https://f1hub.lead-seek.ru/app/auth-callback
 * 2. Telegram approves, redirects to our HTTPS callback with signed payload
 * 3. Backend callback page issues a window.location = f1hub://auth?<qs>
 * 4. Expo's openAuthSessionAsync detects the scheme match and returns the URL
 * 5. We parse the query string, save it via SecureStore, and verify with /api/auth/widget
 */
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { create } from 'zustand';

import { api, clearTgAuth, setTgAuth, type User } from './api';

const TG_BOT_ID =
  (Constants.expoConfig?.extra?.tgBotId as string) ?? '8471280241';

const ORIGIN = 'https://f1hub.lead-seek.ru';
const CALLBACK_BASE = 'https://f1hub.lead-seek.ru/app/auth-callback';

/**
 * The URL the mobile app listens for. In Expo Go this resolves to
 * exp://192.168.x.x:8081/--/auth; in a dev/standalone build it's f1hub://auth.
 * We pass this to the backend as `back=...` so it can bounce the OAuth
 * payload back to whichever runtime is currently active.
 */
function appReturnUrl(): string {
  return Linking.createURL('auth');
}

function buildTelegramOAuthUrl() {
  const back = appReturnUrl();
  const returnTo = `${CALLBACK_BASE}?back=${encodeURIComponent(back)}`;
  const params = new URLSearchParams({
    bot_id: TG_BOT_ID,
    origin: ORIGIN,
    request_access: 'write',
    return_to: returnTo,
  });
  return `https://oauth.telegram.org/auth?${params.toString()}`;
}

/**
 * Open Telegram OAuth and return the auth query string if successful.
 */
export async function signInWithTelegram(): Promise<{ user: User } | null> {
  const oauthUrl = buildTelegramOAuthUrl();
  const back = appReturnUrl();
  const result = await WebBrowser.openAuthSessionAsync(oauthUrl, back);

  if (result.type !== 'success' || !result.url) {
    return null;
  }

  const parsed = Linking.parse(result.url);
  const params = (parsed.queryParams ?? {}) as Record<string, string | string[]>;

  if (!params.id || !params.hash) {
    throw new Error('Invalid Telegram callback (missing id/hash)');
  }

  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v[0] : v)}`,
    )
    .join('&');

  await setTgAuth(qs);

  const res = await api.authWidget(qs);
  return { user: res.user };
}

export async function signOut() {
  await clearTgAuth();
}

// ============ AUTH STORE ============

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  setUser: (u: User | null) => void;
  setAdmin: (admin: boolean) => void;
  setLoading: (loading: boolean) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAdmin: false,
  setUser: (u) => set({ user: u }),
  setAdmin: (admin) => set({ isAdmin: admin }),
  setLoading: (loading) => set({ isLoading: loading }),
  refresh: async () => {
    set({ isLoading: true });
    try {
      const user = await api.me();
      set({ user });
      try {
        const { is_admin } = await api.isAdmin();
        set({ isAdmin: is_admin });
      } catch {
        set({ isAdmin: false });
      }
    } catch {
      set({ user: null, isAdmin: false });
    } finally {
      set({ isLoading: false });
    }
  },
  logout: async () => {
    await signOut();
    set({ user: null, isAdmin: false });
  },
}));
