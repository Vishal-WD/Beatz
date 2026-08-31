'use client';

/**
 * Now Playing — real music via the YouTube IFrame embed.
 *
 * The player iframe must stay >= 200x200px and visible while playing: hiding
 * or shrinking it below that violates YouTube's terms (LICENSING_RIGHTS.md
 * §2.7), and it is what keeps this app copyright-clean. We show it as the
 * card's "stage" rather than tucking it away.
 */

import { useState } from 'react';
import type { SongCard } from '@/types/cards';
import { usePlayback, fmtTime } from '@/lib/usePlayback';
import { RARITY, vibeColor } from '@/lib/rarity';

interface Props {
  card: SongCard;
  vibe?: number;
  compact?: boolean;
}

export function NowPlaying({ card, vibe = 62, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { hostRef, state, ready, error, elapsed, duration, toggle } = usePlayback({
    videoId: card.youtubeVideoId,
    autoplay: false,
  });

  const r = RARITY[card.rarity];
  const playing = state === 'playing';
  const pct = duration > 0 ? (elapsed / duration) * 100 : 0;
  const color = vibeColor(vibe);

  if (!card.youtubeVideoId) {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 12,
          background: 'var(--booth-panel)',
          border: '1px solid var(--hairline)',
          font: '400 9px/1.5 var(--font-tele)',
          letterSpacing: '.12em',
          color: 'var(--ink-25)',
        }}
      >
        NO PLAYBACK SOURCE FOR THIS CARD
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--booth-panel)',
        border: `1px solid ${playing ? color : 'var(--hairline)'}`,
        transition: 'border-color .3s ease',
      }}
    >
      {/*
        The player must stay >= 200x200 and on-screen (LICENSING_RIGHTS.md
        §2.7). It is mounted from the first render rather than on expand:
        the YouTube IFrame API replaces the host element on construction, and
        a zero-height container gave it nothing to measure, so the player
        never initialised and every play button did nothing.

        Collapsed state moves it off-screen at full size instead of shrinking
        it to zero — that keeps the required dimensions while hiding it.
      */}
      <div
        style={
          expanded
            ? { height: 200, overflow: 'hidden', background: '#000', transition: 'height .3s ease' }
            : { height: 0, overflow: 'hidden', background: '#000' }
        }
      >
        <div
          style={
            expanded
              ? { width: '100%', height: 200 }
              : // Off-screen, still 320x200: hidden without being unmeasurable.
                { position: 'fixed', left: -10000, top: 0, width: 320, height: 200, pointerEvents: 'none' }
          }
        >
          <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => {
              // `toggle()` is only meaningful once the API has constructed the
              // player. `ready` gates the button, so by the time this fires the
              // player exists — expanding is then purely about visibility.
              setExpanded(true);
              toggle();
            }}
            aria-label={playing ? `Pause ${card.title}` : `Play ${card.title}`}
            disabled={!ready && !error}
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              background: playing ? color : 'rgba(255,255,255,.06)',
              border: `1px solid ${playing ? color : 'rgba(255,255,255,.16)'}`,
              color: playing ? '#0a0812' : 'var(--ink)',
              font: '400 15px/1 var(--font-body)',
              opacity: !ready && !error ? 0.45 : 1,
              transition: 'background .2s ease',
            }}
          >
            {playing ? '❚❚' : '▶'}
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: '400 17px/1.05 var(--font-title)',
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.title}
            </div>
            <div
              style={{
                font: '500 8px/1 var(--font-tele)',
                letterSpacing: '.1em',
                color: 'var(--ink-40)',
                marginTop: 5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.subtitle}
            </div>
          </div>

          {!compact && (
            <span
              style={{
                font: '700 7px/1 var(--font-tele)',
                letterSpacing: '.12em',
                padding: '4px 6px',
                borderRadius: 4,
                background: r.badgeBg,
                color: r.badgeColor,
                flexShrink: 0,
              }}
            >
              {r.tag}
            </span>
          )}
        </div>

        {/* Scrubber — display only; YouTube owns transport controls. */}
        <div style={{ marginTop: 11 }}>
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: 'rgba(255,255,255,.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: color,
                transition: 'width .5s linear',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              font: '400 8px/1 var(--font-tele)',
              letterSpacing: '.08em',
              color: 'var(--ink-40)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>{fmtTime(elapsed)}</span>
            <span>
              {error
                ? 'UNAVAILABLE'
                : !ready
                  ? 'LOADING…'
                  : playing
                    ? 'PLAYING'
                    : state === 'buffering'
                      ? 'BUFFERING'
                      : 'PAUSED'}
            </span>
            <span>{fmtTime(duration)}</span>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: 9,
              font: '400 10px/1.5 var(--font-body)',
              color: 'var(--neon-gold)',
            }}
          >
            {error} Try another card.
          </div>
        )}

        {/* Attribution: we display YouTube's player, we don't host audio. */}
        {expanded && !error && (
          <div
            style={{
              marginTop: 9,
              font: '400 7px/1.5 var(--font-tele)',
              letterSpacing: '.1em',
              color: 'var(--ink-25)',
            }}
          >
            PLAYED VIA YOUTUBE
          </div>
        )}
      </div>
    </div>
  );
}
