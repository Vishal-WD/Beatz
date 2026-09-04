# Packs, Chart, Shoutouts and Fixture Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the missing gameplay features (pack opening, world chart, shoutouts, Peak Moment minting) on the domain layer, and remove the last three screens that render invented data.

**Architecture:** Pure rules go in `lib/domain/` (no React, no Supabase) and are unit-tested. Anything that spends Drops or decrements supply is a Postgres `SECURITY DEFINER` function doing atomic `UPDATE ... WHERE ... RETURNING`, never a read-then-write from the client. Screens become thin renderers: they call a hook, the hook calls the database and the domain, and where no real data exists the screen says so rather than substituting a plausible value.

**Tech Stack:** TypeScript, Vitest (`lib/**/*.test.ts` already in the include glob), Supabase Postgres + RLS, Next.js 15 static export, Capacitor.

**Spec:** `docs/superpowers/specs/2026-08-31-formats-and-rooms-design.md` and `CLAUDE.md` §§1–4.

**Branch:** All work lands on `core-domain-rebuild`, on top of the 12 commits already there. Nothing merges to `main` during this plan, so no merge conflict can arise.

## Global Constraints

- **Drops are earn-only.** Never add a real-money purchase path while a card-sell path exists (CLAUDE.md §3). A pack is bought with earned Drops only.
- **Supply decrements must be atomic** — `UPDATE ... WHERE supply_remaining > 0 RETURNING`, never read-then-write (§3).
- **Legendaries come from exactly two paths**: discrete stat milestones, or a live Peak Moment. **Never** scale legendary odds smoothly with playtime or spend (§3). A pack's legendary slot is a fixed-probability roll, not a ramp.
- **Rarity tier exhausted → downgrade one tier and refund the Drops difference**, never a hard pull failure (§6).
- **Shoutouts are display-only** — no Drops, no odds, no mechanical advantage (§1.2). They appear on Disco, Clubbing and Private Party only.
- **Exactly three control models** — `contested`, `delegated`, `spectator`. Never a fourth (§1).
- **Visibility and card rule stay independent axes.** Never merge `open|guest_list` with `casual|event` (§1.1).
- `lib/domain/` must never import React or Supabase.
- **No invented data on screens.** Where no real value exists, the screen states that plainly. This plan exists partly to remove the last three violations.
- No new dependencies.

---

### Task 1: Pack odds (pure)

**Files:**
- Create: `lib/domain/packs.ts`
- Test: `lib/domain/packs.test.ts`

**Interfaces:**
- Consumes: `Rarity` from `types/cards.ts` (`'common' | 'rare' | 'epic' | 'legendary'`).
- Produces: `const PACK_COST = 250`; `const PACK_SIZE = 5`; `interface PackOdds { common: number; rare: number; epic: number; legendary: number }`; `const PACK_ODDS: PackOdds`; `rollRarity(roll: number): Rarity`; `rollPack(rolls: number[]): Rarity[]`; `canAfford(drops: number): boolean`; `refundFor(from: Rarity, to: Rarity): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { PACK_COST, PACK_SIZE, PACK_ODDS, rollRarity, rollPack, canAfford, refundFor } from './packs';

describe('pack odds', () => {
  it('costs 250 Drops and yields 5 cards', () => {
    expect(PACK_COST).toBe(250);
    expect(PACK_SIZE).toBe(5);
  });

  it('has odds that sum to exactly 1', () => {
    const sum = PACK_ODDS.common + PACK_ODDS.rare + PACK_ODDS.epic + PACK_ODDS.legendary;
    expect(sum).toBeCloseTo(1, 10);
  });

  // CLAUDE.md §3: legendary must stay rare and FIXED — never a ramp.
  it('keeps legendary the rarest slice', () => {
    expect(PACK_ODDS.legendary).toBeLessThan(PACK_ODDS.epic);
    expect(PACK_ODDS.epic).toBeLessThan(PACK_ODDS.rare);
    expect(PACK_ODDS.rare).toBeLessThan(PACK_ODDS.common);
  });

  it('maps a roll deterministically onto a tier', () => {
    expect(rollRarity(0)).toBe('common');
    expect(rollRarity(0.999999)).toBe('legendary');
  });

  it('never returns undefined for any roll in [0,1)', () => {
    for (let i = 0; i < 1000; i++) {
      const r = rollRarity(i / 1000);
      expect(['common', 'rare', 'epic', 'legendary']).toContain(r);
    }
  });

  it('draws one tier per roll', () => {
    expect(rollPack([0, 0, 0, 0, 0.999999])).toEqual(
      ['common', 'common', 'common', 'common', 'legendary'],
    );
  });

  it('affords a pack only with enough Drops', () => {
    expect(canAfford(250)).toBe(true);
    expect(canAfford(249)).toBe(false);
  });

  // §6: an exhausted tier downgrades and refunds, never hard-fails.
  it('refunds the difference when a pull downgrades a tier', () => {
    expect(refundFor('legendary', 'epic')).toBeGreaterThan(0);
    expect(refundFor('epic', 'common')).toBeGreaterThan(refundFor('epic', 'rare'));
    expect(refundFor('rare', 'rare')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/packs.test.ts`
