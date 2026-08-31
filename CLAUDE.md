# CLAUDE.md — Project Context for Beatz (AuxWars)

This file is the persistent context Claude Code should read at the start
of every session in this repo. It describes what the product is, the
rules that must never be silently violated, and where to find deeper
detail when a task needs it.

## 1. What this project is

Beatz (working name "AuxWars") is a live, multiplayer music party app.
Someone controls what's playing, and the room's real-time collective
reaction — the **Vibe Bar** — decides how that goes. Every song is a
collectible trading card with real-world-popularity-derived stats, and
playing a card onto a deck slot is the only way to start a reign.

**The core loop:**
`Play → Vibe Bar sustains or decays → the room responds`

How the room responds depends on the format's **control model**. There
are exactly three, and every feature must be a variant of one of them:

- **Contested** — the crowd can take the throne. Vibe collapse hands
  over to the next player in the Challenger Line. *(This was the
  original single loop, and it is still the default.)*
- **Delegated** — one holder plays, but the crowd feeds the pool they
  choose from. The holder keeps control; the crowd shapes the options.
- **Spectator** — hosts play; the crowd sustains but never takes over.
  Vibe **scores the set** rather than ending it.

**Adding a fourth control model requires an explicit decision recorded
here.** If a task seems to need one, stop and flag it — that is almost
always drift, not a new mechanic.

*(History: this section previously mandated a single contested loop.
Rewritten 2026-08-31 when the six formats in §1.1 were adopted, three of
which remove the dethrone step. The rewrite was deliberate, not an
erosion — see `docs/superpowers/specs/2026-08-31-formats-and-rooms-design.md` §1.)*

### 1.1 Formats

Six formats, each pinned to one control model:

| Format | Control | Who plays | Cards from | Entry | Floor |
|---|---|---|---|---|---|
| **Concert** | Spectator | One or more hosts | Hosts' own | Guest list | Any |
| **Fest** | Spectator | One or more hosts | Hosts' own | Open | Large |
| **Clubbing** | Spectator | One DJ | DJ's own only | Guest list | Large |
| **Night Party** | Delegated | One DJ | Crowd offers, DJ picks | Guest list | Any |
| **Disco** | Contested | Anyone | Own | Open | Medium |
| **Private Party** | Contested | Anyone | Own | Guest list | Small |

Concert and Fest differ only by door and scale. Clubbing is a stricter
Concert — one performer, and the crowd never contributes. Disco and
Private Party are the same contested loop at different doors and sizes.

**Two independent axes, never collapsed into one enum:**

- **Visibility** — who may *enter* (open / guest list)
- **Card rule** — what may be *played* (§4's `mode`: casual / event)

A public night can be owned-cards-only; a private one can allow Guest
Cards. Merging these is the obvious shortcut and it is wrong.

### 1.2 The social layer

Scheduled nights, RSVPs, following and an activity feed are part of the
product, not a bolt-on. They schedule, gather and advertise a session;
the session itself always runs one of the three control models above.

**Guard rails — these bind regardless of format:**

- Every scheduled night **resolves into a room** running a control
  model. A night that opens into nothing is drift.
- Following and RSVPs **never affect card rarity, pull odds, or supply**
  (§2, §3). Social standing must not become a second progression track
  that buys better cards — that would recreate the pay-to-win shape §3
  exists to prevent.
- **Shoutouts are display-only** (card credit, occasion dedications,
  requests). They award no Drops and confer no mechanical advantage.
- Drops stay **earn-only** (§3). RSVPs, follows, hosting and shoutouts
  are never sold, and never a real-money path.
- Vibe always means the room's live collective reaction, in every
  control model. In Spectator formats it scores the set and **cannot end
  one** — low vibe is a weak set the room can see, not a forfeit.

## 2. Card system (source of truth — see `docs/CARD_SCHEMA.md` for full detail)

Three card types, do not conflate them:
- **Song Card** — a specific song (solo or collab), owned/collectible,
  dragged onto the deck to start a reign. Stats: `hype` (sets starting
  Vibe Bar position) and `stamina` (sets decay rate), both derived from
  real popularity data at mint time.
- **Profile Card** — a player's own stats (Total Reigns Won, Peak Vibe,
  Challenger Win Rate). Same visual template as a Song Card, different
  data source. This IS the user's profile.
- **Guest Card** — auto-generated from OS "now playing" sync. Never
  owned, never enters the scarce supply pool, **only usable in Casual
  Rooms** (blocked in Event Rooms — see Section 4).

Rarity is computed once per card from real popularity data and is
**universal** — never let personalization or user stats change rarity
odds directly. Personalization only affects *which* card within an
already-rolled tier gets picked (`0.7 × affinity + 0.3 × random`).

## 3. Economy rules (do not violate without flagging to the user)

