'use client';

/**
 * Accessible Vibe readout.
 *
 * The vibe number changes every 420ms and its urgency was previously carried
 * by color alone (cyan→violet→pink→gold). That leaves two groups unable to
 * play: screen-reader users get no signal at all, and colorblind users cannot
 * read "about to lose the throne" from a hue shift.
 *
 * Fixes both without spamming: announcements fire on THRESHOLD CROSSINGS, not
 * on every tick — an aria-live region updating twice a second is unusable.
 */

import { useEffect, useRef, useState } from 'react';
import { vibeColor } from '@/lib/rarity';
import { DETHRONE_THRESHOLD } from '@/types/game';

export type VibeBand = 'critical' | 'low' | 'holding' | 'strong' | 'peak';

export function vibeBand(v: number): VibeBand {
  if (v <= DETHRONE_THRESHOLD + 5) return 'critical';
  if (v < 40) return 'low';
  if (v < 62) return 'holding';
  if (v < 82) return 'strong';
  return 'peak';
}

/** Text equivalent of the color ramp — the non-visual channel. */
const BAND_LABEL: Record<VibeBand, string> = {
  critical: 'LOSING IT',
  low: 'SLIPPING',
  holding: 'HOLDING',
  strong: 'STRONG',
  peak: 'PEAKING',
};

const BAND_ANNOUNCE: Record<VibeBand, string> = {
  critical: 'Vibe critical. You are about to lose the throne.',
  low: 'Vibe slipping.',
  holding: 'Vibe holding steady.',
  strong: 'Vibe strong.',
  peak: 'Vibe peaking.',
};

interface Props {
  vibe: number;
  size?: 'sm' | 'lg';
  /** Fires once per crossing into `critical` — good place for a warning sound. */
  onCritical?: () => void;
}

export function VibeMeter({ vibe, size = 'sm', onCritical }: Props) {
  const band = vibeBand(vibe);
  const color = vibeColor(vibe);
  const prevBand = useRef<VibeBand>(band);
  const [announcement, setAnnouncement] = useState('');
  const onCriticalRef = useRef(onCritical);

  useEffect(() => {
    onCriticalRef.current = onCritical;
  }, [onCritical]);

  useEffect(() => {
    if (band === prevBand.current) return;
    const was = prevBand.current;
    prevBand.current = band;
    setAnnouncement(BAND_ANNOUNCE[band]);
    if (band === 'critical' && was !== 'critical') onCriticalRef.current?.();
  }, [band]);

  const big = size === 'lg';

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: big ? 8 : 5 }}>
      <span
        style={{
          font: `700 ${big ? 52 : 17}px/1 var(--font-stat)`,
          color,
          fontVariantNumeric: 'tabular-nums',
          transition: 'color .42s linear',
        }}
      >
        {vibe}
      </span>

      {/* The text band is the accessible duplicate of the color ramp. */}
      <span
        style={{
          font: `700 ${big ? 10 : 7}px/1 var(--font-tele)`,
          letterSpacing: '.16em',
          color,
          opacity: 0.9,
        }}
      >
        {BAND_LABEL[band]}
      </span>

      {/* Machine-readable current value for assistive tech. */}
      <span
        role="meter"
        aria-valuenow={vibe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Vibe level"
        className="sr-only"
      />

      {/* Polite: never interrupts, fires only on band changes. */}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
