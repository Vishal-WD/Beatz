'use client';

/**
 * Home — the music library.
 *
 * Every other screen is about the room: what is playing, who is holding it,
 * what you can pull next. This one is only about what you already own — the
 * collection as a playlist rather than as a binder, so a card is something
 * you can just listen to without staking a reign on it.
 *
 * Playback is the 30-second Apple preview (lib/usePreviewAudio.ts), which is
 * the only stream this app is allowed to drive from an <audio> element
 * (docs/LICENSING_RIGHTS.md DO NOT #1 — nothing is downloaded or cached).
 * Cards with no previewUrl are still listed, because they are still owned;
 * they are marked unplayable rather than hidden, since hiding them would
 * make the count disagree with the collection.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneChrome';
import { EmptyState, Button } from '@/components/ui';
import { useOwnedCards } from '@/lib/useOwnedCards';
import { usePreviewAudio } from '@/lib/usePreviewAudio';
import { useSound } from '@/lib/useSound';
import { useHaptics } from '@/lib/useHaptics';
import { rarityTextVar } from '@/lib/rarity';
import type { SongCard } from '@/types/cards';
import {
  shuffleCards, applyOrder, nextPlayable as nextAfter, firstPlayable,
} from '@/lib/domain/playback-queue';

/** mm:ss. Only ever called with a duration the audio element actually reported. */
function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Fisher-Yates over a copy.
 *
 * The order this produces is stored, not recomputed: reshuffling on every
 * advance would mean the list you are looking at is never the list that
 * plays next, and "what's coming up" would be unanswerable.
 */


