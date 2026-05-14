import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'f1hub.savedBroadcasts';

async function readSaved(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

async function writeSaved(ids: number[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(ids));
}

const listeners = new Set<(ids: number[]) => void>();

async function emit() {
  const ids = await readSaved();
  listeners.forEach((l) => l(ids));
}

export async function isSaved(broadcastId: number): Promise<boolean> {
  const ids = await readSaved();
  return ids.includes(broadcastId);
}

export async function toggleSaved(broadcastId: number): Promise<boolean> {
  const ids = await readSaved();
  const has = ids.includes(broadcastId);
  const next = has ? ids.filter((x) => x !== broadcastId) : [...ids, broadcastId];
  await writeSaved(next);
  emit();
  return !has;
}

export function useIsSaved(broadcastId: number | null): {
  saved: boolean;
  toggle: () => Promise<boolean>;
} {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (broadcastId == null) {
      setSaved(false);
      return;
    }
    let alive = true;
    isSaved(broadcastId).then((v) => alive && setSaved(v));
    const listener = (ids: number[]) => alive && setSaved(ids.includes(broadcastId));
    listeners.add(listener);
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, [broadcastId]);

  const toggle = async () => {
    if (broadcastId == null) return false;
    const v = await toggleSaved(broadcastId);
    return v;
  };

  return { saved, toggle };
}