Expected: FAIL — cannot resolve `./packs`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Pack economics.
 *
 * Pure and roll-injected: the caller supplies the random numbers, so the
 * odds are testable without stubbing Math.random and the server can use the
 * same table the client displays.
 */

import type { Rarity } from '@/types/cards';

/** Earned Drops only. Never purchasable with money (CLAUDE.md §3). */
export const PACK_COST = 250;
export const PACK_SIZE = 5;

export interface PackOdds {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

/**
 * Fixed odds. CLAUDE.md §3 rejects any curve that scales legendary chance
 * with playtime or spend, so these are constants — the same for a first
 * pack and a five-hundredth.
 */
export const PACK_ODDS: PackOdds = {
  common: 0.70,
  rare: 0.22,
  epic: 0.07,
  legendary: 0.01,
};

/** What a pull is worth, used for downgrade refunds. */
const TIER_VALUE: Record<Rarity, number> = {
  common: 10,
  rare: 40,
  epic: 120,
  legendary: 400,
};

export function rollRarity(roll: number): Rarity {
  // Walk the cumulative distribution from the rarest end so floating point
  // slop lands in `common` (the widest band) rather than off the end.
  const r = Math.min(Math.max(roll, 0), 0.9999999);
  if (r >= 1 - PACK_ODDS.legendary) return 'legendary';
  if (r >= 1 - PACK_ODDS.legendary - PACK_ODDS.epic) return 'epic';
  if (r >= 1 - PACK_ODDS.legendary - PACK_ODDS.epic - PACK_ODDS.rare) return 'rare';
  return 'common';
}

export const rollPack = (rolls: number[]): Rarity[] => rolls.map(rollRarity);

export const canAfford = (drops: number): boolean => drops >= PACK_COST;

/**
 * §6: a tier that is sold out downgrades one step and refunds the
 * difference, rather than failing the pull outright.
 */
export const refundFor = (from: Rarity, to: Rarity): number =>
  Math.max(0, TIER_VALUE[from] - TIER_VALUE[to]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/packs.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/packs.ts lib/domain/packs.test.ts
git commit -m "feat(domain): pack odds as pure, roll-injected rules

Legendary odds are a fixed constant rather than a curve, because
CLAUDE.md 3 rejects any path that scales legendary chance with
playtime or spend. Rolls are injected so the table is testable
without stubbing Math.random."
```

---

### Task 2: Server-side pack opening

**Files:**
- Apply migration via MCP `apply_migration`, name `open_pack`
- Modify: `lib/supabase.ts` — add `openPack()`

**Interfaces:**
- Consumes: `PACK_COST`, `PACK_SIZE` values from Task 1 (mirrored as SQL constants).
- Produces: SQL function `open_pack(p_user uuid) returns table(card_id uuid, rarity text, serial_number int, downgraded boolean)`; `openPack(): Promise<PackPull[] | { error: string }>` in `lib/supabase.ts`, where `interface PackPull { cardId: string; rarity: Rarity; serialNumber: number; downgraded: boolean }`.

- [ ] **Step 1: Apply the migration**

```sql
-- Opening a pack spends Drops and claims scarce supply, so it cannot live
-- in the client: a read-then-write from two devices would oversell the last
-- copy of a card and could spend the same Drops twice. Everything here is
-- one transaction.
create or replace function public.open_pack(p_user uuid)
returns table(card_id uuid, rarity text, serial_number int, downgraded boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cost    constant int := 250;   -- mirrors PACK_COST in lib/domain/packs.ts
  v_size    constant int := 5;     -- mirrors PACK_SIZE
  v_drops   int;
  v_roll    numeric;
  v_tier    text;
  v_try     text;
  v_card    uuid;
  v_serial  int;
  v_refund  int := 0;
  v_down    boolean;
  i         int;
  v_order   text[] := array['legendary','epic','rare','common'];
  v_idx     int;
begin
  -- Atomic spend: the WHERE clause is the affordability check, so two
  -- concurrent opens cannot both pass it on the same balance.
  update profiles
     set drops = drops - v_cost
   where id = p_user and drops >= v_cost
  returning drops into v_drops;

  if not found then
    raise exception 'insufficient_drops';
  end if;

  for i in 1..v_size loop
    v_roll := random();
    v_tier := case
                when v_roll >= 0.99 then 'legendary'
                when v_roll >= 0.92 then 'epic'
                when v_roll >= 0.70 then 'rare'
                else 'common'
              end;

    v_down := false;
    v_card := null;

    -- Walk down from the rolled tier until a tier has stock (§6: downgrade
    -- and refund, never a hard failure).
    v_idx := array_position(v_order, v_tier);
    while v_card is null and v_idx <= 4 loop
      v_try := v_order[v_idx];

      update cards
         set supply_remaining = supply_remaining - 1
       where id = (
         select id from cards
          where rarity = v_try::rarity and supply_remaining > 0
          order by random() limit 1
       )
      returning id, supply_total - supply_remaining into v_card, v_serial;

      if v_card is null then
        v_idx := v_idx + 1;
        v_down := true;
      end if;
    end loop;

    -- Every tier sold out: refund the whole slot rather than give nothing.
    if v_card is null then
      v_refund := v_refund + (v_cost / v_size);
      continue;
    end if;

    if v_down then
      v_refund := v_refund + 30;
    end if;

    insert into card_ownership (owner_id, card_id, serial_number, acquired_via)
    values (p_user, v_card, v_serial, 'pack');

    card_id := v_card;
    rarity := v_try;
    serial_number := v_serial;
    downgraded := v_down;
    return next;
  end loop;

  if v_refund > 0 then
    update profiles set drops = drops + v_refund where id = p_user;
  end if;
end;
$$;

revoke execute on function public.open_pack(uuid) from anon, public;
grant  execute on function public.open_pack(uuid) to authenticated;
```

- [ ] **Step 2: Verify the migration behaves**

Run this and confirm every row reads `true`:

```sql
create temp table t(check_name text, passed boolean, detail text);
do $$
declare v_u uuid; v_before int; v_after int; v_cards int;
begin
  select id into v_u from profiles order by drops desc limit 1;
  update profiles set drops = 1000 where id = v_u;
  select drops into v_before from profiles where id = v_u;
  select count(*) into v_cards from public.open_pack(v_u);
  select drops into v_after from profiles where id = v_u;
  insert into t values
    ('pack yields 5 cards', v_cards = 5, v_cards::text),
    ('drops were spent',    v_after <= v_before - 250, v_before || ' -> ' || v_after),
    ('ownership rows added', (select count(*) from card_ownership
                              where owner_id = v_u and acquired_via = 'pack') >= 5, '');
end $$;
select * from t;
```

Then confirm a broke player is refused:

```sql
do $$
declare v_u uuid; v_msg text;
begin
  select id into v_u from profiles limit 1;
  update profiles set drops = 10 where id = v_u;
  begin
    perform public.open_pack(v_u);
    raise notice 'FAIL: opened a pack with 10 drops';
  exception when others then
    raise notice 'PASS: refused with %', sqlerrm;
  end;
end $$;
```

Expected: refused with `insufficient_drops`.

- [ ] **Step 3: Add the client wrapper**

In `lib/supabase.ts`, following the existing `degrade to null` style of `fetchCards`:

```ts
export interface PackPull {
  cardId: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  serialNumber: number;
  downgraded: boolean;
}

/**
 * Opens a pack. The spend and the supply claim both happen inside
 * `open_pack`, so a client that dies mid-call cannot leave Drops debited
 * with no cards granted.
 */
export async function openPack(): Promise<PackPull[] | { error: string }> {
  const db = supabase();
  if (!db) return { error: 'No backend configured.' };
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: 'Sign in to open packs.' };

  const { data, error } = await db.rpc('open_pack', { p_user: auth.user.id });
  if (error) {
    return {
      error: error.message.includes('insufficient_drops')
        ? 'Not enough Drops for a pack.'
        : 'Could not open the pack. Try again.',
    };
  }
  return (data ?? []).map((r: {
    card_id: string; rarity: PackPull['rarity']; serial_number: number; downgraded: boolean;
  }) => ({
    cardId: r.card_id,
    rarity: r.rarity,
    serialNumber: r.serial_number,
    downgraded: r.downgraded,
  }));
}
```

- [ ] **Step 4: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat(packs): open a pack atomically on the server

Spending Drops and claiming scarce supply cannot be a client
read-then-write: two devices would oversell the last copy of a card
and could spend the same balance twice. The affordability check IS
the UPDATE's WHERE clause. A sold-out tier downgrades and refunds
per CLAUDE.md 6 rather than failing the pull."
```

---

### Task 3: Wire the packs screen

**Files:**
- Modify: `app/packs/page.tsx`
- Create: `lib/usePacks.ts`

**Interfaces:**
- Consumes: `openPack`, `PackPull` (Task 2); `PACK_COST`, `canAfford` (Task 1); `useAuth`, `useOwnedCards`.
- Produces: `usePacks(): { open: () => Promise<void>; pulls: PackPull[] | null; busy: boolean; error: string | null; affordable: boolean }`.

- [ ] **Step 1: Add the hook**

```ts
'use client';

/**
 * Pack opening. The screen had a tear animation but nothing behind it —
 * no spend, no pull, no card ever added to a collection.
 */

import { useCallback, useState } from 'react';
import { openPack, type PackPull } from './supabase';
import { canAfford } from './domain/packs';
import { useAuth } from './useAuth';

export function usePacks() {
  const { profile, isSignedIn } = useAuth();
  const [pulls, setPulls] = useState<PackPull[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await openPack();
    if ('error' in res) setError(res.error);
    else setPulls(res);
    setBusy(false);
  }, [busy]);

  return {
    open,
    pulls,
    busy,
    error,
    affordable: isSignedIn && canAfford(profile.drops ?? 0),
  };
}
```

- [ ] **Step 2: Render real outcomes on the screen**

In `app/packs/page.tsx`, keep the existing sealed-pack visual and tear
interaction. Change what happens on tear: call `open()`, then reveal the
returned `pulls` as real cards. Requirements:

- Show the cost (`PACK_COST` Drops) on the sealed pack.
- When `!affordable`, the tear action is disabled and the screen says
  `NOT ENOUGH DROPS · 250 NEEDED` — never a silent no-op.
- When signed out, show `SIGN IN TO OPEN PACKS` and link to `/signin`.
- When `error` is set, show it verbatim.
- A pull with `downgraded === true` is labelled `TIER SOLD OUT · REFUNDED`
  next to that card, so the §6 downgrade is visible rather than silent.

- [ ] **Step 3: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && NODE_ENV=production CAPACITOR=1 npx next build`
Expected: 0 errors; tests pass; build succeeds.

- [ ] **Step 4: Verify in a real browser**

Write `scripts/probe/packs.mjs` modelled on the existing probes in that
directory: register a fresh account (which grants 500 Drops), navigate to
`/packs`, tear the pack, and assert that five cards appear and the Drops
figure drops by 250. Run it and paste the output into your report.

- [ ] **Step 5: Commit**

```bash
git add app/packs/page.tsx lib/usePacks.ts scripts/probe/packs.mjs
git commit -m "feat(packs): make the pack screen actually open packs

The tear animation played and nothing happened: no Drops spent, no
card pulled, no collection change. Tearing now calls open_pack and
reveals the real pulls, and a sold-out downgrade is labelled rather
than silently swallowed."
```

---

### Task 4: Peak Moment mints a Legendary

**Files:**
- Apply migration via MCP `apply_migration`, name `mint_peak_moment_legendary`
- Modify: `lib/useVibe.ts` — call it on the rising edge
- Modify: `lib/supabase.ts` — add `mintPeakMoment()`

**Interfaces:**
- Consumes: `isPeakMoment`, `ReignState` from `lib/domain/reign.ts`.
- Produces: SQL `mint_peak_moment(p_user uuid, p_reign uuid) returns uuid`; `mintPeakMoment(reignId: string): Promise<string | null>`.

- [ ] **Step 1: Apply the migration**

```sql
-- CLAUDE.md §3 allows exactly two legendary paths: a discrete stat
-- milestone, or a live Peak Moment. This is the second one. It mints a
-- brand-new copy rather than drawing from the pool, so hitting vibe 100
-- cannot be blocked by a sold-out tier.
create or replace function public.mint_peak_moment(p_user uuid, p_reign uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_card   uuid;
  v_serial int;
begin
  -- One mint per reign. Without this, a vibe hovering at 100 would mint on
  -- every tick and legendaries would stop being scarce.
  update reigns
     set peak_moments = peak_moments + 1
   where id = p_reign and peak_moments = 0 and player_id = p_user
  returning card_id into v_card;

  if not found then
    return null;
  end if;

  update cards
     set supply_total = supply_total + 1,
         supply_remaining = supply_remaining + 1
   where id = v_card
  returning supply_total into v_serial;

  insert into card_ownership (owner_id, card_id, serial_number, acquired_via)
  values (p_user, v_card, v_serial, 'peak_moment');

  update cards set supply_remaining = supply_remaining - 1 where id = v_card;

  return v_card;
end;
$$;

revoke execute on function public.mint_peak_moment(uuid, uuid) from anon, public;
grant  execute on function public.mint_peak_moment(uuid, uuid) to authenticated;
```

- [ ] **Step 2: Verify one mint per reign**

```sql
create temp table t2(check_name text, passed boolean);
do $$
declare v_u uuid; v_c uuid; v_room uuid; v_r uuid; a uuid; b uuid;
begin
  select id into v_u from profiles limit 1;
  select id into v_c from cards limit 1;
  insert into rooms (slug,name,format,visibility) values ('t-peak','T','disco','open') returning id into v_room;
  insert into reigns (room_id,player_id,card_id,starting_vibe,peak_vibe,decay_rate)
    values (v_room,v_u,v_c,100,100,1.0) returning id into v_r;
  a := public.mint_peak_moment(v_u, v_r);
  b := public.mint_peak_moment(v_u, v_r);
  insert into t2 values ('first mint succeeds', a is not null), ('second mint refused', b is null);
  delete from reigns where room_id=v_room; delete from rooms where id=v_room;
end $$;
select * from t2;
```

Expected: both rows `true`.

- [ ] **Step 3: Call it on the rising edge**

Add to `lib/supabase.ts`:

```ts
/** Returns the minted card id, or null when this reign already minted. */
export async function mintPeakMoment(reignId: string): Promise<string | null> {
  const db = supabase();
  if (!db) return null;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await db.rpc('mint_peak_moment', {
    p_user: auth.user.id, p_reign: reignId,
  });
  if (error) {
    console.warn('[supabase] mintPeakMoment:', error.message);
    return null;
  }
  return (data as string) ?? null;
}
```

In `lib/useVibe.ts`, the hook already tracks `peakMoments` in its
`ReignState`. When that count increases between ticks AND the caller passed
a `reignId`, call `mintPeakMoment(reignId)` exactly once and expose the
result as `mintedCardId: string | null` on the hook's return. Add
`reignId?: string | null` to the hook's options; when it is absent (solo
practice, or no server reign), do not call the server at all.

- [ ] **Step 4: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors; the existing 79 tests still pass.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts lib/useVibe.ts
git commit -m "feat(reign): mint a Legendary on a live Peak Moment

CLAUDE.md 3 defines two legendary paths and this is the second.
It mints a NEW copy rather than drawing from the pool, so hitting
vibe 100 can never be blocked by a sold-out tier, and the reign row
gates it to one mint so a vibe parked at 100 cannot farm them."
```

---

### Task 5: World chart from real data

**Files:**
- Create: `lib/domain/chart.ts`
- Test: `lib/domain/chart.test.ts`
- Modify: `lib/supabase.ts` — add `fetchChartRows()`
- Modify: `app/chart/page.tsx`

**Interfaces:**
- Consumes: `Rarity` from `types/cards.ts`.
- Produces: `interface ChartEntry { cardId: string; title: string; subtitle: string; rarity: Rarity; artworkUrl: string | null; supplyTotal: number; supplyRemaining: number; scarcity: number; rank: number }`; `buildChart(rows: ChartRow[], limit?: number): ChartEntry[]` where `ChartRow = Omit<ChartEntry, 'scarcity' | 'rank'>`; `fetchChartRows(): Promise<ChartRow[] | null>`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildChart } from './chart';

const row = (id: string, rarity: 'common'|'rare'|'epic'|'legendary', total: number, left: number) => ({
  cardId: id, title: id, subtitle: 'X', rarity, artworkUrl: null,
  supplyTotal: total, supplyRemaining: left,
});

describe('world chart', () => {
  it('ranks the scarcest card first', () => {
    const chart = buildChart([row('a','common',1000,900), row('b','legendary',25,1)]);
    expect(chart[0].cardId).toBe('b');
    expect(chart[0].rank).toBe(1);
    expect(chart[1].rank).toBe(2);
  });

  it('reports scarcity as the fraction claimed', () => {
    const [e] = buildChart([row('a','rare',100,25)]);
    expect(e.scarcity).toBeCloseTo(0.75, 5);
  });

  it('never divides by zero on a card with no supply recorded', () => {
    const [e] = buildChart([row('a','rare',0,0)]);
    expect(Number.isFinite(e.scarcity)).toBe(true);
  });

  it('returns an empty chart for no rows, never placeholders', () => {
    expect(buildChart([])).toEqual([]);
  });

  it('honours the limit', () => {
    expect(buildChart([row('a','rare',10,1), row('b','rare',10,2), row('c','rare',10,3)], 2))
      .toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/chart.test.ts`
Expected: FAIL — cannot resolve `./chart`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * The world chart: which cards the room has actually claimed.
 *
 * This replaces a fixture called BIDS that listed invented Drop amounts
 * against four hardcoded player names. There is no bidding in this app —
 * CLAUDE.md §3 keeps Drops earn-only alongside a card-sell path, and a live
 * bid board is exactly the combination that section exists to avoid. What
 * IS real is scarcity: how much of each card's finite supply is gone.
 */

import type { Rarity } from '@/types/cards';

export interface ChartRow {
  cardId: string;
  title: string;
  subtitle: string;
  rarity: Rarity;
  artworkUrl: string | null;
  supplyTotal: number;
  supplyRemaining: number;
}

export interface ChartEntry extends ChartRow {
  /** Fraction of the printed supply now owned, 0..1. */
  scarcity: number;
  rank: number;
}

export function buildChart(rows: ChartRow[], limit = 50): ChartEntry[] {
  return rows
    .map((r) => ({
      ...r,
      // A card with no recorded supply is not infinitely scarce; it is
      // unknown, so it scores 0 rather than NaN or Infinity.
      scarcity: r.supplyTotal > 0
        ? (r.supplyTotal - r.supplyRemaining) / r.supplyTotal
        : 0,
      rank: 0,
    }))
    .sort((a, b) => b.scarcity - a.scarcity || a.supplyRemaining - b.supplyRemaining)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/chart.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Fetch real rows and render them**

Add to `lib/supabase.ts`:

```ts
export async function fetchChartRows(): Promise<ChartRow[] | null> {
  const db = supabase();
  if (!db) return null;
  const { data, error } = await db
    .from('cards')
    .select('id, title, subtitle, rarity, artwork_url, supply_total, supply_remaining');
  if (error) {
    console.warn('[supabase] fetchChartRows:', error.message);
    return null;
  }
  return (data ?? []).map((c) => ({
    cardId: c.id, title: c.title, subtitle: c.subtitle, rarity: c.rarity,
    artworkUrl: c.artwork_url, supplyTotal: c.supply_total, supplyRemaining: c.supply_remaining,
  }));
}
```

In `app/chart/page.tsx`, delete the `BIDS` import and render `buildChart`'s
output: rank, artwork, title, rarity badge, and `N OF M CLAIMED`. Keep the
screen's existing visual language. When the list is empty, render the
`EmptyState` primitive from `components/ui` — never placeholder rows.

- [ ] **Step 6: Commit**

```bash
git add lib/domain/chart.ts lib/domain/chart.test.ts lib/supabase.ts app/chart/page.tsx
git commit -m "feat(chart): rank real cards by scarcity, not invented bids

BIDS listed fabricated Drop amounts against four hardcoded names.
There is no bidding here on purpose: CLAUDE.md 3 keeps Drops
earn-only alongside a card-sell path, and a live bid board is the
combination it exists to avoid. Scarcity is real and already tracked."
```

---

### Task 6: Room screen on the real challenger line

**Files:**
- Modify: `app/room/page.tsx`

**Interfaces:**
- Consumes: `Challenger`, `positionOf`, `nextHolder` from `lib/domain/challengers.ts`; `useRoom`'s `line`.
- Produces: no new exports.

- [ ] **Step 1: Replace the fixture queue**

`app/room/page.tsx` imports `CHALLENGER_QUEUE` and `NEXT_UP` from
`lib/seed-data.ts` — two arrays of invented initials (`DR`, `SV`, `ET`,
`JU`) rendered as though they were players in the room. This is the Throne
Room shared display (1280×720), so it is the screen an audience actually
watches, which makes fabricated players worse here than anywhere else.

Use the real line from `useRoom` (it already exposes `line: Challenger[]`
and takes `roomUuid`). Render each queued player's initials from their
profile. When the line is empty, show `NO CHALLENGERS · THRONE UNCONTESTED`
rather than an empty grid or placeholder avatars.

`NEXT_UP` is the same fixture in a different shape — derive it from the
front of the same `line` instead of a second source.

- [ ] **Step 2: Delete the now-dead fixtures**

Once nothing imports them, delete `CHALLENGER_QUEUE` and `NEXT_UP` from
`lib/seed-data.ts`. Verify with
`grep -rn "CHALLENGER_QUEUE\|NEXT_UP" app/ lib/ components/` first — if any
other screen still imports them, leave them and say so in your report.

- [ ] **Step 3: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && NODE_ENV=production CAPACITOR=1 npx next build`
Expected: 0 errors; tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/room/page.tsx lib/seed-data.ts
git commit -m "feat(room): show the real challenger line on the shared display

CHALLENGER_QUEUE and NEXT_UP were arrays of invented initials
rendered as though those players were in the room. This is the
1280x720 display an audience watches, so fabricated players are
worse here than anywhere else in the app."
```

---

### Task 7: Event detail from the database

**Files:**
- Modify: `app/events/[slug]/EventDetailView.tsx`
- Modify: `lib/useLiveEvents.ts` — add `useEventBySlug`

**Interfaces:**
- Consumes: `fetchEvents`, `fetchEventCounts` from `lib/supabase.ts`.
- Produces: `useEventBySlug(slug: string): { event: PartyEvent | null; state: 'loading' | 'found' | 'missing' }`.

- [ ] **Step 1: Add the hook**

`app/events/[slug]/EventDetailView.tsx` calls `eventBySlug(slug)` from
`lib/social-data.ts`, a fixture lookup — so the events LIST reads the real
database while tapping into an event shows seeded data. The two disagree.

Add to `lib/useLiveEvents.ts`, reusing the mapping already in that file:

```ts
export function useEventBySlug(slug: string) {
  const { events, source } = useLiveEvents();
  const [state, setState] = useState<'loading' | 'found' | 'missing'>('loading');
  const event = events.find((e) => e.slug === slug) ?? null;

  useEffect(() => {
    if (source === 'loading') { setState('loading'); return; }
    setState(event ? 'found' : 'missing');
  }, [source, event]);

  return { event, state };
}
```

If `useLiveEvents` does not currently expose a `'loading'` source value,
add one rather than treating "not yet fetched" as "not found" — that
distinction is the whole point of this task.

- [ ] **Step 2: Render real event data**

In `EventDetailView.tsx`, replace `eventBySlug(slug)` with
`useEventBySlug(slug)`. While `state === 'loading'`, render the existing
loading treatment. When `state === 'missing'`, render the `EmptyState`
primitive with `EVENT NOT FOUND` and a link back to `/events` — never fall
back to fixture data.

- [ ] **Step 3: Remove the dead fixture**

Delete `eventBySlug` from `lib/social-data.ts` once nothing imports it.
Verify with `grep -rn "eventBySlug" app/ lib/ components/` first. Leave
`relativeTime` and `timeAgo` alone — they are date formatters, still used,
and not fixture data.

- [ ] **Step 4: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && NODE_ENV=production CAPACITOR=1 npx next build`
Expected: 0 errors; tests pass; build succeeds. Note that `/events/[slug]`
is statically exported via `generateStaticParams` — confirm the build still
lists its routes.

- [ ] **Step 5: Commit**

```bash
git add app/events/\[slug\]/EventDetailView.tsx lib/useLiveEvents.ts lib/social-data.ts
git commit -m "feat(events): read event detail from the database

The events list read Supabase while the detail screen read a
fixture, so tapping an event showed different data from the card
that led to it. A missing slug now says so instead of silently
falling back to seeded content."
```

---

### Task 8: Shoutouts

**Files:**
- Create: `lib/domain/shoutouts.ts`
- Test: `lib/domain/shoutouts.test.ts`
- Modify: `components/NowPlaying.tsx`

**Interfaces:**
- Consumes: `FormatId`, `allowsShoutouts` from `lib/domain/formats.ts`.
- Produces: `interface CardCredit { ownerHandle: string; ownerName: string }`; `creditFor(format: FormatId, credit: CardCredit | null): string | null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { creditFor } from './shoutouts';

const credit = { ownerHandle: 'sashav', ownerName: 'Sasha V.' };

describe('shoutouts', () => {
  // Spec §4: Disco, Clubbing and Private Party only.
  it('credits the card owner on the three formats that allow it', () => {
    expect(creditFor('disco', credit)).toContain('@sashav');
    expect(creditFor('clubbing', credit)).toContain('@sashav');
    expect(creditFor('private_party', credit)).toContain('@sashav');
  });

  it('shows nothing on formats without shoutouts', () => {
    expect(creditFor('concert', credit)).toBeNull();
    expect(creditFor('fest', credit)).toBeNull();
    expect(creditFor('night_party', credit)).toBeNull();
  });

  it('shows nothing when the card has no known owner', () => {
    expect(creditFor('disco', null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/shoutouts.test.ts`
Expected: FAIL — cannot resolve `./shoutouts`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Shoutouts — card credit on the formats that allow it.
 *
 * Display only. CLAUDE.md §1.2 is explicit: a shoutout awards no Drops,
 * changes no odds and confers no mechanical advantage. If it paid out,
 * social standing would become a second progression track, which is
 * exactly what §3 exists to prevent. So this module returns a STRING and
 * nothing else — it has no access to Drops or supply by construction.
 */

import type { FormatId } from './formats';
import { allowsShoutouts } from './formats';

export interface CardCredit {
  ownerHandle: string;
  ownerName: string;
}

export function creditFor(format: FormatId, credit: CardCredit | null): string | null {
  if (!allowsShoutouts(format) || !credit) return null;
  return `from @${credit.ownerHandle}'s collection`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/shoutouts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Render the credit**

`components/NowPlaying.tsx` already receives the playing card. Add two
optional props — `format?: FormatId` and `credit?: CardCredit | null` — and
when `creditFor(format, credit)` returns a string, render it under the track
subtitle in the existing small-caps telemetry style. When it returns null,
render nothing at all (no empty row, no placeholder).

**Where the credit comes from.** In single-player use the card on the deck
is the signed-in player's own, so pass their own handle from `useAuth`'s
`profile.handle`:

```tsx
const credit = isSignedIn && hasCollection
  ? { ownerHandle: profile.handle, ownerName: profile.display_name }
  : null;
```

Pass `format={dbRoom?.format ?? DEFAULT_FORMAT}` alongside it. Do NOT try to
look up another player's handle: `card_ownership` is RLS-scoped to the
caller's own rows, so a client cannot read who else owns a card, and
inventing a name is precisely the defect this plan removes. Crediting other
players' cards belongs with multiplayer card-play, which no task here
builds — say so in your report rather than faking it.

- [ ] **Step 6: Commit**

```bash
git add lib/domain/shoutouts.ts lib/domain/shoutouts.test.ts components/NowPlaying.tsx app/deck/page.tsx
git commit -m "feat(shoutouts): credit whose collection a card came from

Gives the collectible layer a social payoff it lacked: a rare card
was only better stats. Display only by construction -- the module
returns a string and has no access to Drops or supply, because
CLAUDE.md 1.2 forbids a shoutout conferring any advantage."
```

---

## Verification

After Task 8, all of the following must hold:

1. `npx vitest run` — all tests pass, including the new `packs`, `chart` and `shoutouts` suites.
2. `grep -rn "BIDS\|CHALLENGER_QUEUE\|NEXT_UP\|eventBySlug" app/ lib/ components/` returns nothing.
3. `grep -rn "from 'react'\|from '.*supabase'" lib/domain/` returns nothing — the domain stays pure.
4. A signed-in player with 500 Drops can open a pack, ends with 250, and owns 5 more cards.
5. A player with fewer than 250 Drops is refused with a visible message, and no supply is decremented.
6. `/chart` ranks real cards by scarcity; an empty card table renders the empty state, not placeholders.
7. `/room` shows the real challenger line, or `NO CHALLENGERS · THRONE UNCONTESTED`.
8. `/events/<unknown-slug>` renders `EVENT NOT FOUND`, not fixture content.
9. Card credit appears on Disco/Clubbing/Private Party only, awards no Drops,
   and names the signed-in player's own handle — never a fabricated one.
10. `NODE_ENV=production CAPACITOR=1 npx next build` succeeds with every route still listed.
