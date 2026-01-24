import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
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
  await Haptics.impact({ style: ImpactStyle.Light });
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
