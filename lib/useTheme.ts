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

/**
 * Mirrors --stage-black's dark-theme value in globals.css, for the one place
 * that cannot reach a CSS custom property: the <meta name="theme-color">
 * Next's Viewport API generates statically at build time (app/layout.tsx).
 * Dark-first for the same reason useTheme() below is: no toggle is wired to
 * this yet, and the app's identity is a dark stage.
 *
 * Pinned against globals.css by lib/useTheme.tokens.test.ts -- edit
 * --stage-black there and these constants together, or the status bar tint
 * silently drifts from the ground colour it's supposed to match.
 */
export const STAGE_BLACK_META = '#160f26';

/** Mirrors --stage-black's value under :root[data-theme='light']. */
export const STAGE_BLACK_META_LIGHT = '#faf6ef';

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
