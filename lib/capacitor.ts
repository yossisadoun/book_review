import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

export const isNativePlatform = Capacitor.isNativePlatform();
export const isAndroid = isNativePlatform && Capacitor.getPlatform() === 'android';

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
    await Browser.open({ url, presentationStyle: 'popover' });
    return;
  }
  window.location.assign(url);
}

/**
 * Open a URL as a deep link on native platforms.
 * Uses a hidden iframe to trigger universal link handling on iOS,
 * opening the target app (e.g. Apple Music, Spotify, Podcasts) directly.
 * If the link isn't handled as a universal link, falls back to in-app browser.
 * The iframe approach avoids navigating the WebView away from the app.
 */
export async function openDeepLink(url: string): Promise<void> {
  if (isNativePlatform) {
    let didLeaveApp = false;

    // Listen for app going to background (means deep link worked)
    const onPause = () => { didLeaveApp = true; };
    document.addEventListener('pause', onPause, { once: true });

    // Use a hidden iframe to trigger universal link without navigating the WebView
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 100);

    // If we're still in the app after 800ms, the URL wasn't handled — open in browser
    setTimeout(async () => {
      document.removeEventListener('pause', onPause);
      if (!didLeaveApp) {
        await Browser.open({ url, presentationStyle: 'popover' });
      }
    }, 800);
    return;
  }
  window.open(url, '_blank');
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
  try {
    await PushNotifications.register();
  } catch (e) {
    console.warn('PushNotifications.register() failed (Firebase may not be configured):', e);
  }
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

// Cross-platform storage helpers (uses Preferences on native, localStorage on web)
export async function storageSet(key: string, value: string): Promise<void> {
  if (isNativePlatform) {
    await Preferences.set({ key, value });
  } else {
    localStorage.setItem(key, value);
  }
}

export async function storageGet(key: string): Promise<string | null> {
  if (isNativePlatform) {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  }
  return localStorage.getItem(key);
}

export async function storageRemove(key: string): Promise<void> {
  if (isNativePlatform) {
    await Preferences.remove({ key });
  } else {
    localStorage.removeItem(key);
  }
}

// Android hardware back button listener
export function listenForBackButton(handler: () => void): () => void {
  if (!isNativePlatform) return () => {};
  let removeListener = () => {};

  App.addListener('backButton', () => {
    handler();
  }).then((listener) => {
    removeListener = () => listener.remove();
  });

  return () => removeListener();
}

// Exit the app (Android)
export function exitApp(): void {
  if (!isNativePlatform) return;
  App.exitApp();
}

// App lifecycle listener for background/foreground events
export function listenForAppStateChange(handler: (isActive: boolean) => void): () => void {
  if (!isNativePlatform) return () => {};
  let removeListener = () => {};

  App.addListener('appStateChange', (state) => {
    handler(state.isActive);
  }).then((listener) => {
    removeListener = () => listener.remove();
  });

  return () => removeListener();
}
