'use client';

/**
 * Screen 02 — Deck & Hand.
 * Playing a card onto the deck slot is the ONLY way to start a reign
 * (CLAUDE.md §1).
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { SongCardView } from '@/components/SongCardView';
import { PhoneShell } from '@/components/PhoneChrome';
import { NowPlaying } from '@/components/NowPlaying';
import { VibeMeter } from '@/components/VibeMeter';
import { PerformerDisc } from '@/components/PerformerDisc';
import { useVibe } from '@/lib/useVibe';
import { useSound } from '@/lib/useSound';
import { useHaptics } from '@/lib/useHaptics';
import { useRoom, MODE_LABEL } from '@/lib/useRoom';
import { useMic } from '@/lib/useMic';
import { vibeColor, RARITY } from '@/lib/rarity';
import { useCards, SOURCE_LABEL } from '@/lib/useCards';
import { useOwnedCards } from '@/lib/useOwnedCards';
import { useAuth } from '@/lib/useAuth';
import { supabase, subscribeToRoom, toggleFollow, type DbRoom } from '@/lib/supabase';
import { controlModelFor, canDethrone, type FormatId } from '@/lib/domain/formats';
import { positionOf } from '@/lib/domain/challengers';
import { canPlayCard, type PlayRefusal } from '@/lib/domain/play-rules';

const ROOM_SLUG = 'basement-4am';

/** Player-facing sentence for each refusal `canPlayCard` can return. */
const REFUSAL_COPY: Record<PlayRefusal, string> = {
  guest_card_in_event_room: 'Event room — owned cards only.',
  not_owned: "You don't own this card yet.",
  crowd_cannot_play: 'Only the host can play cards in this room.',
};

/** Falls back to Disco (open, contested — CLAUDE.md §1.1) when no room row has loaded yet. */
const DEFAULT_FORMAT: FormatId = 'disco';

