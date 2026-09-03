'use client';

/**
 * Peak Moment shard burst — Screen 01's full-screen celebration overlay.
 *
 * This is illustration, not theming: the 54-shard palette and the gold
 * flash are the design prototype's burst effect, verbatim
 * (docs/CARD_ART_GENERATION.md). It must render identically in both themes,
 * the same way a card's rarity foil does — so its colours stay literal
 * rather than routing through the surface/ink token system in
 * app/globals.css. Extracted out of app/room/page.tsx so that screen layer
 * can stay free of raw colour literals without flattening this into a
 * token that was never meant to invert with the theme.
 */

import { useEffect, useMemo, useState } from 'react';

interface Shard {
  id: number;
  style: React.CSSProperties;
}

const SHARD_COLOURS = ['#ffd84d', '#ff2e88', '#4ce3ff', '#7dffc3', '#fff'];

function makeShards(): Shard[] {
  // 54 shards, matching the design prototype's burst.
  return Array.from({ length: 54 }, (_, id) => {
    const a = Math.random() * Math.PI * 2;
    const d = 180 + Math.random() * 380;
    const c = SHARD_COLOURS[Math.floor(Math.random() * SHARD_COLOURS.length)];
    return {
      id,
      style: {
        position: 'absolute',
        left: '50%',
        top: '46%',
        width: 3 + Math.random() * 7,
        height: 8 + Math.random() * 18,
        background: c,
        borderRadius: 2,
        ['--tx' as string]: `${Math.cos(a) * d}px`,
        ['--ty' as string]: `${Math.sin(a) * d}px`,
        ['--rot' as string]: `${Math.round(Math.random() * 720 - 360)}deg`,
        animation: `shard ${1.1 + Math.random() * 0.7}s cubic-bezier(.2,.7,.3,1) ${
          Math.random() * 0.18
        }s forwards`,
      } as React.CSSProperties,
    };
  });
}

interface Props {
  /** True for the duration of the burst; the caller owns the timer. */
  active: boolean;
  dropsLabel?: string;
}

export function PeakMomentBurst({ active, dropsLabel = 'REIGN EXTENDED · +140 DROPS' }: Props) {
  const [shards, setShards] = useState<Shard[]>([]);

  // Reroll the burst every time it (re)activates, not on every render.
  useEffect(() => {
    if (active) setShards(makeShards());
  }, [active]);

  const rendered = useMemo(() => shards, [shards]);

  if (!active) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,216,77,.14)', animation: 'flash .9s ease-out forwards' }} />
      {rendered.map((s) => (
        <div key={s.id} style={s.style} />
      ))}
      <div
        style={{
          position: 'absolute', left: '50%', top: '46%',
          transform: 'translate(-50%,-50%)', textAlign: 'center',
        }}
      >
        <div style={{ font: '400 56px/1 var(--font-title)', textTransform: 'uppercase', color: 'var(--neon-gold)' }}>
          Peak Moment
        </div>
        <div style={{ font: '700 12px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink)', marginTop: 10 }}>
          {dropsLabel}
        </div>
      </div>
    </div>
  );
}
