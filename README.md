# Beatz

**A live multiplayer music party app.** Someone controls what's playing, and
the room's real-time collective reaction — the Vibe Bar — decides how long
they keep it. Every song is a collectible trading card whose stats come from
real-world popularity data, and playing one onto a deck slot is the only way
to start a reign.

Working name **AuxWars**. Built as a college hackathon project, shipped as an
installable Android APK.

```
Play  →  Vibe Bar sustains or decays  →  the room responds
```

---

## The idea

Most party apps are a shared queue. This one makes control of the music
something you can win, hold and lose in front of everyone.

- **Cards, not a playlist.** A song is a card with `hype` (where the Vibe Bar
  starts) and `stamina` (how slowly it decays), both derived from real chart
  and streaming data at mint time. A chart-topper is a burner: huge opening,
  fast decay. A deep cut holds longer. Choosing between them is the game.
- **Supply is finite.** Cards run out. Pulling the last copy of one is a real
  event, and every pull decrements supply atomically so two people cannot
  both take it.
- **The crowd is the timer.** Vibe is the room's live reaction, and what it
  does when it collapses depends on the format.

### Three control models

Every format is a variant of one of these. There are exactly three, and that
is deliberate — see `CLAUDE.md` §1.

| Model | What the crowd can do |
|---|---|
| **Contested** | Take the throne. Vibe collapse hands over to the next player in the Challenger Line. |
| **Delegated** | Feed the pool. One holder plays, but the crowd shapes the options. |
| **Spectator** | Sustain, never take over. Vibe *scores* the set rather than ending it. |

Six formats sit on top: Concert, Fest, Clubbing, Night Party, Disco, Private
Party — differing by door (open vs guest list), scale, and who may play.

---

## Built with

| Layer | Choice |
|---|---|
| App | Next.js 15 (static export), React 19, Framer Motion |
| Shell | Capacitor 6 → Android APK (`com.beatz.auxwars`) |
| Data | Supabase (Postgres 17) with row-level security |
| Realtime | Socket.io on a long-running Node process |
| Audio | Web Audio API for local FFT analysis |

**Why Capacitor and not React Native:** it runs a real browser engine, so Web
Audio FFT, media embeds and `DeviceOrientationEvent` (the Legendary holo
tilt) all keep working. A React Native port would need native replacements
for all three.

**Why two hosts:** Vercel's serverless functions cannot hold a persistent
WebSocket. The UI ships static; the Socket.io server runs separately and owns
live room state. See `docs/DEPLOY_MULTIPLAYER.md`.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm run server:dev   # Socket.io, port 3001 — needed for multiplayer
```

Create `.env.local` with your Supabase project URL and anon key
(`docs/AUTH_SETUP.md` covers the auth side). Without it the app runs on
seeded demo data rather than a live database.

### Checks

```bash
npm test                     # 190 unit tests
npm run typecheck            # tsc --noEmit
npx tsx scripts/verify.ts    # 32 invariant checks against the live database
```

`verify.ts` is the unusual one. It guards the rules in `CLAUDE.md` that must
never silently regress — economy invariants, rarity boundaries, the licensing
gate, ownership integrity — and exits non-zero, so it can gate a build. It
reads `.env.local` directly; without credentials the database-backed checks
report as skipped rather than passing vacuously.

### Building the APK

Requires JDK 17 and the Android SDK. Android Studio alone is not enough — it
ships no SDK until you download one.

```bash
export JAVA_HOME=/d/Android/jdk17
export ANDROID_HOME=/d/Android/Sdk
npm run apk:debug            # → android/app/build/outputs/apk/debug/
```

Full detail, including the release build and why `NODE_ENV=production`
matters for the WebView, is in `docs/BUILD_APK.md`.

---

## Rules that are not negotiable

These are enforced in code and checked by `scripts/verify.ts`. They exist
because each one has already been got wrong once.

- **Drops are earn-only.** There is no real-money path to currency while a
  card marketplace exists. That combination is a genuine loot-box regulatory
  risk, not a style preference — and sideloading avoids store review, not
  regulation.
- **Rarity is universal.** Computed once per card from real popularity data.
  Personalization decides *which* card inside an already-rolled tier you get,
  never the odds of the tier itself.
- **Following is discovery, never progression.** Follows and RSVPs cannot
  touch rarity, pull odds or supply. Otherwise social standing becomes a
  second progression track that buys better cards.
- **Supply decrements atomically.** `UPDATE ... WHERE remaining > 0
  RETURNING`, never read-then-write, or two people race for the last copy.
- **A tier that runs out downgrades and refunds.** Never a hard pull failure.
- **Audio is never hosted or redistributed.** Playback goes through licensed
  players and open-licensed sources. `docs/LICENSING_RIGHTS.md` records what
  each source permits, and the licensing gate in `verify.ts` fails the build
  if a card stores audio it should not.

---

## Layout

```
app/          screens (static-exported routes)
components/   UI, including the persistent MiniPlayer
lib/          domain logic — pure functions, separately tested
  domain/     vibe, wheel, activity, playback queue
server/       Socket.io realtime server
scripts/      seeding, migration, invariant checks
docs/         schema, licensing, build and deploy notes
```

`lib/domain/` is deliberately free of React and network calls, which is why
the game rules can be tested without a browser or a database.

**`CLAUDE.md` is the design record.** It holds the constraints above along
with the reasoning, including patterns that were tried and rejected. Read it
before adding a mechanic — silently reintroducing a rejected pattern is the
most likely way to break this system.

---

## Status

Working: card pulls, the deck and reign loop, the Vibe Bar, the shop and spin
wheel, packs with swipe-through reveals, a persistent mini-player that
survives navigation, people search with follow and online/offline presence,
and account deletion that fully removes your data.

Not yet: audio continuing while the app is minimised (needs an Android
foreground service and media notification), and cross-device multiplayer over
a deployed backend — the realtime server is verified locally with four
concurrent clients but has no host yet.
