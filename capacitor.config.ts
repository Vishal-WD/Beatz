import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the static Next.js export as an Android app.
 * Build: CAPACITOR=1 npm run build && npx cap sync android
 */
const config: CapacitorConfig = {
  appId: 'com.beatz.auxwars',
  appName: 'Beatz',
  webDir: 'out',

  android: {
    // Stage black (CLAUDE.md design tokens) — avoids a white flash on launch.
    backgroundColor: '#160f26',
    // Release builds must not ship a debuggable WebView.
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
  },

  server: {
    androidScheme: 'https',
    /*
      The APK talks to the hosted backend; it bundles no server of its own.
      cleartext stays false — Render and Vercel are both HTTPS.

      LAN_DEV=1 opens it, and ONLY then, so a phone can reach a realtime
      server running on a laptop over plain http://192.168.x.x during
      testing. It is deliberately an explicit opt-in rather than a value
      someone edits and forgets: a release built without the flag cannot
      ship cleartext by accident.
    */
    cleartext: process.env.LAN_DEV === '1',
  },

  plugins: {
    // Gyroscope for the Legendary holo tilt (CARD_ART_GENERATION.md §3).
    // Android needs no runtime permission for the accelerometer; iOS would.
    Motion: {},
  },
};

export default config;
