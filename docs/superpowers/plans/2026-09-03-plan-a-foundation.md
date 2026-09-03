# Plan A — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the mock data, fix the sign-in flash, replace the six text tabs with five icon tabs, and make the whole app themeable by finishing the design-system migration.

**Architecture:** Colour lives in exactly three layers — tokens in `app/globals.css` (the only place a colour is defined), primitives in `components/ui/` (already token-clean), and screens that reference tokens and never literals. A test enforces the third rule so the 126 inline colours cannot creep back. Theme switching is a `data-theme` attribute binding a second palette to the same token names, so no consumer knows which theme is active.

**Tech Stack:** TypeScript, Next.js 15 static export, Vitest, Supabase Postgres, Capacitor.

**Spec:** `docs/superpowers/specs/2026-09-03-app-redesign-design.md`

**Runs before:** Plan B (economy & onboarding) and Plan C (room & feed). Both build screens on the token layer this plan establishes, so doing them first would mean writing colours twice.

## Global Constraints

- **Screens contain no raw colour values.** No hex, no `rgba()`, no named CSS colours under `app/`. A screen picks a token or a primitive.
- **Light and dark bind the same token names.** A consumer must never branch on the active theme.
- **The four rarity accents do not invert between themes.** Rarity is how a card is read at a glance; a legendary that changes colour stops being recognisable.
- **Exactly three control models** — `contested`, `delegated`, `spectator`. Never a fourth (CLAUDE.md §1).
- **Visibility and card rule stay independent axes.** Never merge `open|guest_list` with `casual|event` (§1.1).
- `lib/domain/` imports neither React nor Supabase.
- The card catalogue is real data from Apple's charts — **never delete cards, artists, or card_artists**.
- No new dependencies.

---

### Task 1: Wipe the mock data

**Files:**
- Apply migration via MCP `apply_migration`, name `wipe_mock_data`

**Interfaces:**
- Consumes: nothing.
- Produces: an empty `profiles`, `card_ownership`, `follows`, `rsvps`, `reigns`, `challengers`, `pinned_cards`, and `activity`; `cards`/`artists`/`card_artists` untouched.

- [ ] **Step 1: Record what exists, so the wipe can be verified**

Run this and note the numbers:

```sql
select 'profiles' t, count(*) from profiles
union all select 'card_ownership', count(*) from card_ownership
union all select 'follows', count(*) from follows
union all select 'rsvps', count(*) from rsvps
union all select 'reigns', count(*) from reigns
union all select 'challengers', count(*) from challengers
union all select 'pinned_cards', count(*) from pinned_cards
union all select 'activity', count(*) from activity
union all select 'events', count(*) from events
union all select 'rooms', count(*) from rooms
union all select 'cards (KEEP)', count(*) from cards
union all select 'auth.users', count(*) from auth.users;
```

- [ ] **Step 2: Apply the wipe**

```sql
-- Full reset of player and session data. The user confirmed every account
-- goes, including the one they registered on their phone.
--
-- cards / artists / card_artists are NOT touched: those are real rows built
-- from Apple's charts with real artwork, not mock data.
delete from pinned_cards;
delete from card_ownership;
delete from challengers;
delete from reigns;
delete from rsvps;
delete from follows;
delete from activity;
delete from events;
delete from rooms;
delete from profiles;

-- auth.users last: profiles has a foreign key onto it.
delete from auth.users;

-- Supply was decremented by every mock pull. Reset it to the printed total
-- so the economy starts from a true zero rather than a partly-drained pool.
update cards set supply_remaining = supply_total;
```

- [ ] **Step 3: Verify the wipe and that the catalogue survived**

```sql
select 'profiles' t, count(*) from profiles
union all select 'card_ownership', count(*) from card_ownership
union all select 'auth.users', count(*) from auth.users
union all select 'cards (must be > 0)', count(*) from cards
union all select 'supply fully restored',
  (select count(*) from cards where supply_remaining <> supply_total);
```

Expected: every player table `0`, `cards` unchanged and greater than zero, and `supply fully restored` reporting `0` rows out of step.

- [ ] **Step 4: Confirm a fresh signup still works end to end**

The signup trigger grants a profile and the 21-card starter pack. Verify it survived the wipe by registering through the REST API and checking the result:

