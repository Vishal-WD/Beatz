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
import { DropsAmount, DropsIcon } from '@/components/DropsIcon';
import { spinWheel } from '@/lib/supabase';
import { useSound } from '@/lib/useSound';
import { useHaptics } from '@/lib/useHaptics';

const SEG = 360 / WHEEL.length;

/**
 * Colour per prize.
 *
 * One colour per VALUE, not per index. The first version alternated a light
 * and dark shade within each tier to stop neighbouring slices merging — but
 * that made the two 100s look like different prizes, and washed the 1000 out
 * to a pale yellow that read as less valuable than the 500 beside it. The
 * spokes already separate adjacent slices, so the alternation was solving a
 * problem that no longer existed.
 *
 * The ladder now reads by colour alone: gold is the jackpot, pink is the
 * near-miss, and the blank is plainly inert.
 */
function segTone(value: number): string {
  if (value >= 1000) return '#ffc400';   // gold — the jackpot
  if (value >= 500) return '#ff2e6b';    // hot pink
  if (value >= 250) return '#a855f7';    // violet
  if (value >= 100) return '#22b8ef';    // cyan
  if (value > 0) return '#4ad9a4';       // mint, the smallest win
  return '#4a4658';                      // blank: flat, unmistakably nothing
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
            position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, zIndex: 4,
            borderLeft: '11px solid transparent',
            borderRight: '11px solid transparent',
            // Points DOWN into the wheel, sitting above the new gold rim.
            borderTop: '20px solid var(--ink)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))',
          }}
        />

        <div
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            // A gold rim with an outer glow, so the wheel reads as an object
            // rather than a flat pie chart.
            border: '4px solid var(--neon-gold)',
            boxShadow: '0 0 0 2px rgba(0,0,0,.45), 0 10px 30px rgba(0,0,0,.5), inset 0 0 22px rgba(0,0,0,.55)',
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
          {/*
            Spokes as a conic-gradient overlay rather than rotated divs.

            A 2px-wide element rotated 51 degrees keeps an axis-aligned
            bounding box, so those "hairlines" were painting as 109x27 and
            88x71 dark wedges over the slices — which is the colour overlap
            that made the wheel look wrong. A gradient has no box to rotate.
          */}
          <span
            aria-hidden
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              pointerEvents: 'none',
              background: `repeating-conic-gradient(
                rgba(0,0,0,.42) 0deg 0.7deg,
                transparent 0.7deg ${SEG}deg
              )`,
            }}
          />

          {/* A single specular sheen across the top, which is what stops a
              conic-gradient looking like a spreadsheet chart. */}
          <span
            aria-hidden
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'radial-gradient(circle at 32% 24%, rgba(255,255,255,.30), transparent 52%)',
              pointerEvents: 'none',
            }}
          />
          {WHEEL.map((s, i) => (
            <span
              key={i}
              style={{
                position: 'absolute', left: '50%', top: '50%',
                transform: `rotate(${i * SEG + SEG / 2}deg) translateY(-78px)`,
                transformOrigin: '0 0',
                font: '700 12px/1 var(--font-stat)',
                color: '#1a1526',
                textShadow: '0 1px 0 rgba(255,255,255,.35)',
                whiteSpace: 'nowrap',
                zIndex: 1,
              }}
            >
              {s.label === 'BETTER LUCK' ? '—' : s.label}
            </span>
          ))}
        </div>

        {/* Hub, over the spokes' meeting point — which would otherwise be a
            visible knot of overlapping lines. */}
        <span
          aria-hidden
          style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 46, height: 46, marginLeft: -23, marginTop: -23,
            borderRadius: '50%', zIndex: 2,
            background: 'radial-gradient(circle at 38% 32%, #2a2340, #14101f)',
            border: '2px solid var(--neon-gold)',
            boxShadow: '0 4px 14px rgba(0,0,0,.55)',
            display: 'grid', placeItems: 'center',
          }}
        >
          <DropsIcon size={18} />
        </span>
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
