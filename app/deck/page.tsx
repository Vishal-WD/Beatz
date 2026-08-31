'use client';

/**
 * Screen 02 — Deck & Hand.
 * Playing a card onto the deck slot is the ONLY way to start a reign
 * (CLAUDE.md §1).
 */

import { useState, useMemo, useCallback } from 'react';
import { SongCardView } from '@/components/SongCardView';
import { PhoneShell } from '@/components/PhoneChrome';
import { NowPlaying } from '@/components/NowPlaying';
import { VibeMeter } from '@/components/VibeMeter';
import { useVibe } from '@/lib/useVibe';
import { useSound } from '@/lib/useSound';
import { useHaptics } from '@/lib/useHaptics';
import { useRoom, MODE_LABEL } from '@/lib/useRoom';
import { vibeColor, RARITY } from '@/lib/rarity';
import { useCards, SOURCE_LABEL } from '@/lib/useCards';
import { useAuth } from '@/lib/useAuth';

export default function DeckScreen() {
  const [deckId, setDeckId] = useState<string | null>(null);
  const { play } = useSound();
  const haptic = useHaptics();
  const { cards, source } = useCards();
  const { profile, isSignedIn } = useAuth();

  // A hand that spans rarities, so the hype/stamina trade-off is visible.
  const hand5 = useMemo(() => {
    const byTier = (r: string, n = 0) => cards.filter((c) => c.rarity === r)[n];
    return [byTier('legendary'), byTier('epic'), byTier('rare'),
            byTier('epic', 1) ?? byTier('rare', 1), byTier('common') ?? byTier('rare', 2)]
      .filter(Boolean).slice(0, 5);
  }, [cards]);

  // Connects to the hosted server when one is configured; otherwise falls
  // back to local simulation and SAYS so via the badge below.
  const { mode, setHolding: pushHold } = useRoom({
    roomId: 'basement-4am',
    playerId: profile.id,
    displayName: profile.display_name,
  });

  const deckCard = useMemo(() => hand5.find((c) => c.id === deckId) ?? null, [hand5, deckId]);
  const hand = useMemo(() => hand5.filter((c) => c.id !== deckId), [hand5, deckId]);

  const { vibe, holding, holdPct, startHold, endHold } = useVibe({
    stamina: deckCard?.stamina ?? 60,
    initialVibe: 62,
  });

  const color = vibeColor(vibe);

  const onPlayCard = useCallback((id: string) => {
    setDeckId(id);
    play('cardPlay');
    haptic('medium');
  }, [play, haptic]);

  const onHoldStart = useCallback(() => {
    startHold();
    pushHold(true);
    haptic('light');
  }, [startHold, pushHold, haptic]);

  const onHoldEnd = useCallback(() => {
    endHold();
    pushHold(false);
  }, [endHold, pushHold]);

  const onCritical = useCallback(() => {
    play('warn');
    haptic('warning');
  }, [play, haptic]);

  return (
    <PhoneShell>
      <div style={{ padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Player header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)' }}>
              YOU ARE
            </div>
            <div style={{ font: '400 22px/1 var(--font-title)', textTransform: 'uppercase', marginTop: 5 }}>
              {isSignedIn ? profile.display_name : 'Challenger #2'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)' }}>
              DROPS
            </div>
            <div style={{ font: '700 22px/1 var(--font-stat)', color: 'var(--neon-gold)', marginTop: 4 }}>
              {profile.drops.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Live reign strip */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 12px', borderRadius: 10,
            background: 'var(--booth-panel)', border: '1px solid var(--hairline)',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 3, background: color, flexShrink: 0 }} />
          <span
            style={{
              font: '500 9px/1 var(--font-tele)', letterSpacing: '.1em',
              color: 'var(--ink-60)', flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            MAYA J. HOLDS · NEON TEETH
          </span>
          <VibeMeter vibe={vibe} onCritical={onCritical} />
        </div>

        {/* Never silently simulate a multiplayer game (CLAUDE.md §6). */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:-8 }}>
          <span style={{ width:5, height:5, borderRadius:3, background: MODE_LABEL[mode].color }} />
          <span style={{ font:'400 7px/1 var(--font-tele)', letterSpacing:'.16em',
                         color: MODE_LABEL[mode].color }}>
            {MODE_LABEL[mode].text}
          </span>
          <span style={{ width:5, height:5, borderRadius:3, background: SOURCE_LABEL[source].color, marginLeft:6 }} />
          <span style={{ font:'400 7px/1 var(--font-tele)', letterSpacing:'.16em',
                         color: SOURCE_LABEL[source].color }}>
            {SOURCE_LABEL[source].text}
          </span>
        </div>

        {/*
          Deck slot. Height is clamped rather than fixed: on a short phone
          (iPhone SE) a fixed 240px pushed "Hold to Vibe" below the fold, and
          scrolling to reach the hold button mid-reign loses you the throne.
        */}
        <div
          style={{
            minHeight: 'clamp(180px, 28dvh, 240px)', borderRadius: 16,
            border: deckCard ? '1px solid rgba(255,255,255,.12)' : '2px dashed rgba(255,255,255,.14)',
            background: deckCard ? 'var(--booth-panel)' : 'transparent',
            display: 'grid', placeItems: 'center', padding: 16,
          }}
        >
          {deckCard ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <SongCardView card={deckCard} size="md" showSerial />
              <div style={{ width: '100%' }}>
                <NowPlaying card={deckCard} vibe={vibe} compact />
              </div>
              <button
                onClick={() => { setDeckId(null); play('tap'); }}
                style={{
                  font: '700 9px/1 var(--font-tele)', letterSpacing: '.16em',
                  padding: '9px 14px', borderRadius: 7,
                  border: '1px solid rgba(255,255,255,.16)', color: 'var(--ink-60)',
                }}
              >
                RETURN TO HAND
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--ink-25)' }}>
              <div style={{ font: '400 30px/1 var(--font-title)', animation: 'bob 2.6s ease-in-out infinite' }}>↑</div>
              <div style={{ font: '400 10px/1.7 var(--font-tele)', letterSpacing: '.18em', marginTop: 10 }}>
                TAP A CARD
                <br />
                TO PLAY IT
              </div>
            </div>
          )}
        </div>

        {/* Hold to Vibe */}
        <div>
          <button
            onPointerDown={onHoldStart}
            onPointerUp={onHoldEnd}
            onPointerLeave={onHoldEnd}
            onPointerCancel={onHoldEnd}
            aria-label="Hold to raise the room's vibe"
            style={{
              width: '100%', padding: '18px 0', borderRadius: 14,
              background: holding
                ? 'linear-gradient(120deg,rgba(255,46,136,.3),rgba(76,227,255,.3))'
                : 'var(--booth-panel)',
              border: `1px solid ${holding ? color : 'rgba(255,255,255,.12)'}`,
              transform: holding ? 'scale(.985)' : 'none',
              transition: 'transform .12s ease, background .2s ease, border-color .2s ease',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ font: '400 20px/1 var(--font-title)', textTransform: 'uppercase' }}>Hold to Vibe</span>
            <span style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em', color: 'var(--ink-40)' }}>
              {holding ? 'CROWD FEELS IT' : 'PRESS AND KEEP PRESSING'}
            </span>
          </button>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 7,
              font: '400 8px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-40)',
            }}
          >
            <span>CROWD 14 HOLDING</span>
            <span>YOUR PULL {holdPct}%</span>
          </div>
        </div>

        {/* Hand — fanned, tap to play */}
        <div>
          <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)', marginBottom: 12 }}>
            YOUR HAND · {hand.length}
          </div>
          <div style={{ position: 'relative', height: 'clamp(120px, 18dvh, 150px)', display: 'flex', justifyContent: 'center' }}>
            {hand.map((c, i) => {
              const mid = (hand.length - 1) / 2;
              const off = i - mid;
              return (
                <button
                  key={c.id}
                  onClick={() => onPlayCard(c.id)}
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${off * 52}px)`,
                    transform: `translateX(-50%) rotate(${off * 6}deg) translateY(${Math.abs(off) * 9}px)`,
                    transformOrigin: 'bottom center',
                    zIndex: 10 + i,
                    transition: 'transform .2s ease',
                  }}
                  /* Stats belong in the label: choosing between a high-hype
                     burner and a high-stamina holder is the whole decision. */
                  aria-label={`Play ${c.title} by ${c.subtitle}. ${RARITY[c.rarity].label}. Hype ${c.hype}, stamina ${c.stamina}.`}
                >
                  <SongCardView card={c} size="sm" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}
