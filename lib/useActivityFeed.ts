'use client';

/**
 * The social feed, built from real reigns, pulls and follows.
 *
 * Replaces the static ACTIVITY[] fixture in lib/social-data.ts, which said
 * the same thing forever. `buildFeed` (lib/domain/activity.ts) stays pure —
 * this hook is the only place that touches Supabase and React state.
 */

import { useEffect, useState } from 'react';
import { buildFeed, type ActivityEvent } from './domain/activity';
import { fetchFeedSources } from './supabase';

export type FeedState = 'loading' | 'live' | 'empty';

export function useActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [state, setState] = useState<FeedState>('loading');

  useEffect(() => {
    let cancelled = false;
    void fetchFeedSources().then((src) => {
      if (cancelled) return;
      const feed = src ? buildFeed(src) : [];
      setEvents(feed);
      setState(feed.length ? 'live' : 'empty');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { events, state };
}