export default function HomeScreen() {
  const { cards, state } = useOwnedCards();
  const { play } = useSound();
  const haptic = useHaptics();

  /*
    The playing order. Null means "collection order" — shuffling stores an
    order rather than flipping a boolean the advance step would re-roll, so
    the queue you can scroll is the queue that will actually play.

    Held as ids, not cards, so a refetch that returns fresh objects for the
    same collection does not silently invalidate the order.
  */
  const [order, setOrder] = useState<string[] | null>(null);

  /* Applying a saved shuffle to the live collection is shared, tested
     logic: cards pulled since the shuffle are appended rather than dropped,
     so the queue can never be shorter than the collection it represents. */
  const queue = useMemo(() => applyOrder(cards, order), [cards, order]);

  // One id drives one usePreviewAudio call — one <audio> element for the
  // whole library, so two tracks can never overlap.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playingCard = queue.find((c) => c.id === playingId) ?? null;
  const previewUrl = playingCard?.previewUrl ?? null;
  const preview = usePreviewAudio(previewUrl);
  const { state: audioState, playing, toggle, stop, duration } = preview;

  /*
    usePreviewAudio only builds its <audio> element once the url effect has
    run for the NEW id, so the `toggle` captured during the tap's own render
    is still bound to the previous url and would no-op. Record the intent,
    act on it from an effect keyed on the resolved url — that effect always
    sees the toggle wired to the current element. (Same shape as the binder
    on app/profile/page.tsx; the failure it avoids is a silent one.)
  */
  const wantPlayRef = useRef<string | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    if (wantPlayRef.current !== playingId) return;
    if (playing) return;
    wantPlayRef.current = null;
    toggle();
  }, [previewUrl, playingId, playing, toggle]);

  /** Start `id`, or stop it if it is already the one playing. */
  const start = useCallback((id: string) => {
    setPlayingId((current) => {
      if (current === id) {
        stop();
        wantPlayRef.current = null;
        return null;
      }
      wantPlayRef.current = id;
      return id;
    });
  }, [stop]);

  /*
    Auto-advance. 'ended' is the hook's own terminal state, so this needs no
    timer and no polling — and it stops at the end of the list rather than
    looping, because a library that restarts itself is a library you cannot
    put down.

    nextPlayable() treats "the playing card is not in the queue" as "start
    from the top", which is the honest answer when the queue was reordered
    underneath a playing track. The old arithmetic asked findIndex for an
    index and stopped playback outright when it came back -1.
  */
  useEffect(() => {
    if (audioState !== 'ended' || !playingId) return;
    const next = nextAfter(queue, playingId);
    if (next) {
      wantPlayRef.current = next.id;
      setPlayingId(next.id);
    } else {
      setPlayingId(null);
      wantPlayRef.current = null;
    }
  }, [audioState, playingId, queue]);

  const playAll = useCallback(() => {
    setOrder(null);
    const first = firstPlayable(cards);
    if (!first) return;
    play('tap');
    haptic('light');
    wantPlayRef.current = first.id;
    setPlayingId(first.id);
  }, [cards, play, haptic]);

  const shuffle = useCallback(() => {
    const next = shuffleCards(cards);
    setOrder(next.map((c) => c.id));
    const first = firstPlayable(next);
    if (!first) return;
    play('tap');
    haptic('light');

    /*
      Re-shuffling can land on the track already playing. setPlayingId with
      the same id changes no url, so usePreviewAudio never rebuilds its
      <audio> element and the play-on-url-change effect early-returns on
      `playing` -- leaving wantPlayRef set forever while the list on screen
      reordered underneath the audio. The visible queue and what you heard
      disagreed from then on.

      Clearing the id first forces the url through null, so the next render
      genuinely remounts and starts the new order from its top.
    */
    if (playingId === first.id) {
      stop();
      setPlayingId(null);
    }
    wantPlayRef.current = first.id;
    setPlayingId(first.id);
  }, [cards, play, haptic, playingId, stop]);

  const playableCount = queue.filter((c) => c.previewUrl).length;

  if (state === 'loading') {
    return (
      <PhoneShell>
        <div style={{ padding: 'var(--sp-4)' }}>
          <div
            style={{
              font: '400 9px/1 var(--font-tele)',
              letterSpacing: '.16em',
              color: 'var(--ink-25)',
            }}
          >
            LOADING YOUR LIBRARY…
          </div>
        </div>
      </PhoneShell>
    );
  }

  /*
    Signed out, or signed in with nothing: the same honest answer either way.
    No placeholder rows — a fake library is worse than an empty one, because
    it is a list you can tap that will never make a sound.
  */
  if (queue.length === 0) {
    return (
      <PhoneShell>
        <div style={{ padding: '4px var(--sp-4) var(--sp-6)' }}>
          <Header count={0} />
          <EmptyState
            title="NO CARDS IN YOUR LIBRARY"
            hint="Cards you own show up here, ready to play. Open a pack to start the collection."
            action={
              <Link href="/packs" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="md">Go to the shop</Button>
              </Link>
            }
          />
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <div style={{ padding: '4px var(--sp-4) var(--sp-6)' }}>
        <Header count={queue.length} />

        <div style={{ display: 'flex', gap: 'var(--sp-2)', margin: 'var(--sp-4) 0' }}>
          <Button
            variant="primary"
            size="md"
            block
            data-press
            onClick={playAll}
            disabled={playableCount === 0}
          >
            ▶ PLAY ALL
          </Button>
          <Button
            variant="secondary"
            size="md"
            block
            data-press
            onClick={shuffle}
            disabled={playableCount === 0}
          >
            ⤨ SHUFFLE
          </Button>
        </div>

        {order && (
          <div
            style={{
              font: '400 8px/1 var(--font-tele)',
              letterSpacing: '.2em',
              color: 'var(--neon-cyan)',
              marginBottom: 'var(--sp-3)',
            }}
          >
            SHUFFLED ORDER
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {queue.map((card, i) => (
            <TrackRow
              key={card.id}
              card={card}
              index={i}
              current={card.id === playingId}
              playing={card.id === playingId && playing}
              errored={card.id === playingId && audioState === 'error'}
              /* Only the live element knows a real duration, so only the
                 playing row can show one. Every other row shows nothing
                 rather than an invented number. */
              duration={card.id === playingId && duration > 0 ? duration : null}
              onTap={() => {
                if (!card.previewUrl) return;
                play('tap');
                haptic('light');
                /* Tapping a row plays it in the order already on screen.
                   It does not clear a shuffle — the queue you can see is
                   the queue that keeps playing. */
                start(card.id);
              }}
            />
          ))}
        </div>
      </div>
    </PhoneShell>
  );
}

function Header({ count }: { count: number }) {
  return (
    <div style={{ marginBottom: 'var(--sp-2)' }}>
      <div style={{ font: '400 26px/1 var(--font-title)', textTransform: 'uppercase', color: 'var(--ink)' }}>
        Library
      </div>
      <div
        style={{
          font: '400 8px/1 var(--font-tele)',
          letterSpacing: '.2em',
          color: 'var(--neon-cyan)',
          marginTop: 6,
        }}
      >
        {count === 1 ? '1 CARD' : `${count} CARDS`}
      </div>
    </div>
  );
}

function TrackRow({
  card, index, current, playing, errored, duration, onTap,
}: {
  card: SongCard;
  index: number;
  current: boolean;
  playing: boolean;
  errored: boolean;
  duration: number | null;
  onTap: () => void;
}) {
  const [artError, setArtError] = useState(false);
  const playable = Boolean(card.previewUrl);

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!playable}
      aria-current={current ? 'true' : undefined}
      data-press={playable ? '' : undefined}
      data-rise
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        width: '100%',
        textAlign: 'left',
        padding: 'var(--sp-2) var(--sp-3)',
        borderRadius: 'var(--radius-lg)',
        background: current ? 'var(--surface-inset)' : 'var(--glass-regular)',
        backdropFilter: 'var(--glass-blur-thin)',
        WebkitBackdropFilter: 'var(--glass-blur-thin)',
        border: current ? `1px solid ${rarityTextVar(card.rarity)}` : 'var(--border-hair)',
        boxShadow: 'var(--glass-edge)',
        opacity: playable ? 1 : 0.5,
        cursor: playable ? 'pointer' : 'default',
        animationDelay: `${Math.min(index, 12) * 40}ms`,
      }}
    >
      {/* Artwork. A missing cover falls back to the same slot wash the card
          face uses, rather than a broken-image glyph. */}
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: 46,
          height: 46,
          flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--art-slot)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {card.artworkUrl && !artError ? (
          <img
            src={card.artworkUrl}
            alt=""
            loading="lazy"
            onError={() => setArtError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span
            style={{
              font: '400 6px/1.3 var(--font-tele)',
              letterSpacing: '.1em',
              color: 'var(--ink-25)',
              textAlign: 'center',
            }}
          >
            COVER<br />ART
          </span>
        )}
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          style={{
            font: '600 14px/1.2 var(--font-body)',
            letterSpacing: '-0.01em',
            color: current ? 'var(--ink)' : 'var(--ink-60)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {card.title}
        </span>
        <span
          style={{
            font: '400 11px/1.2 var(--font-body)',
            color: 'var(--ink-40)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {card.subtitle}
        </span>
      </span>

      <span
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          font: '400 9px/1 var(--font-tele)',
          letterSpacing: '.12em',
          color: 'var(--ink-25)',
        }}
      >
        {duration !== null && <span>{clock(duration)}</span>}
        {/* State in words, not colour alone — the marked row has to survive
            being read rather than looked at. */}
        {errored ? (
          <span style={{ color: 'var(--neon-gold)' }}>ERROR</span>
        ) : playing ? (
          <span style={{ color: 'var(--neon-pink)' }}>PLAYING</span>
        ) : current ? (
          <span style={{ color: 'var(--neon-pink)' }}>PAUSED</span>
        ) : !playable ? (
          <span>NO PREVIEW</span>
        ) : null}
      </span>
    </button>
  );
}
