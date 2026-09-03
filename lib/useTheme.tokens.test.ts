import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { STAGE_BLACK_META, STAGE_BLACK_META_LIGHT } from './useTheme';

/*
  lib/useTheme.ts hand-copies --stage-black out of app/globals.css into
  STAGE_BLACK_META (and its light counterpart) because <meta
  name="theme-color"> can't reference a CSS custom property. Nothing else
  ties those two files together -- app/no-raw-colours.test.ts only walks
  app/, not lib/ -- so a copy that fell out of sync would ship silently.
  This test reads globals.css from disk (same approach as
  no-raw-colours.test.ts) and pins the constants to it directly.
*/

const CSS_PATH = 'app/globals.css';

function extractStageBlack(css: string, blockPattern: RegExp): string {
  const blockMatch = blockPattern.exec(css);
  if (!blockMatch) {
    throw new Error(`${CSS_PATH}: could not find a block matching ${blockPattern}`);
  }
  const varMatch = /--stage-black:\s*(#[0-9a-fA-F]{3,8})/.exec(blockMatch[0]);
  if (!varMatch) {
    throw new Error(`${CSS_PATH}: --stage-black not found inside matched block`);
  }
  return varMatch[1];
}

describe('STAGE_BLACK_META tracks --stage-black in globals.css', () => {
  const css = readFileSync(CSS_PATH, 'utf8');

  it('matches the dark :root value', () => {
    const cssValue = extractStageBlack(css, /:root\s*\{[^}]*\}/);
    expect(
      STAGE_BLACK_META,
      `lib/useTheme.ts STAGE_BLACK_META (${STAGE_BLACK_META}) no longer matches ` +
        `--stage-black in ${CSS_PATH}'s :root block (${cssValue}). Update both together.`,
    ).toBe(cssValue);
  });

  it("matches the :root[data-theme='light'] value", () => {
    const cssValue = extractStageBlack(css, /:root\[data-theme=['"]light['"]\]\s*\{[^}]*\}/);
    expect(
      STAGE_BLACK_META_LIGHT,
      `lib/useTheme.ts STAGE_BLACK_META_LIGHT (${STAGE_BLACK_META_LIGHT}) no longer matches ` +
        `--stage-black in ${CSS_PATH}'s :root[data-theme='light'] block (${cssValue}). Update both together.`,
    ).toBe(cssValue);
  });
});
