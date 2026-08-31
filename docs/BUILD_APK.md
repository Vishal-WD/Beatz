# BUILD_APK.md — Building the Installable APK

The web build, static export and Android project **already work** and are
verified. The only missing piece on this machine is the Java toolchain,
which Gradle needs to compile the APK.

```
✓ npm install                 436 packages
✓ npx tsc --noEmit            clean
✓ npx next build              6 routes, ~110 kB first load
✓ CAPACITOR=1 next build      static export → out/
✓ npx cap add android         android/ created
✓ npx cap sync android        assets bundled
✗ gradlew assembleDebug       JAVA_HOME is not set   ← the only blocker
```

---

## One-time setup (~15 min)

### 1. JDK 21

Capacitor 6 + Android Gradle Plugin need JDK 17 or newer; **21 is the
current LTS and the safe default**.

**Option A — with Android Studio (recommended).** Studio bundles a JDK,
so this covers both steps at once. Install from
<https://developer.android.com/studio>, then in Studio:
`More Actions → SDK Manager → SDK Platforms` → check **Android 14 (API 34)**;
`SDK Tools` → check **Android SDK Build-Tools** and **Platform-Tools**.

**Option B — JDK only** (if you already have the SDK): install
[Temurin 21](https://adoptium.net/temurin/releases/?version=21).

### 2. Environment variables

PowerShell, run once — adjust paths if you installed elsewhere:

```powershell
# JDK bundled with Android Studio
[Environment]::SetEnvironmentVariable(
  'JAVA_HOME', 'C:\Program Files\Android\Android Studio\jbr', 'User')

# Android SDK (default location)
[Environment]::SetEnvironmentVariable(
  'ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
```

**Open a new terminal** afterwards — existing shells keep the old
environment. Verify:

```bash
java -version      # expect 21.x
echo $ANDROID_HOME
```

### 3. Accept SDK licences

```bash
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses
```

Gradle fails with a licence error if this is skipped.

---

## Building

### Debug APK — for testing on your own phone

```bash
npm run apk:debug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

That script runs the full chain: `CAPACITOR=1 next build` → `cap sync` →
`gradlew assembleDebug`. Rebuild after any code change — Capacitor bundles
a **snapshot** of `out/`, so an un-synced change will not appear in the APK.

### Install on a phone

**Over USB:**
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
Requires Developer Options → USB Debugging on the phone.

**Without a cable:** copy the `.apk` to the device and open it. Android
prompts to allow "install from unknown sources" — expected for a
sideloaded app, not an error.

### Release APK — signed, for distribution

A debug APK is signed with a throwaway key Android will not accept from
other installers. For real distribution, generate a keystore **once**:

```bash
keytool -genkey -v -keystore beatz-release.keystore \
  -alias beatz -keyalg RSA -keysize 2048 -validity 10000
```

> **Back this file up and never commit it.** Losing it means you can never
> ship an update that Android will accept as the same app. It is already
> covered by `.gitignore`.

Create `android/key.properties` (also gitignored):

```properties
storeFile=../../beatz-release.keystore
storePassword=<your password>
keyAlias=beatz
keyPassword=<your password>
```

Then:
```bash
npm run apk:release
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Pointing the APK at the backend

The APK ships with the backend URL **compiled in** — it is baked at build
time, so it cannot be changed after the fact without rebuilding.

Create `.env.local` before building:

```bash
NEXT_PUBLIC_API_URL=https://beatz-realtime.onrender.com
```

Deploy the backend **before** the final APK build (see
`docs/DEPLOYMENT.md`). Building against `localhost` produces an APK that
works only in an emulator on your machine.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `JAVA_HOME is not set` | No JDK | Step 1–2 above |
| `SDK location not found` | `ANDROID_HOME` unset | Step 2, then new terminal |
| `Failed to install ... INSTALL_FAILED_UPDATE_INCOMPATIBLE` | A debug and release build of the same appId | `adb uninstall com.beatz.auxwars` first |
| Blank white screen on launch | `out/` stale or missing | `npx cap sync android` and rebuild |
| App loads but no live data | Wrong/unreachable `NEXT_PUBLIC_API_URL` | Check the backend is awake (Render free tier sleeps) |
| Fonts look wrong offline | Google Fonts CDN unreachable | Self-host the four fonts — see `docs/DEMO_FALLBACKS.md` |
| Gradle daemon OOM | Low heap | Add `org.gradle.jvmargs=-Xmx2048m` to `android/gradle.properties` |

## What is not in the APK

By design (`CLAUDE.md` §7.1): no SSR, no API routes, no database
credentials. The APK is a static bundle that talks to the hosted backend
over HTTPS. Anything holding a secret lives server-side — the APK ships to
devices we do not control.
