'use client';

/**
 * Screen 01 — The Throne Room.
 * Shared display, 1280×720. Not a phone screen: this is the TV/projector view
 * everyone in the room watches (CLAUDE.md §7.1).
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useVibe } from '@/lib/useVibe';
import { useSound } from '@/lib/useSound';
import { VibeMeter } from '@/components/VibeMeter';
import { NowPlaying } from '@/components/NowPlaying';
import { PeakMomentBurst } from '@/components/PeakMomentBurst';
import { vibeColor, avatarFor } from '@/lib/rarity';
import { fetchChallengerLine, subscribeToRoom, type LinePlayer, type DbRoom } from '@/lib/supabase';
import { useCards } from '@/lib/useCards';

const RING_CIRCUMFERENCE = 1131; // 2πr, r=180

/** The room this shared display is showing. */
const ROOM_SLUG = 'last-train-disco';

export default function ThroneRoom() {
  const { cards } = useCards();
  const [dbRoom, setDbRoom] = useState<DbRoom | null>(null);
  const [line, setLine] = useState<LinePlayer[]>([]);

  /*
    The queue used to be a fixture of invented initials rendered as though
    those players were in the room. This is the 1280x720 display an audience
    watches, so a fabricated line is the worst place in the app to have one.
    An empty line now reads as empty rather than as four waiting strangers.
  */
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeToRoom(ROOM_SLUG, (r) => !cancelled && setDbRoom(r));
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!dbRoom?.id) return;
    let cancelled = false;
    void fetchChallengerLine(dbRoom.id).then((l) => !cancelled && setLine(l));
    return () => { cancelled = true; };
  }, [dbRoom?.id]);
  /*
    An empty pool is reachable now that useCards has no fixture fallback —
    prerendering has no database at all, which is what caught this: the old
    `?? cards[0]` handed undefined straight to useVibe and crashed the
    static export.

    Hooks cannot be called conditionally, so useVibe still runs on neutral
    stats and the SCREEN decides whether there is anything to show. Same
    reasoning as the challenger line above: this is the display an audience
    watches, so it says nothing rather than something invented.
  */
  const nowPlaying = cards.find((c) => c.rarity === 'epic') ?? cards[0] ?? null;
  const [peak, setPeak] = useState(false);
  const { vibe, firePeak } = useVibe({
    stamina: nowPlaying?.stamina ?? 50,
    hype: nowPlaying?.hype ?? 50,
    control: 'contested',
  });
  const { play } = useSound();
  const peakTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The peak timeout previously outlived the component: navigating away
  // mid-burst fired setState on an unmounted tree.
  useEffect(() => () => clearTimeout(peakTimer.current), []);

  const onPeak = useCallback(() => {
    setPeak(true);
    firePeak();
    play('peak');
    clearTimeout(peakTimer.current);
    peakTimer.current = setTimeout(() => {
      setPeak(false);
    }, 2200);
  }, [firePeak, play]);

  const color = vibeColor(vibe);
  const offset = useMemo(
    () => Math.round(RING_CIRCUMFERENCE * (1 - vibe / 100)),
    [vibe],
  );

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100dvh',
        background: 'var(--stage-black)',
        display: 'grid',
        gridTemplateColumns: '260px 1fr 300px',
        gridTemplateRows: 'auto 1fr auto',
        gap: 20,
        padding: 28,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div
            style={{
              font: '400 34px/1 var(--font-title)',
              textTransform: 'uppercase',
              background: 'linear-gradient(92deg,var(--ink) 10%,var(--neon-cyan) 48%,var(--neon-pink) 88%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Beatz
          </div>
          <div style={{ font: '400 10px/1 var(--font-tele)', letterSpacing: '.22em', color: 'var(--ink-40)', marginTop: 5 }}>
            ROOM · BASEMENT 4AM
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)' }}>REIGN</div>
            <div style={{ font: '700 26px/1 var(--font-stat)', color: 'var(--ink)', marginTop: 3 }}>07:41</div>
          </div>
          <button
            onClick={onPeak}
            aria-label="Trigger a Peak Moment"
            style={{
              font: '700 10px/1 var(--font-tele)',
              letterSpacing: '.14em',
              padding: '11px 15px',
              borderRadius: 8,
              background: 'var(--gold-wash)',
              border: '1px solid var(--neon-gold)',
              color: 'var(--neon-gold)',
            }}
          >
            TRIGGER PEAK
          </button>
        </div>
      </div>

      {/* Challenger Line */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)' }}>
          CHALLENGER LINE
        </div>
        {line.length === 0 && (
          <div style={{ font: '400 10px/1.6 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-25)' }}>
            NO CHALLENGERS · THRONE UNCONTESTED
          </div>
        )}
        {line.map((c) => (
          <div key={c.playerId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 42, height: 42, borderRadius: 12,
                background: avatarFor(c.initials),
                display: 'grid', placeItems: 'center',
                font: '700 14px/1 var(--font-stat)',
              }}
            >
              {c.initials}
            </div>
            <span style={{ font: '400 11px/1 var(--font-tele)', color: 'var(--ink-40)' }}>#{c.position}</span>
          </div>
        ))}
      </div>

      {/* Vibe ring + throne holder */}
      <div style={{ display: 'grid', placeItems: 'center', position: 'relative' }}>
        <div style={{ position: 'relative', width: 420, height: 420, maxWidth: '100%' }}>
          <svg viewBox="0 0 420 420" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="210" cy="210" r="180" fill="none" style={{ stroke: 'var(--hairline)' }} strokeWidth="16" />
            <circle
              cx="210" cy="210" r="180" fill="none" strokeWidth="16" strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              stroke={color}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset .42s linear, stroke .42s linear', filter: `drop-shadow(0 0 12px ${color})` }}
            />
          </svg>

          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <div
              style={{
                width: 92, height: 92, borderRadius: 26,
                background: avatarFor('MJ'),
                display: 'grid', placeItems: 'center',
                font: '700 30px/1 var(--font-stat)',
                animation: 'beat 1.4s ease-in-out infinite',
              }}
            >
              MJ
            </div>
            <div style={{ font: '400 24px/1 var(--font-title)', textTransform: 'uppercase', marginTop: 8 }}>Maya J.</div>
            <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--neon-gold)' }}>
              HOLDS THE THRONE
            </div>
            <div style={{ marginTop: 10 }}>
              <VibeMeter vibe={vibe} size="lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Next up + now playing */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)', marginBottom: 10 }}>
            NEXT UP
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {line.length === 0 && (
              <span style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-25)' }}>
                NOBODY WAITING
              </span>
            )}
            {/* Same line, front three — not a second source that can disagree. */}
            {line.slice(0, 3).map((c) => (
              <div
                key={c.playerId}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: avatarFor(c.initials),
                  display: 'grid', placeItems: 'center',
                  font: '700 12px/1 var(--font-stat)',
                  animation: 'queue 2.4s ease-in-out infinite',
                }}
              >
                {c.initials}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'auto', background: 'var(--booth-panel)', borderRadius: 14, padding: 14, border: '1px solid var(--hairline)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--neon-mint)' }} />
            <span style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--neon-mint)' }}>
              LIVE FROM DESKTOP
            </span>
          </div>
          {nowPlaying ? (
            <>
              <div style={{ font: '400 20px/1 var(--font-title)', textTransform: 'uppercase' }}>{nowPlaying.title}</div>
              <div style={{ font: '500 9px/1 var(--font-tele)', letterSpacing: '.12em', color: 'var(--ink-40)', marginTop: 5 }}>
                {nowPlaying.subtitle}
              </div>
              <div style={{ marginTop: 12 }}>
                <NowPlaying card={nowPlaying} vibe={vibe} compact />
              </div>
            </>
          ) : (
            <div style={{ font: '400 9px/1.6 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-25)' }}>
              NOTHING PLAYING YET
            </div>
          )}
        </div>
      </div>

      {/* Peak Moment overlay — artwork, not theming; see components/PeakMomentBurst.tsx */}
      <PeakMomentBurst active={peak} />
    </div>
  );
}
