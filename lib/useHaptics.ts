'use client';

/**
 * Haptic feedback. Capacitor's Haptics plugin inside the APK, the Web
 * Vibration API in a browser, silent no-op where neither exists.
 *
 * Reserved for moments with real stakes — taking the throne, losing it,
 * pulling a legendary. Buzzing on every tap trains people to ignore it.
 */

import { useCallback, useRef, useEffect } from 'react';

export type Haptic = 'light' | 'medium' | 'heavy' | 'success' | 'warning';

/** Web Vibration fallback patterns, in ms. */
const PATTERNS: Record<Haptic, number | number[]> = {
  light: 10,
  medium: 22,
  heavy: 42,
  success: [18, 55, 32],
  warning: [30, 45, 30],
};

export function useHaptics() {
  const plugin = useRef<any>(null);
  const tried = useRef(false);

  useEffect(() => {
    // Only load the native plugin inside the Capacitor shell — importing it
    // in a plain browser pulls in a bridge that will never connect.
    if (tried.current || typeof window === 'undefined') return;
    tried.current = true;
    if (!(window as any).Capacitor?.isNativePlatform?.()) return;

    import('@capacitor/haptics')
      .then((m) => {
        plugin.current = m;
      })
      .catch(() => {
        // Plugin unavailable — the web fallback below still works.
      });
  }, []);

  return useCallback((kind: Haptic = 'light') => {
    if (typeof window === 'undefined') return;

    // A user who suppressed motion generally wants less physical feedback too.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const p = plugin.current;
    if (p) {
      try {
        if (kind === 'success') {
          void p.Haptics.notification({ type: p.NotificationType.Success });
        } else if (kind === 'warning') {
          void p.Haptics.notification({ type: p.NotificationType.Warning });
        } else {
          const style =
            kind === 'heavy'
              ? p.ImpactStyle.Heavy
              : kind === 'medium'
                ? p.ImpactStyle.Medium
                : p.ImpactStyle.Light;
          void p.Haptics.impact({ style });
        }
        return;
      } catch {
        // Fall through to the web API.
      }
    }

    try {
      navigator.vibrate?.(PATTERNS[kind]);
    } catch {
      // No vibration hardware, or a browser that blocks it. Non-fatal.
    }
  }, []);
}
