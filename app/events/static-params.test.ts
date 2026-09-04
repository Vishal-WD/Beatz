import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
  The bug this pins:

  `generateStaticParams` enumerated slugs from the EVENTS fixture in
  lib/social-data.ts, while the feed read events from the database. Static
  export builds a page only for the enumerated slugs, so an APK shipped
  detail pages for five invented nights and none for the real ones — two of
  three feed tiles led to a 404.

  It survived every earlier check because `next dev` renders any slug on
  demand. Only the export shows it, which is exactly the environment the
  APK ships from.

  Asserting on the source rather than on a built bundle keeps this cheap to
  run: the rule is that the build's slug list must come from the events
  table, never from a hand-written array.
*/
describe('event detail static params', () => {
  const src = readFileSync(
    join(process.cwd(), 'app', 'events', '[slug]', 'page.tsx'),
    'utf8',
  );

  it('builds its slug list from the events table', () => {
    expect(src).toMatch(/from\(['"]events['"]\)/);
    expect(src).toMatch(/select\(['"]slug['"]\)/);
  });

  it('does not enumerate slugs from the social-data fixture', () => {
    // Scoped to imports, not the whole file: the header comment names the
    // fixture while explaining the bug, and a test that trips over its own
    // documentation would be noise rather than a guard.
    const imports = src
      .split('\n')
      .filter((l) => l.trimStart().startsWith('import'))
      .join('\n');

    expect(imports).not.toMatch(/social-data/);
    expect(imports).not.toMatch(/\bEVENTS\b/);
  });

  it('fails the build rather than silently exporting no pages on error', () => {
    // Swallowing the error would ship an APK whose event links 404 — the
    // original bug wearing a different mask.
    expect(src).toMatch(/throw new Error/);
  });
});
