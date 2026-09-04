/**
 * Mic control for the spectator formats that share it.
 *
 * Concert and Fest have several mic people who decide among themselves;
 * Clubbing has one DJ invited at room creation and never votes. This is a
 * property OF the spectator model, not a fourth control model — CLAUDE.md
 * §1 allows exactly three and adding one needs a recorded decision.
 *
 * Only mic people vote. A crowd vote would make the room delegated, which
 * is the drift §1.2 exists to prevent.
 */

import type { FormatId } from './formats';

export type MicMode = 'solo' | 'vote_song' | 'setlist';

export interface MicPerson {
  playerId: string;
  displayName: string;
}

export interface Nomination {
  id: string;
  playerId: string;
  cardId: string;
  /** Player ids. Duplicates are ignored when counting. */
  votes: string[];
}

/** Only Concert and Fest have several mic people to arbitrate between. */
export const usesMic = (f: FormatId): boolean => f === 'concert' || f === 'fest';

const ALL_MODES: MicMode[] = ['solo', 'vote_song', 'setlist'];

export const micModesFor = (f: FormatId): MicMode[] =>
  usesMic(f) ? [...ALL_MODES] : [];

const uniqueVotes = (votes: string[]): number => new Set(votes).size;

/**
 * The nomination that plays next, or null when nothing has any support.
 *
 * Ties break on `id` so that two clients reading the same rows in different
 * orders still agree — otherwise the room would disagree with itself about
 * what is playing.
 */
export function winningNomination(noms: Nomination[]): Nomination | null {
  const withVotes = noms.filter((n) => uniqueVotes(n.votes) > 0);
  if (withVotes.length === 0) return null;

  return [...withVotes].sort((a, b) => {
    const d = uniqueVotes(b.votes) - uniqueVotes(a.votes);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  })[0];
}

/**
 * Whether a STEP IN request has enough support to pass the mic.
 *
 * The vote is of the OTHER mic people: the current holder cannot vote on
 * their own replacement, and someone who is not a mic person has no say at
 * all. With a lone mic person there is nobody to outvote them, so it can
 * never pass.
 */
export function stepInPasses(
  votes: string[],
  micPeople: MicPerson[],
  holderId: string,
): boolean {
  const others = micPeople.filter((p) => p.playerId !== holderId);
  if (others.length === 0) return false;

  const eligible = new Set(others.map((p) => p.playerId));
  const counted = new Set(votes.filter((v) => eligible.has(v)));
  return counted.size > others.length / 2;
}
