import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bookreview.app',
  appName: 'BOOK',
  webDir: 'out',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    StatusBar: {
      style: 'DEFAULT'
    }
  }
};

export default config;
