'use client';

/**
 * Screen 04 — Pack Opening.
 * Four-stage tap sequence: sealed → tear → flip → settle.
 *
 * The animation used to be all there was: it displayed a legendary picked
 * out of the global pool, spent nothing, claimed no supply, and added
 * nothing to anyone's collection. The tear now opens a real pack — Drops
 * are spent and cards are granted server-side (lib/usePacks.ts).
 */

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { SongCardView } from '@/components/SongCardView';
import { PhoneShell } from '@/components/PhoneChrome';
import { SealedPack } from '@/components/SealedPack';
import { useCards } from '@/lib/useCards';
import { useSound } from '@/lib/useSound';
import { useHaptics } from '@/lib/useHaptics';
import { usePacks } from '@/lib/usePacks';

const STEP_LABEL = ['SEALED · SERIES 01', 'TEARING', 'FLIPPING', 'PULLED'];
const STEP_CTA = ['TAP TO TEAR', 'TAP TO SLIDE IT OUT', 'TAP TO SETTLE', 'TAP FOR THE NEXT CARD'];

export default function PacksScreen() {
  const [stage, setStage] = useState(0);
  const { play } = useSound();
  const haptic = useHaptics();
  const { cards } = useCards();
  const pack = usePacks();

  // The server returns card ids; the catalogue supplies the artwork.
  const pulled = useMemo(() => {
    if (!pack.pulls?.length) return null;
    return pack.pulls
      .map((p) => cards.find((c) => c.id === p.cardId))
      .filter(Boolean);
  }, [pack.pulls, cards]);

  // Which pull is on screen. The reveal steps through the five cards
  // rather than showing a single fixed one.
  const [revealed, setRevealed] = useState(0);
  const hero = pulled?.[Math.min(revealed, pulled.length - 1)] ?? null;
  const heroPull = pack.pulls?.[Math.min(revealed, (pack.pulls?.length ?? 1) - 1)] ?? null;

  const advance = useCallback(() => {
    // Nothing to tear if the player cannot pay for it — say so instead of
    // playing an animation that grants nothing.
    if (!pack.affordable && stage === 0) return;
    if (pack.busy) return;

    // Tearing IS the purchase. Everything after is reveal.
    if (stage === 0) {
      play('packTear');
      haptic('medium');
      setRevealed(0);
      void pack.open();
      setStage(1);
      return;
    }

    setStage((s) => {
      if (s >= 3) {
        // Step through the remaining cards before offering another pack.
        const more = (pulled?.length ?? 0) - 1;
        if (revealed < more) {
          setRevealed((r) => r + 1);
          play('tap');
          haptic('light');
          return 3;
        }
        pack.reset();
        setRevealed(0);
        return 0;
      }
      const next = s + 1;
      if (next === 3) { play('legendary'); haptic('success'); }
      else { play('tap'); haptic('light'); }
      return next;
    });
  }, [play, haptic, pack, stage, pulled, revealed]);

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

        <SealedPack spotlight={spot} visible={packVisible} torn={stage >= 1} cost={pack.cost} />

        <div style={{ position: 'relative', width: '100%', height: 380, flexShrink: 0 }}>
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
              {hero ? (
                <SongCardView card={hero} size="lg" showSerial showFlavor={stage >= 3} />
              ) : (
                <div
                  style={{
                    width: 176, height: 244, borderRadius: 14,
                    border: '1px dashed var(--hairline)',
                    display: 'grid', placeItems: 'center',
                    font: '400 8px/1 var(--font-tele)', letterSpacing: '.16em',
                    color: 'var(--ink-25)',
                  }}
                >
                  {pack.busy ? 'OPENING…' : ''}
                </div>
              )}
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
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}
        >
          {/*
            Say what is actually true. A tap that cannot open a pack must
            explain itself rather than play an animation and grant nothing.
          */}
          {!pack.isSignedIn ? (
            <Link href="/signin" style={{ color: 'var(--neon-cyan)', textDecoration: 'none' }}>
              SIGN IN TO OPEN PACKS
            </Link>
          ) : pack.error ? (
            <span style={{ color: 'var(--neon-gold)' }}>{pack.error.toUpperCase()}</span>
          ) : !pack.affordable && stage === 0 ? (
            <span style={{ color: 'var(--neon-gold)' }}>
              NOT ENOUGH DROPS · {pack.cost} NEEDED · YOU HAVE {pack.drops}
            </span>
          ) : (
            <span>{STEP_CTA[stage]}</span>
          )}

          {/* CLAUDE.md §6: a sold-out tier downgrades and refunds. Show it. */}
          {stage >= 3 && heroPull?.downgraded && (
            <span style={{ font: '400 8px/1 var(--font-tele)', color: 'var(--neon-gold)' }}>
              TIER SOLD OUT · DOWNGRADED · DROPS REFUNDED
            </span>
          )}

          {stage >= 3 && pulled && (
            <span style={{ font: '400 8px/1 var(--font-tele)', color: 'var(--ink-25)' }}>
              CARD {Math.min(revealed + 1, pulled.length)} OF {pulled.length}
            </span>
          )}
        </div>
      </div>
    </PhoneShell>
  );
}
