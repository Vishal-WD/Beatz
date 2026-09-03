'use client';

/**
 * The signed-in player's own collection.
 *
 * The deck screen used to build a "hand" by picking cards out of the global
 * catalogue by rarity, which meant every player saw an identical hand and
 * owned nothing. card_ownership existed in the schema from the start but
 * nothing ever read it.
 *
 * Signed out, this returns an empty list and `owned: false`, so the caller
 * can show a preview of the catalogue and say plainly that it is a preview
 * rather than pretending the guest has a collection.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SongCard } from '@/types/cards';
import { fetchOwnedCards, dbCardToSongCard, isSupabaseConfigured, supabase } from './supabase';

export type OwnedState = 'loading' | 'owned' | 'guest';

export function useOwnedCards() {
  const [cards, setCards] = useState<SongCard[]>([]);
  const [state, setState] = useState<OwnedState>(
    isSupabaseConfigured ? 'loading' : 'guest',
  );
  // load() is re-created on every render that needs a fresh closure, but the
  // effect below must only ever bind ONE subscription -- so the callable
  // callers use (refetch) is stashed in a ref rather than in effect deps.
  const loadRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    const load = () => {
      void fetchOwnedCards().then((rows) => {
        if (cancelled) return;
        if (rows && rows.length > 0) {
          setCards(rows.map(dbCardToSongCard) as SongCard[]);
          setState('owned');
        } else {
          setCards([]);
          setState('guest');
        }
      }).catch(() => { if (!cancelled) setState('guest'); });
    };

    loadRef.current = load;
    load();

    // The collection belongs to whoever is signed in, so it has to be
    // reloaded when that changes — otherwise signing in leaves the previous
    // (empty) guest collection on screen until a manual refresh.
    const db = supabase();
    const sub = db?.auth.onAuthStateChange(() => load());

    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  // Lets a caller (e.g. a stuck-on-loading screen) re-query on demand
  // instead of reloading the whole page.
  const refetch = useCallback(() => {
    loadRef.current();
  }, []);

  return { cards, state, owned: state === 'owned', refetch };
}
