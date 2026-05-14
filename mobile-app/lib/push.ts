import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { api, apiFetch } from './api';

// In-foreground display behaviour
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let cachedToken: string | null = null;

/**
 * Request permission + obtain Expo push token + send to backend.
 * Silent on every failure path — never throws, never alerts.
 * Returns null if push isn't available (simulator, missing projectId,
 * permission denied, network error, etc.).
 */
export async function registerPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'F1 HUB',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 100, 200],
          lightColor: '#E10600',
        });
      } catch {}
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const ask = await Notifications.requestPermissionsAsync();
      status = ask.status;
    }
    if (status !== 'granted') return null;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId ||
      (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

    if (!projectId) {
      // Expo Go without eas init — push isn't usable yet
      return null;
    }

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
    cachedToken = tokenResp.data;
    await apiFetch('/push/register', {
      method: 'POST',
      body: JSON.stringify({ token: cachedToken, platform: Platform.OS }),
    });
    return cachedToken;
  } catch {
    return null;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!cachedToken) return;
  try {
    await apiFetch('/push/register', {
      method: 'DELETE',
      body: JSON.stringify({ token: cachedToken }),
    });
  } catch {}
  cachedToken = null;
}

export { api as _api };
