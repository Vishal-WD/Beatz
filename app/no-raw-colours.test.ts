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

  /*
    The primitives are the layer screens compose instead of styling from
    scratch, so a literal here leaks into every screen that uses it and
    survives a theme switch. Button and Segmented held hardcoded copies of
    --ink-on-neon (one a near-miss: #0a0008 against the token's #0a0812),
    and Sheet had its own backdrop rgba.

    Scoped to components/ui/ rather than all of components/: PeakMomentBurst
    and SongCardView carry deliberate artwork colours — Peak Moment shards
    and the holo sweep — which the design treats as artwork rather than
    theming, and which must not become tokens.
  */
  it('has no hex or rgba() anywhere under components/ui/', () => {
    const offenders = walk(join('components', 'ui'))
      .filter((f) => !f.includes('.test.'))
      .map((f) => {
        const lines = readFileSync(f, 'utf8').split('\n');
        return lines
          .map((l, i) => (COLOUR.test(l) ? `${f}:${i + 1}` : null))
          .filter(Boolean) as string[];
      })
      .flat();

    expect(offenders, `Raw colours found:\n  ${offenders.join('\n  ')}`)
      .toEqual([]);
  });
});
