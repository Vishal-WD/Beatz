---
name: build-apk
description: Use when building, rebuilding, or debugging the AuxWars Android APK — including "make an APK", "build for Android", Capacitor sync issues, blank screens in the app, or signing for distribution.
---

# Building the APK

AuxWars ships as an installable Android APK: Next.js static export wrapped
in Capacitor (`CLAUDE.md` §7.1). Full reference in `docs/BUILD_APK.md`.

## The chain

```bash
npm run apk:debug     # CAPACITOR=1 next build → cap sync → gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

Each step matters:
1. `CAPACITOR=1 next build` — static export to `out/`. The env var switches
   on `output: 'export'`; without it you get a server build Capacitor cannot
   bundle.
2. `npx cap sync android` — copies `out/` into the Android project.
3. `gradlew assembleDebug` — compiles the APK.

## Prerequisites

Gradle needs a JDK and the Android SDK. Check first:

```bash
java -version && echo "$ANDROID_HOME"
```

If either is missing, **stop and tell the user** — do not attempt to
install a multi-GB SDK unprompted. `docs/BUILD_APK.md` has the setup steps.

## Rules that matter

**Always sync after a code change.** Capacitor bundles a *snapshot* of
`out/`. Editing a component and running Gradle alone ships the previous
build — this is the single most common source of "my change didn't appear".

**The backend URL is baked in at build time.** `NEXT_PUBLIC_API_URL` is
compiled into the bundle. Building against `localhost` produces an APK that
only works in an emulator on the build machine. Set it in `.env.local`
before a distribution build.

**Never commit the keystore.** Losing `beatz-release.keystore` means never
shipping an update Android accepts as the same app; committing it lets
anyone publish as you. Already in `.gitignore` — keep it that way.

**No secrets in the APK.** It ships to devices we do not control. Anything
holding a credential lives on the hosted backend. Never put a secret behind
a `NEXT_PUBLIC_` prefix — that prefix means "compiled into the client and
visible to anyone with the file".

## Debugging

| Symptom | Cause | Fix |
|---|---|---|
| `JAVA_HOME is not set` | No JDK | `docs/BUILD_APK.md` step 1–2 |
| `SDK location not found` | `ANDROID_HOME` unset | Set it, **open a new terminal** |
| Blank white screen | `out/` stale or missing | `npx cap sync android`, rebuild |
| Change didn't appear | Skipped the sync | Use `npm run apk:debug`, not bare Gradle |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Debug vs release signing | `adb uninstall com.beatz.auxwars` |
| Works on wifi, dead on mobile data | Backend unreachable | Check `NEXT_PUBLIC_API_URL` is public, not LAN |
| Fonts wrong offline | Google Fonts CDN | Self-host the four faces |

Live logs from a connected device:
```bash
adb logcat | grep -i -E "capacitor|chromium|beatz"
```

## Verifying before you claim it works

```bash
ls -la android/app/build/outputs/apk/debug/app-debug.apk
```

An APK that builds is not an APK that runs. If the user needs confidence,
install it and open it — a blank screen still produces a passing Gradle
build.
