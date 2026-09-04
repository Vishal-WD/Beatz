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

  /*
    The original grammar was square corners (spec 7.1, --radius-sm: 2px).
    The app moved to an iOS-style material where controls are rounded or
    pill-shaped; 2px was why every chip read as a plain box. The rule worth
    pinning now is that the ladder EXISTS and is ordered, not that it is
    square -- a radius scale nobody can rank is how ad-hoc corner values
    creep back in.
  */
  it('defines an ordered radius ladder', () => {
    expect(css).toContain('--radius-none: 0');
    for (const step of ['--radius-sm:', '--radius-md:', '--radius-lg:', '--radius-pill:']) {
      expect(css).toContain(step);
    }

    const px = (name: string) =>
      Number((css.match(new RegExp(`${name}:\\s*(\\d+)px`)) ?? [])[1]);
    expect(px('--radius-sm')).toBeLessThan(px('--radius-md'));
    expect(px('--radius-md')).toBeLessThan(px('--radius-lg'));
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
    expect(css).toContain('--stage-black: #160f26');
    for (const c of ['--neon-pink', '--neon-cyan', '--neon-gold', '--neon-violet']) {
      expect(css).toContain(c);
    }
  });
});
