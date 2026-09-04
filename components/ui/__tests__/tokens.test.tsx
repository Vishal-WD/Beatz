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
    expect(css).toContain('--stage-black: #160f26');
    for (const c of ['--neon-pink', '--neon-cyan', '--neon-gold', '--neon-violet']) {
      expect(css).toContain(c);
    }
  });
});
