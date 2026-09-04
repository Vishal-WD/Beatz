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
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${colour}`,
        background: 'var(--surface-inset)',
        color: colour,
        font: '600 9px/1.1 var(--font-body)',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
