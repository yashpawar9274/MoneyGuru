import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.moneyguruai.app',
  appName: 'MoneyGuruAI',
  webDir: 'android-shell',
  server: { url: 'https://moneyguruai.dev', cleartext: false },
  android: { allowMixedContent: false },
};

export default config;