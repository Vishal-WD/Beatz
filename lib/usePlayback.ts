'use client';

/**
 * Music playback via the YouTube IFrame API.
 *
 * This is the licence-safe path (docs/LICENSING_RIGHTS.md §2.7): we embed
 * YouTube's own player, so no content licence is required on our part. We
 * never download, cache, proxy, or synthesize a real track — doing so is
 * DO NOT #1 and #2 in that document.
 *
 * Constraints the YouTube API imposes, all handled below:
 *   - player viewport must be >= 200x200px
 *   - a valid HTTP Referer must be sent (missing => blocked playback)
 *   - ads must not be blocked, muted, or obscured
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const IFRAME_API = 'https://www.youtube.com/iframe_api';

/** YouTube's own PlayerState enum. */
export type PlayerState = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued';

const STATE_MAP: Record<number, PlayerState> = {
  [-1]: 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'cued',
};

let apiPromise: Promise<void> | null = null;

/** The IFrame API is a global singleton — loading it twice breaks the callback. */
function loadApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).YT?.Player) return resolve();

    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };

    const script = document.createElement('script');
    script.src = IFRAME_API;
    script.async = true;
    script.onerror = () => reject(new Error('YouTube IFrame API failed to load'));
    document.head.appendChild(script);

    // Venue wifi can stall this indefinitely. Fail loudly rather than
    // leaving the caller waiting forever.
    setTimeout(() => reject(new Error('YouTube IFrame API timed out')), 12_000);
  });

  return apiPromise;
}

interface Options {
  videoId: string | null;
  autoplay?: boolean;
  onEnded?: () => void;
}

export function usePlayback({ videoId, autoplay = false, onEnded }: Options) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);

  const [state, setState] = useState<PlayerState>('unstarted');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    if (!videoId || !hostRef.current) return;

    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    loadApi()
      .then(() => {
        if (cancelled || !hostRef.current) return;

        playerRef.current = new (window as any).YT.Player(hostRef.current, {
          videoId,
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              setDuration(playerRef.current?.getDuration?.() ?? 0);
            },
            onStateChange: (e: { data: number }) => {
              if (cancelled) return;
              const s = STATE_MAP[e.data] ?? 'unstarted';
              setState(s);
              if (s === 'ended') onEndedRef.current?.();
            },
            onError: () => {
              if (cancelled) return;
              // Common causes: video removed, or embedding disabled by the
              // rights holder. Neither is recoverable — surface it.
              setError('This track cannot be played here.');
            },
          },
        });

        poll = setInterval(() => {
          const p = playerRef.current;
          if (p?.getCurrentTime) {
            setElapsed(p.getCurrentTime());
            const d = p.getDuration?.() ?? 0;
            if (d) setDuration(d);
          }
        }, 500);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      try {
        playerRef.current?.destroy?.();
      } catch {
        // Player may already be gone if the iframe was removed first.
      }
      playerRef.current = null;
    };
  }, [videoId, autoplay]);

  const play = useCallback(() => playerRef.current?.playVideo?.(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo?.(), []);
  const toggle = useCallback(() => {
    if (state === 'playing') playerRef.current?.pauseVideo?.();
    else playerRef.current?.playVideo?.();
  }, [state]);

  return { hostRef, state, ready, error, elapsed, duration, play, pause, toggle };
}

export const fmtTime = (s: number): string => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