export default function DeckScreen() {
  const [deckId, setDeckId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { play } = useSound();
  const haptic = useHaptics();
  const { cards, source } = useCards();
  const { profile, isSignedIn, isLoading } = useAuth();
  const { cards: owned, owned: hasCollection } = useOwnedCards();

  /*
    The hand comes from the player's OWN collection (21 cards from the
    starter pack, plus anything pulled since). It used to be assembled from
    the global catalogue, so every player held an identical hand and owned
    nothing at all.

    Signed out there is no collection, so we show a catalogue preview and
    label it as one rather than implying the guest owns these cards.
  */
  const pool = hasCollection ? owned : cards;
  const hand5 = useMemo(() => {
    // Best of each tier, so the hype/stamina trade-off stays visible.
    const rank = { legendary: 0, epic: 1, rare: 2, common: 3 } as const;
    return [...pool]
      .sort((a, b) => rank[a.rarity] - rank[b.rarity] || b.hype - a.hype)
      .slice(0, 5);
  }, [pool]);

  /*
    The room's format/mode/host/id come from the `rooms` table, not the live
    Socket.io state (which only carries the in-memory reign/vibe/players).
    Loaded once and kept current on the same realtime channel other rooms
    use, so controlModelFor() and canPlayCard() see the real format instead
    of always assuming a contested Disco.
  */
  const [dbRoom, setDbRoom] = useState<DbRoom | null>(null);
  useEffect(() => {
    const db = supabase();
    if (!db) return;
    let cancelled = false;
    db.from('rooms').select('*').eq('slug', ROOM_SLUG).single().then(({ data }) => {
      if (!cancelled && data) setDbRoom(data as DbRoom);
    });
    const unsubscribe = subscribeToRoom(ROOM_SLUG, (r) => !cancelled && setDbRoom(r));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Connects to the hosted server when one is configured; otherwise falls
  // back to local simulation and SAYS so via the badge below.
  //
  // roomId (the slug) and roomUuid (dbRoom.id) are deliberately two
  // different values: the Socket.io server keys rooms by slug, but
  // challengers.room_id is a UUID foreign key into `rooms`. Until dbRoom
  // has loaded, roomUuid is null and useRoom leaves the challenger line
  // empty rather than querying with the wrong identifier.
  const { mode, room, line, setHolding: pushHold } = useRoom({
    roomId: ROOM_SLUG,
    roomUuid: dbRoom?.id ?? null,
    playerId: profile.id,
    displayName: profile.display_name,
  });

  const control = controlModelFor(dbRoom?.format ?? DEFAULT_FORMAT);
  /*
    canDethrone already returns false for spectator/delegated rooms
    (lib/domain/formats.ts) — the domain has always been right here. Only
    the screen used to lie, printing "THRONE" and dethrone/collapse copy in
    every format regardless of what canDethrone said. This flag is what the
    render below branches on to stop doing that.
  */
  const dethroneable = canDethrone(control);

  // Task 5 builds the mic UI proper; this screen only needs the holder's
  // name for the disc, which is why the hook is consumed here rather than
  // gated behind a not-yet-built panel.
  const mic = useMic(dbRoom?.id ?? null);

  /*
    Whose collection the card came from. card_ownership is RLS-scoped to the
    caller's own rows, so a client cannot read who else owns a card — the
    only owner it can truthfully name is the signed-in player. Crediting
    other players belongs with multiplayer card-play, which does not exist
    yet; inventing a name here would be the defect this branch removed.
  */
  const cardCredit = isSignedIn && hasCollection
    ? { ownerHandle: profile.handle, ownerName: profile.display_name }
    : null;

  const myPosition = positionOf(line, profile.id);
  const challengerLabel = myPosition ? `CHALLENGER #${myPosition}` : 'NOT IN LINE';

  /*
    Who actually holds control of the deck. This was the hardcoded string
    "MAYA J. HOLDS · NEON TEETH", which claimed a live reign by a player who
    was not in the room — the app asserted multiplayer state that did not
    exist. Say what is true instead: the real holder when the server reports
    one, and plain Solo Practice when nobody else is here (CLAUDE.md §6).

    Wording branches on control model: a contested room has a throne that
    can be taken; spectator and delegated rooms do not, so "THRONE" and
    dethrone-flavoured copy never appear there (CLAUDE.md §1.2 — vibe scores
    a spectator set, it cannot end one).
  */
  const holderLabel = useMemo(() => {
    const holder = (room as { holder_name?: string | null } | null)?.holder_name;
    if (dethroneable) {
      if (holder) return `${holder.toUpperCase()} HOLDS`;
      if (deckId) return 'YOU HOLD THE THRONE';
      return 'THRONE OPEN · PLAY A CARD';
    }
    if (control === 'delegated') {
      if (holder) return `${holder.toUpperCase()} IS DJING`;
      if (deckId) return 'YOU ARE DJING';
      return 'PICK FROM THE CROWD’S POOL';
    }
    // Spectator: the performer's name lives on PerformerDisc; this strip
    // only needs to say the set is live, never that it could be taken.
    if (holder) return `${holder.toUpperCase()} IS LIVE`;
    if (deckId) return 'YOU ARE LIVE';
    return 'SET NOT STARTED';
  }, [room, deckId, dethroneable, control]);

  /*
    Performer's display name for PerformerDisc, in spectator rooms. Same
    source as holderLabel above (the server-reported holder), falling back
    to the mic holder's name when the socket has not reported one yet, and
    finally to a plain "PERFORMER" rather than inventing an identity.
  */
  const performerName = useMemo(() => {
    const holder = (room as { holder_name?: string | null } | null)?.holder_name;
    if (holder) return holder.toUpperCase();
    const micHolder = mic.people.find((p) => p.playerId === mic.holderId);
    if (micHolder) return micHolder.displayName.toUpperCase();
    if (deckId) return (isSignedIn ? profile.display_name : 'YOU').toUpperCase();
    return 'PERFORMER';
  }, [room, mic.people, mic.holderId, deckId, isSignedIn, profile.display_name]);

  const [following, setFollowing] = useState(false);
  const onFollowPerformer = useCallback(() => {
    const target = dbRoom?.host_id;
    if (!target || !isSignedIn) return;
    const next = !following;
    setFollowing(next);
    void toggleFollow(target, next);
    play('tap');
    haptic('light');
  }, [dbRoom?.host_id, isSignedIn, following, play, haptic]);

  const deckCard = useMemo(() => hand5.find((c) => c.id === deckId) ?? null, [hand5, deckId]);
  const hand = useMemo(() => hand5.filter((c) => c.id !== deckId), [hand5, deckId]);

  const { vibe, holding, holdPct, startHold, endHold } = useVibe({
    stamina: deckCard?.stamina ?? 60,
    hype: deckCard?.hype ?? 62,
    control,
  });

  const color = vibeColor(vibe);

  /*
    Every play used to succeed unconditionally — the deck slot accepted
    any card tapped, regardless of room rules. Route the attempt through
    the same canPlayCard() the server enforces, and when it says no,
    explain why instead of silently doing nothing or pretending it worked.
  */
  const onPlayCard = useCallback((card: (typeof hand5)[number]) => {
    const verdict = canPlayCard({
      format: dbRoom?.format ?? DEFAULT_FORMAT,
      cardRule: dbRoom?.mode ?? 'casual',
      isHost: dbRoom?.host_id === profile.id,
      // The hand here is always SongCard (useCards/useOwnedCards) — no
      // Guest Card source feeds this screen yet, so this is never true.
      // Written as a real check, not `false`, so wiring one in later
      // (CLAUDE.md §2's OS "now playing" sync) doesn't require finding
      // and flipping a stale literal here.
      isGuestCard: (card as { kind: string }).kind === 'guest',
      owned: owned.some((c) => c.id === card.id),
    });
    if (!verdict.ok) {
      setRefusal(REFUSAL_COPY[verdict.reason]);
      return;
    }
    setRefusal(null);
    setDeckId(card.id);
    play('cardPlay');
    haptic('medium');
  }, [dbRoom, profile.id, deckId, owned, play, haptic]);

  const onHoldStart = useCallback(() => {
    startHold();
    pushHold(true);
    haptic('light');
  }, [startHold, pushHold, haptic]);

  const onHoldEnd = useCallback(() => {
    endHold();
    pushHold(false);
  }, [endHold, pushHold]);

  const onCritical = useCallback(() => {
    play('warn');
    haptic('warning');
  }, [play, haptic]);

  if (isLoading) {
    return (
      <PhoneShell>
        <div
          style={{
            padding: 'var(--sp-7)',
            textAlign: 'center',
            font: '400 9px/1 var(--font-tele)',
            letterSpacing: '.16em',
            color: 'var(--ink-25)',
          }}
        >
          LOADING…
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <div style={{ padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Player header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)' }}>
              YOU ARE
            </div>
            <div style={{ font: '400 22px/1 var(--font-title)', textTransform: 'uppercase', marginTop: 5 }}>
              {isSignedIn ? profile.display_name : 'Guest'}
            </div>
            {/*
              This used to print "Challenger #2" for every visitor — a queue
              position nobody held. NOT IN LINE is the honest default; a real
              rank only shows once positionOf() finds this player queued.

              A challenger line only exists where dethroning does — showing
              it in a spectator or delegated room would imply a queue to
              take over that the domain does not have (canDethrone is false
              there), so this whole line is contested-only.
            */}
            {dethroneable && (
              <div style={{ font: '500 9px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-40)', marginTop: 4 }}>
                {challengerLabel}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)' }}>
              DROPS
            </div>
            <div style={{ font: '700 22px/1 var(--font-stat)', color: 'var(--neon-gold)', marginTop: 4 }}>
              {profile.drops.toLocaleString()}
            </div>
          </div>
        </div>

        {/*
          Spectator rooms lead with the performer, not a throne strip — a
          Concert is a performance, and putting a "holds the throne" line
          above it implied the same contested duel a Disco runs. The disc
          spins while a set is live and stands still when nothing is
          playing or the deck slot is empty.
        */}
        {control === 'spectator' && (
          <PerformerDisc
            name={performerName}
            artworkUrl={deckCard?.artworkUrl ?? null}
            spinning={Boolean(deckCard) && vibe > 0}
            onFollow={onFollowPerformer}
            following={following}
          />
        )}

        {/* Live reign strip. In a spectator room this is applause scoring
            the set, never a collapse timer — canDethrone is false there,
            so nothing below ever reads as "about to end". */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 12px', borderRadius: 10,
            background: 'var(--booth-panel)', border: '1px solid var(--hairline)',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 3, background: color, flexShrink: 0 }} />
          <span
            style={{
              font: '500 9px/1 var(--font-tele)', letterSpacing: '.1em',
              color: 'var(--ink-60)', flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {holderLabel}
          </span>
          {control === 'spectator' && (
            <span style={{ font: '700 7px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-40)' }}>
              APPLAUSE
            </span>
          )}
          <VibeMeter vibe={vibe} onCritical={dethroneable ? onCritical : undefined} dethroneable={dethroneable} />
        </div>

        {/* Never silently simulate a multiplayer game (CLAUDE.md §6). */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:-8 }}>
          <span style={{ width:5, height:5, borderRadius:3, background: MODE_LABEL[mode].color }} />
          <span style={{ font:'400 7px/1 var(--font-tele)', letterSpacing:'.16em',
                         color: MODE_LABEL[mode].color }}>
            {MODE_LABEL[mode].text}
          </span>
          <span style={{ width:5, height:5, borderRadius:3, background: SOURCE_LABEL[source].color, marginLeft:6 }} />
          <span style={{ font:'400 7px/1 var(--font-tele)', letterSpacing:'.16em',
                         color: SOURCE_LABEL[source].color }}>
            {SOURCE_LABEL[source].text}
          </span>
          {/* Be explicit about whether these cards are actually the
              player's. A guest is browsing the catalogue, not holding a
              collection, and the app should not blur that. */}
          <span style={{ font:'400 7px/1 var(--font-tele)', letterSpacing:'.16em',
                         color: hasCollection ? 'var(--neon-mint)' : 'var(--ink-25)',
                         marginLeft: 8 }}>
            {hasCollection ? `YOUR COLLECTION · ${owned.length}` : 'PREVIEW · SIGN IN TO OWN'}
          </span>
        </div>

        {/*
          Deck slot. Height is clamped rather than fixed: on a short phone
          (iPhone SE) a fixed 240px pushed "Hold to Vibe" below the fold, and
          scrolling to reach the hold button mid-reign loses you the throne.
        */}
        <div
          style={{
            minHeight: 'clamp(180px, 28dvh, 240px)', borderRadius: 16,
            border: deckCard ? '1px solid var(--hairline)' : '2px dashed var(--hairline)',
            background: deckCard ? 'var(--booth-panel)' : 'transparent',
            display: 'grid', placeItems: 'center', padding: 16,
          }}
        >
          {deckCard ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <SongCardView card={deckCard} size="md" showSerial />
              <div style={{ width: '100%' }}>
                <NowPlaying
                  card={deckCard}
                  vibe={vibe}
                  compact
                  format={dbRoom?.format ?? DEFAULT_FORMAT}
                  credit={cardCredit}
                />
              </div>
              <button
                onClick={() => { setDeckId(null); play('tap'); }}
                style={{
                  font: '700 9px/1 var(--font-tele)', letterSpacing: '.16em',
                  padding: '9px 14px', borderRadius: 7,
                  border: 'var(--border-strong)', color: 'var(--ink-60)',
                }}
              >
                RETURN TO HAND
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--ink-25)' }}>
              <div style={{ font: '400 30px/1 var(--font-title)', animation: 'bob 2.6s ease-in-out infinite' }}>↑</div>
              <div style={{ font: '400 10px/1.7 var(--font-tele)', letterSpacing: '.18em', marginTop: 10 }}>
                TAP A CARD
                <br />
                TO PLAY IT
              </div>
            </div>
          )}
        </div>

        {/* Hold to Vibe */}
        <div>
          <button
            onPointerDown={onHoldStart}
            onPointerUp={onHoldEnd}
            onPointerLeave={onHoldEnd}
            onPointerCancel={onHoldEnd}
            aria-label="Hold to raise the room's vibe"
            style={{
              width: '100%', padding: '18px 0', borderRadius: 14,
              background: holding
                ? 'var(--vibe-hold-glow)'
                : 'var(--booth-panel)',
              border: `1px solid ${holding ? color : 'var(--hairline)'}`,
              transform: holding ? 'scale(.985)' : 'none',
              transition: 'transform .12s ease, background .2s ease, border-color .2s ease',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ font: '400 20px/1 var(--font-title)', textTransform: 'uppercase' }}>Hold to Vibe</span>
            <span style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em', color: 'var(--ink-40)' }}>
              {holding ? 'CROWD FEELS IT' : 'PRESS AND KEEP PRESSING'}
            </span>
          </button>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 7,
              font: '400 8px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-40)',
            }}
          >
            {/*
              There is no crowd-size signal anywhere in the app — nothing
              counts how many people are "holding". This used to be a
              literal 14, the same invented-count defect as the old
              "MAYA J. HOLDS" string. Report what is actually known: the
              real Challenger Line length, or Solo Practice when it's empty.

              "IN LINE" only means something where a challenger line exists
              — a contested room. Spectator and delegated rooms have no
              queue to take over, so they get the crowd-neutral SOLO
              PRACTICE / LIVE ROOM label instead of implying one.
            */}
            <span>
              {dethroneable
                ? line.length > 0 ? `${line.length} IN LINE` : 'SOLO PRACTICE'
                : mode === 'live' ? 'LIVE ROOM' : 'SOLO PRACTICE'}
            </span>
            <span>YOUR PULL {holdPct}%</span>
          </div>
        </div>

        {/* Hand — fanned, tap to play */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)' }}>
              YOUR HAND · {hand.length}
            </div>
            {/* A refused play is explained, never silently dropped. */}
            {refusal && (
              <div style={{ font: '500 9px/1 var(--font-tele)', letterSpacing: '.08em', color: 'var(--neon-pink)' }}>
                {refusal}
              </div>
            )}
          </div>
          <div style={{ position: 'relative', height: 'clamp(120px, 18dvh, 150px)', display: 'flex', justifyContent: 'center' }}>
            {hand.map((c, i) => {
              const mid = (hand.length - 1) / 2;
              const off = i - mid;
              return (
                <button
                  key={c.id}
                  onClick={() => onPlayCard(c)}
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${off * 52}px)`,
                    transform: `translateX(-50%) rotate(${off * 6}deg) translateY(${Math.abs(off) * 9}px)`,
                    transformOrigin: 'bottom center',
                    zIndex: 10 + i,
                    transition: 'transform .2s ease',
                  }}
                  /* Stats belong in the label: choosing between a high-hype
                     burner and a high-stamina holder is the whole decision. */
                  aria-label={`Play ${c.title} by ${c.subtitle}. ${RARITY[c.rarity].label}. Hype ${c.hype}, stamina ${c.stamina}.`}
                >
                  <SongCardView card={c} size="sm" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}
