'use client';

/**
 * The room's mic state, for the spectator formats that have one.
 *
 * Returns empty state when `roomUuid` is null rather than guessing, so a
 * screen that has not yet resolved its room never renders a mic that does
 * not exist.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  fetchMicState, nominateCard, voteNomination, requestStepIn, passMic,
} from './supabase';
import { winningNomination, type MicPerson, type Nomination } from './domain/mic';
import { useAuth } from './useAuth';

export function useMic(roomUuid: string | null) {
  const { profile, isSignedIn } = useAuth();
  const [people, setPeople] = useState<MicPerson[]>([]);
  const [holderId, setHolderId] = useState<string | null>(null);
  const [nominations, setNominations] = useState<Nomination[]>([]);

  const refresh = useCallback(async () => {
    if (!roomUuid) {
      setPeople([]); setHolderId(null); setNominations([]);
      return;
    }
    const s = await fetchMicState(roomUuid);
    setPeople(s.people);
    setHolderId(s.holderId);
    setNominations(s.nominations);
  }, [roomUuid]);

  useEffect(() => { void refresh(); }, [refresh]);

  const nominate = useCallback(async (cardId: string) => {
    if (!roomUuid) return;
    await nominateCard(roomUuid, cardId);
    await refresh();
  }, [roomUuid, refresh]);

  const vote = useCallback(async (nominationId: string, on: boolean) => {
    await voteNomination(nominationId, on);
    await refresh();
  }, [refresh]);

  const stepIn = useCallback(async (candidateId: string) => {
    if (!roomUuid) return;
    await requestStepIn(roomUuid, candidateId);
    // The server decides whether the vote carries; passMic returns null
    // when it does not, which is a no-op rather than an error.
    await passMic(roomUuid);
    await refresh();
  }, [roomUuid, refresh]);

  return {
    people,
    holderId,
    nominations,
    isHolder: isSignedIn && holderId === profile.id,
    isMicPerson: isSignedIn && people.some((p) => p.playerId === profile.id),
    winner: winningNomination(nominations),
    nominate,
    vote,
    stepIn,
    refresh,
  };
}
