# AuxWars App Redesign — Design

**Date:** 2026-09-03
**Status:** Approved in brainstorming, pending spec review

## Why

The app works but does not yet behave like a product. Six things are wrong,
and they are all the same kind of wrong — the mechanics exist but the
experience around them does not:

1. **Signup drops you straight into the room.** No welcome, and the starter
   pack's 21 cards materialise invisibly in the database. Opening a pack is
   the best moment in the app and a new player never gets to do it.
2. **The room says "THRONE" in every format.** A Concert reads as a
   contested duel when it is a performance, and vibe depletion ends sets
   that CLAUDE.md §1.2 says can never be ended.
3. **One pack at one price.** No ladder, nothing to save for.
4. **The feed is a text log of your own actions** — 358 "You pulled X" rows
   telling you what you already know.
5. **The collection is not playable.** The binder shows cards; you cannot
   hear them or manage them.
6. **Every screen flashes signed-out on load** before the session resolves.

---

## 1. Navigation

Six text tabs become five icon tabs. Six labels at 9px is why the bar reads
as cramped.

| Tab | Route | Purpose |
|---|---|---|
| **Room** | `/deck` | The live room — play, vibe, queue |
| **Feed** | `/feed` | Event grid |
| **Shop** | `/packs` | Three pack tiers |
| **Chart** | `/chart` | Scarcity ranking |
| **You** | `/profile` | Collection, profile, settings |

`/events` and `/social` merge into **Feed**, a new route.

**Routes keep their current paths; only the tab labels change.** `/room` is
already taken by the 1280×720 Throne Room shared display (CLAUDE.md §7.1),
which is a different screen for a different device — renaming `/deck` to
`/room` would collide with it. Renaming the other paths would mean rewriting
every internal link and re-generating the static export's route list for no
user-visible gain, since the APK has no address bar.

### 1.1 The sign-in flash

`useAuth` exposes `state: 'loading' | 'signed-in' | 'anonymous'`, but every
screen reads `isSignedIn`, which is `state === 'signed-in'` — false while
loading. So each screen renders its signed-out view for a beat before the
session resolves.

Screens branch on the three-state value and render a skeleton during
`loading`. `isSignedIn` stays for the cases that genuinely only care about
the resolved answer.

---

## 2. The room

One screen, three shapes, chosen by the room's format. The format table in
CLAUDE.md §1.1 already decides who may play; this section decides what the
room *looks* like and what the vibe bar *means*.

### 2.1 Spectator — Concert, Fest, Clubbing

A performance, not a contest.

- A **rotating disc** at the top carrying the performer's name and a
  **Follow** button.
- **No depletion, no dethroning.** Hold-to-Vibe becomes applause: it scores
  the set and can never end it (CLAUDE.md §1.2). The domain already enforces
  this via `canDethrone`; the screen must stop implying otherwise.
- **Clubbing** — one DJ, invited at room creation, holds the mic for the
  whole set. No voting.
- **Concert / Fest** — several mic people, who decide among themselves. The
  room picks ONE mode at creation:

  | Mode | Behaviour |
  |---|---|
  | **SOLO MIC** | One person holds the mic. Others tap STEP IN; the other mic people vote; a majority passes the mic **after the current song ends**, never mid-track. |
  | **VOTE EACH SONG** | Mic people nominate a card from their own deck. Most votes plays next. |
  | **PRIOR SETLIST** | Everyone contributes cards before the room opens; the list plays through. |

**Only mic people vote.** The crowd watches and vibes. This is what keeps
Spectator meaning "the crowd sustains but never takes over" — a crowd vote
would make it Delegated.

### 2.2 Delegated — Night Party

Unchanged: the crowd offers cards, the DJ picks from the pool.

### 2.3 Contested — Disco, Private Party

Current player plus a visible queue. You **queue a specific card**, not just
a slot, so the room can see what is coming. Dethroning survives only here,
because taking turns is the point of these two formats.

### 2.4 Playback

Whoever holds the mic chooses **30s preview** or **full track** per song.
Both paths already exist: the Apple preview (`usePreviewAudio`) and the
YouTube embed (`usePlayback`).

---

## 3. Onboarding and economy

### 3.1 First run

`welcome → tear open the 21-card starter pack → 500 Drops`

The starter grant already exists server-side and is atomic. What changes is
that the player **opens** it rather than finding it already done.

### 3.2 Pack tiers

| Pack | Cost | Cards | Guarantee |
|---|---|---|---|
| **STARTER** | 150 | 3 | — |
| **NIGHT** | 400 | 5 | — |
| **HEADLINER** | 900 | 5 | At least one epic or legendary |

500 starting Drops buys one Night, or three Starters. Headliner is the thing
to save for.

Odds are **fixed constants per tier**, never scaled by playtime or spend
(CLAUDE.md §3). Headliner's guarantee is a floor applied after the roll, not
a probability ramp — the rejected pattern is a curve that improves with
engagement, and a flat per-tier floor is not that.

All three tiers go through the existing atomic `open_pack`, which already
refuses an unaffordable purchase and cannot double-spend.

---

## 4. Feed

A grid of event tiles, each illustrated by a **collage of card artwork from
cards played at that event** — a 2×2 mosaic, like a playlist cover, built
from artwork already in the `cards` table. No uploads, no storage bucket, no
new column.

An event with no plays yet falls back to its existing poster gradient.
Live events carry a pulse indicator. Tapping a tile opens the event.

**Your own pulls no longer feed anything.** That is the 358 rows making the
current feed useless.

---

## 5. You

One screen, four jobs:

- **Collection** — a grid of the cards you own, **tap to play the 30s
  preview inline**, without leaving the page.
- **Filters** — by rarity, and by language (Tamil / Hindi / English).
- **Edit profile** — display name and handle.
- **Theme toggle** — light / dark.

### 5.1 Theme

The costliest item here. `app/globals.css` defines 33 variables and the
palette is hardcoded dark; there is no `data-theme` switching anywhere.

The work is: define a full light palette against the same token names, set
`data-theme` on the root, persist the choice, and **audit every screen for
colours written inline rather than through a token**. The audit is the real
cost — a half-themed app looks worse than a dark-only one.

The four rarity accents (common / rare / epic / legendary) keep their
identity across both themes; only ground, ink and hairline invert.

---

## 6. Data reset

Delete all mock and test data before this ships:

- The 5 seeded demo accounts (Maya, Dom, Sasha, Eli, Rae)
- Every test account created during development
- **The EREN account** — explicitly confirmed for deletion
- All `card_ownership` rows and seeded events

Cards, artists and the card catalogue stay: they are real data from Apple's
charts, not mocks.

---

## Out of scope

Named so they are not silently assumed:

- Cross-player card credit (RLS scopes `card_ownership` to the caller, so a
  client cannot read who else owns a card)
- Trades and the marketplace
- Guest Cards / OS sync
- Stat-milestone legendaries (CLAUDE.md §3's first path; the Peak Moment
  path is built)
- Redis-backed room state — rooms remain per-process until a second
  instance is needed

---

## Constraints carried from CLAUDE.md

- Exactly three control models; never a fourth (§1)
- Spectator vibe scores a set and can never end one (§1.2)
- Visibility and card rule stay independent axes (§1.1)
- Drops are earn-only; no real-money path (§3)
- Supply decrements stay atomic (§3)
- Legendaries only from stat milestones or Peak Moments — never a smooth
  odds ramp (§3)
- Shoutouts are display-only (§1.2)
- `lib/domain/` imports neither React nor Supabase
