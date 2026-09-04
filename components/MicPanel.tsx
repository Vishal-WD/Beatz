'use client';

/**
 * Mic control for Concert and Fest (CLAUDE.md §1.1 — spectator formats
 * with several mic people, as opposed to Clubbing's single invited DJ).
 *
 * `mic_mode` (lib/domain/mic.ts) picks one of three shapes:
 *   - solo:      one holder performs; the others can request to step in.
 *   - vote_song: mic people nominate cards from their own collection and
 *                vote on which plays next.
 *   - setlist:   the agreed running order, contributed before the room
 *                opened — read-only once the set is live.
 *
 * The one rule that holds across all three: only mic people get controls.
 * `mic.isMicPerson` gates every button in this file. The crowd sees the
 * exact same state — who holds, what's nominated, how the votes stand —
 * with no affordance to act on it. A crowd vote here would turn a
 * spectator room into a delegated one, which is the drift CLAUDE.md §1.2
 * exists to prevent. The server enforces this independently (RLS on the
 * mic tables), but a button the crowd can press that then silently fails
 * is worse than no button, so the client gate matters too.
 */

import { useState, useCallback } from 'react';
import type { SongCard } from '@/types/cards';
import type { MicMode, Nomination } from '@/lib/domain/mic';
import type { useMic } from '@/lib/useMic';
import { useAuth } from '@/lib/useAuth';
import { SongCardView } from '@/components/SongCardView';

type Mic = ReturnType<typeof useMic>;

interface Props {
  mode: MicMode;
  mic: Mic;
  ownedCards: SongCard[];
}

const LABEL_STYLE: React.CSSProperties = {
  font: '400 9px/1 var(--font-tele)',
  letterSpacing: '.2em',
  color: 'var(--ink-40)',
};

const NAME_STYLE: React.CSSProperties = {
  font: '400 15px/1 var(--font-title)',
  textTransform: 'uppercase',
};

const PANEL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '12px 14px',
  borderRadius: 12,
  background: 'var(--booth-panel)',
  border: '1px solid var(--hairline)',
};

const PILL_BUTTON: React.CSSProperties = {
  font: '700 8px/1 var(--font-tele)',
  letterSpacing: '.14em',
  padding: '7px 12px',
  borderRadius: 7,
  background: 'var(--neon-cyan)',
  border: '1px solid var(--neon-cyan)',
  color: 'var(--ink-on-neon)',
  flexShrink: 0,
};

const PILL_BUTTON_ON: React.CSSProperties = {
  ...PILL_BUTTON,
  background: 'var(--neon-mint)',
  border: '1px solid var(--neon-mint)',
};

const PILL_BUTTON_DONE: React.CSSProperties = {
  ...PILL_BUTTON,
  background: 'transparent',
  border: 'var(--border-strong)',
  color: 'var(--ink-40)',
};

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {children}
    </div>
  );
}

