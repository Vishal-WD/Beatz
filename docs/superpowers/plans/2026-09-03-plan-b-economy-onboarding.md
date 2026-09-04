# Plan B — Economy and Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a new player's first five minutes real — a welcome, a starter pack they actually tear open, three pack tiers to spend Drops on, and a collection they can play, filter and curate.

**Architecture:** Pack economics stay in `lib/domain/packs.ts` as pure roll-injected rules, extended from one tier to three; the authoritative odds live in the `open_pack` SQL function, which already spends and claims supply in one atomic transaction. Onboarding is a route guard, not a wizard: a nullable `onboarded_at` on `profiles` decides whether a signed-in player is sent to `/welcome` or straight to the app. The collection screen gains playback and filtering by composing hooks that already exist rather than new machinery.

**Tech Stack:** TypeScript, Next.js 15 static export, Vitest, Supabase Postgres, Capacitor.

**Spec:** `docs/superpowers/specs/2026-09-03-app-redesign-design.md` (sections 3 and 5)

**Runs after:** Plan A (foundation), which wiped the mock data, fixed the sign-in flash, and established the token layer. Screens built here use those tokens and must not reintroduce colour literals.

**Runs before:** Plan C (room and feed).

## Global Constraints

- **Drops are earn-only.** No real-money purchase path while a card-sell path exists (CLAUDE.md §3). Packs are bought with earned Drops only.
- **Pack odds are fixed constants per tier** — never scaled by playtime, spend, streak, or a pity counter (§3). A guaranteed floor applied after the roll is allowed; a curve that improves with engagement is not.
- **Supply decrements stay atomic** — `UPDATE ... WHERE supply_remaining > 0 RETURNING`, never read-then-write (§3).
- **A sold-out tier downgrades one tier and refunds the difference**, never a hard pull failure (§6).
- **Screens contain no raw colour values.** `app/no-raw-colours.test.ts` enforces this; it must stay green.
- **A token used by a screen must exist in both palettes** (`:root` and `:root[data-theme='light']`) unless it is genuinely theme-invariant.
- `lib/domain/` imports neither React nor Supabase.
- No new dependencies.

---

### Task 1: Three pack tiers (pure)

**Files:**
- Modify: `lib/domain/packs.ts`
- Modify: `lib/domain/packs.test.ts`

**Interfaces:**
- Consumes: `Rarity` from `types/cards.ts`.
- Produces: `type PackTier = 'starter' | 'night' | 'headliner'`; `interface PackDef { id: PackTier; label: string; cost: number; size: number; odds: PackOdds; guarantee: Rarity | null }`; `const PACKS: Record<PackTier, PackDef>`; `rollRarity(roll: number, tier: PackTier): Rarity`; `rollPack(rolls: number[], tier: PackTier): Rarity[]`; `applyGuarantee(pulled: Rarity[], tier: PackTier, roll: number): Rarity[]`; `canAfford(drops: number, tier: PackTier): boolean`; `refundFor(from: Rarity, to: Rarity): number` (unchanged).

- [ ] **Step 1: Write the failing test**

Replace the body of `lib/domain/packs.test.ts` with this. The old single-tier tests go — `PACK_COST` and `PACK_SIZE` no longer exist as single values.

