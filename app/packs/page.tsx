'use client';

/**
 * Screen 04 — Pack Opening.
 * Four-stage tap sequence: sealed → tear → flip → settle.
 *
 * The legendary here comes from the milestone path (CLAUDE.md §3, path 1) —
 * a guaranteed pull, never probability-scaled. That is precisely what makes
 * the demo's key moment triggerable on cue.
 */

import { useState, useCallback } from 'react';
import { SongCardView } from '@/components/SongCardView';
import { PhoneShell } from '@/components/PhoneChrome';
import { useCards } from '@/lib/useCards';
import { useSound } from '@/lib/useSound';
import { useHaptics } from '@/lib/useHaptics';

const STEP_LABEL = ['SEALED · SERIES 01', 'TEARING', 'FLIPPING', 'LEGENDARY PULL'];
const STEP_CTA = ['TAP TO TEAR', 'TAP TO SLIDE IT OUT', 'TAP TO SETTLE', 'TAP TO OPEN ANOTHER'];

const TORN_CLIP =
  'polygon(0 14%,9% 10%,20% 15%,32% 9%,45% 15%,58% 9%,70% 15%,82% 10%,92% 15%,100% 11%,100% 100%,0 100%)';

export default function PacksScreen() {
  const [stage, setStage] = useState(0);
  const { play } = useSound();
  const haptic = useHaptics();
  const { cards } = useCards();
  // Guaranteed legendary — the milestone path (CLAUDE.md §3), never scaled odds.
  const pulled = cards.find((c) => c.rarity === 'legendary') ?? cards[0];

  const advance = useCallback(() => {
    setStage((s) => {
      const next = s >= 3 ? 0 : s + 1;
      if (next === 1) { play('packTear'); haptic('medium'); }
      else if (next === 3) { play('legendary'); haptic('success'); }
      else if (next !== 0) { play('tap'); haptic('light'); }
      return next;
    });
  }, [play, haptic]);

  const packVisible = stage < 3;
  const cardOut = stage >= 1;
  const spot = stage >= 2;

  const revealTransform =
    stage === 0
      ? 'translate(-50%,0) scale(.9)'
      : stage === 1
        ? 'translate(-50%,-150px) scale(.96)'
        : stage === 2
          ? 'translate(-50%,-190px) scale(1.02)'
          : 'translate(-50%,-200px) scale(1.06)';

  return (
    <PhoneShell>
      <div
        onClick={advance}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); advance(); } }}
        aria-label={`Pack opening, ${STEP_LABEL[stage]}. ${STEP_CTA[stage]}`}
        style={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: 20,
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            font: '400 9px/1 var(--font-tele)',
            letterSpacing: '.24em',
            color: 'var(--neon-pink)',
            marginBottom: 'auto',
            paddingTop: 20,
          }}
        >
          {STEP_LABEL[stage]}
        </div>

        {/* Spotlight behind the reveal */}
        {spot && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              top: '38%',
              width: 460,
              height: 460,
              transform: 'translate(-50%,-50%)',
              background: 'radial-gradient(circle,rgba(255,216,77,.22),transparent 65%)',
              animation: 'spotgrow .7s ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        )}

        <div style={{ position: 'relative', width: '100%', height: 380, flexShrink: 0 }}>
          {/* The pack */}
          {packVisible && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 90,
                transform: 'translateX(-50%)',
                width: 176,
                height: 244,
                borderRadius: 14,
                background: 'linear-gradient(150deg,#1b1130,#3b1050 55%,#12081f)',
                border: '1px solid rgba(255,255,255,.14)',
                clipPath: stage >= 1 ? TORN_CLIP : undefined,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'clip-path .4s ease',
                zIndex: 5,
              }}
            >
              <span
                style={{
                  font: '400 34px/0.92 var(--font-title)',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  background: 'linear-gradient(92deg,#fff,#ffd84d)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Aux
                <br />
                Pack
              </span>
              <span style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em', color: 'var(--ink-40)' }}>
                5 CARDS · SERIES 01
              </span>
            </div>
          )}

          {/* The pulled card */}
          {cardOut && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 150,
                transform: revealTransform,
                transition: 'transform .55s cubic-bezier(.2,.7,.3,1)',
                zIndex: 10,
              }}
            >
              <SongCardView card={pulled} size="lg" showSerial showFlavor={stage >= 3} />
            </div>
          )}
        </div>

        <div
          style={{
            font: '700 10px/1 var(--font-tele)',
            letterSpacing: '.2em',
            color: 'var(--ink-40)',
            marginTop: 'auto',
            paddingBottom: 24,
          }}
        >
          {STEP_CTA[stage]}
        </div>
      </div>
    </PhoneShell>
  );
}
