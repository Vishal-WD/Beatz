'use client';

/**
 * The Vibe Bar engine — the core loop's heartbeat (CLAUDE.md §1).
 *
 * Local simulation. The hosted Socket.io server is authoritative in
 * multiplayer; this drives Solo Practice and keeps the UI alive during the
 * reconnect grace window (CLAUDE.md §6) rather than dropping to zero.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { VIBE_TICK_MS, VIBE_MIN, VIBE_MAX, DETHRONE_THRESHOLD } from '@/types/game';
import { decayRateFor } from './stats';

interface Options {
  /** Card stamina drives decay rate; 0 stamina means no active reign. */
  stamina: number;
  initialVibe?: number;
  /** True when nobody else is in the room — labeled practice, never hidden. */
  soloPractice?: boolean;
  onDethrone?: () => void;
}

export function useVibe({
  stamina,
  initialVibe = 62,
  soloPractice = true,
  onDethrone,
}: Options) {
  const [vibe, setVibe] = useState(initialVibe);
  const [holding, setHolding] = useState(false);
  const [hold, setHold] = useState(0);
  const holdingRef = useRef(false);
  const belowSince = useRef<number | null>(null);
  const onDethroneRef = useRef(onDethrone);

  useEffect(() => {
    onDethroneRef.current = onDethrone;
  }, [onDethrone]);

  useEffect(() => {
    holdingRef.current = holding;
  }, [holding]);

  useEffect(() => {
    const decay = decayRateFor(stamina);

    const tick = setInterval(() => {
      setVibe((v) => {
        // Crowd energy: simulated in Solo Practice, real crowd input in a
        // live room. Random drift keeps a solo reign from being deterministic.
        //
        // Drift MUST be zero-mean. An earlier +0.4 mean silently outpaced the
        // decay of high-stamina cards, so a legendary reign never ended and the
        // throne never changed hands — which breaks the core loop (CLAUDE.md §1).
        // Holds are the only positive force on the vibe; that is the mechanic.
        const crowd = soloPractice ? Math.random() * 3.2 - 1.6 : 0;
        const pull = holdingRef.current ? 4 : 0;
        const next = Math.max(VIBE_MIN, Math.min(VIBE_MAX, v - decay + crowd + pull));

        if (next <= DETHRONE_THRESHOLD) {
          if (belowSince.current === null) belowSince.current = Date.now();
          else if (Date.now() - belowSince.current > 1500) {
            onDethroneRef.current?.();
            belowSince.current = null;
          }
        } else {
          belowSince.current = null;
        }

        return next;
      });

      setHold((h) => (holdingRef.current ? Math.min(100, h + 9) : Math.max(0, h - 12)));
    }, VIBE_TICK_MS);

    return () => clearInterval(tick);
  }, [stamina, soloPractice]);

  const startHold = useCallback(() => setHolding(true), []);
  const endHold = useCallback(() => setHolding(false), []);

  /** Peak Moment — mints a Legendary directly (CLAUDE.md §3, path 2). */
  const firePeak = useCallback(() => setVibe(VIBE_MAX), []);

  return {
    vibe: Math.round(vibe),
    holding,
    holdPct: Math.round(hold),
    startHold,
    endHold,
    firePeak,
    setVibe,
  };
}
