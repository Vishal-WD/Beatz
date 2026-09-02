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

import { useEffect, useState } from 'react';
import type { SongCard } from '@/types/cards';
import { fetchOwnedCards, dbCardToSongCard, isSupabaseConfigured, supabase } from './supabase';

export type OwnedState = 'loading' | 'owned' | 'guest';

export function useOwnedCards() {
  const [cards, setCards] = useState<SongCard[]>([]);
  const [state, setState] = useState<OwnedState>(
    isSupabaseConfigured ? 'loading' : 'guest',
  );

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

  return { cards, state, owned: state === 'owned' };
}