```bash
node -e "
const fs=require('fs');
const env=fs.readFileSync('.env.local','utf8');
const url=(env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)||[])[1].trim();
const key=(env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)||[])[1].trim();
(async()=>{
  const su=await (await fetch(url+'/auth/v1/signup',{method:'POST',
    headers:{apikey:key,'Content-Type':'application/json'},
    body:JSON.stringify({email:'wipecheck.'+Date.now()+'@gmail.com',
      password:'AuxWars!2026',data:{display_name:'Wipe Check'}})})).json();
  const H={apikey:key,Authorization:'Bearer '+su.access_token};
  const me=await (await fetch(url+'/rest/v1/my_profile?select=drops',{headers:H})).json();
  const own=await (await fetch(url+'/rest/v1/card_ownership?select=id',{headers:H})).json();
  console.log('drops:', me[0]?.drops, '(expect 500)');
  console.log('cards:', own.length, '(expect 21)');
})();
"
```

Expected: `drops: 500`, `cards: 21`.

- [ ] **Step 5: Commit**

No code changed, so record the migration in the docs instead:

```bash
git commit --allow-empty -m "chore(db): wipe all mock and test player data

Every profile, ownership row, follow, RSVP, reign and seeded event is
gone, including the account registered on the test phone. Card supply is
reset to the printed totals so the economy starts from a true zero rather
than a pool partly drained by mock pulls.

The card catalogue survives: those are real rows built from Apple's
charts with real artwork, not mocks."
```

---

### Task 2: Fix the sign-in flash

**Files:**
- Modify: `lib/useAuth.ts`
- Test: `lib/useAuth.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `useAuth()` additionally returns `isLoading: boolean` and `isAnonymous: boolean`; `state` and `isSignedIn` keep their current meaning.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from './useAuth';

describe('useAuth loading state', () => {
  /*
    The bug this pins: every screen read `isSignedIn`, which is
    `state === 'signed-in'` and therefore FALSE while the session is still
    resolving. So each screen rendered its signed-out view for a beat, and
    the app flashed "sign in" on every load.

    A screen needs to distinguish "not signed in" from "not known yet".
  */
  it('reports loading separately from anonymous', () => {
    const { result } = renderHook(() => useAuth());
    // Before the session resolves, the hook must NOT claim the user is
    // anonymous — only that the answer is not known.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAnonymous).toBe(false);
    expect(result.current.isSignedIn).toBe(false);
  });

  it('never reports loading and anonymous at the same time', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading && result.current.isAnonymous).toBe(false);
  });

  it('never reports loading and signed-in at the same time', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading && result.current.isSignedIn).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/useAuth.test.ts`
Expected: FAIL — `isLoading` is `undefined`, not `true`.

- [ ] **Step 3: Add the two derived flags**

In `lib/useAuth.ts`, extend the returned object:

```ts
  return {
    state,
    profile,
    error,
    isSignedIn: state === 'signed-in',
    /*
      Distinguish "not known yet" from "known to be signed out". Screens
      that branch on isSignedIn alone render their signed-out view during
      the initial session check, which is the sign-in flash on every load.
    */
    isLoading: state === 'loading',
    isAnonymous: state === 'anonymous',
    signIn,
    signUp,
    signOut,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/useAuth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Hold a skeleton on the screens that flash**

Four screens branch on auth and therefore flash: `app/page.tsx`,
`app/deck/page.tsx`, `app/profile/page.tsx`, `app/signin/page.tsx`.

In each, take `isLoading` from `useAuth()` and return the existing
`PhoneShell` wrapper containing a centred placeholder while it is true,
before any branch that depends on `isSignedIn`:

```tsx
  if (isLoading) {
    return (
      <PhoneShell>
        <div
          style={{
            padding: 'var(--sp-7)',
            textAlign: 'center',
            font: '400 9px/1 var(--font-tele)',
            letterSpacing: '.16em',
            color: 'var(--ink-25)',
          }}
        >
          LOADING…
        </div>
      </PhoneShell>
    );
  }
```

`app/signin/page.tsx` renders its own `Shell`, not `PhoneShell` — use whatever wrapper that file already uses.

- [ ] **Step 6: Verify the flash is gone on the device**

With the app installed and running, drive its WebView and assert that no screen shows signed-out text while loading:

```bash
node scripts/probe/device-dom.mjs
```

Expected: no screen reports `SIGN IN TO` or `GUEST` for a signed-in session.

- [ ] **Step 7: Commit**

```bash
git add lib/useAuth.ts lib/useAuth.test.ts app/page.tsx app/deck/page.tsx app/profile/page.tsx app/signin/page.tsx
git commit -m "fix(auth): stop every screen flashing signed-out on load

Screens branched on isSignedIn, which is state === 'signed-in' and so
false while the session is still resolving. Each screen therefore rendered
its signed-out view for a beat before the answer arrived.

