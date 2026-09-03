'use client';

/**
 * The Vibe Bar engine — the core loop's heartbeat (CLAUDE.md §1).
 *
 * Thin React adapter over lib/domain/reign.ts. The decay maths, clamping and
 * the end-of-reign decision live there and are tested there — this hook owns
 * ONLY React concerns: the interval, hold state, and the soloPractice crowd
 * simulation. It must never re-implement or second-guess the domain's rule
 * that a spectator/delegated room can't end a reign (CLAUDE.md §1.2).
 *
 * Local simulation. The hosted Socket.io server is authoritative in
 * multiplayer; this drives Solo Practice and keeps the UI alive during the
 * reconnect grace window (CLAUDE.md §6) rather than dropping to zero.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { VIBE_TICK_MS } from '@/types/game';
import type { ControlModel } from './domain/formats';
import { startReign, tickReign, VIBE_MAX, type ReignState, type EndReason } from './domain/reign';

interface Options {
  /** Card stamina drives decay rate; 0 stamina means no active reign. */
  stamina: number;
  /** Card hype sets the opening Vibe Bar position (CLAUDE.md §2). */
  hype: number;
  /** Which of the three control models governs collapse (CLAUDE.md §1). */
  control: ControlModel;
  /** True when nobody else is in the room — labeled practice, never hidden. */
  soloPractice?: boolean;
}

export function useVibe({
  stamina,
  hype,
  control,
  soloPractice = true,
}: Options) {
  const state = useRef<ReignState>(startReign(hype, Date.now()));
  const [vibe, setVibe] = useState(state.current.vibe);
  const [ended, setEnded] = useState<EndReason | null>(state.current.endedReason);
  const [holding, setHolding] = useState(false);
  const [hold, setHold] = useState(0);
  const holdingRef = useRef(false);
  // The ref initializer above already seeds the first reign from `hype`.
  // Skip this effect's first run so mount doesn't call startReign() twice —
  // a later `hype` change (a new card played) still must re-seed it.
  const mounted = useRef(false);

  useEffect(() => {
    holdingRef.current = holding;
  }, [holding]);

  // A new card onto the deck slot starts a fresh reign (CLAUDE.md §1).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    state.current = startReign(hype, Date.now());
    setVibe(state.current.vibe);
    setEnded(state.current.endedReason);
  }, [hype]);

  useEffect(() => {
    const tick = setInterval(() => {
      // Crowd energy: simulated in Solo Practice, real crowd input in a
      // live room. Random drift keeps a solo reign from being deterministic.
      //
      // Drift MUST be zero-mean. An earlier +0.4 mean silently outpaced the
      // decay of high-stamina cards, so a legendary reign never ended and the
      // throne never changed hands — which breaks the core loop (CLAUDE.md §1).
      // Holds are the only positive force on the vibe; that is the mechanic.
      const crowd = soloPractice ? Math.random() * 3.2 - 1.6 : 0;
      const pull = (holdingRef.current ? 4 : 0) + crowd;

      state.current = tickReign(state.current, {
        control,
        stamina,
        crowdPull: pull,
        deltaMs: VIBE_TICK_MS,
        now: Date.now(),
      });
      setVibe(state.current.vibe);
      setEnded(state.current.endedReason);

      setHold((h) => (holdingRef.current ? Math.min(100, h + 9) : Math.max(0, h - 12)));
    }, VIBE_TICK_MS);

    return () => clearInterval(tick);
  }, [stamina, control, soloPractice]);

  const startHold = useCallback(() => setHolding(true), []);
  const endHold = useCallback(() => setHolding(false), []);

  /** Peak Moment — mints a Legendary directly (CLAUDE.md §3, path 2). */
  const firePeak = useCallback(() => {
    state.current = { ...state.current, vibe: VIBE_MAX, peakVibe: VIBE_MAX };
    setVibe(VIBE_MAX);
  }, []);

  return {
    vibe: Math.round(vibe),
    holding,
    holdPct: Math.round(hold),
    startHold,
    endHold,
    firePeak,
    ended,
  };
}
