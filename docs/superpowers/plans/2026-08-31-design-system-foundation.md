# Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 311 inline `style={{}}` blocks with eight reusable UI primitives built on spacing/radius tokens, in the Industry blueprint grammar on the AuxWars dark ground.

**Architecture:** Add spacing/radius/border tokens to the existing `:root` block in `app/globals.css` (colour and type tokens already live there). Build eight primitives under `components/ui/`, each a thin styled wrapper over a native element — no new runtime dependency. Screens are migrated to them in a later plan; this plan delivers the primitives plus a visual proof page.

**Tech Stack:** Next.js 15, React 19, TypeScript, plain CSS custom properties. Vitest + @testing-library/react for tests (installed in Task 1 — no runner exists today).

**Spec:** `docs/superpowers/specs/2026-08-31-formats-and-rooms-design.md` (§7 and §7.1)

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include these.

- **Square corners.** `--radius-sm: 2px`, `--radius-none: 0`. No primitive may use a radius above 2px. (Spec §7.1)
- **Registration marks.** Framed objects carry four `+` crosshairs at the corners — Industry's signature. (Spec §7.1)
- **Hairline borders are the primary surface treatment.** Objects are drawn, not filled. (Spec §7.1)
- **Barlow Condensed for headings**, replacing Anton. `--font-heading` is added; `--font-title` stays defined so unmigrated screens keep working. (Spec §7.1)
- **Stage black `#05050a` ground and the four rarity accents are RETAINED.** Industry's single-accent rule is explicitly rejected — it would flatten the rarity ladder. (Spec §7.1)
- **Album art is rendered unmodified.** Industry's `.duotone` rule is explicitly NOT adopted; `docs/LICENSING_RIGHTS.md` forbids altering artist cover art. (Spec §7.1)
- **No Tailwind, no component library.** `CLAUDE.md` §7 fixes the stack. (Spec §7)
- **Rarity is never conveyed by colour alone** — every rarity surface carries its text tag. (`docs/CARD_ART_GENERATION.md` §3)
- **`prefers-reduced-motion` is already handled globally** in `app/globals.css`. Do not add a second implementation.
- Existing checks must keep passing: `npx tsc --noEmit` and `npx tsx scripts/verify.ts` (29 checks).

---

### Task 1: Test infrastructure

