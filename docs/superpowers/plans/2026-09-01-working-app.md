# Working Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn the current build — which reads as "a plain site" — into an app that looks and behaves like a product on a phone: real navigation everywhere, a proper home screen, artwork and banners, working auth, and every screen migrated onto the design system.

**Architecture:** No new frameworks. Migrate the ten existing screens onto the nine `components/ui` primitives built in the previous plan, wrap the two unwrapped entry points in `PhoneShell`, add generated banner art, and gate the screens that need a signed-in user.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase (auth + data), Vitest + Testing Library, Playwright for real-browser verification.

**Spec:** `docs/superpowers/specs/2026-08-31-formats-and-rooms-design.md` (§7, §7.1 for the visual grammar)

## Global Constraints

- **Square corners.** `--radius-none: 0`, `--radius-sm: 2px`. Nothing above 2px anywhere.
- **Registration marks** (`+` crosshairs) on framed objects — the signature detail.
- **Barlow Condensed** headings via `--font-heading`; Anton is superseded.
- **Stage black `#05050a`** ground; the **four rarity accents are retained** (bronze/silver/gold/spectrum). Never collapse them to one accent.
- **Album art is rendered unmodified** — never recoloured, filtered or duotoned. Licensing, not style (`docs/LICENSING_RIGHTS.md`).
- **Audio: YouTube IFrame embed only.** No stored audio, no stream-ripping, no ad-stripping clients (DO NOT #1 and #2).
- **Drops are earn-only.** No purchase path anywhere in the UI.
- Use tokens, never literals: `--sp-1`..`--sp-8`, `--radius-*`, `--border-hair`, `--border-strong`, `--mark-size`.
- Existing checks must keep passing: `npx vitest run` (44+), `npx tsc --noEmit`, `npx tsx scripts/verify.ts` (29), `npx next build`.

---

### Task 1: Home screen

`/` currently renders a bare link list with no nav and no `PhoneShell`. It is the
first thing anyone sees and it is why the app reads as a plain site.

**Files:**
- Rewrite: `app/page.tsx`
- Test: `app/home.test.tsx`

**Interfaces:**
- Consumes: `PhoneShell` from `@/components/PhoneChrome`; `Panel`, `Badge`, `Button`, `Stat` from `@/components/ui`; `useCards`, `useLiveEvents`, `useAuth`
- Produces: the app's home route

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Home from './page';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('Home', () => {
  it('renders inside the phone shell with tab navigation', () => {
    render(<Home />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('shows the live night as the primary call to action', () => {
    render(<Home />);
    expect(screen.getByText(/TONIGHT/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run app/home.test.tsx`
Expected: FAIL — no `navigation` role, because `/` is not in `PhoneShell`.

- [ ] **Step 3: Rewrite the home screen**

Replace `app/page.tsx` entirely. It must:
- Wrap everything in `<PhoneShell>` so the tab bar renders.
- Open with a hero: the app name in `var(--font-heading)`, uppercase, with the
  existing `linear-gradient(92deg,#fff 10%,#4ce3ff 48%,#ff2e88 88%)` text fill.
- Show **TONIGHT** — the live event from `useLiveEvents()`, as a `Panel` with the
  event's `posterGradient` as a banner strip, its title, host initials, and a
  `Button variant="primary"` linking to `/deck` labelled `ENTER THE ROOM`.
  When no event is live, show the next scheduled one with its relative time.
- Show a **YOUR HAND** strip: the first four cards from `useCards()` rendered
  with `SongCardView size="sm"`, horizontally scrollable, linking to `/deck`.
- Show three `Stat`s from `useAuth().profile`: `drops`, `total_reigns_won`,
  `peak_vibe`.
- Drop the raw route list entirely — the tab bar is the navigation now. Keep a
  single small link to `/room` labelled `SHARED DISPLAY · 1280×720`, since that
  route is deliberately outside the tab bar.

Use only tokens for spacing, radius and borders.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run app/home.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/home.test.tsx
git commit -m "feat(app): real home screen inside PhoneShell"
```

---

### Task 2: Sign-in screen and auth gating

`/signin` has no navigation — a dead end. Auth also isn't enforced anywhere.

**Files:**
- Modify: `app/signin/page.tsx`
- Create: `components/AuthGate.tsx`
- Test: `components/AuthGate.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `@/lib/useAuth`; `Button`, `Field`, `Panel`, `EmptyState` from `@/components/ui`
- Produces: `<AuthGate>{children}</AuthGate>` — renders children when signed in, a prompt when not

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthGate } from './AuthGate';

const mockAuth = vi.hoisted(() => ({ state: 'anonymous', isSignedIn: false }));
vi.mock('@/lib/useAuth', () => ({ useAuth: () => mockAuth }));
vi.mock('next/navigation', () => ({ usePathname: () => '/deck' }));

describe('AuthGate', () => {
  it('hides protected content from anonymous visitors', () => {
    render(<AuthGate><p>secret</p></AuthGate>);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('offers a way to sign in', () => {
    render(<AuthGate><p>secret</p></AuthGate>);
    expect(screen.getByText(/SIGN IN/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run components/AuthGate.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Build AuthGate**

`components/AuthGate.tsx`: a client component reading `useAuth()`. While
`state === 'loading'`, render nothing (avoids a flash of the prompt). When
signed in, render `children`. Otherwise render an `EmptyState` with title
`SIGN IN TO CONTINUE`, a hint explaining that cards and Drops belong to an
account, and a `Button variant="primary"` linking to `/signin`.

- [ ] **Step 4: Rebuild the sign-in screen on the primitives**

Rewrite `app/signin/page.tsx` to use `Field`, `Button` and `Panel` from
`@/components/ui` instead of its hand-rolled equivalents. Keep the existing
sign-in/sign-up toggle, the demo-account hint, and the "skip for now" link —
signing in stays optional. Add a link back to `/` so the screen is not a dead
end.

- [ ] **Step 5: Gate the screens that need an account**

Wrap the page bodies of `app/profile/page.tsx` and `app/chart/page.tsx` in
`<AuthGate>`. Leave `/deck`, `/events`, `/social`, `/packs`, `/room` and `/`
open — browsing without an account is deliberate.

- [ ] **Step 6: Run tests, verify they pass**

Run: `npx vitest run components/AuthGate.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add components/AuthGate.tsx components/AuthGate.test.tsx app/signin/page.tsx app/profile/page.tsx app/chart/page.tsx
git commit -m "feat(auth): AuthGate, primitives on sign-in, gate profile and chart"
```

---

### Task 3: Banner and poster art

`public/` holds one SVG. Events render as flat gradients; there is no app
artwork anywhere.

**Files:**
- Create: `components/Banner.tsx`
- Create: `components/Banner.test.tsx`
- Create: `public/banner-*.svg` (five files)

**Interfaces:**
- Consumes: tokens
- Produces: `<Banner kind={EventKind} title={string} height?={number} />`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Banner } from './Banner';

describe('Banner', () => {
  it('renders the title', () => {
    render(<Banner kind="disco" title="Basement 4AM" />);
    expect(screen.getByText('Basement 4AM')).toBeInTheDocument();
  });

  it('is decorative-safe: the artwork layer is hidden from screen readers', () => {
    const { container } = render(<Banner kind="disco" title="X" />);
    expect(container.querySelector('[data-banner-art]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives each event kind a distinct treatment', () => {
    const { container: a } = render(<Banner kind="disco" title="X" />);
    const { container: b } = render(<Banner kind="tournament" title="X" />);
    expect(a.innerHTML).not.toBe(b.innerHTML);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run components/Banner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the Banner component**

`components/Banner.tsx` renders a framed banner: the event's gradient ground,
an inline SVG pattern layer marked `data-banner-art aria-hidden="true"`, the
title in `var(--font-heading)` uppercase, and the four registration marks.
Each of the five `EventKind` values gets a distinct generated pattern —
concentric arcs for `disco`, a waveform for `dj_night`, scattered dots for
`house_party`, horizontal rules for `listening`, a bracket for `tournament`.

Generate the patterns as inline SVG in the component. **Do not use album art
here** — event artwork is originated, cover art is licensed
(`docs/CARD_ART_GENERATION.md` §6).

- [ ] **Step 4: Use it on the events screen**

In `app/events/page.tsx`, replace the flat `posterGradient` div with
`<Banner kind={e.kind} title={e.title} />`.

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run components/Banner.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add components/Banner.tsx components/Banner.test.tsx app/events/page.tsx
git commit -m "feat(ui): generated banner art per event kind"
```

---

### Task 4: Migrate the phone screens onto the primitives

Nine of ten screens still carry inline styles and old radii. This is the task
that makes the app stop looking like two different products.

**Files:**
- Modify: `app/deck/page.tsx`, `app/events/page.tsx`, `app/social/page.tsx`,
  `app/packs/page.tsx`, `app/chart/page.tsx`, `app/profile/page.tsx`
- Modify: `components/PhoneChrome.tsx`

**Interfaces:**
- Consumes: all nine primitives from `@/components/ui`
- Produces: no new API — this is a refactor

- [ ] **Step 1: Migrate the tab bar**

In `components/PhoneChrome.tsx`, replace the hand-rolled tab buttons' inline
styles with tokens (`--sp-*`, `--radius-none`). Keep the six tabs, the active
underline, and the safe-area padding. The status bar's mute toggle stays.

- [ ] **Step 2: Migrate each screen, one at a time**

For each of the six screens: replace hand-rolled buttons with `Button`,
card-like surfaces with `Panel`, pills and tags with `Badge`, filter rows with
`Segmented`, stat blocks with `Stat`, empty results with `EmptyState`, and any
inline `padding`/`gap`/`borderRadius` literal with its token.

Preserve every existing behaviour exactly: the deck's tap-to-play and
hold-to-vibe, the pack's four-stage tap sequence, the chart's expanding rows,
the profile's rarity filter, the social follow toggle, the events RSVP cycle.
Preserve every `aria-label`, `aria-live`, `role` and `aria-pressed` already
present — the accessibility work is not to be lost in the refactor.

Commit after each screen so a regression is bisectable.

- [ ] **Step 3: Verify no behaviour was lost**

Run: `npx vitest run`
Expected: PASS, all existing tests still green.

Run: `npx tsc --noEmit` — expect silence.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(ui): migrate phone screens onto design system primitives"
```

---

### Task 5: Expand the card pool

Ten cards is thin for a binder and a marketplace. Grow it to ~30, keeping the
Tamil / Hindi / English spread.

**Files:**
- Modify: `seeds/cards.seed.json`
- Regenerate: `lib/generated-cards.ts`

**Interfaces:**
- Consumes: `scripts/seed-cards.ts` (already built)
- Produces: a larger `GENERATED_CARDS` array

- [ ] **Step 1: Find and verify new MBIDs**

For each candidate track, query MusicBrainz for a recording MBID with
`score >= 95` that has a `releases` array, then confirm Cover Art Archive
returns art for its release group. Rate-limit to **one request per second** —
MusicBrainz blocks IPs that exceed it, and a descriptive `User-Agent` with a
contact address is required.

Target roughly 20 additional tracks: a third Tamil, a third Hindi, a third
English, spread across the four `tierHint` values.

- [ ] **Step 2: Verify YouTube embeddability**

For each track, find a video id and confirm it via
`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json`.
A 200 means it exists and is publicly embeddable. **Do not guess ids** — an
unverified id renders a dead player. Discard any track whose id does not verify.

- [ ] **Step 3: Append to the seed list and re-run the pipeline**

```bash
npx tsx scripts/seed-cards.ts
```

Cards cache per-MBID, so existing entries are not refetched.

- [ ] **Step 4: Verify the pool**

Run: `npx tsx scripts/verify.ts`
Expected: `ALL 29 CHECKS PASSED`, with every tier represented and at least half
the pool carrying real artwork.

- [ ] **Step 5: Commit**

```bash
git add seeds/cards.seed.json lib/generated-cards.ts
git commit -m "feat(data): expand card pool across Tamil, Hindi and English"
```

---

### Task 6: Real-browser verification

Unit tests passed while the app read as a plain site. This task adds the check
that would have caught that.

**Files:**
- Create: `scripts/probe/app-probe.mjs`
- Modify: `package.json` (add `probe` script)

**Interfaces:**
- Consumes: Playwright (already installed)
- Produces: `npm run probe` — drives the real app at 390×844 and asserts behaviour

- [ ] **Step 1: Write the probe**

`scripts/probe/app-probe.mjs` launches Chromium at 390×844 and asserts:
- every route returns without a page error
- `/`, `/deck`, `/events`, `/social`, `/packs`, `/chart`, `/profile` each render
  a `<nav>`
- tapping a card on `/deck` fills the deck slot
- holding the vibe button changes `[role="meter"]`'s `aria-valuenow`
- `/packs` advances through its four stages on tap
- `/events` RSVP button changes label when tapped
- zero console errors across the whole run

Exit non-zero on any failure so it can gate a build.

- [ ] **Step 2: Add the script**

In `package.json` scripts: `"probe": "node scripts/probe/app-probe.mjs"`.

- [ ] **Step 3: Run it against the dev server**

Start `npm run dev`, then `npm run probe`.
Expected: every assertion passes, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/probe/app-probe.mjs package.json
git commit -m "test: real-browser probe for navigation and interaction"
```

---

## What this plan does NOT do

- **Echo Music / scraped audio.** Ad-free YouTube Music clients work by
  stripping ads and downloading streams, which makes the app the distributor of
  commercial masters. `docs/LICENSING_RIGHTS.md` DO NOT #1 and #2, unchanged.
  Playback stays the YouTube IFrame embed.
- **Formats, rooms, joining, shoutouts** — that is the separate formats plan,
  still blocked on the naming question.
- **The APK build** — needs JDK + Android SDK on the machine.
- **Real popularity data** — all three APIs are unreachable from this network,
  so tiers come from curated hints.

## Verification summary

| Check | Command | Expected |
|---|---|---|
| Unit tests | `npx vitest run` | all pass |
| Types | `npx tsc --noEmit` | no output |
| Invariants | `npx tsx scripts/verify.ts` | ALL 29 CHECKS PASSED |
| Build | `npx next build` | completes |
| **Real browser** | `npm run probe` | every assertion passes |