```ts
import { describe, it, expect } from 'vitest';
import {
  PACKS, rollRarity, rollPack, applyGuarantee, canAfford, refundFor,
  type PackTier,
} from './packs';

const TIERS: PackTier[] = ['starter', 'night', 'headliner'];

describe('pack tiers', () => {
  it('prices the three tiers as the spec sets them', () => {
    expect(PACKS.starter.cost).toBe(150);
    expect(PACKS.night.cost).toBe(400);
    expect(PACKS.headliner.cost).toBe(900);
  });

  it('sizes them 3 / 5 / 5', () => {
    expect(PACKS.starter.size).toBe(3);
    expect(PACKS.night.size).toBe(5);
    expect(PACKS.headliner.size).toBe(5);
  });

  it('gives every tier odds that sum to exactly 1', () => {
    for (const t of TIERS) {
      const o = PACKS[t].odds;
      expect(o.common + o.rare + o.epic + o.legendary, t).toBeCloseTo(1, 10);
    }
  });

  // CLAUDE.md §3: legendary must stay the rarest slice in EVERY tier — a
  // better pack shifts the odds, it never inverts the rarity ladder.
  it('keeps legendary rarest and common commonest in every tier', () => {
    for (const t of TIERS) {
      const o = PACKS[t].odds;
      expect(o.legendary, t).toBeLessThan(o.epic);
      expect(o.epic, t).toBeLessThan(o.rare);
      expect(o.rare, t).toBeLessThan(o.common);
    }
  });

  it('improves the odds as the tier gets more expensive', () => {
    expect(PACKS.night.odds.legendary).toBeGreaterThan(PACKS.starter.odds.legendary);
    expect(PACKS.headliner.odds.legendary).toBeGreaterThan(PACKS.night.odds.legendary);
  });

  it('never returns undefined for any roll in [0,1) in any tier', () => {
    for (const t of TIERS) {
      for (let i = 0; i < 500; i++) {
        expect(['common', 'rare', 'epic', 'legendary'], t).toContain(rollRarity(i / 500, t));
      }
    }
  });

  it('draws one tier per roll', () => {
    expect(rollPack([0, 0, 0], 'starter')).toEqual(['common', 'common', 'common']);
  });

  // Only headliner guarantees anything. §3 allows a discrete floor; it
  // forbids a curve that improves with how much you have played or spent.
  it('guarantees an epic or better only in headliner', () => {
    expect(PACKS.starter.guarantee).toBeNull();
    expect(PACKS.night.guarantee).toBeNull();
    expect(PACKS.headliner.guarantee).toBe('epic');
  });

  it('upgrades one card when a headliner pull has no epic or better', () => {
    const all: import('@/types/cards').Rarity[] = ['common', 'common', 'common', 'common', 'common'];
    const out = applyGuarantee(all, 'headliner', 0);
    expect(out).toHaveLength(5);
    expect(out.some((r) => r === 'epic' || r === 'legendary')).toBe(true);
    // Exactly one card is lifted — the guarantee is a floor, not a reroll.
    expect(out.filter((r) => r === 'common')).toHaveLength(4);
  });

  it('leaves a headliner pull alone when it already met the floor', () => {
    const already: import('@/types/cards').Rarity[] = ['common', 'legendary', 'common', 'common', 'common'];
    expect(applyGuarantee(already, 'headliner', 0)).toEqual(already);
  });

  it('never applies a guarantee to the untiered packs', () => {
    const all: import('@/types/cards').Rarity[] = ['common', 'common', 'common'];
    expect(applyGuarantee(all, 'starter', 0)).toEqual(all);
    expect(applyGuarantee(all, 'night', 0)).toEqual(all);
  });

  it('affords a tier only with enough Drops for that tier', () => {
    expect(canAfford(150, 'starter')).toBe(true);
    expect(canAfford(149, 'starter')).toBe(false);
    expect(canAfford(500, 'night')).toBe(true);
    expect(canAfford(500, 'headliner')).toBe(false);
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
Expected: FAIL — `PACKS` is not exported.

- [ ] **Step 3: Rewrite the module for three tiers**

Replace `lib/domain/packs.ts` with this. `PackOdds` and `refundFor` keep their current shape; `PACK_COST` and `PACK_SIZE` are gone.

```ts
/**
 * Pack economics.
 *
 * Pure and roll-injected: the caller supplies the random numbers, so the
 * odds are testable without stubbing Math.random and the screen can show
 * the same table the server rolls against.
 *
 * NOTE: the odds below are duplicated in the `open_pack` SQL function, and
 * THE SQL COPY IS AUTHORITATIVE because it is what actually grants cards.
 * This copy exists so the shop can price and describe a pack without a
 * round trip. Change both together.
 */

import type { Rarity } from '@/types/cards';

export type PackTier = 'starter' | 'night' | 'headliner';

