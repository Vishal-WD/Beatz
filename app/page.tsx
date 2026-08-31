'use client';

/**
 * Home — entry point plus screen 03 (Song Cards · rarity ladder).
 * The ladder is a living style reference: all four tiers side by side, so a
 * rarity regression is visible immediately.
 */

import Link from 'next/link';
import { SongCardView } from '@/components/SongCardView';
import { useCards } from '@/lib/useCards';

/**
 * One card per tier, resolved by rarity rather than index so a re-seed can
 * never silently show four cards of the same tier on the style reference.
 */


const ENTRIES = [
  { href: '/deck', label: 'DECK & HAND', hint: 'play a card, hold the vibe' },
  { href: '/packs', label: 'PACK OPENING', hint: 'tear · flip · pull' },
  { href: '/profile', label: 'PROFILE', hint: 'stats, pinned, binder' },
  { href: '/chart', label: 'WORLD CHART', hint: 'offers and ranked bids' },
  { href: '/room', label: 'THRONE ROOM', hint: 'shared display · 1280×720' },
  { href: '/events', label: 'EVENTS', hint: 'disco · dj nights · rsvp' },
  { href: '/social', label: 'SOCIAL', hint: 'feed and following' },
  { href: '/signin', label: 'SIGN IN', hint: 'own your cards' },
];

export default function Home() {
  const { cards } = useCards();
  // One card per tier, resolved by rarity so a re-seed cannot show four of
  // the same tier on the style reference.
  const LADDER = (['common', 'rare', 'epic', 'legendary'] as const)
    .map((r) => cards.find((c) => c.rarity === r))
    .filter((c): c is (typeof cards)[number] => Boolean(c));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 60px' }}>
      <div style={{ font: '400 10px/1 var(--font-tele)', letterSpacing: '.24em', color: 'var(--neon-pink)' }}>
        DARK / NEON / FOIL
      </div>
      <h1
        style={{
          font: '400 clamp(48px,12vw,84px)/.9 var(--font-title)',
          textTransform: 'uppercase',
          margin: '12px 0 0',
          background: 'linear-gradient(92deg,#fff 10%,#4ce3ff 48%,#ff2e88 88%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        AuxWars
      </h1>
      <p style={{ font: '400 14px/1.65 var(--font-body)', color: 'var(--ink-60)', maxWidth: 560, marginTop: 14 }}>
        Hold the throne. Keep the vibe above the line or the next challenger takes
        the aux. Every song is a card.
      </p>

      {/* Entry points */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
          gap: 10,
          margin: '32px 0 48px',
        }}
      >
        {ENTRIES.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            style={{
              padding: '16px 14px',
              borderRadius: 12,
              background: 'var(--booth-panel)',
              border: '1px solid var(--hairline)',
              textDecoration: 'none',
              color: 'var(--ink)',
              display: 'block',
            }}
          >
            <div style={{ font: '400 17px/1 var(--font-title)', textTransform: 'uppercase' }}>{e.label}</div>
            <div style={{ font: '400 8px/1.5 var(--font-tele)', letterSpacing: '.12em', color: 'var(--ink-40)', marginTop: 6 }}>
              {e.hint.toUpperCase()}
            </div>
          </Link>
        ))}
      </div>

      {/* Rarity ladder — screen 03 */}
      <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.22em', color: 'var(--ink-40)', marginBottom: 16 }}>
        SONG CARDS · RARITY LADDER
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {LADDER.map((c) => (
          <SongCardView key={c.id} card={c} size="md" showFlavor showSerial />
        ))}
      </div>
    </div>
  );
}