The hook now distinguishes 'not known yet' from 'known to be signed out',
and the four screens that branch on auth hold a skeleton until it is."
```

---

### Task 3: Light and dark token layer

**Files:**
- Modify: `app/globals.css`
- Create: `lib/useTheme.ts`
- Test: `lib/useTheme.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `useTheme(): { theme: 'light' | 'dark'; setTheme(t: 'light' | 'dark'): void; toggle(): void }`; `:root[data-theme='light']` overriding the ground/ink/hairline tokens.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to dark — the app is dark-first', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('writes the choice onto the document so CSS can bind it', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles between exactly two themes', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('light');
    act(() => result.current.toggle());
    expect(result.current.theme).toBe('dark');
  });

  it('persists the choice across a remount', () => {
    const first = renderHook(() => useTheme());
    act(() => first.result.current.setTheme('light'));
    first.unmount();
    const second = renderHook(() => useTheme());
    expect(second.result.current.theme).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/useTheme.test.ts`
Expected: FAIL — cannot resolve `./useTheme`.

- [ ] **Step 3: Add the light palette**

Append to `app/globals.css`, after the existing `:root` block:

```css
/*
  Light theme.

  Binds the SAME token names as the dark palette above, so no component
  ever branches on which theme is active — a screen asks for --ink and gets
  whatever ink means right now.

  The four rarity accents are deliberately absent: --neon-pink, --neon-cyan,
  --neon-gold, --neon-violet and --neon-mint keep their dark-theme values in
  both themes. Rarity is how a card is read at a glance, and a legendary
  that changes colour with the theme stops being recognisable. Only the
  ground, the ink on it, and the lines between them invert.
*/
:root[data-theme='light'] {
  --stage-black: #f4f4f7;
  --booth-panel: #ffffff;

  --ink: #0a0812;
  --ink-60: rgba(10, 8, 18, 0.62);
  --ink-40: rgba(10, 8, 18, 0.44);
  --ink-25: rgba(10, 8, 18, 0.3);

  --hairline: rgba(10, 8, 18, 0.12);
  --border-strong: rgba(10, 8, 18, 0.24);
}
```

- [ ] **Step 4: Write the hook**

```ts
'use client';

/**
 * Light / dark theme.
 *
 * The choice is written to `data-theme` on the document element, and the
 * palettes in globals.css bind the same token names under each. That is
 * what lets every component stay theme-agnostic: it asks for --ink, not
 * for a colour.
 */

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'auxwars:theme';

export function useTheme() {
  // Dark-first: the app's identity is a dark stage, and a light default
  // would flash white before the stored choice loads.
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    let stored: string | null = null;
    // Private browsing and some WebViews throw on localStorage access
    // rather than returning null, so the read must not be able to break
    // the app's first render.
    try { stored = localStorage.getItem(KEY); } catch { stored = null; }
    if (stored === 'light' || stored === 'dark') {
      setThemeState(stored);
      document.documentElement.setAttribute('data-theme', stored);
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch { /* not fatal */ }
  }, []);

  const toggle = useCallback(() => {
    setThemeState((cur) => {
      const next: Theme = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch { /* not fatal */ }
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/useTheme.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css lib/useTheme.ts lib/useTheme.test.ts
git commit -m "feat(theme): add a light palette bound to the same tokens

Light and dark bind identical token names, so no component branches on
which theme is active -- a screen asks for --ink and gets whatever ink
means right now.

The four rarity accents keep their values in both themes. Rarity is how a
card is read at a glance, and a legendary that changed colour with the
theme would stop being recognisable."
```

---

### Task 4: Enforce no raw colours in screens

**Files:**
- Create: `app/no-raw-colours.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a failing test listing every file under `app/` that contains a colour literal. Task 5 makes it pass.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
  Screens must reference tokens, never literals.

  126 raw colours accumulated across the screens because nothing checked.
  The ui/ primitives stayed clean, so this is what keeps the screen layer
  clean too — without it the count climbs back the first time someone is
  in a hurry.
*/
const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

describe('screens use tokens, not colour literals', () => {
  it('has no hex or rgba() anywhere under app/', () => {
    const offenders = walk('app')
      .map((f) => {
        const lines = readFileSync(f, 'utf8').split('\n');
        const hits = lines
          .map((l, i) => (COLOUR.test(l) ? `${f}:${i + 1}` : null))
          .filter(Boolean);
        return hits as string[];
      })
      .flat();

    // The message matters more than the assertion: it tells the next
    // person exactly which lines to fix.
    expect(offenders, `Raw colours found:\n  ${offenders.join('\n  ')}`)
      .toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and record the baseline**

Run: `npx vitest run app/no-raw-colours.test.ts`
Expected: FAIL, listing 75 line references across the screen files (the 126 literals fall on 75 lines, since several lines carry more than one). Save that list — it is Task 5's worklist.

- [ ] **Step 3: Commit the failing test**

Committing a known-failing test is deliberate here: it is the definition of done for Task 5, and it belongs in history before the work rather than after.

```bash
git add app/no-raw-colours.test.ts
git commit -m "test(theme): fail while screens still contain colour literals

126 raw colours accumulated because nothing checked. This is the gate that
keeps the screen layer clean once Task 5 clears them; it fails until then,
and the failure message lists every line to fix."
```

---

### Task 5: Migrate the screens onto tokens

**Files:**
- Modify: `app/events/page.tsx`, `components/SongCardView.tsx`, `app/room/page.tsx`, `app/social/page.tsx`, `app/signin/page.tsx`, `app/packs/page.tsx`, `app/deck/page.tsx`, `components/NowPlaying.tsx`, `app/page.tsx`, `app/profile/page.tsx`, `app/chart/page.tsx`
- Modify: `app/globals.css` (only if a genuinely new token is needed)

**Interfaces:**
- Consumes: the light palette and token names from Task 3.
- Produces: `app/no-raw-colours.test.ts` passing.

- [ ] **Step 1: Replace literals with tokens, heaviest file first**

Work in this order, which is descending by count: `events` (14), `SongCardView` (12), `room` (11), `social` (10), `signin` (8), `packs` (8), `deck` (6), `NowPlaying` (6), `page` (5), `profile` (3), `chart` (2).

The mapping for the values that appear repeatedly:

| Literal | Token |
|---|---|
| `#05050a`, `#0a0812` | `var(--stage-black)` |
| panel backgrounds like `#12101a` | `var(--booth-panel)` |
| `#fff`, `#ffffff` as text | `var(--ink)` |
| `rgba(255,255,255,.6)` | `var(--ink-60)` |
| `rgba(255,255,255,.4)` | `var(--ink-40)` |
| `rgba(255,255,255,.25)` and dimmer | `var(--ink-25)` |
| `rgba(255,255,255,.05)`–`.14` as a border | `var(--hairline)` |
| `rgba(255,255,255,.16)`–`.24` as a border | `var(--border-strong)` |
| `#ff2e88` | `var(--neon-pink)` |
| `#4ce3ff` | `var(--neon-cyan)` |
| `#ffd84d` | `var(--neon-gold)` |
| `#7dffc3` | `var(--neon-mint)` |

Two rules for the cases the table does not cover:

- **A colour used as a surface, text or line gets a token.** If none of the existing tokens fits, add one to `:root` AND to `:root[data-theme='light']` — never to only one.
- **A colour that is part of an illustration stays where it is, but moves out of `app/`.** The pack's gradient wrapper and the Peak Moment shard burst are artwork, not theming. Move those into a component under `components/` so the screen layer stays literal-free and the artwork keeps its exact colours.

- [ ] **Step 2: Run the gate**

Run: `npx vitest run app/no-raw-colours.test.ts`
Expected: PASS.

- [ ] **Step 3: Run the whole suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors; every test passes, including the 101 that existed before this plan.

- [ ] **Step 4: Check both themes render**

```bash
node scripts/probe/theme.mjs
```

Write that probe modelled on the existing files in `scripts/probe/`: load each of `/`, `/deck`, `/packs`, `/chart`, `/profile`, `/events`, `/social` in a browser, and for each theme set `document.documentElement.setAttribute('data-theme', t)` then read the computed `backgroundColor` and `color` of `body`. Assert that the two themes differ on both, and that in light mode no full-page element still computes to a near-black background.

- [ ] **Step 5: Commit**

```bash
git add app/ components/
git commit -m "refactor(theme): move screens onto tokens

126 colour literals across the screens meant a theme toggle would have
flipped a third of the app and left the rest dark. The ui/ primitives were
already token-clean, so this finishes the migration they were built for
rather than starting a new one.

Artwork that is genuinely illustrative -- the pack wrapper gradient, the
Peak Moment shard burst -- moves into components/ with its exact colours
intact, so the screen layer can stay literal-free without flattening the
things that are meant to be colourful."
```

---

### Task 6: Icon navbar

**Files:**
- Modify: `components/PhoneChrome.tsx`
- Create: `components/ui/TabIcon.tsx`
- Test: `components/ui/TabIcon.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 3.
- Produces: `<TabIcon name={'room' | 'feed' | 'shop' | 'chart' | 'you'} active={boolean} />`; `TABS` reduced to five entries.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TabIcon } from './TabIcon';

describe('TabIcon', () => {
  it('renders an svg for every tab name', () => {
    for (const n of ['room', 'feed', 'shop', 'chart', 'you'] as const) {
      const { container, unmount } = render(<TabIcon name={n} active={false} />);
      expect(container.querySelector('svg'), `no svg for ${n}`).toBeTruthy();
      unmount();
    }
  });

  it('marks the icon decorative — the label carries the name', () => {
    const { container } = render(<TabIcon name="room" active={false} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses currentColor so the tab controls its own colour', () => {
    const { container } = render(<TabIcon name="room" active />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('stroke') ?? svg.getAttribute('fill')).toBe('currentColor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/ui/TabIcon.test.tsx`
Expected: FAIL — cannot resolve `./TabIcon`.

- [ ] **Step 3: Write the component**

```tsx
'use client';

/**
 * Tab bar icons.
 *
 * Inline SVG rather than an icon package: five glyphs do not justify a
 * dependency, and `currentColor` lets the tab own its colour so the icon
 * follows the active state and the theme without either being passed in.
 */

export type TabIconName = 'room' | 'feed' | 'shop' | 'chart' | 'you';

const PATHS: Record<TabIconName, string> = {
  // Play triangle — the room is where a card gets played.
  room: 'M5 3l14 9-14 9V3z',
  // Grid — the feed is a wall of event tiles.
  feed: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
  // Pack — a sealed wrapper.
  shop: 'M3 7l9-4 9 4v10l-9 4-9-4V7zm9-4v18',
  // Ascending bars — scarcity ranking.
  chart: 'M4 20V10m6 10V4m6 16v-7m6 7V7',
  // Person.
  you: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0',
};

export function TabIcon({ name, active }: { name: TabIconName; active: boolean }) {
  return (
    <svg
      // Decorative: the visible text label beside it is the accessible name,
      // so announcing the icon too would read the tab twice.
      aria-hidden="true"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/ui/TabIcon.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Rebuild the tab bar with five tabs**

In `components/PhoneChrome.tsx`, replace the six-entry `TABS` with five, keeping the existing route paths — `/room` is already the 1280×720 shared display and must not be reused:

```tsx
const TABS = [
  { href: '/deck',    label: 'ROOM',  icon: 'room'  as const },
  { href: '/feed',    label: 'FEED',  icon: 'feed'  as const },
  { href: '/packs',   label: 'SHOP',  icon: 'shop'  as const },
  { href: '/chart',   label: 'CHART', icon: 'chart' as const },
  { href: '/profile', label: 'YOU',   icon: 'you'   as const },
];
```

Render `<TabIcon name={t.icon} active={isActive} />` above each label. Keep the label: an icon-only bar is unreadable to anyone who does not already know the app. Five tabs give each one more width, which is the point of dropping from six.

`/feed` does not exist until Plan C. Until then that tab points at a route that 404s in development — acceptable within this plan because the static export only includes routes that exist, and Plan C adds it. Note it in the commit so it is not mistaken for a bug.

- [ ] **Step 6: Verify tap targets on a phone-sized viewport**

Every tab must be at least 44px tall — below that they are hard to hit on a real device:

```bash
node scripts/probe/tabs.mjs
```

Write that probe modelled on `scripts/probe/flow.mjs`: load `/deck` at 390×844, measure each tab's bounding box, and assert every one is ≥44px tall and that the five are within a few pixels of the same width.

- [ ] **Step 7: Commit**

```bash
git add components/PhoneChrome.tsx components/ui/TabIcon.tsx components/ui/TabIcon.test.tsx
git commit -m "feat(nav): five icon tabs instead of six text ones

Six labels at 9px is why the bar read as cramped; five tabs give each one
noticeably more width. Labels stay -- an icon-only bar is unreadable to
anyone who does not already know the app.

Routes keep their current paths. /room is already the 1280x720 shared
display, so the ROOM tab points at /deck. The FEED tab points at /feed,
which Plan C adds; until then that route does not exist."
```

---

## Verification

After Task 6, all of the following must hold:

1. `npx vitest run` — every test passes, including `app/no-raw-colours.test.ts`.
2. `grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" app/ --include=*.tsx` returns nothing outside test files.
3. A fresh signup lands with 500 Drops and 21 cards, proving the wipe did not break the signup trigger.
4. `select count(*) from profiles` returns only accounts created after the wipe.
5. No screen renders signed-out text while the session is still resolving.
6. Both themes render: light and dark produce different `body` background and text colours on every route.
7. The tab bar has five tabs, each at least 44px tall.
8. `NODE_ENV=production CAPACITOR=1 npx next build` succeeds with every route still listed.
