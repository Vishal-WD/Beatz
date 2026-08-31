---
name: add-screen
description: Use when adding or restyling any AuxWars screen, card, or UI component — new routes, new views, color/typography changes, or anything touching the rarity frames. Carries the design system and the constraints that are easy to violate by accident.
---

# Adding a screen or component

The visual language is fixed (`design/AuxWars.dc.html`,
`docs/CARD_ART_GENERATION.md`). Match it; do not invent a parallel one.

## Design tokens

Use the CSS variables in `app/globals.css`. Never hard-code a hex in a
component.

```
--stage-black #05050a   page ground        --neon-pink   #ff2e88
--booth-panel #0e0e18   panel/card ground  --neon-cyan   #4ce3ff
--ink         #f4f2ff   text               --neon-gold   #ffd84d
--ink-60/-40/-25        muted text         --neon-violet #7b2bff
--hairline              1px borders        --neon-mint   #7dffc3
```

**Two surfaces only.** Stage black and booth panel. A third background
shade dilutes the whole system — if something needs separation, use a
hairline border or spacing, not a new grey.

## Type roles

| Face | Role | Never |
|---|---|---|
| Anton (`--font-title`) | Titles, uppercase | body text |
| Barlow Condensed (`--font-stat`) | Stat numerics | prose |
| JetBrains Mono (`--font-tele`) | Telemetry labels, `.14–.24em` tracking | paragraphs |
| Barlow (`--font-body`) | Body copy | headings |

Uppercase mono labels always carry letter-spacing. Without it they read as
code, not telemetry.

## Rules that are easy to break

**Foil belongs only on rarity frames.** The moment a gradient/foil treatment
decorates a button or header, rarity stops reading as special. This is the
single most common regression.

**Rarity is never color-alone.** Every card shows its text tag
(`CMN`/`RARE`/`EPIC`/`LGND`). A colorblind player must still read tier.

**Reuse `SongCardView`.** One card renderer, `size` prop of `sm`/`md`/`lg`.
Do not write a second card component — the frames, holo, and stat bars all
live there.

**Profile Cards never get the holo.** Holo means scarce supply; a profile is
not scarce. Cyan/violet frame plus crown badge (`PROFILE_FRAME`).

**Guest Cards stay ugly on purpose.** Dashed grey, no foil, no sheen. The
visual gap between a Guest Card and a Common is the entire argument for
collecting.

**No "buy Drops" entry point, anywhere.** Drops are earn-only
(`CLAUDE.md` §3). A real-money path alongside the marketplace is a loot-box
regulatory risk, and sideloading the APK does not relax it.

## Phone layout

Phone screens wrap in `<PhoneShell>` (status bar + tab nav, safe-area
insets). Target 390×844, but **verify at 375×667** — the iPhone SE is the
one that breaks.

Prefer `clamp()` against `dvh` over fixed pixel heights for anything that
must stay above the fold. A fixed-height deck slot once pushed "Hold to
Vibe" off-screen, and scrolling to reach it mid-reign loses you the throne.

The Throne Room (`/room`) is **not** a phone screen — 1280×720 shared
display, no `PhoneShell`.

## Motion

Keyframes already exist in `globals.css`: `beat`, `ring`, `holo`, `sheen`,
`shard`, `flash`, `bob`, `queue`, `spotgrow`. Reuse them.

Animate `transform` and `opacity` only. `prefers-reduced-motion` is already
handled globally — do not add a second implementation.

## Before you finish

```bash
npx tsc --noEmit && npx next build
```

Then look at it: `npm run dev`, open the route. A passing build is not a
correct layout.
