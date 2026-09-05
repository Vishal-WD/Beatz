'use client';

/**
 * ONE audio element for the whole app.
 *
 * Playback used to live inside whichever screen started it: the library, the
 * binder and the deck each called usePreviewAudio, so each built its own
 * <audio> element and tore it down on unmount. Moving between tabs killed
 * the music, and two screens could in principle play over each other.
 *
 * The element lives at module scope instead, outside React's tree, so
 * navigation cannot touch it. Screens subscribe to its state; the element
 * itself is never remounted.
 *
 * This is the same shape as the auth store in lib/useAuth.ts, and for the
 * same reason: per-call useState means per-call state, and anything that
 * must survive a route change cannot live there.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { SongCard } from '@/types/cards';

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface PlayerSnapshot {
  /** The card currently loaded, or null when nothing is. */
  card: SongCard | null;
  /** The queue this card came from, so next/prev mean something. */
  queue: SongCard[];
  state: PlayerState;
  elapsed: number;
  duration: number;
}

let snapshot: PlayerSnapshot = {
  card: null,
  queue: [],
  state: 'idle',
  elapsed: 0,
  duration: 0,
};

const listeners = new Set<() => void>();

function emit(patch: Partial<PlayerSnapshot>) {
  // New identity every time, or useSyncExternalStore sees no change.
  snapshot = { ...snapshot, ...patch };
  for (const l of listeners) l();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
const getSnapshot = () => snapshot;
/* The server renders no audio, so the server snapshot is the idle one. It
   must be a stable reference or React will loop. */
const serverSnapshot = snapshot;

let audio: HTMLAudioElement | null = null;
/** Whether playback was actually asked for; a retry must not autoplay. */
let wanted = false;

function element(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (audio) return audio;

  const a = new Audio();
  a.preload = 'metadata';
  /*
    crossOrigin is deliberately NOT set. It is only needed to feed a Web
    Audio AnalyserNode, and setting it makes the browser refuse any source
    whose server omits CORS headers. Plain playback needs none.
  */
  a.addEventListener('loadedmetadata', () => emit({ duration: a.duration || 0 }));
  a.addEventListener('timeupdate', () => emit({ elapsed: a.currentTime }));
  a.addEventListener('play', () => emit({ state: 'playing' }));
  // 'playing' also fires when a stall resolves itself, which 'play' does not.
  a.addEventListener('playing', () => emit({ state: 'playing' }));
  a.addEventListener('waiting', () => emit({ state: 'loading' }));
  a.addEventListener('pause', () =>
    emit({ state: snapshot.state === 'ended' ? 'ended' : 'paused' }));
  a.addEventListener('ended', () => { emit({ state: 'ended' }); advance(); });

  /*
    Retry once on error.

    Audius load-balances a stream across content nodes and some answer 503,
    and the assignment is sticky per track — so a card pointed at a dead node
    fails every time rather than intermittently. Re-requesting gets a fresh
    redirect. The cache-buster is required: without it the browser reuses the
    failed response and the retry does nothing.
  */
  let retried = false;
  a.addEventListener('error', () => {
    const src = snapshot.card?.previewUrl;
    if (!retried && src) {
      retried = true;
      emit({ state: 'loading' });
      a.src = `${src}${src.includes('?') ? '&' : '?'}_r=${Date.now()}`;
      a.load();
      if (wanted) void a.play().catch(() => emit({ state: 'error' }));
      return;
    }
    retried = false;
    emit({ state: 'error' });
  });

  audio = a;
  return a;
}

/** The next card in the queue that can actually make a sound. */
function nextInQueue(): SongCard | null {
  const { queue, card } = snapshot;
  if (!card) return null;
  const i = queue.findIndex((c) => c.id === card.id);
  // Not in the queue means the queue was reordered under us: start at the
  // top rather than stopping dead.
  for (let n = i < 0 ? 0 : i + 1; n < queue.length; n++) {
    if (queue[n].previewUrl) return queue[n];
  }
  return null;
}

function advance() {
  const next = nextInQueue();
  // Stop at the end rather than looping: a library that restarts itself is
  // one you cannot put down.
  if (next) play(next, snapshot.queue);
  else emit({ card: null, state: 'idle', elapsed: 0, duration: 0 });
}

/** Loads and plays a card. Passing a queue enables next/prev and auto-advance. */
export function play(card: SongCard, queue: SongCard[] = []) {
  const a = element();
  if (!a || !card.previewUrl) return;

  wanted = true;
  const q = queue.length ? queue : snapshot.queue;

  if (snapshot.card?.id === card.id) {
    // Same card: treat as resume rather than reloading, which would restart
    // it from zero and lose the position.
    emit({ queue: q });
    void a.play().catch(() => emit({ state: 'error' }));
    return;
  }

  emit({ card, queue: q, state: 'loading', elapsed: 0, duration: 0 });
  a.src = card.previewUrl;
  a.load();
  void a.play().catch(() => emit({ state: 'error' }));
}

export function pause() {
  wanted = false;
  audio?.pause();
}

export function toggle() {
  const a = audio;
  if (!a || !snapshot.card) return;
  if (a.paused) {
    wanted = true;
    void a.play().catch(() => emit({ state: 'error' }));
  } else {
    pause();
  }
}

export function next() { advance(); }

export function previous() {
  const { queue, card } = snapshot;
  if (!card) return;
  const i = queue.findIndex((c) => c.id === card.id);
  for (let n = i - 1; n >= 0; n--) {
    if (queue[n].previewUrl) { play(queue[n], queue); return; }
  }
  // Nothing before this one: restart the current track, which is what every
  // music player does at the head of a queue.
  if (audio) audio.currentTime = 0;
}

/** Clears the player entirely. The bar disappears. */
export function stop() {
  wanted = false;
  if (audio) {
    audio.pause();
    // NEVER src = '': an empty string resolves against the page URL, so the
    // element points at the document and fires MEDIA_ERR_SRC_NOT_SUPPORTED.
    audio.removeAttribute('src');
    audio.load();
  }
  emit({ card: null, state: 'idle', elapsed: 0, duration: 0 });
}

/** Subscribes a component to the shared player. */
export function usePlayer() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  return {
    ...snap,
    playing: snap.state === 'playing',
    play: useCallback(play, []),
    pause: useCallback(pause, []),
    toggle: useCallback(toggle, []),
    next: useCallback(next, []),
    previous: useCallback(previous, []),
    stop: useCallback(stop, []),
  };
}
