import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.appinterfone.app',
  appName: 'App Interfone',
  webDir: 'dist',
  server: {
    // Allow mixed content and navigation to the API server
    androidScheme: 'https',
    // In production, all API calls go to appinterfone.com.br via apiFetch
    // The allowNavigation permits WebView to open these origins
    allowNavigation: ['appinterfone.com.br', '*.appinterfone.com.br'],
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Keyboard behavior
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    // Push Notifications (Firebase Cloud Messaging)
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    // Local Notifications — notification channels for Android
    LocalNotifications: {
      channels: [
        {
          id: 'interfone_calls',
          name: 'Chamadas do Interfone',
          description: 'Notificações de chamadas do interfone digital',
          importance: 5, // IMPORTANCE_HIGH — heads-up, sound, vibrate
          visibility: 1, // PUBLIC
          sound: 'ringtone', // Uses system ringtone
          vibration: true,
          lights: true,
        },
      ],
    },
    // Force fetch/XMLHttpRequest through the native bridge on Android/iOS.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
