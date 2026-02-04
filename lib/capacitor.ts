import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

export const isNativePlatform = Capacitor.isNativePlatform();

export function listenForAppUrlOpen(handler: (url: string) => void): () => void {
  if (!isNativePlatform) return () => {};
  let removeListener = () => {};

  App.addListener('appUrlOpen', (event) => {
    if (event?.url) {
      handler(event.url);
    }
  }).then((listener) => {
    removeListener = () => listener.remove();
  });

  return () => removeListener();
}

export async function openSystemBrowser(url: string): Promise<void> {
  if (isNativePlatform) {
    await Browser.open({ url });
    return;
  }
  window.location.assign(url);
}

export async function closeSystemBrowser(): Promise<void> {
  if (!isNativePlatform) return;
  await Browser.close();
}

export async function triggerLightHaptic(): Promise<void> {
  if (!isNativePlatform) return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch (e) {
    // Fallback silently
  }
}

export async function triggerMediumHaptic(): Promise<void> {
  if (!isNativePlatform) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    // Fallback to vibrate
    try {
      await Haptics.vibrate({ duration: 50 });
    } catch (e2) {
      // Fallback silently
    }
  }
}

export async function triggerHeavyHaptic(): Promise<void> {
  if (!isNativePlatform) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (e) {
    // Fallback to vibrate
    try {
      await Haptics.vibrate({ duration: 100 });
    } catch (e2) {
      // Fallback silently
    }
  }
}

export async function triggerSuccessHaptic(): Promise<void> {
  if (!isNativePlatform) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (e) {
    // Fallback to vibrate
    try {
      await Haptics.vibrate({ duration: 50 });
    } catch (e2) {
      // Fallback silently
    }
  }
}

export async function triggerErrorHaptic(): Promise<void> {
  if (!isNativePlatform) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (e) {
    // Fallback to vibrate
    try {
      await Haptics.vibrate({ duration: 100 });
    } catch (e2) {
      // Fallback silently
    }
  }
}

export async function registerForPushNotifications(): Promise<void> {
  if (!isNativePlatform) return;
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;
  await PushNotifications.register();
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (isNativePlatform) {
    await SecureStoragePlugin.set({ key, value });
    return;
  }
  await Preferences.set({ key, value });
}

export async function secureGet(key: string): Promise<string | null> {
  if (isNativePlatform) {
    const result = await SecureStoragePlugin.get({ key });
    return result?.value ?? null;
  }
  const { value } = await Preferences.get({ key });
  return value ?? null;
}
