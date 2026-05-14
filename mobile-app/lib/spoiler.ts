/**
 * Spoiler-free mode. When ON:
 *  - Last race results are hidden on Home
 *  - Standings tabs (drivers/constructors/cards/teams/h2h/progress) hidden
 *  - Past Race Detail Results & Qualifying tabs hidden
 *  - Driver Profile season race results hidden
 *
 * Only applies to the current season (2026). Mirrors web localStorage key
 * `f1hub_spoiler_free`.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'f1hub.spoiler_free';
export const CURRENT_SEASON = 2026;

type SpoilerState = {
  enabled: boolean;
  ready: boolean;
  load: () => Promise<void>;
  toggle: () => Promise<void>;
};

export const useSpoiler = create<SpoilerState>((set, get) => ({
  enabled: false,
  ready: false,
  load: async () => {
    try {
      const v = await AsyncStorage.getItem(KEY);
      set({ enabled: v === '1', ready: true });
    } catch {
      set({ ready: true });
    }
  },
  toggle: async () => {
    const next = !get().enabled;
    set({ enabled: next });
    try {
      await AsyncStorage.setItem(KEY, next ? '1' : '0');
    } catch {}
  },
}));

/** True iff spoiler should hide a payload for the given season. */
export function isSpoilerHidden(season: number, enabled: boolean): boolean {
  return enabled && season === CURRENT_SEASON;
}
