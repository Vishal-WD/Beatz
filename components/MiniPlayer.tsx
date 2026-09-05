'use client';

/**
 * The now-playing bar, above the tabs.
 *
 * Mounted in PhoneShell rather than on any one screen, so it survives
 * navigation — which is the whole point. It renders nothing at all when the
 * player is idle, so a screen with no music has no bar and loses no space.
 *
 * It is deliberately not a full player: artwork, title, a play/pause and a
 * skip. Everything else lives on the screen the music came from.
 */

import { usePlayer } from '@/lib/usePlayer';
import { rarityTextVar } from '@/lib/rarity';

export function MiniPlayer() {
  const player = usePlayer();
  const { card, state, elapsed, duration, playing } = player;

  if (!card) return null;

  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: 'var(--border-hair)',
        background: 'var(--glass-thick)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        boxShadow: 'var(--glass-edge)',
        position: 'relative',
      }}
    >
      {/* Progress, as a hairline across the top edge — a full bar would
          compete with the tab bar directly beneath it. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'var(--hairline)',
        }}
      >
        <div
          style={{
            width: `${pct}%`, height: '100%',
            background: rarityTextVar(card.rarity),
            transition: 'width .25s linear',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px' }}>
        {card.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.artworkUrl}
            alt=""
            style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <span style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--art-slot)', flexShrink: 0 }} />
        )}

        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block', font: '600 12px/1.25 var(--font-body)', color: 'var(--ink)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {card.title}
          </span>
          <span
            style={{
              display: 'block', font: '400 10px/1.3 var(--font-body)', color: 'var(--ink-40)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {/* The state is said in words. A stalled track that only stopped
                animating would look identical to a paused one. */}
            {state === 'error' ? 'Could not play this one'
              : state === 'loading' ? 'Buffering…'
              : card.subtitle}
          </span>
        </span>

        <button
          data-press
          onClick={player.toggle}
          aria-label={playing ? `Pause ${card.title}` : `Play ${card.title}`}
          style={{
            width: 38, height: 38, borderRadius: 'var(--radius-pill)', flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: 'var(--surface-inset)', border: 'var(--border-hair)',
            color: 'var(--ink)',
          }}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="4" width="4" height="16" rx="1.4" />
              <rect x="14" y="4" width="4" height="16" rx="1.4" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.2v13.6a.8.8 0 0 0 1.23.68l10.3-6.8a.8.8 0 0 0 0-1.36L9.23 4.52A.8.8 0 0 0 8 5.2Z" />
            </svg>
          )}
        </button>

        <button
          data-press
          onClick={player.next}
          aria-label="Next track"
          style={{
            width: 38, height: 38, borderRadius: 'var(--radius-pill)', flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 'none', color: 'var(--ink-60)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M6 5.2v13.6a.8.8 0 0 0 1.23.68l8.3-6.8a.8.8 0 0 0 0-1.36L7.23 4.52A.8.8 0 0 0 6 5.2Z" />
            <rect x="17" y="4" width="3" height="16" rx="1.3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
