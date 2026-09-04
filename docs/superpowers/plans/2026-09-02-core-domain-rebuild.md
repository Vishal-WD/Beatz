# Core Domain Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded screen fixtures with a pure, tested domain layer — the three control models, reign lifecycle, and a derived activity feed — so every value on screen has a defined origin.

**Architecture:** A new `lib/domain/` holds pure TypeScript with no React and no Supabase imports: plain functions over plain data, unit-tested in isolation. React hooks become thin adapters that fetch rows, call domain functions, and render. Database writes that must not race (supply, challenger position, reign handover) stay in Postgres functions. Screens keep their current look; only their data source changes.

**Tech Stack:** TypeScript, Vitest (`lib/**/*.test.ts` already in the include glob), Supabase Postgres + RLS, Next.js 15 static export.

**Spec:** `docs/superpowers/specs/2026-08-31-formats-and-rooms-design.md`

## Global Constraints

- **Three control models only** — `contested`, `delegated`, `spectator`. A fourth requires an explicit decision recorded in `CLAUDE.md` (§1).
- **Six formats**, each pinned to one control model: Concert/Fest/Clubbing → spectator, Night Party → delegated, Disco/Private Party → contested (§1.1).
- **Visibility and card rule are independent axes.** Never collapse `open|guest_list` and `casual|event` into one enum (§1.1).
- **Spectator vibe cannot end a set.** Low vibe is a weak set, never a forfeit (§1.2).
- **Shoutouts are display-only** — no Drops, no odds, no mechanical advantage (§1.2, spec §4).
- **Drops are earn-only.** No real-money path while a card-sell path exists (§3).
- **Supply decrements must be atomic** — `UPDATE ... WHERE remaining > 0 RETURNING`, never read-then-write (§3).
- **Legendaries come from exactly two paths**: discrete stat milestones, or a live Peak Moment. Never smooth probability scaling (§3).
- No new dependencies. No `import` of `react` or `./supabase` anywhere under `lib/domain/`.

---

### Task 1: Control models and formats

**Files:**
- Create: `lib/domain/formats.ts`
- Test: `lib/domain/formats.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type ControlModel = 'contested' | 'delegated' | 'spectator'`; `type FormatId = 'concert' | 'fest' | 'clubbing' | 'night_party' | 'disco' | 'private_party'`; `type Visibility = 'open' | 'guest_list'`; `type CardRule = 'casual' | 'event'`; `interface FormatDef { id: FormatId; label: string; control: ControlModel; visibility: Visibility; shoutouts: boolean }`; `const FORMATS: Record<FormatId, FormatDef>`; `controlModelFor(f: FormatId): ControlModel`; `canDethrone(c: ControlModel): boolean`; `allowsShoutouts(f: FormatId): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { FORMATS, controlModelFor, canDethrone, allowsShoutouts } from './formats';

describe('formats', () => {
  it('pins all six formats to a control model', () => {
    expect(Object.keys(FORMATS)).toHaveLength(6);
    expect(controlModelFor('disco')).toBe('contested');
    expect(controlModelFor('night_party')).toBe('delegated');
    expect(controlModelFor('concert')).toBe('spectator');
    expect(controlModelFor('clubbing')).toBe('spectator');
  });

  // CLAUDE.md §1.2: spectator vibe scores the set and cannot end one.
  it('only contested rooms can hand over the throne', () => {
    expect(canDethrone('contested')).toBe(true);
    expect(canDethrone('delegated')).toBe(false);
    expect(canDethrone('spectator')).toBe(false);
  });

  // Spec §4: shoutouts on Disco, Clubbing and Private Party only.
  it('allows shoutouts on exactly three formats', () => {
    const on = Object.values(FORMATS).filter((f) => f.shoutouts).map((f) => f.id);
    expect(on.sort()).toEqual(['clubbing', 'disco', 'private_party']);
    expect(allowsShoutouts('fest')).toBe(false);
  });

  // §1.1: visibility and card rule are independent axes.
  it('keeps visibility independent of the card rule', () => {
    expect(FORMATS.disco.visibility).toBe('open');
    expect(FORMATS.private_party.visibility).toBe('guest_list');
    expect(FORMATS.disco).not.toHaveProperty('mode');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/formats.test.ts`
Expected: FAIL — cannot resolve `./formats`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * The three control models and the six formats pinned to them.
 *
 * CLAUDE.md §1 allows exactly three control models; a fourth needs an
 * explicit recorded decision. Formats are presentation over those models —
 * Concert and Fest differ only by door and scale, so they share mechanics.
 */

export type ControlModel = 'contested' | 'delegated' | 'spectator';
export type FormatId =
  | 'concert' | 'fest' | 'clubbing' | 'night_party' | 'disco' | 'private_party';

