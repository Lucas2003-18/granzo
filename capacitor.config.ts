import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meufinanceiro.app',
  appName: 'Meu Financeiro',
  webDir: 'dist',
  android: {
    buildOptions: {
      releaseType: 'APK',
    }
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