export interface PackOdds {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

export interface PackDef {
  id: PackTier;
  label: string;
  /** Earned Drops only. Never purchasable with money (CLAUDE.md §3). */
  cost: number;
  size: number;
  odds: PackOdds;
  /**
   * The floor a pull is lifted to when it misses. A discrete guarantee is
   * allowed by §3; a curve that improves with playtime or spend is not, so
   * this is a fixed rarity or nothing.
   */
  guarantee: Rarity | null;
}

export const PACKS: Record<PackTier, PackDef> = {
  starter: {
    id: 'starter',
    label: 'STARTER',
    cost: 150,
    size: 3,
    odds: { common: 0.78, rare: 0.18, epic: 0.035, legendary: 0.005 },
    guarantee: null,
  },
  night: {
    id: 'night',
    label: 'NIGHT',
    cost: 400,
    size: 5,
    odds: { common: 0.70, rare: 0.22, epic: 0.07, legendary: 0.01 },
    guarantee: null,
  },
  headliner: {
    id: 'headliner',
    label: 'HEADLINER',
    cost: 900,
    size: 5,
    odds: { common: 0.52, rare: 0.30, epic: 0.15, legendary: 0.03 },
    guarantee: 'epic',
  },
};

/** What a pull is worth, used for downgrade refunds. */
const TIER_VALUE: Record<Rarity, number> = {
  common: 10,
  rare: 40,
  epic: 120,
  legendary: 400,
};

export function rollRarity(roll: number, tier: PackTier): Rarity {
  const o = PACKS[tier].odds;
  // Walk the cumulative distribution from the rarest end so floating point
  // slop lands in `common` (the widest band) rather than off the end.
  const r = Math.min(Math.max(roll, 0), 0.9999999);
  if (r >= 1 - o.legendary) return 'legendary';
  if (r >= 1 - o.legendary - o.epic) return 'epic';
  if (r >= 1 - o.legendary - o.epic - o.rare) return 'rare';
  return 'common';
}

export const rollPack = (rolls: number[], tier: PackTier): Rarity[] =>
  rolls.map((r) => rollRarity(r, tier));

const ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/**
 * Lifts ONE card to the tier's guaranteed floor when the pull missed it.
 *
 * A floor, not a reroll: the other cards are untouched, so a headliner that
 * already rolled a legendary is returned unchanged rather than being given
 * a second chance at one.
 */
export function applyGuarantee(pulled: Rarity[], tier: PackTier, roll: number): Rarity[] {
  const floor = PACKS[tier].guarantee;
  if (!floor) return pulled;

  const floorIdx = ORDER.indexOf(floor);
  if (pulled.some((r) => ORDER.indexOf(r) >= floorIdx)) return pulled;

  // Lift the weakest card, so the guarantee costs the pull as little as
  // possible; `roll` breaks ties deterministically when several are equal.
  let weakest = 0;
  for (let i = 1; i < pulled.length; i++) {
    if (ORDER.indexOf(pulled[i]) < ORDER.indexOf(pulled[weakest])) weakest = i;
  }
  const pick = Math.min(Math.floor(Math.max(roll, 0) * pulled.length), pulled.length - 1);
  const target = ORDER.indexOf(pulled[pick]) === ORDER.indexOf(pulled[weakest]) ? pick : weakest;

  const out = [...pulled];
  out[target] = floor;
  return out;
}

export const canAfford = (drops: number, tier: PackTier): boolean =>
  drops >= PACKS[tier].cost;

/**
 * §6: a tier that is sold out downgrades one step and refunds the
 * difference, rather than failing the pull outright.
 */
export const refundFor = (from: Rarity, to: Rarity): number =>
  Math.max(0, TIER_VALUE[from] - TIER_VALUE[to]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/packs.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Fix the callers the rename broke**

`lib/usePacks.ts` imports `canAfford` and `PACK_COST`, and `app/packs/page.tsx` reads `pack.cost`. Both break at compile time. Do the minimum to typecheck — Task 3 rewrites them properly:

```ts
// lib/usePacks.ts — temporary until Task 3 rewrites this hook for tiers.
import { canAfford, PACKS } from './domain/packs';
// …
cost: PACKS.night.cost,
affordable: isSignedIn && canAfford(profile.drops ?? 0, 'night'),
```

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/domain/packs.ts lib/domain/packs.test.ts lib/usePacks.ts
git commit -m "feat(packs): three tiers instead of one

One pack at one price gave a player nothing to save toward. Starter at
150 is affordable in the first minute, Night at 400 is the default, and
Headliner at 900 is worth waiting for -- it is the only tier that
guarantees anything.

Odds stay fixed constants per tier. CLAUDE.md 3 rejects any curve that
improves with playtime or spend, so a better pack shifts the whole
distribution rather than adding a pity counter, and headliner's floor is
applied once after the roll rather than rerolling until it hits."
```

---

### Task 2: Server-side tiers

**Files:**
- Apply migration via MCP `apply_migration`, name `open_pack_tiers`
- Modify: `lib/supabase.ts` — `openPack` takes a tier

**Interfaces:**
- Consumes: the tier costs, sizes and odds from Task 1 (mirrored in SQL).
- Produces: SQL `open_pack(p_user uuid, p_tier text)`; `openPack(tier: PackTier): Promise<PackPull[] | { error: string }>`.

- [ ] **Step 1: Apply the migration**

```sql
-- Three tiers. The spend and the supply claim stay in one transaction: a
-- client-side read-then-write would let two devices oversell the last copy
-- of a card and spend the same balance twice (CLAUDE.md §3).
--
-- These odds are duplicated in lib/domain/packs.ts so the shop can price a
-- pack without a round trip. THIS COPY IS AUTHORITATIVE. Change both.
create or replace function public.open_pack(p_user uuid, p_tier text default 'night')
returns table(out_card_id uuid, out_rarity text, out_serial int, out_downgraded boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cost    int;
  v_size    int;
  v_leg     numeric;
  v_epic    numeric;
  v_rare    numeric;
  v_floor   text;
  v_drops   int;
  v_roll    numeric;
  v_tier    text;
  v_try     text;
  v_card    uuid;
  v_serial  int;
  v_refund  int := 0;
  v_down    boolean;
  v_best    int := 0;
  i         int;
  v_order   text[] := array['legendary','epic','rare','common'];
  v_idx     int;
  v_rank    int;
begin
  -- Tier table, mirroring lib/domain/packs.ts.
  case p_tier
    when 'starter'   then v_cost := 150; v_size := 3; v_leg := 0.005; v_epic := 0.035; v_rare := 0.18; v_floor := null;
    when 'night'     then v_cost := 400; v_size := 5; v_leg := 0.01;  v_epic := 0.07;  v_rare := 0.22; v_floor := null;
    when 'headliner' then v_cost := 900; v_size := 5; v_leg := 0.03;  v_epic := 0.15;  v_rare := 0.30; v_floor := 'epic';
    else raise exception 'unknown_tier';
  end case;

  -- Atomic spend: the WHERE clause IS the affordability check, so two
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
                when v_roll >= 1 - v_leg then 'legendary'
                when v_roll >= 1 - v_leg - v_epic then 'epic'
                when v_roll >= 1 - v_leg - v_epic - v_rare then 'rare'
                else 'common'
              end;

    -- Headliner's floor: if this is the last card and nothing has reached
    -- epic yet, this one is lifted. Applied once, never a reroll loop.
    if v_floor is not null and i = v_size and v_best < 3 then
      v_tier := v_floor;
    end if;

    v_down := false;
    v_card := null;
    v_idx  := array_position(v_order, v_tier);

    -- Walk down from the rolled tier until one has stock (§6: downgrade
    -- and refund, never a hard failure).
    while v_card is null and v_idx <= 4 loop
      v_try := v_order[v_idx];

      update cards c
         set supply_remaining = c.supply_remaining - 1
       where c.id = (
         select c2.id from cards c2
          where c2.rarity = v_try::rarity and c2.supply_remaining > 0
          order by random() limit 1
       )
      returning c.id, c.supply_total - c.supply_remaining into v_card, v_serial;

      if v_card is null then
        v_idx  := v_idx + 1;
        v_down := true;
      end if;
    end loop;

    if v_card is null then
      v_refund := v_refund + (v_cost / v_size);
      continue;
    end if;

    if v_down then
      v_refund := v_refund + 30;
    end if;

    -- Track the best rarity seen, so the floor knows whether it is needed.
    v_rank := 5 - array_position(v_order, v_try);
    if v_rank > v_best then v_best := v_rank; end if;

    insert into card_ownership (owner_id, card_id, serial_number, acquired_via)
    values (p_user, v_card, v_serial, 'pack');

    out_card_id    := v_card;
    out_rarity     := v_try;
    out_serial     := v_serial;
    out_downgraded := v_down;
    return next;
  end loop;

  if v_refund > 0 then
    update profiles set drops = drops + v_refund where id = p_user;
  end if;
end;
$$;

revoke execute on function public.open_pack(uuid, text) from anon, public;
grant  execute on function public.open_pack(uuid, text) to authenticated;
```

- [ ] **Step 2: Verify each tier**

Run this and confirm every row reads `true`:

```sql
create temp table t(check_name text, passed boolean, detail text);
do $$
declare v_u uuid; d0 int; d1 int; n int; c0 int; c1 int;
begin
  select id into v_u from profiles limit 1;

  -- starter: 150 drops, 3 cards
  update profiles set drops = 5000 where id = v_u;
  select drops into d0 from profiles where id=v_u;
  select count(*) into c0 from card_ownership where owner_id=v_u;
  select count(*) into n from public.open_pack(v_u,'starter');
  select drops into d1 from profiles where id=v_u;
  select count(*) into c1 from card_ownership where owner_id=v_u;
  insert into t values ('starter: 3 cards', n=3, n::text),
                       ('starter: costs 150', d0-d1 >= 150, (d0-d1)::text),
                       ('starter: 3 owned', c1-c0 = 3, (c1-c0)::text);

  -- night: 400 drops, 5 cards
  update profiles set drops = 5000 where id = v_u;
  select drops into d0 from profiles where id=v_u;
  select count(*) into n from public.open_pack(v_u,'night');
  select drops into d1 from profiles where id=v_u;
  insert into t values ('night: 5 cards', n=5, n::text),
                       ('night: costs 400', d0-d1 >= 400, (d0-d1)::text);

  -- headliner: 900 drops, 5 cards, at least one epic+
  update profiles set drops = 5000 where id = v_u;
  select drops into d0 from profiles where id=v_u;
  select count(*) into n from public.open_pack(v_u,'headliner');
  select drops into d1 from profiles where id=v_u;
  insert into t values ('headliner: 5 cards', n=5, n::text),
                       ('headliner: costs 900', d0-d1 >= 900, (d0-d1)::text);

  -- an unknown tier must be refused, and cost nothing
  update profiles set drops = 5000 where id = v_u;
  begin
    perform public.open_pack(v_u,'bogus');
    insert into t values ('unknown tier refused', false, 'it succeeded');
  exception when others then
    insert into t values ('unknown tier refused', sqlerrm like '%unknown_tier%', sqlerrm);
  end;
  insert into t values ('unknown tier cost nothing',
    (select drops from profiles where id=v_u) = 5000, '');

  -- cannot afford headliner on 899
  update profiles set drops = 899 where id = v_u;
  begin
    perform public.open_pack(v_u,'headliner');
    insert into t values ('899 cannot buy headliner', false, 'it succeeded');
  exception when others then
    insert into t values ('899 cannot buy headliner', sqlerrm like '%insufficient%', '');
  end;
end $$;
select * from t;
```

Then run the headliner guarantee twenty times and confirm every pull contains an epic or legendary:

```sql
do $$
declare v_u uuid; i int; v_miss int := 0; v_has boolean;
begin
  select id into v_u from profiles limit 1;
  for i in 1..20 loop
    update profiles set drops = 5000 where id = v_u;
    select bool_or(out_rarity in ('epic','legendary')) into v_has
      from public.open_pack(v_u,'headliner');
    if not v_has then v_miss := v_miss + 1; end if;
  end loop;
  raise notice 'headliner pulls missing epic+: % of 20 (must be 0)', v_miss;
end $$;
```

- [ ] **Step 3: Pass the tier from the client**

In `lib/supabase.ts`, change `openPack` to take a tier:

```ts
export async function openPack(tier: PackTier): Promise<PackPull[] | { error: string }> {
  const db = supabase();
  if (!db) return { error: 'No backend configured.' };
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: 'Sign in to open packs.' };

  const { data, error } = await db.rpc('open_pack', {
    p_user: auth.user.id,
    p_tier: tier,
  });
  if (error) {
    return {
      error: error.message.includes('insufficient_drops')
        ? 'Not enough Drops for that pack.'
        : 'Could not open the pack. Try again.',
    };
  }
  return (data ?? []).map((r: {
    out_card_id: string;
    out_rarity: PackPull['rarity'];
    out_serial: number;
    out_downgraded: boolean;
  }) => ({
    cardId: r.out_card_id,
    rarity: r.out_rarity,
    serialNumber: r.out_serial,
    downgraded: r.out_downgraded,
  }));
}
```

Import `PackTier` from `./domain/packs` at the top of the file.

- [ ] **Step 4: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors; every test passes.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat(packs): open any of the three tiers atomically

The tier table lives in SQL alongside the spend, so the odds a player is
shown and the odds the server rolls cannot drift apart within a request.
An unknown tier is refused before any Drops move.

Headliner's epic floor is applied to the last card only when nothing
better has already been pulled -- a floor, not a reroll, so a pull that
already contains a legendary is left alone."
```

---

### Task 3: The shop screen

**Files:**
- Modify: `lib/usePacks.ts`
- Modify: `app/packs/page.tsx`

**Interfaces:**
- Consumes: `PACKS`, `PackTier`, `canAfford` (Task 1); `openPack` (Task 2).
- Produces: `usePacks()` returning `{ open(tier: PackTier): Promise<void>; reset(): void; pulls; state; error; busy; drops; isSignedIn; affordable(tier: PackTier): boolean; openedTier: PackTier | null }`.

- [ ] **Step 1: Rewrite the hook for tiers**

```ts
'use client';

/**
 * Pack opening.
 *
 * The screen had a tear animation and nothing behind it: no spend, no
 * pull, no card added to a collection. Tearing is now the purchase, and
 * which tier was torn decides what it costs and what it contains.
 */

import { useCallback, useState } from 'react';
import { openPack, type PackPull } from './supabase';
import { canAfford, PACKS, type PackTier } from './domain/packs';
import { useAuth } from './useAuth';

export type PackState = 'idle' | 'opening' | 'opened' | 'error';

export function usePacks() {
  const { profile, isSignedIn } = useAuth();
  const [pulls, setPulls] = useState<PackPull[] | null>(null);
  const [openedTier, setOpenedTier] = useState<PackTier | null>(null);
  const [state, setState] = useState<PackState>('idle');
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async (tier: PackTier) => {
    // Guard re-entry: the pack is one big tap target and a double tap
    // must not bill two packs.
    if (state === 'opening') return;
    setState('opening');
    setError(null);
    setOpenedTier(tier);

    const res = await openPack(tier);
    if ('error' in res) {
      setError(res.error);
      setState('error');
      return;
    }
    setPulls(res);
    setState('opened');
  }, [state]);

  const reset = useCallback(() => {
    setPulls(null);
    setOpenedTier(null);
    setError(null);
    setState('idle');
  }, []);

  const drops = profile.drops ?? 0;

  return {
    open,
    reset,
    pulls,
    openedTier,
    state,
    error,
    busy: state === 'opening',
    drops,
    isSignedIn,
    affordable: (tier: PackTier) => isSignedIn && canAfford(drops, tier),
  };
}
```

- [ ] **Step 2: Add tier selection to the screen**

`app/packs/page.tsx` currently opens one implicit pack. Change it so the
idle state shows the three tiers and tearing is scoped to the chosen one:

- When `state === 'idle'`, render one card per tier from
  `Object.values(PACKS)`, each showing its label, `{cost} DROPS`,
  `{size} CARDS`, and — for headliner only — `GUARANTEED EPIC OR BETTER`.
- A tier the player cannot afford is visibly disabled and labelled
  `NEED {cost - drops} MORE`, never a silent no-op.
- Signed out, all three are disabled and a single `SIGN IN TO OPEN PACKS`
  links to `/signin`.
- Tapping an affordable tier calls `open(tier)` and runs the existing tear
  and reveal animation unchanged.
- The reveal shows `openedTier`'s label so the player can see which pack
  they opened.
- A pull with `downgraded === true` keeps its existing
  `TIER SOLD OUT · REFUNDED` label.

Use only tokens for colour — `app/no-raw-colours.test.ts` must stay green.

- [ ] **Step 3: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && NODE_ENV=production CAPACITOR=1 npx next build`
Expected: 0 errors; all tests pass; build succeeds.

- [ ] **Step 4: Verify in a real browser**

Write `scripts/probe/shop.mjs`, modelled on the existing probes in that
directory (Playwright against a dev server on `http://localhost:3100`).
Register a fresh account, go to `/packs`, and assert:

- All three tiers render with their costs.
- On 500 Drops, starter and night are enabled and headliner is disabled
  with a `NEED 400 MORE` label.
- Opening a starter leaves 350 Drops and adds exactly 3 cards.

Paste the probe's output into your report.

- [ ] **Step 5: Commit**

```bash
git add lib/usePacks.ts app/packs/page.tsx scripts/probe/shop.mjs
git commit -m "feat(shop): choose a pack tier before tearing it

The shop opened one implicit pack, so Drops had nothing to be spent on
and no reason to accumulate. Three tiers give the balance a meaning:
500 starting Drops is one Night or three Starters, and Headliner is
something to come back for.

A tier you cannot afford says how many Drops are missing rather than
refusing silently."
```

---

### Task 4: Onboarding

**Files:**
- Apply migration via MCP `apply_migration`, name `profiles_onboarded_at`
- Create: `app/welcome/page.tsx`
- Create: `lib/useOnboarding.ts`
- Modify: `app/signin/page.tsx:40` — send a new player to `/welcome`
- Modify: `lib/supabase.ts` — add `markOnboarded()`

**Interfaces:**
- Consumes: `useAuth` (`isLoading`, `isSignedIn`, `profile`); `useOwnedCards`.
- Produces: `profiles.onboarded_at timestamptz`; `markOnboarded(): Promise<boolean>`; `useOnboarding(): { needsWelcome: boolean; finish(): Promise<void> }`.

- [ ] **Step 1: Add the flag**

```sql
-- Nothing recorded whether a player had seen the welcome, so the app could
-- not tell a brand-new account from a returning one. Nullable rather than
-- boolean-default-false: the timestamp answers "when", and NULL genuinely
-- means "not yet" rather than being indistinguishable from a default.
alter table profiles
  add column if not exists onboarded_at timestamptz;

-- Everyone who already exists has effectively been onboarded; only new
-- signups should see the welcome.
update profiles set onboarded_at = now() where onboarded_at is null;

-- CRITICAL: my_profile was created with an EXPLICIT column list, and
-- useAuth reads the player's profile through it (lib/useAuth.ts:47), not
-- from the table. Adding a column to `profiles` does NOT surface it through
-- the view, so without this recreation `onboarded_at` arrives as undefined
-- and every player is treated as brand new -- the welcome would show on
-- every single load, forever.
create or replace view public.my_profile
with (security_invoker = true) as
  select id, handle, display_name, initials, avatar_gradient, bio,
         tier, season_badge, drops, onboarded_at,
         total_reigns_won, peak_vibe, challenger_wins, challenger_attempts
    from public.profiles
   where id = auth.uid();

grant select on public.my_profile to authenticated;
```

Verify both the column and the view:

```sql
select count(*) as total,
       count(onboarded_at) as onboarded,
       count(*) - count(onboarded_at) as pending
from profiles;

-- The view must expose it, or the client never sees it.
select count(*) as view_exposes_onboarded_at
from information_schema.columns
where table_schema='public' and table_name='my_profile'
  and column_name='onboarded_at';
```

Expected: `pending` is `0`, and `view_exposes_onboarded_at` is `1`.

- [ ] **Step 2: Add the client pieces**

In `lib/supabase.ts`:

```ts
/** Records that this player has seen the welcome. */
export async function markOnboarded(): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return false;
  const { error } = await db
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', auth.user.id);
  return !error;
}
```

Add `onboarded_at: string | null;` to the `DbProfile` interface in the same
file. (The `my_profile` view is already recreated in Step 1 — it enumerates
columns, so that recreation is what makes the field reach the client.)

Create `lib/useOnboarding.ts`:

```ts
'use client';

/**
 * Whether this player still needs the welcome.
 *
 * A route guard, not a wizard: `needsWelcome` is false while auth is still
 * resolving, so a returning player never flashes the welcome screen on the
 * way to the app — the same class of bug as the sign-in flash.
 */

import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { markOnboarded } from './supabase';

export function useOnboarding() {
  const { isLoading, isSignedIn, profile } = useAuth();
  const [finished, setFinished] = useState(false);

  const finish = useCallback(async () => {
    setFinished(true);
    await markOnboarded();
  }, []);

  return {
    needsWelcome:
      !isLoading &&
      isSignedIn &&
      !finished &&
      (profile as { onboarded_at?: string | null }).onboarded_at == null,
    finish,
  };
}
```

- [ ] **Step 3: Build the welcome route**

`app/welcome/page.tsx` runs three stages in one screen, holding a skeleton
while `isLoading` so it never flashes:

1. **Greet** — the player's display name, one line explaining that every
   song is a card and the room's reaction decides how it goes, and a
   `TEAR IT OPEN` action.
2. **Open** — reveal the 21 cards the signup trigger already granted.
   Read them with `useOwnedCards` rather than granting anything: the grant
   is server-side and atomic, and re-granting here would double it. Reuse
   `SongCardView` and step through the cards the way `/packs` does.
3. **Done** — show the 500 Drops balance, call `finish()`, and link to
   `/deck` and `/packs`.

Signed out, redirect to `/signin`. Colours must come from tokens only.

- [ ] **Step 4: Send new players there**

In `app/signin/page.tsx`, the `submit` handler currently does
`router.push('/deck')` inside `if (res.ok)` after BOTH sign-in and sign-up
(around line 40). Send a player with no `onboarded_at` to `/welcome`
instead, and everyone else to `/deck`.

Two things to get right here:

- **Branch on the profile, not on which action was taken.** Sending every
  sign-*up* to `/welcome` looks equivalent but is not: a player who signs
  up, closes the app mid-welcome and returns would sign *in* and skip it
  forever. The flag is the source of truth.
- The profile may not have loaded at the instant `res.ok` resolves. If
  `onboarded_at` is not yet known, route to `/welcome` — the welcome screen
  itself re-checks and forwards an already-onboarded player to `/deck`, so
  the cost of guessing wrong is one redirect rather than a lost welcome.

- [ ] **Step 5: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && NODE_ENV=production CAPACITOR=1 npx next build`
Expected: 0 errors; all tests pass; the build lists `/welcome`.

- [ ] **Step 6: Verify the whole first run**

Extend `scripts/probe/shop.mjs` or add `scripts/probe/onboarding.mjs`:
register a fresh account and assert it lands on `/welcome`, that the reveal
shows 21 cards, that finishing sets `onboarded_at`, and that signing out
and back in goes straight to `/deck` with no welcome.

- [ ] **Step 7: Commit**

```bash
git add app/welcome/page.tsx lib/useOnboarding.ts lib/supabase.ts app/signin/page.tsx scripts/probe/onboarding.mjs
git commit -m "feat(onboarding): welcome a new player and let them open the starter pack

Signup dropped straight into the room, and the starter pack's 21 cards
appeared in the database without the player ever seeing them. Opening a
pack is the best moment in the app and a new player never got to do it.

The welcome reveals cards the signup trigger already granted rather than
granting them again -- the grant is server-side and atomic, and doing it
here would double it. onboarded_at is a nullable timestamp so NULL means
'not yet' rather than being indistinguishable from a default."
```

---

### Task 5: A collection you can use

**Files:**
- Create: `lib/domain/collection.ts`
- Test: `lib/domain/collection.test.ts`
- Modify: `app/profile/page.tsx`

**Interfaces:**
- Consumes: `SongCard`, `Rarity` from `types/cards.ts`.
- Produces: `type RarityFilter = 'all' | Rarity`; `type LanguageFilter = 'all' | string`; `filterCollection(cards: SongCard[], f: { rarity: RarityFilter; language: LanguageFilter }): SongCard[]`; `languagesIn(cards: SongCard[]): string[]`; `countsByRarity(cards: SongCard[]): Record<Rarity, number>`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { filterCollection, languagesIn, countsByRarity } from './collection';
import type { SongCard } from '@/types/cards';

const card = (id: string, rarity: SongCard['rarity'], language: string | null) =>
  ({ id, rarity, language, title: id, kind: 'song' } as unknown as SongCard);

const pool = [
  card('a', 'common', 'tamil'),
  card('b', 'legendary', 'hindi'),
  card('c', 'rare', 'tamil'),
  card('d', 'epic', 'english'),
  card('e', 'common', null),
];

describe('collection filtering', () => {
  it('returns everything when both filters are all', () => {
    expect(filterCollection(pool, { rarity: 'all', language: 'all' })).toHaveLength(5);
  });

  it('filters by rarity', () => {
    expect(filterCollection(pool, { rarity: 'common', language: 'all' }).map((c) => c.id))
      .toEqual(['a', 'e']);
  });

  it('filters by language', () => {
    expect(filterCollection(pool, { rarity: 'all', language: 'tamil' }).map((c) => c.id))
      .toEqual(['a', 'c']);
  });

  it('combines both filters', () => {
    expect(filterCollection(pool, { rarity: 'common', language: 'tamil' }).map((c) => c.id))
      .toEqual(['a']);
  });

  it('returns an empty list rather than everything when nothing matches', () => {
    expect(filterCollection(pool, { rarity: 'legendary', language: 'tamil' })).toEqual([]);
  });

  // Languages come from the cards, not a hardcoded list: the catalogue has
  // four today (english, hindi, tamil, telugu) and adding a fifth must not
  // require touching the UI.
  it('derives the language list from the cards themselves, sorted', () => {
    expect(languagesIn(pool)).toEqual(['english', 'hindi', 'tamil']);
  });

  it('omits cards with no language from the language list', () => {
    expect(languagesIn(pool)).not.toContain(null);
    expect(languagesIn(pool)).not.toContain('');
  });

  it('counts every rarity, including the ones with none', () => {
    expect(countsByRarity(pool)).toEqual({ common: 2, rare: 1, epic: 1, legendary: 1 });
    expect(countsByRarity([])).toEqual({ common: 0, rare: 0, epic: 0, legendary: 0 });
  });

  it('does not mutate the caller’s array', () => {
    const before = pool.map((c) => c.id).join(',');
    filterCollection(pool, { rarity: 'common', language: 'all' });
    languagesIn(pool);
    expect(pool.map((c) => c.id).join(',')).toBe(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/collection.test.ts`
Expected: FAIL — cannot resolve `./collection`.

- [ ] **Step 3: Write the module**

```ts
/**
 * Filtering a player's own collection.
 *
 * Pure, so the filter logic is testable without rendering the binder, and
 * so the same rules can be reused by any screen that shows cards.
 */

import type { Rarity, SongCard } from '@/types/cards';

export type RarityFilter = 'all' | Rarity;
export type LanguageFilter = 'all' | string;

export interface CollectionFilters {
  rarity: RarityFilter;
  language: LanguageFilter;
}

export function filterCollection(cards: SongCard[], f: CollectionFilters): SongCard[] {
  return cards.filter(
    (c) =>
      (f.rarity === 'all' || c.rarity === f.rarity) &&
      (f.language === 'all' || c.language === f.language),
  );
}

/**
 * The languages actually present, sorted. Derived from the cards rather
 * than hardcoded: the catalogue holds four today (english, hindi, tamil,
 * telugu) and adding a fifth must not require touching the UI.
 */
export function languagesIn(cards: SongCard[]): string[] {
  const set = new Set<string>();
  for (const c of cards) if (c.language) set.add(c.language);
  return [...set].sort();
}

const EMPTY: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };

/** Every rarity is present in the result, including those with a count of 0. */
export function countsByRarity(cards: SongCard[]): Record<Rarity, number> {
  const out = { ...EMPTY };
  for (const c of cards) out[c.rarity] += 1;
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/collection.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Make the binder playable and filterable**

In `app/profile/page.tsx`:

- Replace the local rarity-filter state with `filterCollection`, and add a
  second row of language chips built from `languagesIn(owned)`. Both rows
  include an `ALL` chip. Show `countsByRarity` on the rarity chips so a
  player can see what they hold.
- **Tapping a card plays its 30-second preview in place.** Reuse
  `usePreviewAudio` — the hook already handles the Apple preview URL,
  cleanup, and the case where a card has no preview. Only one card plays
  at a time: tapping another switches to it, tapping the playing one
  stops it. A card with no `previewUrl` is not tappable and says so.
- **Edit profile:** a display-name field that saves to `profiles`. Add
  `updateDisplayName(name: string): Promise<boolean>` to `lib/supabase.ts`
  following the shape of `markOnboarded`. Handle is not editable — it is
  generated at signup and other players may already know it.
- **Theme toggle:** add the light/dark control here using `useTheme` from
  Plan A. It is the settings surface, so this is where it belongs.

Colours from tokens only.

- [ ] **Step 6: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && NODE_ENV=production CAPACITOR=1 npx next build`
Expected: 0 errors; all tests pass; build succeeds.

- [ ] **Step 7: Verify on the screen**

Extend a probe to assert: the binder shows the owned count, filtering by a
rarity narrows it, filtering by a language narrows it further, tapping a
card issues a media request to Apple, and toggling the theme changes the
page background.

- [ ] **Step 8: Commit**

```bash
git add lib/domain/collection.ts lib/domain/collection.test.ts app/profile/page.tsx lib/supabase.ts
git commit -m "feat(you): play, filter and curate your own collection

The binder showed cards you could not hear, filter by language, or do
anything with. Tapping a card now plays its 30-second preview in place,
the language chips are derived from the cards themselves so a fifth
language needs no UI change, and the rarity chips carry counts.

The theme toggle lands here because this is the settings surface. The
handle stays read-only: it is generated at signup and other players may
already know it."
```

---

## Verification

After Task 5, all of the following must hold:

1. `npx vitest run` — every test passes, including the new `packs` and `collection` suites.
2. `npx vitest run app/no-raw-colours.test.ts` — still green; no screen built here introduced a colour literal.
3. A fresh signup lands on `/welcome`, reveals 21 cards, and finishes with 500 Drops.
4. Signing out and back in goes straight to `/deck` — the welcome never shows twice.
5. On 500 Drops the shop enables Starter and Night and disables Headliner with the shortfall named.
6. Opening a Starter leaves 350 Drops and adds exactly 3 cards.
7. Twenty consecutive Headliner pulls each contain at least one epic or legendary.
8. A player with 899 Drops cannot open a Headliner, and loses no Drops attempting it.
9. An unknown tier is refused before any Drops move.
10. In `/profile`, filtering by rarity and by language both narrow the binder, and tapping a card issues a media request to Apple.
11. `NODE_ENV=production CAPACITOR=1 npx next build` succeeds with `/welcome` in the route list.