/** Who may enter. Independent of CardRule — never merge the two (§1.1). */
export type Visibility = 'open' | 'guest_list';
/** What may be played. Event rooms block Guest Cards (§4). */
export type CardRule = 'casual' | 'event';

export interface FormatDef {
  id: FormatId;
  label: string;
  control: ControlModel;
  visibility: Visibility;
  shoutouts: boolean;
}

export const FORMATS: Record<FormatId, FormatDef> = {
  concert:       { id: 'concert',       label: 'Concert',       control: 'spectator', visibility: 'guest_list', shoutouts: false },
  fest:          { id: 'fest',          label: 'Fest',          control: 'spectator', visibility: 'open',       shoutouts: false },
  clubbing:      { id: 'clubbing',      label: 'Clubbing',      control: 'spectator', visibility: 'guest_list', shoutouts: true  },
  night_party:   { id: 'night_party',   label: 'Night Party',   control: 'delegated', visibility: 'guest_list', shoutouts: false },
  disco:         { id: 'disco',         label: 'Disco',         control: 'contested', visibility: 'open',       shoutouts: true  },
  private_party: { id: 'private_party', label: 'Private Party', control: 'contested', visibility: 'guest_list', shoutouts: true  },
};

export const controlModelFor = (f: FormatId): ControlModel => FORMATS[f].control;

/**
 * Only a contested room takes the throne away. In spectator formats vibe
 * scores the set and cannot end it (§1.2); in delegated the DJ keeps control
 * and only the pool signal weakens.
 */
export const canDethrone = (c: ControlModel): boolean => c === 'contested';

export const allowsShoutouts = (f: FormatId): boolean => FORMATS[f].shoutouts;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/formats.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/formats.ts lib/domain/formats.test.ts
git commit -m "feat(domain): encode the three control models and six formats

The control models existed only in CLAUDE.md prose and one stray comment;
no code knew a Disco behaved differently from a Concert. Encodes them as
data with canDethrone() as the single gate, so a spectator set can never be
ended by vibe."
```

---

### Task 2: Vibe and reign lifecycle

**Files:**
- Create: `lib/domain/reign.ts`
- Test: `lib/domain/reign.test.ts`

**Interfaces:**
- Consumes: `ControlModel`, `canDethrone` from `lib/domain/formats.ts`.
- Produces: `interface ReignState { vibe: number; startedAt: number; peakVibe: number; peakMoments: number; endedReason: EndReason | null }`; `type EndReason = 'collapsed' | 'skipped' | 'set_ended'`; `const VIBE_MIN = 0`, `VIBE_MAX = 100`, `COLLAPSE_THRESHOLD = 15`; `startReign(hype: number, now: number): ReignState`; `tickReign(s: ReignState, opts: { control: ControlModel; stamina: number; crowdPull: number; deltaMs: number; now: number }): ReignState`; `isPeakMoment(s: ReignState): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { startReign, tickReign, isPeakMoment, COLLAPSE_THRESHOLD } from './reign';

const opts = (over = {}) => ({
  control: 'contested' as const, stamina: 60, crowdPull: 0, deltaMs: 1000, now: 1000, ...over,
});

