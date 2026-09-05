'use client';

/**
 * Tells the server you are here, so other people see you as online.
 *
 * Mounted once in PhoneShell rather than per screen: presence is a property
 * of having the app open, not of being on any particular tab. The SQL side
 * treats anything newer than two minutes as online, so the beat is 60s --
 * one missed tick is forgiven, two are not.
 *
 * It stops beating when the app goes to the background. That is the point:
 * a phone in a pocket should read as offline, and a heartbeat that kept
 * running there would make the dot meaningless.
 */

import { useEffect } from 'react';
import { touchPresence } from '@/lib/supabase';

const BEAT_MS = 60_000;

export function usePresence(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | undefined;

    const beat = () => { void touchPresence(); };

    const start = () => {
      if (timer) return;
      beat();                       // immediately, not a minute from now
      timer = setInterval(beat, BEAT_MS);
    };

    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);
}
