# Final fix report — design-system-foundation

Applied the three fixes from the final whole-branch code review.

## Fix 1 (Important) — Sheet.tsx focus management

`components/ui/Sheet.tsx` asserted `role="dialog"` and `aria-modal="true"`
but did nothing to actually contain focus. Fixed inside the existing
`useEffect` (the one that already registered the Escape handler), so the
dialog's whole focus lifecycle stays in one place:

- Added `dialogRef` (a `useRef<HTMLDivElement>`) and attached it to the
  dialog element, with `tabIndex={-1}` so it can receive programmatic focus
  without being in the normal Tab order itself.
- On open: capture `document.activeElement` as `previouslyFocused`, then
  call `dialogRef.current?.focus()` to move focus into the dialog.
- Tab trapping: the existing `keydown` listener now also handles `Tab`.
  It queries focusable descendants with
  `'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'`
  and wraps focus from the last focusable element back to the first (Tab)
  or from the first back to the last (Shift+Tab). If focus has somehow
  left the dialog entirely (e.g. `!dialog.contains(active)`), it's pulled
  back in. If there are no focusable children, Tab is prevented and focus
  stays pinned to the dialog itself.
- On cleanup (effect teardown, which runs when `open` flips to `false` or
  the component unmounts): `previouslyFocused?.focus?.()` restores focus
  to whatever had it before the sheet opened.
- All DOM access is guarded (`document.activeElement` behind a
  `typeof document !== 'undefined'` check, optional chaining on
  `dialogRef.current` and `previouslyFocused`) since this runs under jsdom
  in tests and inside a WebView on Android.

No visual, markup structure, or existing prop/behavior changes — only the
ref, `tabIndex={-1}`, and the effect body changed.

### Covering tests (`components/ui/Sheet.test.tsx`)

Added two tests, taking the file from 7 to 9 tests:

- `'moves focus into the dialog when opened'` — renders an open Sheet and
  asserts `screen.getByRole('dialog', { name: 'Create' })` has focus.
- `'restores focus to the previously focused element on close'` — creates
  and focuses a real `<button>` trigger in `document.body`, renders the
  Sheet open (asserts focus moved to the dialog), then rerenders with
  `open={false}` and asserts focus returned to the trigger button.

## Fix 2 (Minor) — Field.tsx misleading comment

`components/ui/Field.tsx` line ~50 previously said borderRadius was
"re-asserted after the spread," which implied key-by-key merge behavior
like `Button.tsx`. That's not what happens: `{...rest}` (line 42) comes
before a whole `style={{...}}` object (lines 43-52), so by
last-attribute-wins semantics the caller's entire `style` prop — not just
its `borderRadius` — is discarded if they pass one via `rest`.

Rewrote the comment to say exactly that: a caller-supplied `style` is
replaced wholesale by the component's own (deliberate — the field's
appearance is closed), and this differs from `Button`, where caller
styles are merged via `{...style}` spread and only `borderRadius` is
protected afterward. No behavior change, comment only.

## Fix 3 (Minor) — undocumented API inconsistency

- `components/ui/index.ts`: added a header comment above the first export
  stating the three contracts across the nine primitives — `Frame`/`Panel`
  accept `style` (callers position them), `Button`/`Field` spread native
  HTML attributes (they wrap native elements), and `Badge`/`Segmented`/
  `Stat`/`Sheet`/`EmptyState` are closed (extend rather than style around
  them) — plus the global note that `borderRadius` is guarded everywhere
  a caller could override it, since square corners are a hard constraint
  (spec §7.1). Pure re-exports otherwise unchanged.
- `components/ui/Frame.tsx`: added one line near the `...style` spread
  noting `border` and `position` are intentionally caller-overridable
  while `borderRadius` is not — surfacing the existing choice rather than
  changing it.

No other primitives were touched.

## Commands run (actual output)

### `npx vitest run`

```
 Test Files  8 passed (8)
      Tests  44 passed (44)
```

Per-file breakdown from the run:
- components/ui/__tests__/tokens.test.tsx — 5 tests
- components/ui/index.test.ts — 1 test
- components/ui/Panel.test.tsx — 6 tests
- components/ui/Frame.test.tsx — 6 tests
- components/ui/__tests__/smoke.test.tsx — 1 test
- components/ui/Button.test.tsx — 8 tests
- components/ui/Field.test.tsx — 8 tests
- components/ui/Sheet.test.tsx — 9 tests (was 7, +2 new)

Total: 44 passed (was 42, +2), 8 files passed (8).

### `npx tsc --noEmit`

No output (clean, exit 0).

## Files changed

- `components/ui/Sheet.tsx` — focus management (Fix 1)
- `components/ui/Sheet.test.tsx` — two new tests (Fix 1)
- `components/ui/Field.tsx` — comment rewrite (Fix 2)
- `components/ui/index.ts` — header comment (Fix 3)
- `components/ui/Frame.tsx` — one-line comment (Fix 3)