No test runner exists in this repo. Every later task is TDD, so this must land first.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `components/ui/__tests__/smoke.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` (single run) and `npm run test:watch`. All later tasks run `npx vitest run <path>`.

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest@^2.1.8 @vitejs/plugin-react@^4.3.4 jsdom@^25.0.1 \
  @testing-library/react@^16.1.0 @testing-library/jest-dom@^6.6.3 --no-audit --no-fund
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // scripts/ holds one-shot pipelines, not tests.
    include: ['{app,components,lib}/**/*.test.{ts,tsx}'],
  },
  resolve: {
    // Mirrors the "@/*" path alias in tsconfig.json.
    alias: { '@': resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add scripts to `package.json`**

In the `"scripts"` block, add these two entries:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 5: Write the smoke test**

Create `components/ui/__tests__/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('test infrastructure', () => {
  it('renders a React element and finds it by role', () => {
    render(<button type="button">Play</button>);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run it**

Run: `npx vitest run components/ui/__tests__/smoke.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 7: Confirm nothing else broke**

Run: `npx tsc --noEmit && npx tsx scripts/verify.ts`
Expected: no TypeScript output; `ALL 29 CHECKS PASSED`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts components/ui/__tests__/smoke.test.tsx
git commit -m "test: add vitest + testing-library infrastructure"
```

---

### Task 2: Spacing, radius and border tokens

**Files:**
- Modify: `app/globals.css` (the `:root` block, currently ending at the `--safe-bottom` line)
- Create: `components/ui/__tests__/tokens.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: CSS custom properties every later task uses —
  `--sp-1`…`--sp-8`, `--radius-none`, `--radius-sm`, `--border-hair`,
  `--font-heading`, `--mark-size`.

- [ ] **Step 1: Write the failing test**

Create `components/ui/__tests__/tokens.test.tsx`:

```tsx
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let css = '';
beforeAll(() => {
  css = readFileSync(resolve(__dirname, '../../../app/globals.css'), 'utf8');
});

describe('design tokens', () => {
  it('defines an 8-step spacing scale', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(css).toContain(`--sp-${n}:`);
    }
  });

  it('defines square-corner radii only (Industry grammar, spec 7.1)', () => {
    expect(css).toContain('--radius-none: 0');
    expect(css).toContain('--radius-sm: 2px');
  });

  it('defines the hairline border and registration mark size', () => {
    expect(css).toContain('--border-hair:');
    expect(css).toContain('--mark-size:');
  });

  it('adds Barlow Condensed as the heading face', () => {
    expect(css).toMatch(/--font-heading:\s*'?Barlow Condensed'?/);
  });

  it('retains the stage black ground and all four rarity accents', () => {
    // Industry's single-accent rule is deliberately rejected here.
    expect(css).toContain('--stage-black: #05050a');
    for (const c of ['--neon-pink', '--neon-cyan', '--neon-gold', '--neon-violet']) {
      expect(css).toContain(c);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/ui/__tests__/tokens.test.tsx`
Expected: FAIL — the spacing, radius, border and heading assertions fail; the retention test passes (those tokens already exist).

- [ ] **Step 3: Add the tokens**

In `app/globals.css`, inside the existing `:root { … }` block, immediately after the `--font-body:` line, insert:

```css
  /* Barlow Condensed becomes the heading face (spec §7.1, Industry grammar).
     --font-title stays defined below so unmigrated screens keep rendering. */
  --font-heading: 'Barlow Condensed', 'Arial Narrow', sans-serif;

  /* Spacing scale. 4px base — every padding and gap comes from here, so the
     eight different button paddings that exist today collapse to one set. */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 20px;
  --sp-6: 24px;
  --sp-7: 32px;
  --sp-8: 44px;

  /* Square corners. Industry is a blueprint: objects are drawn, not softened.
     Nothing in this system may exceed --radius-sm. */
  --radius-none: 0;
  --radius-sm: 2px;

  /* Hairline is the primary surface treatment — objects are outlined,
     not filled. */
  --border-hair: 1px solid var(--hairline);
  --border-strong: 1px solid rgba(255, 255, 255, 0.18);

  /* Registration marks: the "+" crosshair at each corner of a framed object.
     Industry's signature detail. */
  --mark-size: 7px;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/ui/__tests__/tokens.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Confirm the app still builds**

Run: `npx tsc --noEmit && npx next build`
Expected: no TypeScript output; build completes.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css components/ui/__tests__/tokens.test.tsx
git commit -m "feat(ui): add spacing, radius, border and heading tokens"
```

---

### Task 3: Frame — the registration-mark wrapper

The primitive every other framed component composes. Build it first.

**Files:**
- Create: `components/ui/Frame.tsx`
- Create: `components/ui/Frame.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 2
- Produces:
  ```ts
  function Frame(props: {
    children: React.ReactNode;
    marks?: boolean;        // default true
    accent?: string;        // CSS colour for the marks; default var(--ink-25)
    filled?: boolean;       // default false — hairline drawing, not a fill
    className?: string;
    style?: React.CSSProperties;
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `components/ui/Frame.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Frame } from './Frame';

describe('Frame', () => {
  it('renders its children', () => {
    render(<Frame><span>Naatu Naatu</span></Frame>);
    expect(screen.getByText('Naatu Naatu')).toBeInTheDocument();
  });

  it('draws four registration marks by default', () => {
    const { container } = render(<Frame>x</Frame>);
    expect(container.querySelectorAll('[data-mark]')).toHaveLength(4);
  });

  it('omits the marks when marks={false}', () => {
    const { container } = render(<Frame marks={false}>x</Frame>);
    expect(container.querySelectorAll('[data-mark]')).toHaveLength(0);
  });

  it('marks are decorative, so they are hidden from assistive tech', () => {
    const { container } = render(<Frame>x</Frame>);
    for (const m of container.querySelectorAll('[data-mark]')) {
      expect(m).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('is transparent by default and filled only on request', () => {
    const { container, rerender } = render(<Frame>x</Frame>);
    const el = () => container.firstElementChild as HTMLElement;
    expect(el().style.background).toBe('transparent');
    rerender(<Frame filled>x</Frame>);
    expect(el().style.background).not.toBe('transparent');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/ui/Frame.test.tsx`
Expected: FAIL — cannot resolve `./Frame`.

- [ ] **Step 3: Implement Frame**

Create `components/ui/Frame.tsx`:

```tsx
'use client';

/**
 * The wireframe frame every card, panel and figure wears.
 *
 * Square corners and four "+" registration marks are the Industry grammar's
 * signature (spec §7.1). Objects are drawn rather than filled: `filled` is
 * opt-in, for the few surfaces that need to sit above the ground.
 */

import type { CSSProperties, ReactNode } from 'react';

const CORNERS = [
  { key: 'tl', style: { top: -1, left: -1 } },
  { key: 'tr', style: { top: -1, right: -1 } },
  { key: 'bl', style: { bottom: -1, left: -1 } },
  { key: 'br', style: { bottom: -1, right: -1 } },
] as const;

export interface FrameProps {
  children: ReactNode;
  marks?: boolean;
  accent?: string;
  filled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Frame({
  children,
  marks = true,
  accent = 'var(--ink-25)',
  filled = false,
  className,
  style,
}: FrameProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-none)',
        border: 'var(--border-hair)',
        background: filled ? 'var(--booth-panel)' : 'transparent',
        ...style,
      }}
    >
      {children}
      {marks &&
        CORNERS.map((c) => (
          <i
            key={c.key}
            data-mark={c.key}
            aria-hidden="true"
            style={{
              position: 'absolute',
              width: 'var(--mark-size)',
              height: 'var(--mark-size)',
              pointerEvents: 'none',
              // The "+" is drawn with two gradients rather than glyphs, so it
              // stays crisp at any size and needs no font.
              backgroundImage: `
                linear-gradient(${accent}, ${accent}),
                linear-gradient(${accent}, ${accent})`,
              backgroundSize: '100% 1px, 1px 100%',
              backgroundPosition: 'center center, center center',
              backgroundRepeat: 'no-repeat',
              ...c.style,
            }}
          />
        ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/ui/Frame.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Frame.tsx components/ui/Frame.test.tsx
git commit -m "feat(ui): add Frame with registration marks"
```

---

### Task 4: Button

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Button.test.tsx`

**Interfaces:**
- Consumes: tokens from Task 2
- Produces:
  ```ts
  type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
  type ButtonSize = 'sm' | 'md' | 'lg';
  function Button(props: {
    variant?: ButtonVariant;   // default 'secondary'
    size?: ButtonSize;         // default 'md'
    block?: boolean;
    accent?: string;           // overrides the primary fill; used by rarity surfaces
  } & React.ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `components/ui/Button.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label as an accessible button', () => {
    render(<Button>Place offer</Button>);
    expect(screen.getByRole('button', { name: 'Place offer' })).toBeInTheDocument();
  });

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Join</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Join</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('uses square corners (Industry grammar, spec 7.1)', () => {
    render(<Button>Join</Button>);
    const el = screen.getByRole('button');
    expect(el.style.borderRadius).toBe('var(--radius-sm)');
  });

  it('defaults to type="button" so it cannot submit a form by accident', () => {
    render(<Button>Join</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('honours an explicit type', () => {
    render(<Button type="submit">Sign in</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('takes an accent override for rarity-coloured actions', () => {
    render(<Button variant="primary" accent="#ffd84d">Pull</Button>);
    expect(screen.getByRole('button').style.background).toBe('rgb(255, 216, 77)');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/ui/Button.test.tsx`
Expected: FAIL — cannot resolve `./Button`.

- [ ] **Step 3: Implement Button**

Create `components/ui/Button.tsx`:

```tsx
'use client';

/**
 * The one button. Replaces eight different padding/radius combinations that
 * had drifted across the screens (measured 2026-08-31).
 *
 * `accent` exists so a rarity-coloured action (a gold Epic pull, a pink
 * Legendary) reuses this component instead of forking a ninth dialect.
 */

import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const PAD: Record<ButtonSize, string> = {
  sm: 'var(--sp-2) var(--sp-3)',
  md: 'var(--sp-3) var(--sp-4)',
  lg: 'var(--sp-4) var(--sp-5)',
};

const FONT: Record<ButtonSize, string> = {
  sm: "700 8px/1 var(--font-tele)",
  md: "700 10px/1 var(--font-tele)",
  lg: "700 11px/1 var(--font-tele)",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  accent?: string;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  accent,
  style,
  type,
  children,
  ...rest
}: ButtonProps) {
  const fill = accent ?? 'var(--neon-pink)';

  const variantStyle =
    variant === 'primary'
      ? { background: fill, color: '#0a0008', border: '1px solid transparent' }
      : variant === 'danger'
        ? { background: 'transparent', color: 'var(--neon-gold)', border: 'var(--border-strong)' }
        : variant === 'ghost'
          ? { background: 'transparent', color: 'var(--ink-60)', border: '1px solid transparent' }
          : { background: 'transparent', color: 'var(--ink-60)', border: 'var(--border-strong)' };

  return (
    <button
      // Defaults to "button": a bare <button> inside a form submits it, which
      // has caused accidental submits elsewhere in this codebase.
      type={type ?? 'button'}
      style={{
        padding: PAD[size],
        font: FONT[size],
        letterSpacing: '.16em',
        borderRadius: 'var(--radius-sm)',
        width: block ? '100%' : undefined,
        cursor: 'pointer',
        transition: 'background .18s ease, border-color .18s ease, opacity .18s ease',
        ...variantStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/ui/Button.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Add themed hover, pressed and disabled states**

Industry requires themed interaction states, never browser defaults. These are
CSS pseudo-classes, so they go in `app/globals.css` rather than inline styles.
Append to the end of the file:

```css
/* Themed interaction states for UI primitives (spec §7.1).
   data-ui marks an element as belonging to the primitive layer. */
[data-ui='button']:hover:not(:disabled) {
  filter: brightness(1.12);
}
[data-ui='button']:active:not(:disabled) {
  transform: translateY(1px);
}
[data-ui='button']:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

Then add `data-ui="button"` to the `<button>` in `components/ui/Button.tsx`,
immediately after the `type=` line:

```tsx
      data-ui="button"
```

- [ ] **Step 6: Run the test again**

Run: `npx vitest run components/ui/Button.test.tsx`
Expected: PASS, 7 tests (unchanged — the attribute does not affect behaviour).

- [ ] **Step 7: Commit**

```bash
git add components/ui/Button.tsx components/ui/Button.test.tsx app/globals.css
git commit -m "feat(ui): add Button with themed states"
```

---

### Task 5: Panel and Badge

Two small primitives, one task — Badge is a handful of lines and shares Panel's
test setup.

**Files:**
- Create: `components/ui/Panel.tsx`
- Create: `components/ui/Badge.tsx`
- Create: `components/ui/Panel.test.tsx`

**Interfaces:**
- Consumes: `Frame` (Task 3), tokens (Task 2)
- Produces:
  ```ts
  function Panel(props: {
    children: React.ReactNode;
    marks?: boolean;      // default true
    filled?: boolean;     // default true — panels sit above the ground
    pad?: 'none' | 'sm' | 'md' | 'lg';   // default 'md'
    style?: React.CSSProperties;
  }): JSX.Element

  type BadgeTone = 'neutral' | 'live' | 'warn' | 'accent';
  function Badge(props: {
    children: React.ReactNode;
    tone?: BadgeTone;     // default 'neutral'
    accent?: string;      // overrides tone colour; used by rarity tags
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `components/ui/Panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Panel } from './Panel';
import { Badge } from './Badge';

describe('Panel', () => {
  it('renders its children', () => {
    render(<Panel><span>Challenger line</span></Panel>);
    expect(screen.getByText('Challenger line')).toBeInTheDocument();
  });

  it('carries registration marks by default', () => {
    const { container } = render(<Panel>x</Panel>);
    expect(container.querySelectorAll('[data-mark]')).toHaveLength(4);
  });

  it('supports a padding scale', () => {
    const { container } = render(<Panel pad="none">x</Panel>);
    const inner = container.querySelector('[data-ui="panel-body"]') as HTMLElement;
    expect(inner.style.padding).toBe('0px');
  });
});

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>LIVE</Badge>);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('uses square corners', () => {
    render(<Badge>LIVE</Badge>);
    expect((screen.getByText('LIVE') as HTMLElement).style.borderRadius)
      .toBe('var(--radius-sm)');
  });

  it('takes an accent override so rarity tags reuse it', () => {
    render(<Badge accent="#ff8ac4">LGND</Badge>);
    expect((screen.getByText('LGND') as HTMLElement).style.color)
      .toBe('rgb(255, 138, 196)');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/ui/Panel.test.tsx`
Expected: FAIL — cannot resolve `./Panel`.

- [ ] **Step 3: Implement Panel**

Create `components/ui/Panel.tsx`:

```tsx
'use client';

/**
 * A framed surface. Panels are the one place the Industry "line drawing" rule
 * relaxes to a fill: they sit above the stage-black ground and need to read as
 * a distinct plane.
 */

import type { CSSProperties, ReactNode } from 'react';
import { Frame } from './Frame';

const PAD = {
  none: '0px',
  sm: 'var(--sp-2)',
  md: 'var(--sp-4)',
  lg: 'var(--sp-6)',
} as const;

export interface PanelProps {
  children: ReactNode;
  marks?: boolean;
  filled?: boolean;
  pad?: keyof typeof PAD;
  style?: CSSProperties;
}

export function Panel({
  children,
  marks = true,
  filled = true,
  pad = 'md',
  style,
}: PanelProps) {
  return (
    <Frame marks={marks} filled={filled} style={style}>
      <div data-ui="panel-body" style={{ padding: PAD[pad] }}>
        {children}
      </div>
    </Frame>
  );
}
```

- [ ] **Step 4: Implement Badge**

Create `components/ui/Badge.tsx`:

```tsx
'use client';

/**
 * A small tinted label: LIVE, OWNED ONLY, rarity tags.
 *
 * `accent` lets the four rarity colours reuse this rather than forking —
 * rarity keeps its colour under the Industry grammar (spec §7.1), and the
 * text inside is what satisfies "never colour alone"
 * (docs/CARD_ART_GENERATION.md §3).
 */

import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'live' | 'warn' | 'accent';

const TONE: Record<BadgeTone, string> = {
  neutral: 'var(--ink-40)',
  live: 'var(--neon-mint)',
  warn: 'var(--neon-gold)',
  accent: 'var(--neon-cyan)',
};

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  accent?: string;
}

export function Badge({ children, tone = 'neutral', accent }: BadgeProps) {
  const colour = accent ?? TONE[tone];
  return (
    <span
      data-ui="badge"
      style={{
        display: 'inline-block',
        padding: 'var(--sp-1) var(--sp-2)',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${colour}`,
        color: colour,
        font: "700 7px/1 var(--font-tele)",
        letterSpacing: '.14em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run components/ui/Panel.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add components/ui/Panel.tsx components/ui/Badge.tsx components/ui/Panel.test.tsx
git commit -m "feat(ui): add Panel and Badge"
```

---

### Task 6: Field, Segmented and Stat

Three form/data primitives. Grouped because each is small and they share a test file.

**Files:**
- Create: `components/ui/Field.tsx`
- Create: `components/ui/Segmented.tsx`
- Create: `components/ui/Stat.tsx`
- Create: `components/ui/Field.test.tsx`

**Interfaces:**
- Consumes: tokens (Task 2)
- Produces:
  ```ts
  function Field(props: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>): JSX.Element

  function Segmented<T extends string>(props: {
    options: readonly T[];
    value: T;
    onChange: (v: T) => void;
    accentFor?: (v: T) => string | undefined;
    label: string;                    // accessible group name
  }): JSX.Element

  function Stat(props: {
    label: string;                    // "\n" renders as a line break
    value: string | number;
    accent?: string;
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `components/ui/Field.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Field } from './Field';
import { Segmented } from './Segmented';
import { Stat } from './Stat';

describe('Field', () => {
  it('associates its label with the input', () => {
    render(<Field label="EMAIL" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('EMAIL')).toBeInTheDocument();
  });

  it('reports the typed string, not the event', async () => {
    const onChange = vi.fn();
    render(<Field label="EMAIL" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('EMAIL'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

describe('Segmented', () => {
  const OPTS = ['ALL', 'LIVE', 'GOING'] as const;

  it('renders every option as a button', () => {
    render(<Segmented label="Filter" options={OPTS} value="ALL" onChange={() => {}} />);
    for (const o of OPTS) {
      expect(screen.getByRole('button', { name: o })).toBeInTheDocument();
    }
  });

  it('marks the selected option with aria-pressed', () => {
    render(<Segmented label="Filter" options={OPTS} value="LIVE" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'LIVE' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ALL' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the chosen option', async () => {
    const onChange = vi.fn();
    render(<Segmented label="Filter" options={OPTS} value="ALL" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'GOING' }));
    expect(onChange).toHaveBeenCalledWith('GOING');
  });

  it('names the group for assistive tech', () => {
    render(<Segmented label="Filter" options={OPTS} value="ALL" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Filter' })).toBeInTheDocument();
  });
});

describe('Stat', () => {
  it('renders label and value', () => {
    render(<Stat label="PEAK VIBE" value={99} />);
    expect(screen.getByText('PEAK VIBE')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('uses tabular numerals so columns of digits line up', () => {
    render(<Stat label="DROPS" value={1284} />);
    const el = screen.getByText('1284') as HTMLElement;
    expect(el.style.fontVariantNumeric).toBe('tabular-nums');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/ui/Field.test.tsx`
Expected: FAIL — cannot resolve `./Field`.

- [ ] **Step 3: Implement Field**

Create `components/ui/Field.tsx`:

```tsx
'use client';

/**
 * A labelled text input.
 *
 * onChange takes the string rather than the event, and `onChange`/`value` are
 * omitted from the spread props so the native handler cannot collide with it —
 * that collision was a real TypeScript error in the sign-in screen.
 */

import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function Field({ label, value, onChange, ...rest }: FieldProps) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          marginBottom: 'var(--sp-2)',
          font: "400 8px/1 var(--font-tele)",
          letterSpacing: '.18em',
          color: 'var(--ink-40)',
        }}
      >
        {label}
      </label>
      <input
        id={id}
        data-ui="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: 'var(--sp-3)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--booth-panel)',
          border: 'var(--border-strong)',
          color: 'var(--ink)',
          font: "400 14px/1 var(--font-body)",
        }}
        {...rest}
      />
    </div>
  );
}
```

- [ ] **Step 4: Implement Segmented**

Create `components/ui/Segmented.tsx`:

```tsx
'use client';

/**
 * The filter-pill row. Three hand-rolled copies of this existed before
 * (events, social, profile).
 *
 * role="group" + aria-pressed rather than a radiogroup: these are toggles that
 * act immediately, not a form value awaiting submission.
 */

export interface SegmentedProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  accentFor?: (v: T) => string | undefined;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accentFor,
  label,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}
    >
      {options.map((o) => {
        const on = o === value;
        const accent = accentFor?.(o) ?? 'var(--ink)';
        return (
          <button
            key={o}
            type="button"
            data-ui="button"
            aria-pressed={on}
            onClick={() => onChange(o)}
            style={{
              padding: 'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${on ? accent : 'var(--hairline)'}`,
              background: on ? accent : 'transparent',
              color: on ? '#0a0812' : accent,
              font: "700 8px/1 var(--font-tele)",
              letterSpacing: '.14em',
              cursor: 'pointer',
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Implement Stat**

Create `components/ui/Stat.tsx`:

```tsx
'use client';

/**
 * A label over a large numeral. Four hand-rolled copies existed before
 * (profile stats, chart offers, deck drops, room vibe).
 */

export interface StatProps {
  label: string;
  value: string | number;
  accent?: string;
}

export function Stat({ label, value, accent = 'var(--ink)' }: StatProps) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div
        style={{
          font: "400 7px/1.4 var(--font-tele)",
          letterSpacing: '.12em',
          color: 'var(--ink-40)',
          // "\n" in a label renders as a line break — several stat labels are
          // two words stacked.
          whiteSpace: 'pre-line',
          minHeight: 20,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 'var(--sp-1)',
          font: "700 26px/1 var(--font-stat)",
          fontVariantNumeric: 'tabular-nums',
          color: accent,
        }}
      >
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run components/ui/Field.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 7: Commit**

```bash
git add components/ui/Field.tsx components/ui/Segmented.tsx components/ui/Stat.tsx components/ui/Field.test.tsx
git commit -m "feat(ui): add Field, Segmented and Stat"
```

---

### Task 7: Sheet and EmptyState

`Sheet` is new — the create and join flows in the next plan need a bottom sheet.

**Files:**
- Create: `components/ui/Sheet.tsx`
- Create: `components/ui/EmptyState.tsx`
- Create: `components/ui/Sheet.test.tsx`

**Interfaces:**
- Consumes: `Frame` (Task 3), `Button` (Task 4), tokens (Task 2)
- Produces:
  ```ts
  function Sheet(props: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }): JSX.Element | null

  function EmptyState(props: {
    title: string;
    hint?: string;
    action?: React.ReactNode;
  }): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

Create `components/ui/Sheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Sheet } from './Sheet';
import { EmptyState } from './EmptyState';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Create"><p>body</p></Sheet>);
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders its content when open', () => {
    render(<Sheet open onClose={() => {}} title="Create"><p>body</p></Sheet>);
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('is a labelled modal dialog', () => {
    render(<Sheet open onClose={() => {}} title="Create"><p>body</p></Sheet>);
    expect(screen.getByRole('dialog', { name: 'Create' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Create"><p>body</p></Sheet>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Create"><p>body</p></Sheet>);
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close when the sheet body is clicked', async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Create"><p>body</p></Sheet>);
    await userEvent.click(screen.getByText('body'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('renders title and hint', () => {
    render(<EmptyState title="NOTHING HERE YET" hint="RSVP to see it" />);
    expect(screen.getByText('NOTHING HERE YET')).toBeInTheDocument();
    expect(screen.getByText('RSVP to see it')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/ui/Sheet.test.tsx`
Expected: FAIL — cannot resolve `./Sheet`.

- [ ] **Step 3: Implement Sheet**

Create `components/ui/Sheet.tsx`:

```tsx
'use client';

/**
 * A bottom sheet. Used by the create and join flows.
 *
 * Escape and backdrop both close. The body stops click propagation so a click
 * inside never reaches the backdrop handler.
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="sheet-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,.66)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '86dvh',
          overflowY: 'auto',
          background: 'var(--booth-panel)',
          borderTop: 'var(--border-strong)',
          borderRadius: 'var(--radius-none)',
          padding: 'var(--sp-5)',
          paddingBottom: 'calc(var(--sp-5) + var(--safe-bottom))',
        }}
      >
        <div
          style={{
            font: "400 20px/1 var(--font-heading)",
            textTransform: 'uppercase',
            letterSpacing: '.02em',
            marginBottom: 'var(--sp-4)',
          }}
        >
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement EmptyState**

Create `components/ui/EmptyState.tsx`:

```tsx
'use client';

/** Consistent "nothing here" treatment. Three ad-hoc variants existed before. */

import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  hint?: string;
  action?: ReactNode;
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--sp-7) var(--sp-4)' }}>
      <div
        style={{
          font: "400 10px/1.6 var(--font-tele)",
          letterSpacing: '.16em',
          color: 'var(--ink-25)',
        }}
      >
        {title}
      </div>
      {hint && (
        <div
          style={{
            marginTop: 'var(--sp-2)',
            font: "400 11px/1.6 var(--font-body)",
            color: 'var(--ink-40)',
          }}
        >
          {hint}
        </div>
      )}
      {action && <div style={{ marginTop: 'var(--sp-4)' }}>{action}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run components/ui/Sheet.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add components/ui/Sheet.tsx components/ui/EmptyState.tsx components/ui/Sheet.test.tsx
git commit -m "feat(ui): add Sheet and EmptyState"
```

---

### Task 8: Barrel export and the proof page

A route that renders every primitive in every variant, so the visual direction
can be reviewed in one place and pushed to Claude Design later.

**Files:**
- Create: `components/ui/index.ts`
- Create: `app/ui/page.tsx`
- Create: `components/ui/index.test.ts`

**Interfaces:**
- Consumes: all primitives from Tasks 3–7
- Produces: `import { Button, Panel, … } from '@/components/ui'` and the route `/ui`

- [ ] **Step 1: Write the failing test**

Create `components/ui/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as ui from './index';

describe('ui barrel', () => {
  it('exports all eight primitives plus Frame', () => {
    for (const name of [
      'Frame', 'Button', 'Panel', 'Badge',
      'Field', 'Segmented', 'Stat', 'Sheet', 'EmptyState',
    ]) {
      expect(ui).toHaveProperty(name);
      expect(typeof (ui as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run components/ui/index.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Create the barrel**

Create `components/ui/index.ts`:

```ts
export { Frame } from './Frame';
export type { FrameProps } from './Frame';
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { Panel } from './Panel';
export type { PanelProps } from './Panel';
export { Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';
export { Field } from './Field';
export type { FieldProps } from './Field';
export { Segmented } from './Segmented';
export type { SegmentedProps } from './Segmented';
export { Stat } from './Stat';
export type { StatProps } from './Stat';
export { Sheet } from './Sheet';
export type { SheetProps } from './Sheet';
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/ui/index.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 5: Build the proof page**

Create `app/ui/page.tsx`:

```tsx
'use client';

/**
 * Every primitive, every variant, on one page.
 *
 * This is the review surface for the Industry-grammar direction (spec §7.1)
 * and the source for the Claude Design push. Not linked from the app nav.
 */

import { useState } from 'react';
import {
  Button, Panel, Badge, Field, Segmented, Stat, Sheet, EmptyState,
} from '@/components/ui';
import { RARITY } from '@/lib/rarity';
import type { Rarity } from '@/types/cards';

const FILTERS = ['ALL', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;

export default function UiProof() {
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--sp-7) var(--sp-5)' }}>
      <div
        style={{
          font: "400 10px/1 var(--font-tele)",
          letterSpacing: '.24em',
          color: 'var(--neon-pink)',
        }}
      >
        INDUSTRY GRAMMAR · AUXWARS GROUND
      </div>
      <h1
        style={{
          font: "400 clamp(36px,8vw,58px)/.92 var(--font-heading)",
          textTransform: 'uppercase',
          margin: 'var(--sp-3) 0 var(--sp-7)',
        }}
      >
        UI Primitives
      </h1>

      <Section title="Buttons">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </Row>
        <Row>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
        <Row>
          {(['common', 'rare', 'epic', 'legendary'] as Rarity[]).map((r) => (
            <Button key={r} variant="primary" accent={RARITY[r].color}>
              {RARITY[r].tag}
            </Button>
          ))}
        </Row>
      </Section>

      <Section title="Panels — marks are the signature">
        <Row>
          <Panel style={{ flex: 1 }}>Filled, marked</Panel>
          <Panel filled={false} style={{ flex: 1 }}>Drawn, marked</Panel>
          <Panel marks={false} style={{ flex: 1 }}>Filled, no marks</Panel>
        </Row>
      </Section>

      <Section title="Badges — rarity keeps its colour">
        <Row>
          <Badge>NEUTRAL</Badge>
          <Badge tone="live">● LIVE</Badge>
          <Badge tone="warn">OWNED ONLY</Badge>
          <Badge tone="accent">OPEN DOOR</Badge>
          {(['common', 'rare', 'epic', 'legendary'] as Rarity[]).map((r) => (
            <Badge key={r} accent={RARITY[r].color}>{RARITY[r].label}</Badge>
          ))}
        </Row>
      </Section>

      <Section title="Form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 340 }}>
          <Field label="NIGHT NAME" value={text} onChange={setText} placeholder="Basement 4AM" />
          <Segmented
            label="Rarity filter"
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            accentFor={(f) =>
              f === 'ALL' ? undefined : RARITY[f.toLowerCase() as Rarity].color}
          />
        </div>
      </Section>

      <Section title="Stats">
        <Panel>
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <Stat label={'TOTAL REIGNS\nWON'} value={37} accent="var(--neon-cyan)" />
            <Stat label={'PEAK\nVIBE'} value={99} accent="var(--neon-gold)" />
            <Stat label={'CHALLENGER\nWIN RATE'} value="61%" accent="var(--neon-pink)" />
          </div>
        </Panel>
      </Section>

      <Section title="Sheet and empty state">
        <Row>
          <Button variant="primary" onClick={() => setSheetOpen(true)}>Open sheet</Button>
        </Row>
        <Panel filled={false}>
          <EmptyState
            title="NOTHING HERE YET"
            hint="Create a night to see it listed."
            action={<Button variant="primary">Create a night</Button>}
          />
        </Panel>
      </Section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Create a night">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Field label="NAME" value={text} onChange={setText} placeholder="Basement 4AM" />
          <Button variant="primary" block onClick={() => setSheetOpen(false)}>Done</Button>
        </div>
      </Sheet>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--sp-8)' }}>
      <div
        style={{
          font: "400 9px/1 var(--font-tele)",
          letterSpacing: '.2em',
          color: 'var(--ink-40)',
          paddingBottom: 'var(--sp-3)',
          borderBottom: 'var(--border-hair)',
          marginBottom: 'var(--sp-4)',
        }}
      >
        {title.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {children}
      </div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center' }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Verify the whole suite and the build**

Run: `npm test`
Expected: PASS — 40 tests across 8 files:

| File | Tests |
|---|---|
| `smoke.test.tsx` | 1 |
| `tokens.test.tsx` | 5 |
| `Frame.test.tsx` | 5 |
| `Button.test.tsx` | 7 |
| `Panel.test.tsx` | 6 (Panel 3 + Badge 3) |
| `Field.test.tsx` | 8 (Field 2 + Segmented 4 + Stat 2) |
| `Sheet.test.tsx` | 7 (Sheet 6 + EmptyState 1) |
| `index.test.ts` | 1 |

Run: `npx tsc --noEmit && npx next build`
Expected: no TypeScript output; build completes with `/ui` in the route list.

- [ ] **Step 7: Look at it**

Run: `npm run dev`, then open `http://localhost:3000/ui`.

Confirm by eye:
- every corner is square
- the four `+` registration marks sit at each Panel's corners
- all four rarity colours are present and distinct
- headings render in Barlow Condensed, not Anton

- [ ] **Step 8: Confirm existing checks still pass**

Run: `npx tsx scripts/verify.ts`
Expected: `ALL 29 CHECKS PASSED`.

- [ ] **Step 9: Commit**

```bash
git add components/ui/index.ts components/ui/index.test.ts app/ui/page.tsx
git commit -m "feat(ui): add barrel export and /ui proof page"
```

---

## What this plan does NOT do

Deliberate scope boundaries — each is a later plan:

- **Migrating the 13 existing screens** onto these primitives. This plan builds
  them and proves them at `/ui`; the screens still carry their inline styles
  and their old radii. Nothing regresses, because nothing existing is touched.
- **Formats, rooms, joining, shoutouts** — spec §2–§6.
- **The playback provider interface** — spec §8.
- **Pushing to Claude Design.** Once `/ui` is approved, a `DesignSync`
  `finalize_plan` → `write_files` pass sends the primitives to a **new
  AuxWars project**. "Industry" is left untouched.

## Verification summary

| Check | Command | Expected |
|---|---|---|
| Unit tests | `npm test` | 40 pass, 8 files |
| Types | `npx tsc --noEmit` | no output |
| Invariants | `npx tsx scripts/verify.ts` | ALL 29 CHECKS PASSED |
| Build | `npx next build` | completes, `/ui` listed |
| Visual | `npm run dev` → `/ui` | square corners, marks, 4 rarity colours |
