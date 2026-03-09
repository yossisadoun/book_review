import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.bookreview.app',
  appName: 'Book.luv',
  webDir: 'out',
  ios: {
    scrollEnabled: false,
    allowsLinkPreview: false,
  },
  server: {
    iosScheme: 'capacitor',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 0
    },
    StatusBar: {
      style: 'DEFAULT'
    },
    Keyboard: {
      resize: KeyboardResize.None,
      resizeOnFullScreen: true,
    }
  }
};

export default config;
