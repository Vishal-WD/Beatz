'use client';

/**
 * The Drops wheel, in the shop.
 *
 * One free spin an hour, or 100 Drops to spin again.
 *
 * The prize is decided by the SERVER (spin_wheel) and this animates to it —
 * never the other way round. A wheel that picks its own outcome and then
 * asks to be paid is a wheel that always lands on 1000. That is also why the
 * pointer settles on `result.index` rather than on wherever the spin
 * animation happens to stop.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WHEEL, SPIN_COST, freeSpinIn, freeSpinReady, formatWait, landingAngle,
} from '@/lib/domain/wheel';
import { DropsAmount } from '@/components/DropsIcon';
import { spinWheel } from '@/lib/supabase';
import { useSound } from '@/lib/useSound';
import { useHaptics } from '@/lib/useHaptics';

const SEG = 360 / WHEEL.length;

/** Colour per segment, warming as the prize climbs. */
function segTone(value: number): string {
  if (value >= 1000) return 'var(--neon-gold)';
  if (value >= 500) return 'var(--neon-pink)';
  if (value >= 250) return 'var(--neon-violet)';
  if (value > 0) return 'var(--neon-cyan)';
  return 'var(--ink-25)';
}

export function SpinWheel({
  drops,
  lastFreeSpinAt,
  isSignedIn,
  onResult,
}: {
  drops: number;
  lastFreeSpinAt: string | null;
  isSignedIn: boolean;
  onResult: () => void;
}) {
  const { play } = useSound();
  const haptic = useHaptics();

  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<{ value: number; free: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* A ticking clock, so "free in 42m" counts down rather than going stale
     until the screen happens to re-render. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const free = freeSpinReady(lastFreeSpinAt, now);
  const wait = freeSpinIn(lastFreeSpinAt, now);
  const canPay = drops >= SPIN_COST;

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const doSpin = useCallback(async () => {
    if (spinning || !isSignedIn) return;
    if (!free && !canPay) { setError(`You need ${SPIN_COST} Drops to spin.`); return; }

    setSpinning(true);
    setError(null);
    setWon(null);
    play('tap');
    haptic('medium');

    const res = await spinWheel(!free);
    if ('error' in res) {
      setSpinning(false);
      setError(
        res.error === 'insufficient_drops' ? `You need ${SPIN_COST} Drops to spin.`
          : res.error === 'free_spin_not_ready' ? 'Your free spin is not ready yet.'
          : res.error === 'not_signed_in' ? 'Sign in to spin.'
          : 'Could not spin. Try again.',
      );
      return;
    }

    /*
      Land the POINTER on the winning segment.

      landingAngle returns an ABSOLUTE rotation, not a delta. The first
      version added `360*5 + (360 - centre)` to the current angle, which is
      right exactly once -- after the wheel has turned, adding an absolute
      landing position lands somewhere else. Spin one was correct and every
      spin after it drifted, so the wheel stopped on a different prize than
      the one the server had already paid.
    */
    setAngle((a) => landingAngle(res.index, a));

    /*
      The balance is already correct server-side, so refresh it now rather
      than after the animation: the shop tiles above unlock the instant the
      Drops land, and nothing has to be reloaded by hand.

      The PRIZE is still revealed only when the wheel stops -- telling you
      what you won while it is still turning removes the only reason to
      watch it.
    */
    onResult();

    timer.current = setTimeout(() => {
      setSpinning(false);
      setWon({ value: res.value, free: res.freeUsed });
      if (res.value >= 500) { play('legendary'); haptic('success'); }
      else if (res.value > 0) { play('tap'); haptic('light'); }
      else { haptic('light'); }
    }, 4200);
  }, [spinning, isSignedIn, free, canPay, play, haptic, onResult]);

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        padding: 18, borderRadius: 'var(--radius-lg)',
        background: 'var(--glass-regular)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: 'var(--border-hair)',
        boxShadow: 'var(--glass-edge)',
      }}
    >
      <div style={{ alignSelf: 'flex-start' }}>
        <div style={{ font: '400 20px/1 var(--font-title)', textTransform: 'uppercase', color: 'var(--ink)' }}>
          Daily Spin
        </div>
        <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-40)', marginTop: 6 }}>
          {free ? 'FREE SPIN READY' : `FREE IN ${formatWait(wait).toUpperCase()} · ${SPIN_COST} DROPS TO SPIN NOW`}
        </div>
      </div>

      <div style={{ position: 'relative', width: 230, height: 230 }}>
        {/* Pointer, fixed at the top. The wheel turns under it. */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: -2, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, zIndex: 3,
            borderLeft: '9px solid transparent',
            borderRight: '9px solid transparent',
            borderTop: '16px solid var(--ink)',
          }}
        />

        <div
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            border: '3px solid var(--hairline)',
            position: 'relative', overflow: 'hidden',
            transform: `rotate(${angle}deg)`,
            transition: spinning
              // A long ease-out is what makes it feel like a wheel losing
              // momentum rather than a value snapping into place.
              ? 'transform 4s cubic-bezier(0.16, 1, 0.3, 1)'
              : 'none',
            background: `conic-gradient(${WHEEL.map((s, i) => {
              const tone = segTone(s.value);
              return `${tone} ${i * SEG}deg ${(i + 1) * SEG}deg`;
            }).join(', ')})`,
          }}
        >
          {WHEEL.map((s, i) => (
            <span
              key={i}
              style={{
                position: 'absolute', left: '50%', top: '50%',
                transform: `rotate(${i * SEG + SEG / 2}deg) translateY(-78px)`,
                transformOrigin: '0 0',
                font: '700 11px/1 var(--font-stat)',
                color: 'var(--ink-on-neon)',
                whiteSpace: 'nowrap',
              }}
            >
              {s.label === 'BETTER LUCK' ? '—' : s.label}
            </span>
          ))}
        </div>
      </div>

      {/* The result, in words. Colour alone would not say what happened. */}
      <div style={{ minHeight: 34, display: 'grid', placeItems: 'center' }} role="status">
        {won && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                font: '400 22px/1 var(--font-title)', textTransform: 'uppercase',
                color: won.value > 0 ? 'var(--neon-mint)' : 'var(--ink-40)',
              }}
            >
              {won.value > 0
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    +<DropsAmount value={won.value} size={22} tone="var(--neon-mint)" weight={400} />
                  </span>
                : 'BETTER LUCK NEXT TIME'}
            </div>
            <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-40)', marginTop: 6 }}>
              {won.free ? 'FREE SPIN USED' : `${SPIN_COST} DROPS SPENT`}
            </div>
          </div>
        )}
        {error && (
          <div style={{ font: '500 11px/1.4 var(--font-body)', color: 'var(--neon-pink)' }}>{error}</div>
        )}
      </div>

      <button
        data-press
        onClick={() => void doSpin()}
        disabled={spinning || !isSignedIn || (!free && !canPay)}
        style={{
          width: '100%',
          font: '700 11px/1 var(--font-tele)', letterSpacing: '.16em',
          padding: '15px 0', borderRadius: 'var(--radius-pill)',
          background: free ? 'var(--neon-pink)' : 'var(--surface-inset)',
          color: free ? 'var(--ink-on-neon)' : 'var(--ink)',
          border: free ? '1px solid transparent' : 'var(--border-hair)',
          opacity: spinning || !isSignedIn || (!free && !canPay) ? 0.45 : 1,
        }}
      >
        {spinning ? 'SPINNING…'
          : !isSignedIn ? 'SIGN IN TO SPIN'
          : free ? 'SPIN FREE'
          : canPay ? `SPIN · ${SPIN_COST}`
          : `NEED ${SPIN_COST - drops} MORE DROPS`}
      </button>
    </div>
  );
}
