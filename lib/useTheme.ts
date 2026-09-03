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
