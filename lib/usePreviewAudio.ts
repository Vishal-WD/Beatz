'use client';

/**
 * 30-second preview playback via a plain <audio> element.
 *
 * Why this exists alongside the YouTube path: Apple's preview URLs are served
 * CORS-open, so unlike an iframe they can be
 *   (a) played instantly with no embed and no pre-roll ad, and
 *   (b) fed to a Web Audio AnalyserNode — which is what finally makes the
 *       FFT-driven Vibe Bar in CLAUDE.md §7 possible.
 *
 * The audio is never downloaded or cached; `src` points at Apple's stream and
 * playback happens there (docs/LICENSING_RIGHTS.md DO NOT #1).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type PreviewState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export function usePreviewAudio(url: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PreviewState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!url) {
      setState('idle');
      return;
    }

    const a = new Audio();
    // Required for the AnalyserNode path to work without tainting the context.
    a.crossOrigin = 'anonymous';
    a.preload = 'metadata';
    a.src = url;
    audioRef.current = a;

    const onLoad = () => setDuration(a.duration || 0);
    const onTime = () => setElapsed(a.currentTime);
    // 'play' fires when playback is *requested* (a.play() called); 'playing'
    // fires when frames are actually advancing again — including after a
    // 'waiting' stall resolves itself with no further a.play() call. Relying
    // on 'play' alone left `state` stuck on 'loading' forever the moment a
    // preview buffered mid-stream: 'waiting' fired, flipping state away from
    // 'playing', and nothing ever flipped it back even though the browser
    // resumed on its own a moment later. That silently broke the PLAYING
    // badge and TAP TO STOP affordance while audio kept running underneath.
    const onPlay = () => setState('playing');
    const onPlaying = () => setState('playing');
    const onPause = () => setState((s) => (s === 'ended' ? s : 'paused'));
    const onEnd = () => setState('ended');
    const onErr = () => setState('error');
    const onWait = () => setState('loading');

    a.addEventListener('loadedmetadata', onLoad);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('play', onPlay);
    a.addEventListener('playing', onPlaying);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);
    a.addEventListener('waiting', onWait);

    return () => {
      a.pause();
      a.removeEventListener('loadedmetadata', onLoad);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
      a.removeEventListener('waiting', onWait);

      // NEVER assign src = '' here. An empty string is resolved against the
      // page URL, so the element ends up pointing at the current document and
      // fires MEDIA_ERR_SRC_NOT_SUPPORTED. React Strict Mode runs this cleanup
      // on the first of two dev mounts, which was breaking the live element.
      // removeAttribute releases the resource without inventing a bad URL.
      a.removeAttribute('src');
      a.load();

      // Only surrender the ref if it still points at THIS element — under
      // Strict Mode the second mount may already have replaced it.
      if (audioRef.current === a) {
        audioRef.current = null;
        setState('idle');
        setElapsed(0);
      }
    };
  }, [url]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // play() rejects when the browser blocks autoplay; surface it rather
      // than leaving the button looking broken.
      void a.play().catch(() => setState('error'));
    } else {
      a.pause();
    }
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
  }, []);

  return {
    available: Boolean(url),
    state,
    playing: state === 'playing',
    elapsed,
    duration,
    toggle,
    stop,
  };
}