- Currency is **Drops** (renamed from "VP" — also the name for a live
  Peak Moment payout; keep this dual meaning in copy, it's intentional).
- Drops are **earn-only**. Never implement a real-money purchase path
  for Drops while a card-sell/marketplace path exists — that combination
  is a real regulatory loot-box risk. This is a hard constraint, not a
  style preference.
- Card supply is finite and scales with active users:
  `base_supply[rarity] + floor(active_users / N)`. All pulls/sales that
  decrement supply MUST be atomic DB operations
  (`UPDATE ... WHERE remaining > 0 RETURNING`), never read-then-write,
  to prevent race conditions on the last copy of a card.
- Legendary cards come from exactly two paths: (1) discrete stat
  milestones (guaranteed pull, not probability-scaled), or (2) a live
  Peak Moment during a reign (mints a brand-new card directly). Do not
  add a third path that smoothly scales legendary odds with playtime —
  this was deliberately rejected; it breaks fairness and makes the
  demo's key moment un-triggerable on cue.

## 4. Room modes

- **Casual Room** (default): Guest Cards (OS auto-sync) allowed.
- **Event Room**: Guest Cards blocked — owned cards only. One enum
  field on the room object, one conditional in the "play a card"
  handler. This is the only place room "mode" should ever branch logic.

## 5. Data sourcing — legitimacy is a hard requirement

See `docs/LICENSING_RIGHTS.md` before adding any new external data
source or asset. Summary of current approved sources:
- **MusicBrainz + Cover Art Archive** — canonical open catalog/artist/
  collab data, the actual "open source" layer.
- **Spotify Web API** (Client Credentials) — popularity/followers/
  artwork metadata only. Do NOT rely on `preview_url` or the
  recommendations/audio-features endpoints — deprecated for new apps
  since Nov 27, 2024.
- **Deezer API** — popularity ("rank") + artwork, secondary source.
- **iTunes Search API** — artwork fallback, still has 30s previews if
  ever needed for a non-Spotify path.
- **Jamendo** — the ONLY source for actually playable, locally-analyzed
  audio (Web Audio API FFT needs same-origin, CC-licensed audio). Use
  this for any track that needs real waveform analysis.
- Playback of mainstream/recognizable tracks happens via **YouTube
  IFrame embed** or **Spotify app handoff** — audio is never downloaded,
  stored, or redistributed by this app. This is what keeps the app
  copyright-clean: we display/link to licensed players, we don't host
  audio ourselves except CC-licensed local-analysis tracks.

## 6. Known fallbacks already designed (implement, don't re-derive)

- Guest Card / card-only-queueing conflict → solved by Guest Cards
  being temporary, unowned, Casual-Room-only.
- Simultaneous Challenger Line joins → atomic increment, not array push.
- Trade race vs. Dust → card locked `pending_trade` on offer, blocks
  dust/other trades until resolved/expired.
- WebSocket drop mid-reign → 3–5s grace window holding last known Vibe
  Bar value before decay resumes, not instant zero.
- Empty/solo room → "Solo Practice" mode simulates baseline crowd
  energy, clearly labeled as practice.
- Rarity tier fully exhausted → downgrade one tier + refund Drops
  difference, never a hard pull failure.

## 7. Tech stack (do not introduce alternatives without discussion)

Next.js, Socket.io, Redis (ephemeral room/energy state), PostgreSQL
(persistent data), Framer Motion (animation), Web Audio API (local
file analysis only), YouTube IFrame API, Spotify OAuth+Search (PKCE),
`playerctl` via a small companion agent (Linux MPRIS2 OS sync — build
this OS first, Windows/Mac are stretch/roadmap).

### 7.1 Delivery target — DECIDED 2026-08-31

Ships as an **installable Android APK**, not a web link. Built with
**Capacitor** wrapping the Next.js app — chosen over React Native
specifically to *keep* the stack above intact rather than replace it.

- Web Audio FFT, YouTube IFrame embeds, and `DeviceOrientationEvent`
  (the Legendary holo tilt) all keep working — Capacitor runs a real
  browser engine. A React Native port would need native replacements
  for all three, and would reopen the YouTube licensing question that
  `docs/LICENSING_RIGHTS.md` §2.7 currently answers safely.
- Screen 01 (The Throne Room, 1280×720 shared display) stays the same
  codebase at a different route — it is inherently a web view.
- **Backend is hosted**, not bundled. The APK ships pointing at a
  deployed Next.js + Socket.io server, so multiplayer is real across
  devices. `NEXT_PUBLIC_API_URL` is baked in at build time.
- Next.js runs in **static export** mode (`output: 'export'`) for the
  Capacitor bundle. No SSR, no API routes inside the APK — all server
  work lives on the hosted backend.

**Direct APK distribution is not the Play Store**, but it does not relax
§3: Drops stay earn-only alongside the marketplace. Sideloading avoids
store review; it does not avoid loot-box regulation.

## 8. Where to look for more detail

- `docs/DATABASE.md` — live Supabase schema, RLS, and the atomic
  supply decrement (project `auxwars`, separate from `Circl`)
- `docs/CARD_SCHEMA.md` — full data model for all three card types
- `docs/LICENSING_RIGHTS.md` — per-source terms and what's safe to do
- `docs/DATA_POPULATION.md` — how the initial song/artist/card pool
  gets seeded before launch/demo
- `docs/DEMO_FALLBACKS.md` — everything that must be pre-seeded or
  tested before a live demo (seeded milestone accounts, network
  contingency, iOS permission prompts, etc.)

When a task touches something not covered above, ask before assuming —
this system has already had several rounds of design correction, and
silently reintroducing a previously-rejected pattern (parallel game
modes, smooth legendary-probability scaling, real-money Drops) is the
most likely failure mode.
