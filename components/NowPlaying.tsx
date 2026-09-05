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
import { fmtTime } from '@/lib/usePlayback';
import { usePreviewAudio } from '@/lib/usePreviewAudio';
import { RARITY, vibeColor } from '@/lib/rarity';
import { creditFor, type CardCredit } from '@/lib/domain/shoutouts';
import type { FormatId } from '@/lib/domain/formats';

interface Props {
  card: SongCard;
  vibe?: number;
  compact?: boolean;
  /** Room format — decides whether a shoutout is shown at all (spec §4). */
  format?: FormatId;
  /** Whose collection this card came from. Null when unknown. */
  credit?: CardCredit | null;
}

export function NowPlaying({
  card, vibe = 62, compact = false, format, credit = null,
}: Props) {
  // Null unless the format allows shoutouts AND an owner is known —
  // display only, never a reward (CLAUDE.md §1.2).
  const shoutout = format ? creditFor(format, credit) : null;

  /**
   * Two playback paths, and the preview wins when both exist.
   *
   * The 30-second preview is ad-free, starts instantly, needs no iframe, and
   * is CORS-open so Web Audio can analyse it. The YouTube embed gives the full
   * track but may roll a pre-roll ad and cannot be analysed. Most of the pool
   * is chart-sourced and has only a preview; the hand-curated cards have only
   * a video id — so both paths have to stay.
   */
  /*
    ONE playback path: a plain <audio> element.

    The YouTube embed is gone. It was the only thing that required a visible
    >=200px iframe (LICENSING_RIGHTS.md §2.7), and that stage lived inside
    the deck's card panel — so playing a YouTube-backed card roughly doubled
    the panel's height and shoved the rest of the room down the screen.

    Nothing lost any audio: every card carries either an Apple preview or an
    Audius stream, both of which this element plays. Verified against the
    database before removing it — 90 of 90 cards still playable.
  */
  const preview = usePreviewAudio(card.previewUrl ?? null);
  const available = preview.available;
  const playing = preview.playing;
  const elapsed = preview.elapsed;
  const duration = preview.duration;
  const toggle = preview.toggle;

  /* Which source is actually loaded. Read from the URL rather than a stored
     column so the attribution label can never disagree with the audio. */
  const isFullTrack = (card.previewUrl ?? '').includes('audius');

  const r = RARITY[card.rarity];
  const pct = duration > 0 ? (elapsed / duration) * 100 : 0;
  const color = vibeColor(vibe);

  /* A card with no audio source at all. previewUrl carries both the Apple
     preview and the Audius stream, so it is the only thing to ask about now
     that the YouTube path is gone. */
  if (!card.previewUrl) {
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
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        // The panel must never be wider than whatever it is placed in. On the
        // deck it sits beside the card art in a flex row, and without this it
        // sized to its own longest line instead — the title and the shoutout
        // credit — and spilled past the slot's rounded border.
        minWidth: 0,
        maxWidth: '100%',
        background: 'var(--booth-panel)',
        border: `1px solid ${playing ? color : 'var(--border-hair)'}`,
        boxShadow: 'var(--apple-card-shadow)',
        transition: 'border-color .3s ease',
      }}
    >
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button
            onClick={toggle}
            disabled={!available}
            aria-label={playing ? `Pause ${card.title}` : `Play ${card.title}`}
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-pill)',
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              background: playing ? 'var(--neon-pink)' : 'var(--surface-inset)',
              border: playing ? '1px solid var(--neon-pink)' : 'var(--border-strong)',
              color: playing ? 'var(--ink-on-neon)' : 'var(--ink)',
              font: '400 15px/1 var(--font-body)',
                  transition: 'background .2s ease, transform .12s ease',
              boxShadow: playing ? '0 4px 12px rgba(250, 45, 85, 0.4)' : undefined,
            }}
          >
            {playing ? '❚❚' : '▶'}
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: '600 15px/1.2 var(--font-heading)',
                letterSpacing: '-0.02em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--ink)',
              }}
            >
              {card.title}
            </div>
            <div
              style={{
                font: '400 13px/1.2 var(--font-body)',
                letterSpacing: '-0.01em',
                color: 'var(--ink-60)',
                marginTop: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.subtitle}
            </div>
            {shoutout && (
              <div
                style={{
                  font: '500 10px/1 var(--font-body)',
                  letterSpacing: '0.04em',
                  color: 'var(--neon-cyan)',
                  marginTop: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {shoutout.toUpperCase()}
              </div>
            )}
          </div>

          {/* Apple Music Dynamic Equalizer Bars when playing */}
          {playing && (
            <div
              aria-hidden="true"
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 2.5,
                height: 16,
                padding: '0 4px',
              }}
            >
              <span
                style={{
                  width: 3,
                  height: 16,
                  borderRadius: 1.5,
                  background: 'var(--neon-pink)',
                  animation: 'appleEqualizer 0.7s ease-in-out infinite alternate',
                  transformOrigin: 'bottom',
                }}
              />
              <span
                style={{
                  width: 3,
                  height: 16,
                  borderRadius: 1.5,
                  background: 'var(--neon-pink)',
                  animation: 'appleEqualizer 0.5s ease-in-out 0.2s infinite alternate',
                  transformOrigin: 'bottom',
                }}
              />
              <span
                style={{
                  width: 3,
                  height: 16,
                  borderRadius: 1.5,
                  background: 'var(--neon-pink)',
                  animation: 'appleEqualizer 0.8s ease-in-out 0.4s infinite alternate',
                  transformOrigin: 'bottom',
                }}
              />
            </div>
          )}

          {!compact && (
            <span
              style={{
                font: '600 10px/1 var(--font-body)',
                letterSpacing: '0.02em',
                padding: '4px 8px',
                borderRadius: 'var(--radius-pill)',
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
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              height: 4,
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-inset)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: playing ? 'var(--neon-pink)' : color,
                transition: 'width .5s linear',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              font: '500 10px/1 var(--font-tele)',
              letterSpacing: '0.02em',
              color: 'var(--ink-40)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>{fmtTime(elapsed)}</span>
            {/* The two paths report readiness differently: the preview has no
                "ready" gate (an <audio> element is usable immediately), while
                the YouTube player must construct itself first. */}
            <span>
              {preview.state === 'error'
                ? 'UNAVAILABLE'
                : preview.state === 'loading'
                  ? 'BUFFERING'
                  : playing
                    ? 'PLAYING'
                    : preview.state === 'ended'
                      ? 'ENDED'
                      : isFullTrack
                        ? 'FULL TRACK'
                        : 'PREVIEW · 30s'}
            </span>
            <span>{fmtTime(duration)}</span>
          </div>
        </div>

        {preview.state === 'error' && (
          <div
            style={{
              marginTop: 9,
              font: '400 10px/1.5 var(--font-body)',
              color: 'var(--neon-gold)',
            }}
          >
            That track would not load. Try another card.
          </div>
        )}

        {/*
          Attribute whatever actually played.

          Naming the wrong source is not a cosmetic slip — attribution is
          what keeps this app copyright-clean (LICENSING_RIGHTS.md §2.5), so
          an Audius stream must not be credited to Apple and vice versa. The
          source is read from the URL rather than from a stored flag, so the
          label cannot drift away from what the element is actually loading.
        */}
        {available && preview.state !== 'error' && (
          <div
            style={{
              marginTop: 9,
              font: '400 7px/1.5 var(--font-tele)',
              letterSpacing: '.1em',
              color: 'var(--ink-25)',
            }}
          >
            {isFullTrack ? 'FULL TRACK VIA AUDIUS' : 'PREVIEW VIA APPLE MUSIC'}
          </div>
        )}
      </div>
    </div>
  );
}
