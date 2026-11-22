import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.evenkeel.android',
  appName: 'Evenkeel',
  webDir: 'dist',
  android: { allowMixedContent: false },
  backgroundColor: '#F3F5F7',
};

export default config;
