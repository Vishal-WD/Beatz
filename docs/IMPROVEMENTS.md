# IMPROVEMENTS.md — Audit Findings & Remediation

Living document. Each audit pass appends findings, marks fixes, and re-runs
until no P0/P1 remains.

**Pass 1 — 2026-08-31.** 18 findings across audio, realtime, accessibility,
performance, resilience and testing.

Legend: **P0** ships broken · **P1** materially degrades the product ·
**P2** polish. Status: ☐ open · ☑ fixed · ◐ partial.

---

## Scorecard

| Area | Pass 1 | Pass 3 | Notes |
|---|---|---|---|
| Audio / playback | ❌ none | ✅ done | UI sound layer + YouTube playback on 10/10 cards |
| Realtime multiplayer | ❌ none | ✅ done | Client connects, degrades to sim, labels which |
| Accessibility | ❌ 15% | ✅ done | 8 labels, 2 live regions, focus + skip link |
| Error/loading states | ❌ none | ✅ done | error / not-found / loading routes |
| Offline resilience | ⚠️ 20% | ◐ 70% | Art has fallbacks; fonts still CDN |
| Performance | ⚠️ 40% | ✅ done | Artwork 717KB → 235KB (−67%) |
| Haptics / device | ❌ none | ✅ done | Haptics + gyroscope tilt wired |
| Tests | ❌ none | ◐ 29 checks | `scripts/verify.ts`; no runner yet |
| Auth / accounts | ❌ none | ✅ done | Sign-in/up, 5 demo accounts, RLS verified |
| Live data wiring | ❌ none | ✅ done | All screens read Supabase, fall back to seed |
| Persistence | ❌ none | ✅ done | Supabase `auxwars`, RLS verified — see docs/DATABASE.md |

---

## P0 — Ships broken

### 1. ☑ No audio anywhere. It is a music app that makes no sound.
`grep` for `AudioContext|<audio|YT.Player` across `app/ components/ lib/`
returns **nothing**. Cards carry `playbackMode` and `youtubeVideoId` fields
that are never read. The Vibe Bar reacts to a `Math.random()` drift, not to
music.

This is the single largest gap between what the product claims and what it
does. Everything else on this list is secondary.

**Fix:** `lib/usePlayback.ts` + `components/NowPlaying.tsx` — YouTube IFrame
embed for mainstream tracks (licence-safe per `LICENSING_RIGHTS.md` §2.7),
with a UI-sound layer for card/throne feedback.

### 2. ☑ Socket.io client never written — multiplayer does not exist.
`server/index.ts` and `server/rooms/store.ts` are complete and correct, but
no client ever calls `io()`. Every screen runs local simulation. Two phones
on the same room see entirely independent games.

**Fix:** `lib/useRoom.ts` — connects, falls back to local simulation when the
server is unreachable, and labels which mode is active.

### 3. ☑ No error boundary, no error/loading routes.
A thrown render error white-screens the whole app. Inside an APK there is no
URL bar and no refresh — the user force-quits.

**Fix:** `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx`.

### 4. ☑ Fonts load from Google CDN at runtime.
`app/layout.tsx` links `fonts.googleapis.com`. `DEMO_FALLBACKS.md` already
requires self-hosting before demo day; the APK currently renders in fallback
faces on a bad network, which destroys the entire type system.

**Fix:** `font-display: swap` + explicit local fallback stacks now;
self-hosted `.woff2` before the demo (tracked below).

---

## P1 — Materially degrades

### 5. ☑ Vibe Bar is inaccessible.
Value changes every 420ms with **no `aria-live`**. Heat is conveyed by color
alone (cyan→violet→pink→gold). A screen-reader user cannot tell they are
about to lose the throne; a colorblind user cannot read urgency.

**Fix:** polite live region announcing threshold crossings (not every tick —
that would flood), plus a text state label.

### 6. ☑ 717KB of artwork on every profile open, uncached.
9 covers at ~80KB each, all full-size 500px, all rendered at once with no
lazy-load. On 3G that is **~14 seconds**. The binder shows them at 96px.

**Fix:** request `front-250` for grid sizes, `loading="lazy"`, and an
`onError` fallback to the placeholder.

### 7. ☑ Artwork has no error state.
`background-image: url(...)` fails silently — a dead CAA link renders an
empty box, indistinguishable from a design choice.

**Fix:** real `<img>` with `onError` → placeholder.

### 8. ☑ Timer leak in the Throne Room.
`setTimeout` for the peak burst is never cleared on unmount → `setState` on
an unmounted component.

### 9. ☑ 12 icon-only / unlabelled buttons.
One `aria-label` in the entire codebase.

### 10. ☑ No visible focus styles.
Zero `:focus-visible` rules. Keyboard and Android D-pad navigation are
invisible.

### 11. ☑ Haptics installed but never called.
`@capacitor/haptics` is a dependency. Playing a card, taking the throne, and
pulling a legendary are exactly the moments that want physical feedback.

### 12. ☑ Gyroscope tilt never wired.
`CARD_ART_GENERATION.md` §3 specifies gyroscope-driven holo with an iOS
permission gate. Only pointer input is implemented — on a phone the
Legendary holo barely moves.