function SoloMic({ mic }: { mic: Mic }) {
  const holder = mic.people.find((p) => p.playerId === mic.holderId);
  const others = mic.people.filter((p) => p.playerId !== mic.holderId);
  // Fire-and-forget acknowledgement only: useMic's stepIn() does not
  // return or expose a per-candidate vote count (fetchMicState reads
  // mic_people + nominations, not step_in_votes), so there is nothing
  // real to show as "votes so far / threshold". Rather than invent a
  // number, this just confirms the tap registered.
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const onStepIn = useCallback((candidateId: string) => {
    setRequested((s) => new Set(s).add(candidateId));
    void mic.stepIn(candidateId);
  }, [mic]);

  return (
    <div style={PANEL_STYLE}>
      <div style={LABEL_STYLE}>SOLO MIC</div>
      <div>
        <div style={{ ...LABEL_STYLE, marginBottom: 3 }}>HOLDING</div>
        <div style={NAME_STYLE}>{holder ? holder.displayName : 'NOBODY YET'}</div>
      </div>

      {/*
        The handover only happens once the current song ends, never
        mid-track (pass_mic resolves against stepInPasses, lib/domain/
        mic.ts). Said on screen because a request that visibly does
        nothing for the rest of a song otherwise reads as broken, not as
        "waiting its turn".
      */}
      <div style={{ font: '400 8px/1.5 var(--font-tele)', letterSpacing: '.08em', color: 'var(--ink-25)' }}>
        A STEP IN HANDS OVER THE MIC AFTER THE CURRENT SONG ENDS, NEVER MID-TRACK.
      </div>

      {mic.isMicPerson && others.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
          {others.map((p) => {
            const isRequested = requested.has(p.playerId);
            return (
              <Row key={p.playerId}>
                <span style={{ font: '400 11px/1 var(--font-stat)', flex: 1 }}>{p.displayName}</span>
                <button
                  onClick={() => onStepIn(p.playerId)}
                  disabled={isRequested}
                  aria-label={isRequested ? `Step-in requested for ${p.displayName}` : `Request step in for ${p.displayName}`}
                  style={isRequested ? PILL_BUTTON_DONE : PILL_BUTTON}
                >
                  {isRequested ? 'REQUESTED' : 'STEP IN'}
                </button>
              </Row>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VoteRow({ mic, nomination, card }: { mic: Mic; nomination: Nomination; card: SongCard | undefined }) {
  const { profile } = useAuth();
  const isWinner = mic.winner?.id === nomination.id;
  const offeredBy = mic.people.find((p) => p.playerId === nomination.playerId);
  const iVoted = mic.isMicPerson && nomination.votes.includes(profile.id);

  return (
    <Row>
      {card ? (
        <SongCardView card={card} size="sm" />
      ) : (
        <div style={{ width: 96, height: 134, borderRadius: 8, background: 'var(--art-slot)', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          font: '400 12px/1.3 var(--font-title)', textTransform: 'uppercase',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: isWinner ? 'var(--neon-mint)' : 'var(--ink)',
        }}
        >
          {card ? card.title : 'UNKNOWN CARD'}
        </div>
        <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.1em', color: 'var(--ink-40)', marginTop: 3 }}>
          OFFERED BY {(offeredBy?.displayName ?? 'SOMEONE').toUpperCase()}
          {isWinner && ' · WINNING'}
        </div>
      </div>
      <div style={{ font: '700 14px/1 var(--font-stat)', color: 'var(--ink-60)', flexShrink: 0 }}>
        {new Set(nomination.votes).size}
      </div>
      {/*
        Only mic people get a vote button at all — the crowd sees this
        exact row (card, who offered it, vote count, winner marker) with
        nothing tappable, which is the whole point of the gate.
      */}
      {mic.isMicPerson && (
        <button
          onClick={() => void mic.vote(nomination.id, !iVoted)}
          aria-pressed={iVoted}
          aria-label={iVoted ? `Withdraw vote for ${card?.title ?? 'this nomination'}` : `Vote for ${card?.title ?? 'this nomination'}`}
          style={iVoted ? PILL_BUTTON_ON : PILL_BUTTON}
        >
          {iVoted ? 'VOTED' : 'VOTE'}
        </button>
      )}
    </Row>
  );
}

function VoteSongMic({ mic, ownedCards }: { mic: Mic; ownedCards: SongCard[] }) {
  const nominatedIds = new Set(mic.nominations.map((n) => n.cardId));
  const nominable = ownedCards.filter((c) => !nominatedIds.has(c.id));

  return (
    <div style={PANEL_STYLE}>
      <div style={LABEL_STYLE}>VOTE EACH SONG</div>

      {mic.nominations.length === 0 ? (
        <div style={{ font: '400 10px/1.5 var(--font-tele)', color: 'var(--ink-25)' }}>
          NOTHING NOMINATED YET
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mic.nominations.map((n) => (
            <VoteRow key={n.id} mic={mic} nomination={n} card={ownedCards.find((c) => c.id === n.cardId)} />
          ))}
        </div>
      )}

      {mic.isMicPerson && nominable.length > 0 && (
        <div>
          <div style={{ ...LABEL_STYLE, marginTop: 2, marginBottom: 6 }}>NOMINATE FROM YOUR COLLECTION</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {nominable.map((c) => (
              <button
                key={c.id}
                onClick={() => void mic.nominate(c.id)}
                aria-label={`Nominate ${c.title}`}
                style={{ flexShrink: 0 }}
              >
                <SongCardView card={c} size="sm" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SetlistMic({ mic, ownedCards }: { mic: Mic; ownedCards: SongCard[] }) {
  return (
    <div style={PANEL_STYLE}>
      <div style={LABEL_STYLE}>PRIOR SETLIST</div>
      <div style={{ font: '400 8px/1.5 var(--font-tele)', letterSpacing: '.08em', color: 'var(--ink-25)' }}>
        AGREED BEFORE THE ROOM OPENED · READ-ONLY DURING THE SET
      </div>
      {/*
        fetchMicState only ever returns rows where played_at is null, so a
        track that has already played simply isn't in this list anymore —
        there is no "already played" flag to mark inline. The remaining
        order below IS what's left to play, which says the same thing
        honestly instead of a strikethrough this data can't support.
      */}
      {mic.nominations.length === 0 ? (
        <div style={{ font: '400 10px/1.5 var(--font-tele)', color: 'var(--ink-25)' }}>
          NOTHING LEFT ON THE SETLIST
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mic.nominations.map((n, i) => {
            const card = ownedCards.find((c) => c.id === n.cardId);
            return (
              <Row key={n.id}>
                <span style={{ font: '700 10px/1 var(--font-stat)', color: 'var(--ink-40)', width: 18 }}>{i + 1}</span>
                <span style={{ font: '400 12px/1.3 var(--font-title)', textTransform: 'uppercase', flex: 1 }}>
                  {card ? card.title : 'UNKNOWN CARD'}
                </span>
              </Row>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Renders one of the three mic shapes chosen by the room's `mic_mode`. */
export function MicPanel({ mode, mic, ownedCards }: Props) {
  if (mode === 'solo') return <SoloMic mic={mic} />;
  if (mode === 'vote_song') return <VoteSongMic mic={mic} ownedCards={ownedCards} />;
  return <SetlistMic mic={mic} ownedCards={ownedCards} />;
}