describe('reign lifecycle', () => {
  it('starts at the card hype and records it as the peak', () => {
    const r = startReign(82, 0);
    expect(r.vibe).toBe(82);
    expect(r.peakVibe).toBe(82);
    expect(r.endedReason).toBeNull();
  });

  it('decays over time when the crowd is silent', () => {
    const r = tickReign(startReign(50, 0), opts());
    expect(r.vibe).toBeLessThan(50);
  });

  it('decays more slowly at higher stamina', () => {
    const weak = tickReign(startReign(50, 0), opts({ stamina: 20 }));
    const tough = tickReign(startReign(50, 0), opts({ stamina: 95 }));
    expect(tough.vibe).toBeGreaterThan(weak.vibe);
  });

  it('tracks the peak across the reign', () => {
    let r = startReign(40, 0);
    r = tickReign(r, opts({ crowdPull: 30 }));
    const peak = r.peakVibe;
    r = tickReign(r, opts({ crowdPull: -30 }));
    expect(r.peakVibe).toBe(peak);
    expect(r.vibe).toBeLessThan(peak);
  });

  // CLAUDE.md §1: collapse hands over the throne in a contested room.
  it('collapses a contested reign below the threshold', () => {
    let r = startReign(COLLAPSE_THRESHOLD + 1, 0);
    for (let i = 0; i < 200 && !r.endedReason; i++) r = tickReign(r, opts({ now: i * 1000 }));
    expect(r.endedReason).toBe('collapsed');
  });

  // §1.2: the hard rule. Low vibe is a weak set, never a forfeit.
  it('NEVER ends a spectator set, however low the vibe falls', () => {
    let r = startReign(20, 0);
    for (let i = 0; i < 500; i++) r = tickReign(r, opts({ control: 'spectator', now: i * 1000 }));
    expect(r.endedReason).toBeNull();
    expect(r.vibe).toBe(0);
  });

  it('never ends a delegated reign either — the DJ keeps control', () => {
    let r = startReign(20, 0);
    for (let i = 0; i < 500; i++) r = tickReign(r, opts({ control: 'delegated', now: i * 1000 }));
    expect(r.endedReason).toBeNull();
  });

  it('clamps the vibe to 0..100', () => {
    const hi = tickReign(startReign(99, 0), opts({ crowdPull: 999 }));
    expect(hi.vibe).toBeLessThanOrEqual(100);
    const lo = tickReign(startReign(2, 0), opts({ crowdPull: -999, control: 'spectator' }));
    expect(lo.vibe).toBeGreaterThanOrEqual(0);
  });

  it('flags a peak moment only at the very top', () => {
    expect(isPeakMoment({ ...startReign(100, 0), vibe: 100 })).toBe(true);
    expect(isPeakMoment({ ...startReign(90, 0), vibe: 90 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/reign.test.ts`
Expected: FAIL — cannot resolve `./reign`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Reign lifecycle: what the Vibe Bar means and when a reign ends.
 *
 * Pure and deterministic — time and crowd input arrive as arguments, so the
 * whole loop is testable without a browser, a socket or a clock. The
 * consequence of collapse is the ONE thing that varies by control model.
 */

import type { ControlModel } from './formats';
import { canDethrone } from './formats';

export const VIBE_MIN = 0;
export const VIBE_MAX = 100;
/** Below this a contested reign is over. */
export const COLLAPSE_THRESHOLD = 15;
/** A Peak Moment mints a Legendary (CLAUDE.md §3), so it must be rare. */
export const PEAK_MOMENT_VIBE = 100;

export type EndReason = 'collapsed' | 'skipped' | 'set_ended';

export interface ReignState {
  vibe: number;
  startedAt: number;
  peakVibe: number;
  peakMoments: number;
  endedReason: EndReason | null;
}

export function startReign(hype: number, now: number): ReignState {
  const vibe = clamp(hype);
  return { vibe, startedAt: now, peakVibe: vibe, peakMoments: 0, endedReason: null };
}

/**
 * Higher stamina decays more slowly. Kept gentle so a legendary reign is
 * long, not unlosable — an earlier build had drift outpacing decay entirely
 * and the throne never changed hands.
 */
function decayPerSecond(stamina: number): number {
  return 0.6 + (100 - clamp(stamina)) * 0.045;
}

export function tickReign(
  s: ReignState,
  opts: { control: ControlModel; stamina: number; crowdPull: number; deltaMs: number; now: number },
): ReignState {
  if (s.endedReason) return s;

  const seconds = opts.deltaMs / 1000;
  const next = clamp(s.vibe - decayPerSecond(opts.stamina) * seconds + opts.crowdPull * seconds);
  const peakVibe = Math.max(s.peakVibe, next);
  const peakMoments = s.peakMoments + (next >= PEAK_MOMENT_VIBE && s.vibe < PEAK_MOMENT_VIBE ? 1 : 0);

  // The whole point of the control model. Only a contested room takes the
  // throne away; a spectator set at vibe 0 is a weak set, not a forfeit.
  const endedReason: EndReason | null =
    canDethrone(opts.control) && next <= COLLAPSE_THRESHOLD ? 'collapsed' : null;

  return { ...s, vibe: next, peakVibe, peakMoments, endedReason };
}

export const isPeakMoment = (s: ReignState): boolean => s.vibe >= PEAK_MOMENT_VIBE;

const clamp = (n: number) => Math.max(VIBE_MIN, Math.min(VIBE_MAX, n));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/reign.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/reign.ts lib/domain/reign.test.ts
git commit -m "feat(domain): pure reign lifecycle with per-model collapse

The reign rules lived inside useVibe, so they could not be tested without a
browser and the spectator rule was never enforced anywhere. Collapse is now
gated on canDethrone(), with a test asserting a spectator set survives 500
ticks at vibe 0."
```

---

### Task 3: Challenger line

**Files:**
- Create: `lib/domain/challengers.ts`
- Test: `lib/domain/challengers.test.ts`

**Interfaces:**
- Consumes: `ControlModel` from `lib/domain/formats.ts`.
- Produces: `interface Challenger { playerId: string; position: number }`; `nextHolder(line: Challenger[], control: ControlModel): string | null`; `advanceLine(line: Challenger[]): Challenger[]`; `positionOf(line: Challenger[], playerId: string): number | null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { nextHolder, advanceLine, positionOf } from './challengers';

const line = [
  { playerId: 'a', position: 1 },
  { playerId: 'b', position: 2 },
  { playerId: 'c', position: 3 },
];

describe('challenger line', () => {
  it('hands the throne to position 1 in a contested room', () => {
    expect(nextHolder(line, 'contested')).toBe('a');
  });

  // §1.2: nobody takes over in these models, so there is no next holder.
  it('has no next holder in delegated or spectator rooms', () => {
    expect(nextHolder(line, 'delegated')).toBeNull();
    expect(nextHolder(line, 'spectator')).toBeNull();
  });

  it('returns null for an empty line', () => {
    expect(nextHolder([], 'contested')).toBeNull();
  });

  it('closes the gap when the front takes the throne', () => {
    expect(advanceLine(line)).toEqual([
      { playerId: 'b', position: 1 },
      { playerId: 'c', position: 2 },
    ]);
  });

  it('reports a real position, never an invented one', () => {
    expect(positionOf(line, 'b')).toBe(2);
    expect(positionOf(line, 'zzz')).toBeNull();
  });

  it('orders by position, not array order', () => {
    const jumbled = [
      { playerId: 'c', position: 3 },
      { playerId: 'a', position: 1 },
    ];
    expect(nextHolder(jumbled, 'contested')).toBe('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/challengers.test.ts`
Expected: FAIL — cannot resolve `./challengers`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * The Challenger Line — who takes the throne when a contested reign ends.
 *
 * Positions are assigned by the database (an atomic increment, CLAUDE.md §6),
 * never by pushing onto an array; this module only reads and reorders what
 * the server already decided.
 */

import type { ControlModel } from './formats';
import { canDethrone } from './formats';

export interface Challenger {
  playerId: string;
  position: number;
}

const byPosition = (l: Challenger[]) => [...l].sort((x, y) => x.position - y.position);

/** Null in delegated and spectator rooms: nobody takes over (§1.2). */
export function nextHolder(line: Challenger[], control: ControlModel): string | null {
  if (!canDethrone(control)) return null;
  return byPosition(line)[0]?.playerId ?? null;
}

/** Front player takes the throne; everyone behind moves up one. */
export function advanceLine(line: Challenger[]): Challenger[] {
  return byPosition(line).slice(1).map((c, i) => ({ ...c, position: i + 1 }));
}

/**
 * Null when the player is not queued. The deck screen used to print a fixed
 * "Challenger #2" for everyone, which asserted a queue position nobody held.
 */
export function positionOf(line: Challenger[], playerId: string): number | null {
  return line.find((c) => c.playerId === playerId)?.position ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/challengers.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/challengers.ts lib/domain/challengers.test.ts
git commit -m "feat(domain): challenger line with honest positions

positionOf() returns null when the player is not queued, replacing the
hardcoded 'Challenger #2' the deck printed for everyone."
```

---

### Task 4: Card play rules

**Files:**
- Create: `lib/domain/play-rules.ts`
- Test: `lib/domain/play-rules.test.ts`

**Interfaces:**
- Consumes: `ControlModel`, `CardRule`, `FormatId`, `controlModelFor` from `lib/domain/formats.ts`.
- Produces: `type PlayRefusal = 'not_your_turn' | 'guest_card_in_event_room' | 'not_owned' | 'crowd_cannot_play'`; `interface PlayContext { format: FormatId; cardRule: CardRule; isHost: boolean; isHolder: boolean; isGuestCard: boolean; owned: boolean }`; `canPlayCard(ctx: PlayContext): { ok: true } | { ok: false; reason: PlayRefusal }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { canPlayCard, type PlayContext } from './play-rules';

const ctx = (over: Partial<PlayContext> = {}): PlayContext => ({
  format: 'disco', cardRule: 'casual', isHost: false, isHolder: false,
  isGuestCard: false, owned: true, ...over,
});

describe('card play rules', () => {
  it('lets anyone play in a contested room', () => {
    expect(canPlayCard(ctx())).toEqual({ ok: true });
  });

  // CLAUDE.md §4: the ONE place room mode branches logic.
  it('blocks Guest Cards in an event room', () => {
    expect(canPlayCard(ctx({ cardRule: 'event', isGuestCard: true })))
      .toEqual({ ok: false, reason: 'guest_card_in_event_room' });
  });

  it('allows Guest Cards in a casual room', () => {
    expect(canPlayCard(ctx({ cardRule: 'casual', isGuestCard: true }))).toEqual({ ok: true });
  });

  it('refuses a card the player does not own', () => {
    expect(canPlayCard(ctx({ owned: false })))
      .toEqual({ ok: false, reason: 'not_owned' });
  });

  // A Guest Card is never owned; the ownership check must not fire on it.
  it('does not demand ownership of a Guest Card', () => {
    expect(canPlayCard(ctx({ isGuestCard: true, owned: false }))).toEqual({ ok: true });
  });

  it('only lets hosts play in a spectator room', () => {
    expect(canPlayCard(ctx({ format: 'concert', isHost: true }))).toEqual({ ok: true });
    expect(canPlayCard(ctx({ format: 'concert', isHost: false })))
      .toEqual({ ok: false, reason: 'crowd_cannot_play' });
  });

  it('only lets the DJ play in a delegated room', () => {
    expect(canPlayCard(ctx({ format: 'night_party', isHost: true }))).toEqual({ ok: true });
    expect(canPlayCard(ctx({ format: 'night_party', isHost: false })))
      .toEqual({ ok: false, reason: 'crowd_cannot_play' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/play-rules.test.ts`
Expected: FAIL — cannot resolve `./play-rules`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * May this player play this card right now?
 *
 * One function, so the answer cannot drift between the deck screen, the
 * server handler and the room view. Returns a reason rather than a bare
 * false — the UI has to tell the player why, not just refuse.
 */

import type { CardRule, FormatId } from './formats';
import { controlModelFor } from './formats';

export type PlayRefusal =
  | 'not_your_turn'
  | 'guest_card_in_event_room'
  | 'not_owned'
  | 'crowd_cannot_play';

export interface PlayContext {
  format: FormatId;
  cardRule: CardRule;
  isHost: boolean;
  isHolder: boolean;
  isGuestCard: boolean;
  owned: boolean;
}

export function canPlayCard(ctx: PlayContext): { ok: true } | { ok: false; reason: PlayRefusal } {
  // CLAUDE.md §4: the only place room mode is allowed to branch logic.
  if (ctx.cardRule === 'event' && ctx.isGuestCard) {
    return { ok: false, reason: 'guest_card_in_event_room' };
  }

  // Guest Cards are never owned and never enter the scarce pool (§2), so
  // the ownership check applies only to real cards.
  if (!ctx.isGuestCard && !ctx.owned) {
    return { ok: false, reason: 'not_owned' };
  }

  // In spectator and delegated rooms only the host/DJ puts cards on the
  // deck; the crowd sustains or offers, but never plays (§1.1).
  if (controlModelFor(ctx.format) !== 'contested' && !ctx.isHost) {
    return { ok: false, reason: 'crowd_cannot_play' };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/play-rules.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/play-rules.ts lib/domain/play-rules.test.ts
git commit -m "feat(domain): single source of truth for card play rules

Guest-card blocking, ownership and who-may-play were nowhere in code: the
deck let anyone play anything. One function now answers it with a reason
the UI can show."
```

---

### Task 5: Activity feed derived from real events

**Files:**
- Create: `lib/domain/activity.ts`
- Test: `lib/domain/activity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type ActivityKind = 'reign_won' | 'peak_moment' | 'card_pulled' | 'followed' | 'rsvp'`; `interface ActivityEvent { id: string; kind: ActivityKind; actorName: string; subject: string; detail: string | null; createdAt: string }`; `interface FeedSources { reigns: ReignRow[]; pulls: PullRow[]; follows: FollowRow[] }` with `ReignRow = { id: string; playerName: string; cardTitle: string; peakVibe: number; endedAt: string }`, `PullRow = { id: string; playerName: string; cardTitle: string; rarity: string; acquiredAt: string }`, `FollowRow = { id: string; followerName: string; followeeName: string; createdAt: string }`; `buildFeed(src: FeedSources, limit?: number): ActivityEvent[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildFeed } from './activity';

const src = {
  reigns: [{ id: 'r1', playerName: 'Rae K.', cardTitle: 'Naatu Naatu', peakVibe: 97, endedAt: '2026-09-02T10:00:00Z' }],
  pulls:  [{ id: 'p1', playerName: 'Eli T.', cardTitle: 'Blinding Lights', rarity: 'legendary', acquiredAt: '2026-09-02T11:00:00Z' }],
  follows:[{ id: 'f1', followerName: 'Dom R.', followeeName: 'Rae K.', createdAt: '2026-09-02T09:00:00Z' }],
};

describe('activity feed', () => {
  it('derives entries from real rows', () => {
    const feed = buildFeed(src);
    expect(feed).toHaveLength(3);
    expect(feed.map((e) => e.kind).sort()).toEqual(['card_pulled', 'followed', 'reign_won']);
  });

  it('orders newest first', () => {
    expect(buildFeed(src).map((e) => e.id)).toEqual(['p1', 'r1', 'f1']);
  });

  it('names the real actor, never a fixture', () => {
    const e = buildFeed(src).find((x) => x.kind === 'reign_won')!;
    expect(e.actorName).toBe('Rae K.');
    expect(e.subject).toContain('Naatu Naatu');
  });

  it('surfaces a peak moment as its own kind', () => {
    const feed = buildFeed({ ...src, reigns: [{ ...src.reigns[0], peakVibe: 100 }] });
    expect(feed.some((e) => e.kind === 'peak_moment')).toBe(true);
  });

  it('returns an empty feed for empty sources, not placeholders', () => {
    expect(buildFeed({ reigns: [], pulls: [], follows: [] })).toEqual([]);
  });

  it('honours the limit', () => {
    expect(buildFeed(src, 2)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/activity.test.ts`
Expected: FAIL — cannot resolve `./activity`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * The activity feed, derived from things that actually happened.
 *
 * It used to be a hand-written ACTIVITY[] array in lib/social-data.ts, so it
 * said the same thing forever and never reflected a real reign, pull or
 * follow. Every entry here traces back to a database row.
 */

export type ActivityKind = 'reign_won' | 'peak_moment' | 'card_pulled' | 'followed' | 'rsvp';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  actorName: string;
  subject: string;
  detail: string | null;
  createdAt: string;
}

export interface ReignRow  { id: string; playerName: string; cardTitle: string; peakVibe: number; endedAt: string }
export interface PullRow   { id: string; playerName: string; cardTitle: string; rarity: string; acquiredAt: string }
export interface FollowRow { id: string; followerName: string; followeeName: string; createdAt: string }

export interface FeedSources {
  reigns: ReignRow[];
  pulls: PullRow[];
  follows: FollowRow[];
}

export function buildFeed(src: FeedSources, limit = 50): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...src.reigns.map((r) => ({
      id: r.id,
      // A Peak Moment mints a Legendary (§3), so it reads differently.
      kind: (r.peakVibe >= 100 ? 'peak_moment' : 'reign_won') as ActivityKind,
      actorName: r.playerName,
      subject: `held the throne with ${r.cardTitle}`,
      detail: `PEAK ${r.peakVibe}`,
      createdAt: r.endedAt,
    })),
    ...src.pulls.map((p) => ({
      id: p.id,
      kind: 'card_pulled' as ActivityKind,
      actorName: p.playerName,
      subject: `pulled ${p.cardTitle}`,
      detail: p.rarity.toUpperCase(),
      createdAt: p.acquiredAt,
    })),
    ...src.follows.map((f) => ({
      id: f.id,
      kind: 'followed' as ActivityKind,
      actorName: f.followerName,
      subject: `followed ${f.followeeName}`,
      detail: null,
      createdAt: f.createdAt,
    })),
  ];

  return events
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/activity.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/activity.ts lib/domain/activity.test.ts
git commit -m "feat(domain): derive the activity feed from real rows

Replaces the static ACTIVITY[] fixture with a function over reigns, pulls
and follows. An empty database now yields an empty feed rather than
inventing social proof."
```

---

### Task 6: Room format columns and server-side reign handover

**Files:**
- Modify: Supabase migration (apply via MCP `apply_migration`, name `room_formats_and_reign_handover`)
- Modify: `lib/supabase.ts` — add `format` and `visibility` to `DbRoom`

**Interfaces:**
- Consumes: format ids from Task 1.
- Produces: `rooms.format` and `rooms.visibility` columns; SQL function `end_reign(p_reign uuid, p_reason text) returns uuid` returning the next holder's id or null; `DbRoom` gains `format: FormatId; visibility: Visibility`.

- [ ] **Step 1: Apply the migration**

```sql
-- Rooms knew their card rule (mode) but not their format, so nothing could
-- tell a Disco from a Concert and every room ran the contested loop.
-- Visibility is a separate axis from mode and must stay that way (§1.1).
alter table rooms
  add column if not exists format text not null default 'disco'
    check (format in ('concert','fest','clubbing','night_party','disco','private_party')),
  add column if not exists visibility text not null default 'open'
    check (visibility in ('open','guest_list'));

-- Handover must be atomic: two clients observing a collapse at the same
-- moment must not both promote the front of the line (CLAUDE.md §6).
create or replace function public.end_reign(p_reign uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_room uuid;
  v_next uuid;
  v_control text;
begin
  update reigns
     set ended_at = now(), ended_reason = p_reason
   where id = p_reign and ended_at is null
  returning room_id into v_room;

  if v_room is null then
    return null;  -- already ended; do not promote twice
  end if;

  select case r.format
           when 'disco' then 'contested'
           when 'private_party' then 'contested'
           when 'night_party' then 'delegated'
           else 'spectator'
         end
    into v_control
    from rooms r where r.id = v_room;

  -- Only a contested room hands the throne over (§1.2).
  if v_control <> 'contested' then
    return null;
  end if;

  delete from challengers
   where room_id = v_room
     and position = (select min(position) from challengers where room_id = v_room)
  returning player_id into v_next;

  update challengers set position = position - 1 where room_id = v_room;
  return v_next;
end;
$$;

revoke execute on function public.end_reign(uuid, text) from anon;
```

- [ ] **Step 2: Verify the migration**

Run this SQL and confirm a spectator room returns null while a contested one promotes:

```sql
select column_name from information_schema.columns
 where table_name='rooms' and column_name in ('format','visibility');
```

Expected: both rows present.

- [ ] **Step 3: Extend the DbRoom type**

In `lib/supabase.ts`, add to `interface DbRoom`:

```ts
  /** Which of the six formats this room runs (CLAUDE.md §1.1). */
  format: 'concert' | 'fest' | 'clubbing' | 'night_party' | 'disco' | 'private_party';
  /** Who may enter. Independent of `mode`, which is what may be played. */
  visibility: 'open' | 'guest_list';
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat(db): give rooms a format and atomic reign handover

Rooms had no format column, so nothing could distinguish a Concert from a
Disco. end_reign() promotes the challenger inside one statement and refuses
to promote at all in non-contested rooms."
```

---

### Task 7: Rewire useVibe onto the domain

**Files:**
- Modify: `lib/useVibe.ts`
- Test: `lib/useVibe.test.ts` (create)

**Interfaces:**
- Consumes: `startReign`, `tickReign`, `ReignState` from `lib/domain/reign.ts`; `ControlModel` from `lib/domain/formats.ts`.
- Produces: `useVibe({ stamina, hype, control, soloPractice })` returning `{ vibe, holding, holdPct, startHold, endHold, ended: EndReason | null }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVibe } from './useVibe';

describe('useVibe', () => {
  it('starts at the card hype', () => {
    const { result } = renderHook(() => useVibe({ stamina: 60, hype: 80, control: 'contested' }));
    expect(result.current.vibe).toBe(80);
  });

  // The hook must not re-implement the rule; it delegates to the domain.
  it('never reports an ended reign in a spectator room', () => {
    const { result } = renderHook(() => useVibe({ stamina: 1, hype: 16, control: 'spectator' }));
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.ended).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/useVibe.test.ts`
Expected: FAIL — `useVibe` does not accept `control`/`hype`, `ended` is undefined.

- [ ] **Step 3: Rewrite the hook as an adapter**

Replace the decay arithmetic in `lib/useVibe.ts` with calls to the domain. The hook keeps only React concerns — the interval, hold state, and the `soloPractice` crowd simulation — and holds a `ReignState` in a ref, calling `tickReign` on each frame. Delete the local decay/clamp code; `decayRateFor` is no longer imported here.

```ts
const state = useRef<ReignState>(startReign(hype, Date.now()));
// …inside the interval:
state.current = tickReign(state.current, {
  control, stamina, crowdPull, deltaMs: TICK_MS, now: Date.now(),
});
setVibe(state.current.vibe);
setEnded(state.current.endedReason);
```

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS — all previous tests plus the two new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/useVibe.ts lib/useVibe.test.ts
git commit -m "refactor(vibe): make useVibe a thin adapter over the domain

The decay maths and the end-of-reign decision move into lib/domain/reign.ts,
so the spectator rule is enforced in one tested place instead of implicitly
by whichever screen happened to call the hook."
```

---

### Task 8: Rewire the deck screen

**Files:**
- Modify: `lib/useRoom.ts` — expose the challenger line
- Modify: `app/deck/page.tsx`

**Interfaces:**
- Consumes: `canPlayCard` (Task 4), `positionOf`/`nextHolder` (Task 3), `controlModelFor` (Task 1), `useVibe` (Task 7), `useOwnedCards`.
- Produces: `useRoom` gains `line: Challenger[]` in its return value.

- [ ] **Step 0: Expose the challenger line from useRoom**

`useRoom` currently returns `{ mode, room, serverVibe, isLive, playCard, setHolding, joinLine }` — it can *join* the line but never reads it, so no screen can know a real position. Add a `line` to the returned object, loaded from the `challengers` table for this room and refreshed on the existing realtime subscription:

```ts
const [line, setLine] = useState<Challenger[]>([]);
// alongside the existing room subscription:
const loadLine = useCallback(async () => {
  const db = supabase();
  if (!db || !roomId) return;
  const { data } = await db
    .from('challengers')
    .select('player_id, position')
    .eq('room_id', roomId)
    .order('position');
  setLine((data ?? []).map((r) => ({ playerId: r.player_id, position: r.position })));
}, [roomId]);
```

Call `loadLine()` on mount and whenever the room row changes, and include `line` in the hook's return.

- [ ] **Step 1: Replace the remaining invented values**

The reign strip and challenger label must come from room state and the
challenger line, not from constants. Where no data exists, say so plainly
rather than substituting a plausible name:

```tsx
const control = controlModelFor(room?.format ?? 'disco');
const myPosition = positionOf(line, profile.id);
const challengerLabel = myPosition ? `CHALLENGER #${myPosition}` : 'NOT IN LINE';
```

- [ ] **Step 2: Gate the play action on the rules**

```tsx
const verdict = canPlayCard({
  format: room?.format ?? 'disco',
  cardRule: room?.mode ?? 'casual',
  isHost: room?.host_id === profile.id,
  isHolder: Boolean(deckId),
  isGuestCard: card.kind === 'guest',
  owned: owned.some((c) => c.id === card.id),
});
if (!verdict.ok) { setRefusal(REFUSAL_COPY[verdict.reason]); return; }
```

`REFUSAL_COPY` maps each `PlayRefusal` to a sentence, e.g.
`guest_card_in_event_room: 'Event room — owned cards only.'`

- [ ] **Step 3: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass.

- [ ] **Step 4: Verify in a real browser**

Run `node scripts/probe/owned.mjs` and confirm a signed-out visitor sees
`PREVIEW · SIGN IN TO OWN` and no invented challenger rank, and a signed-in
player sees `YOUR COLLECTION · 21`.

- [ ] **Step 5: Commit**

```bash
git add app/deck/page.tsx
git commit -m "refactor(deck): drive the deck screen from the domain

Play attempts now go through canPlayCard() and refusals are explained.
The challenger label reads NOT IN LINE when the player is not queued,
instead of the hardcoded rank every visitor used to see."
```

---

### Task 9: Rewire the social feed

**Files:**
- Create: `lib/useActivityFeed.ts`
- Modify: `app/social/page.tsx`
- Modify: `lib/supabase.ts` — add `fetchFeedSources()`

**Interfaces:**
- Consumes: `buildFeed`, `FeedSources` from `lib/domain/activity.ts`.
- Produces: `fetchFeedSources(): Promise<FeedSources | null>`; `useActivityFeed(): { events: ActivityEvent[]; state: 'loading' | 'live' | 'empty' }`.

- [ ] **Step 1: Add the query**

In `lib/supabase.ts`, fetch ended reigns joined to profiles and cards, recent
`card_ownership` rows with `acquired_via = 'pack'` or `'peak_moment'`, and
recent follows — then shape them into `FeedSources`. Return `null` on error
so the caller can show an empty state rather than a stale fixture.

- [ ] **Step 2: Add the hook**

```ts
export function useActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [state, setState] = useState<'loading' | 'live' | 'empty'>('loading');
  useEffect(() => {
    let cancelled = false;
    void fetchFeedSources().then((src) => {
      if (cancelled) return;
      const feed = src ? buildFeed(src) : [];
      setEvents(feed);
      setState(feed.length ? 'live' : 'empty');
    });
    return () => { cancelled = true; };
  }, []);
  return { events, state };
}
```

- [ ] **Step 3: Render the derived feed**

Replace `ACTIVITY.map(...)` in `app/social/page.tsx` with `events.map(...)`.
When `state === 'empty'`, render the existing `EmptyState` primitive with
"Nothing yet — play a card to start the feed", never placeholder rows.

- [ ] **Step 4: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/useActivityFeed.ts lib/supabase.ts app/social/page.tsx
git commit -m "refactor(social): render a feed derived from real activity

The feed was a static array that never changed. It now reflects actual
reigns, pulls and follows, and shows an empty state when nothing has
happened rather than inventing social proof."
```

---

### Task 10: Home screen inside the app shell

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `PhoneShell` from `components/PhoneChrome`, `useAuth`, `useOwnedCards`.
- Produces: no new exports.

- [ ] **Step 1: Wrap the home screen in PhoneShell**

The home route renders a bare list of links with no bottom navigation, which
is why the app reads as a plain site on a phone. Wrap it in `PhoneShell` so
it carries the same status bar and tab bar as every other screen.

- [ ] **Step 2: Show real state, not a menu**

Replace the static link list with the player's own state: display name and
Drops when signed in, collection size from `useOwnedCards`, and a single
primary action (`CONTINUE` to `/deck`). Signed out, show one `SIGN IN`
action instead of implying a collection exists.

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && NODE_ENV=production CAPACITOR=1 npx next build`
Expected: 0 errors, build succeeds.

- [ ] **Step 4: Verify on the device**

Rebuild and install, then screenshot `/` and confirm the bottom tab bar is
present and the screen shows the signed-in player's real Drops and
collection count.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): put the home screen in the app shell

It rendered a bare link list with no bottom nav, which is what made the app
read as a plain site. It now sits in PhoneShell and shows the player's own
state instead of a static menu."
```

---

## Verification

After Task 10, the following must all hold:

1. `npx vitest run` — all tests pass, including the new `lib/domain/` suites.
2. `grep -rn "MAYA J\|Challenger #2" app/` returns nothing.
3. `grep -rn "from 'react'\|from './supabase'" lib/domain/` returns nothing — the domain stays pure.
4. A signed-out visitor sees `PREVIEW · SIGN IN TO OWN` and `NOT IN LINE`.
5. A freshly registered player owns exactly 21 cards and the feed reflects their first pull.
6. A spectator-format room never ends a set, however low the vibe falls.
7. `allowsShoutouts()` gates the card-credit line ("from @handle's collection")
   on Disco, Clubbing and Private Party only, and it awards no Drops.
