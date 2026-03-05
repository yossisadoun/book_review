import type { CapacitorConfig } from '@capacitor/cli';

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
    }
  }
};

export default config;
