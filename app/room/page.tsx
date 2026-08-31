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
import { vibeColor, avatarFor } from '@/lib/rarity';
import { CHALLENGER_QUEUE, NEXT_UP } from '@/lib/seed-data';
import { useCards } from '@/lib/useCards';

const RING_CIRCUMFERENCE = 1131; // 2πr, r=180

interface Shard {
  id: number;
  style: React.CSSProperties;
}

export default function ThroneRoom() {
  const { cards } = useCards();
  const nowPlaying = cards.find((c) => c.rarity === 'epic') ?? cards[0];
  const [peak, setPeak] = useState(false);
  const [shards, setShards] = useState<Shard[]>([]);
  const { vibe, firePeak } = useVibe({ stamina: nowPlaying.stamina, initialVibe: 62 });
  const { play } = useSound();
  const peakTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The peak timeout previously outlived the component: navigating away
  // mid-burst fired setState on an unmounted tree.
  useEffect(() => () => clearTimeout(peakTimer.current), []);

  const onPeak = useCallback(() => {
    // 54 shards, matching the design prototype's burst.
    const next: Shard[] = Array.from({ length: 54 }, (_, id) => {
      const a = Math.random() * Math.PI * 2;
      const d = 180 + Math.random() * 380;
      const c = ['#ffd84d', '#ff2e88', '#4ce3ff', '#7dffc3', '#fff'][
        Math.floor(Math.random() * 5)
      ];
      return {
        id,
        style: {
          position: 'absolute',
          left: '50%',
          top: '46%',
          width: 3 + Math.random() * 7,
          height: 8 + Math.random() * 18,
          background: c,
          borderRadius: 2,
          ['--tx' as string]: `${Math.cos(a) * d}px`,
          ['--ty' as string]: `${Math.sin(a) * d}px`,
          ['--rot' as string]: `${Math.round(Math.random() * 720 - 360)}deg`,
          animation: `shard ${1.1 + Math.random() * 0.7}s cubic-bezier(.2,.7,.3,1) ${
            Math.random() * 0.18
          }s forwards`,
        },
      };
    });
    setShards(next);
    setPeak(true);
    firePeak();
    play('peak');
    clearTimeout(peakTimer.current);
    peakTimer.current = setTimeout(() => {
      setPeak(false);
      setShards([]);
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
              background: 'linear-gradient(92deg,#fff 10%,#4ce3ff 48%,#ff2e88 88%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AuxWars
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
              background: 'rgba(255,216,77,.12)',
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
        {CHALLENGER_QUEUE.map((c) => (
          <div key={c.initials} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <circle cx="210" cy="210" r="180" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="16" />
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
            {NEXT_UP.map((c) => (
              <div
                key={c.initials}
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
          <div style={{ font: '400 20px/1 var(--font-title)', textTransform: 'uppercase' }}>{nowPlaying.title}</div>
          <div style={{ font: '500 9px/1 var(--font-tele)', letterSpacing: '.12em', color: 'var(--ink-40)', marginTop: 5 }}>
            {nowPlaying.subtitle}
          </div>
          <div style={{ marginTop: 12 }}>
            <NowPlaying card={nowPlaying} vibe={vibe} compact />
          </div>
        </div>
      </div>

      {/* Peak Moment overlay */}
      {peak && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,216,77,.14)', animation: 'flash .9s ease-out forwards' }} />
          {shards.map((s) => (
            <div key={s.id} style={s.style} />
          ))}
          <div
            style={{
              position: 'absolute', left: '50%', top: '46%',
              transform: 'translate(-50%,-50%)', textAlign: 'center',
            }}
          >
            <div style={{ font: '400 56px/1 var(--font-title)', textTransform: 'uppercase', color: 'var(--neon-gold)' }}>
              Peak Moment
            </div>
            <div style={{ font: '700 12px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink)', marginTop: 10 }}>
              REIGN EXTENDED · +140 DROPS
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
