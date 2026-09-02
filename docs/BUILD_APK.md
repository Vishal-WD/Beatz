# Building the AuxWars APK

## Prerequisites

- **JDK 17** and the **Android SDK** (easiest via Android Studio).
  `java -version` must work and `ANDROID_HOME` must point at the SDK.
- Node 20+, `npm install` already run.

## Build

```bash
# 1. Static export. NODE_ENV=production matters: it is what turns
#    webContentsDebuggingEnabled off, so a release APK does not ship a
#    debuggable WebView.
NODE_ENV=production CAPACITOR=1 npx next build

# 2. Copy the export into the Android project
NODE_ENV=production npx cap sync android

# 3. Assemble
cd android && ./gradlew assembleDebug      # or assembleRelease, signed
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

Or open the project in Android Studio (`npx cap open android`) and press Run.

## What is baked in at build time

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are inlined
into the JS bundle. Changing them means rebuilding — the APK has no way to
pick up new values at runtime. The anon key is safe to ship: every table is
behind RLS (docs/DATABASE.md).

## Playback on device

Songs play through Apple's 30-second preview streams, not the YouTube embed,
for every card that has a `preview_url` (currently all 60). Two things make
that work in the Android WebView, and both are already handled:

- Capacitor sets `setMediaPlaybackRequiresUserGesture(false)`, so `play()`
  is not blocked.
- The preview URLs are HTTPS, so Android's cleartext block does not apply
  and `cleartext: false` can stay off in `capacitor.config.ts`.

Audio always streams from Apple. Nothing is downloaded or cached, which is
what keeps this within docs/LICENSING_RIGHTS.md DO NOT #1.

## Verifying before you ship

`scripts/probe/apk.mjs` loads the built `out/` bundle in a real browser,
presses play, and asserts that audio is actually requested from Apple. Run
the export, serve `out/`, and point the probe at it. An HTTP 200 on a route
does not prove the app works — that assumption has already hidden two real
playback bugs.
