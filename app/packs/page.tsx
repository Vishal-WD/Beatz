'use client';

/**
 * Screen 04 — Pack Opening.
 * Idle: pick one of three tiers. Once chosen: sealed → tear → flip → settle,
 * the same four-stage tap sequence as before.
 *
 * The animation used to be all there was: it displayed a legendary picked
 * out of the global pool, spent nothing, claimed no supply, and added
 * nothing to anyone's collection. The tear now opens a real pack — Drops
 * are spent and cards are granted server-side (lib/usePacks.ts). Tearing
 * used to open one implicit pack; now which tile is tapped decides what
 * gets torn.
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
import { PACKS, type PackTier } from '@/lib/domain/packs';

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

  // Tearing IS the purchase. Picking a tile both spends the Drops and
  // starts the tear; everything after is reveal.
  const selectTier = useCallback((tier: PackTier) => {
    if (pack.busy || !pack.affordable(tier)) return;
    play('packTear');
    haptic('medium');
    setRevealed(0);
    void pack.open(tier);
    setStage(1);
  }, [play, haptic, pack]);

  const advance = useCallback(() => {
    if (stage === 0) return; // stage 0 is the tier picker, not a tap target
    if (pack.busy) return;

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
  const openedDef = pack.openedTier ? PACKS[pack.openedTier] : null;

  const revealTransform =
    stage === 0
      ? 'translate(-50%,0) scale(.9)'
      : stage === 1
        ? 'translate(-50%,-150px) scale(.96)'
        : stage === 2
          ? 'translate(-50%,-190px) scale(1.02)'
          : 'translate(-50%,-200px) scale(1.06)';

  if (stage === 0) {
    return (
      <PhoneShell>
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: 20,
            gap: 20,
          }}
        >
          <div
            style={{
              font: '400 9px/1 var(--font-tele)',
              letterSpacing: '.24em',
              color: 'var(--neon-pink)',
              paddingTop: 20,
            }}
          >
            THE SHOP
          </div>

          <div
            style={{
              font: '400 9px/1 var(--font-tele)',
              letterSpacing: '.18em',
              color: 'var(--ink-40)',
            }}
          >
            {pack.isSignedIn ? `YOU HAVE ${pack.drops} DROPS` : 'PICK A TIER TO OPEN'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.values(PACKS).map((def) => {
              const affordable = pack.affordable(def.id);
              const shortfall = def.cost - pack.drops;
              const disabled = !pack.isSignedIn || !affordable;

              return (
                <button
                  key={def.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectTier(def.id)}
                  style={{
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: 18,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--booth-panel)',
                    border: 'var(--border-hair)',
                    opacity: disabled ? 0.45 : 1,
                    cursor: disabled ? 'default' : 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ font: '400 20px/1 var(--font-title)', textTransform: 'uppercase', color: 'var(--ink)' }}>
                      {def.label}
                    </span>
                    <span style={{ font: '700 13px/1 var(--font-stat)', color: 'var(--neon-gold)' }}>
                      {def.cost} DROPS
                    </span>
                  </div>

                  <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-40)' }}>
                    {def.size} CARDS
                    {def.guarantee && ' · GUARANTEED EPIC OR BETTER'}
                  </div>

                  {pack.isSignedIn && !affordable && (
                    <div style={{ font: '700 9px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--neon-gold)' }}>
                      NEED {shortfall} MORE
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {!pack.isSignedIn && (
            <Link
              href="/signin"
              style={{
                marginTop: 'auto',
                marginBottom: 24,
                textAlign: 'center',
                font: '700 10px/1 var(--font-tele)',
                letterSpacing: '.2em',
                color: 'var(--neon-cyan)',
                textDecoration: 'none',
              }}
            >
              SIGN IN TO OPEN PACKS
            </Link>
          )}
        </div>
      </PhoneShell>
    );
  }

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
          {openedDef ? `${openedDef.label} · ${STEP_LABEL[stage]}` : STEP_LABEL[stage]}
        </div>

        <SealedPack
          spotlight={spot}
          visible={packVisible}
          torn={stage >= 1}
          cost={openedDef?.cost ?? 0}
          size={openedDef?.size ?? 0}
        />

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
          {pack.error ? (
            <span style={{ color: 'var(--neon-gold)' }}>{pack.error.toUpperCase()}</span>
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