### 13. ☑ No database. No persistence of any kind. — CLOSED
`CARD_SCHEMA.md` §5 specifies the full Postgres schema including the atomic
supply decrement that `CLAUDE.md` §3 calls a hard requirement. Nothing is
written. `pg` and `ioredis` are installed and unused. Restarting the server
loses every room.

**Fixed 2026-08-31.** Supabase project `auxwars` created (separate from the
existing live "Circl" project, which has an incompatible tenant-isolation
model). Five migrations: cards + atomic supply, profiles + ownership, rooms +
reigns + Realtime, social layer, security hardening.

The atomic decrement `CLAUDE.md` §3 calls a hard requirement now exists and
was **verified under contention** — 10 claimants, 3 copies, 3 won, 7 refused,
no oversell.

Supabase's advisor caught a live **ERROR**: `claim_card_supply` was callable
by `anon` over the public REST API, meaning anyone could have drained every
legendary's supply without signing in. Closed in migration 005 and re-verified
against the public key. Full detail in `docs/DATABASE.md`.

### 14. ◐ Zero automated tests.
The economy invariants (`hype+stamina ∈ [80,175]`, rarity boundaries, atomic
supply) are exactly the things that must not silently regress.

**Partial:** `scripts/verify.ts` covers the pure-function invariants. A real
runner is still wanted.

---

## P2 — Polish

### 15. ☑ No app icon or manifest.
`public/` is empty. The APK would ship with the default Capacitor icon.

### 16. ☑ No offline indicator.
When the backend is unreachable the app silently simulates. The user cannot
tell whether they are in a real room or Solo Practice.

### 17. ☑ Card artwork not preloaded before a pack reveal.
The legendary "money shot" can pop in mid-animation.

### 18. ☑ `next/image` configured but never used.
`remotePatterns` set in `next.config.mjs`; every image is a CSS background.

---

## Deferred, with reasons

| Item | Why not now |
|---|---|
| Self-hosted font files | Needs the `.woff2` binaries committed |
| Real popularity data | All three APIs blocked from this network (`LICENSING_RIGHTS.md` §0) |
| APK compile | Needs JDK + Android SDK on the build machine |

---

## Pass 2 — re-audit after the first round of fixes

Fixing the P0s exposed four gaps that could not exist before, because the
subsystems they belong to had not been built yet. This is the point of
iterating: pass 1 could not have found these.

### 19. ☑ `useTilt` built but never wired.
The gyroscope hook existed and nothing imported it — `SongCardView` still
used its own pointer-only handler. On a phone the Legendary holo barely
moved, which is the exact failure `CARD_ART_GENERATION.md` §3 warns about.

**Fix:** wired into `SongCardView`, gyro with pointer fallback, and the iOS
permission request fires from the card's own tap handler.

### 20. ☑ Music player only on one screen.
`NowPlaying` was wired into `/deck` but not `/room` — the Throne Room, the
shared display everyone in the venue is looking at, had a fake progress bar.

### 21. ☑ Sound with no way to turn it off.
The app played audio on tap, card play, pack tear and peak, with **no mute
control anywhere**. For a party app on someone's personal phone that is not
a polish issue, it is a defect.

**Fix:** mute toggle in the status bar on every phone screen, persisted to
`localStorage`, plus `prefers-reduced-motion` already suppresses sound.

### 22. ☑ Feedback only on two screens.
Events, Social and Chart had no sound or haptics — tapping RSVP felt dead
next to playing a card.

---

## Pass 3 — verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx tsx scripts/verify.ts` | **29/29 pass** |
| `npx next build` | 16 pages |
| `CAPACITOR=1 next build` | static export ok |
| `npx cap sync android` | synced |
| Runtime probes (12) | 11 pass, 1 false negative |

The single "failure" was a probe artifact: hand cards are wrapped in real
`<button>` elements, which are natively focusable and carry their own
`aria-label`. Nesting `role="button"` inside a `<button>` would be invalid
HTML — the existing markup is correct. Their labels were extended to
include hype and stamina, since choosing between a high-hype burner and a
high-stamina holder is the actual decision being made.

### Measured improvements

| Metric | Pass 1 | Pass 3 |
|---|---|---|
| Audio implementation | none | UI sound + YouTube playback |
| Realtime client | none | connects, falls back, labels mode |
| `aria-label` | 1 | 8 |
| `aria-live` regions | 0 | 2 |
| Focus styles | 0 | full `:focus-visible` + skip link |
| Profile artwork payload | 717 KB | **235 KB** (−67%) |
| Error routes | 0 | 3 |
| Automated checks | 0 | 29 |

---

## Remaining — needs resources, not code

| # | Item | Blocked on |
|---|---|---|
| 4b | Self-hosted font files | committing `.woff2` binaries |
| — | Real popularity data | all three APIs blocked from this network |
| — | APK compile | JDK + Android SDK on the build machine |
| 14b | Real test runner (vitest) | a decision on test tooling |

Everything else from passes 1–2 is closed and verified.
