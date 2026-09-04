'use client';

/**
 * Screen — Feed. Tonight's events as a wall of tiles.
 *
 * Each tile is illustrated by the artwork of cards actually played in that
 * event's room, so a night looks like the music that happened there. A
 * night nobody has played in yet shows its poster gradient — never a
 * partial grid, and never a placeholder tile, which is the fixture problem
 * this redesign removes.
 *
 * A tile is labelled by its room's FORMAT, not the event's kind: the format
 * is the control model the night actually runs (CLAUDE.md §1.1), while kind
 * is only a listing category. Every tile links to the event, which resolves
 * into that room — an event that opens into nothing would be drift (§1.2).
 */

import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneChrome';
import { EmptyState } from '@/components/ui';
import { collageFor, type FeedTile } from '@/lib/domain/collage';
import { FORMATS, type FormatId } from '@/lib/domain/formats';
import { relativeTime } from '@/lib/social-data';
import { useFeed } from '@/lib/useFeed';

const formatLabel = (f: string | null): string =>
  f && f in FORMATS ? FORMATS[f as FormatId].label.toUpperCase() : 'ROOM';

function Tile({ tile }: { tile: FeedTile }) {
  const cells = collageFor(tile.artwork);
  const live = tile.status === 'live';

  return (
    <Link
      href={`/events/${tile.slug}`}
      style={{ display: 'block', border: 'var(--border-hair)', textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{ position: 'relative', aspectRatio: '1 / 1', background: tile.posterGradient }}>
        {cells.length > 0 && (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
            }}
          >
            {cells.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ))}
          </div>
        )}

        {live && (
          <div
            style={{
              position: 'absolute', top: 'var(--sp-2)', left: 'var(--sp-2)',
              display: 'flex', alignItems: 'center', gap: 'var(--sp-1)',
              background: 'var(--scrim)', padding: '3px 6px',
            }}
          >
            <span
              data-live-pulse
              style={{
                width: 'var(--mark-size)', height: 'var(--mark-size)', borderRadius: '50%',
                background: 'var(--neon-pink)', animation: 'feed-pulse 1.4s ease-in-out infinite',
              }}
            />
            <span
              style={{
                font: '700 8px/1 var(--font-tele)', letterSpacing: '.16em',
                color: 'var(--ink-fixed)',
              }}
            >
              LIVE
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: 'var(--sp-2)' }}>
        <div
          style={{
            font: '400 8px/1 var(--font-tele)', letterSpacing: '.16em',
            color: 'var(--ink-40)', marginBottom: 'var(--sp-1)',
          }}
        >
          {formatLabel(tile.format)}
        </div>
        <div style={{ font: '400 15px/1.1 var(--font-title)', textTransform: 'uppercase' }}>
          {tile.title}
        </div>
        <div
          style={{
            marginTop: 'var(--sp-1)',
            font: '400 10px/1.3 var(--font-body)', color: 'var(--ink-60)',
          }}
        >
          {live ? 'live now' : relativeTime(tile.startsAt)}
        </div>
      </div>
    </Link>
  );
}

export default function FeedScreen() {
  const { tiles, state } = useFeed();

  return (
    <PhoneShell>
      {/* Scoped here rather than globals.css: nothing else pulses. */}
      <style>{`
        @keyframes feed-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }
        @media (prefers-reduced-motion: reduce) {
          [data-live-pulse] { animation: none !important }
        }
      `}</style>

      <div style={{ padding: '4px 16px 24px' }}>
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <div style={{ font: '400 26px/1 var(--font-title)', textTransform: 'uppercase' }}>Feed</div>
          <div
            style={{
              font: '400 8px/1 var(--font-tele)', letterSpacing: '.2em',
              color: 'var(--neon-pink)', marginTop: 6,
            }}
          >
            {tiles.filter((t) => t.status === 'live').length} LIVE · {tiles.length} SCHEDULED
          </div>
        </div>

        {state === 'loading' ? (
          <div
            data-feed-skeleton
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ border: 'var(--border-hair)' }}>
                <div style={{ aspectRatio: '1 / 1', background: 'var(--surface-inset)' }} />
                <div style={{ padding: 'var(--sp-2)' }}>
                  <div style={{ height: 8, width: '45%', background: 'var(--surface-inset)' }} />
                  <div style={{ height: 14, width: '80%', background: 'var(--surface-inset)', marginTop: 'var(--sp-2)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : tiles.length === 0 ? (
          <EmptyState
            title="NOTHING SCHEDULED YET"
            hint="Host a night, or wait for someone to put one on."
          />
        ) : (
          <div
            data-feed-grid
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}
          >
            {tiles.map((t) => (
              <Tile key={t.eventId} tile={t} />
            ))}
          </div>
        )}
      </div>
    </PhoneShell>
  );
}
