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
        display: 'inline-block',
        padding: 'var(--sp-1) var(--sp-2)',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${colour}`,
        color: colour,
        font: "700 7px/1 var(--font-tele)",
        letterSpacing: '.14em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
