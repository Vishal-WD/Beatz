'use client';

/**
 * Screen 02 — Deck & Hand.
 * Playing a card onto the deck slot is the ONLY way to start a reign
 * (CLAUDE.md §1).
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { SongCardView } from '@/components/SongCardView';
import { PhoneShell } from '@/components/PhoneChrome';
import { RoomLobby } from '@/components/RoomLobby';
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
// The SHARED player, not NowPlaying's own element: a reign is the room's
// now-playing, and it has to survive leaving this screen.
import { play as startPlayback, stop as stopPlayback } from '@/lib/usePlayer';
import { useOwnedCards } from '@/lib/useOwnedCards';
import { useAuth } from '@/lib/useAuth';
import {
  supabase, subscribeToRoom, toggleFollow,
  joinRoom, leaveRoom, fetchMyMembership, touchMembership,
  type DbRoom, type RoomMembership,
} from '@/lib/supabase';
import { controlModelFor, canDethrone, type FormatId } from '@/lib/domain/formats';
import { positionOf } from '@/lib/domain/challengers';
import { canPlayCard, type PlayRefusal } from '@/lib/domain/play-rules';
import { usesMic } from '@/lib/domain/mic';
import { MicPanel } from '@/components/MicPanel';

/* The room a first-time player lands in. Once they create or join another,
   the choice is remembered per device (see roomSlug below).

   Deliberately an OPEN, contested Disco: it is the format whose rules a new
   player can act on immediately (anyone may play, dethroning is on), and an
   open door means no guest list turns them away on first launch. */
const ROOM_SLUG = 'last-train-disco';

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

  /*
    The whole collection, best first -- NOT a fixed five.

    This used to end in .slice(0, 5), so a player holding 21 starter cards
    could reach exactly five of them, and once one was on the deck slot the
    hand showed four. Cards pulled from a pack were unreachable, which made
    the shop pointless: you could buy cards you could never play.

    The fan can only show a handful legibly at phone width, so the hand is
    scrolled rather than truncated: the rail below carries all of them and
    you flick through it.
  */
  const sorted = useMemo(() => {
    const rank = { legendary: 0, epic: 1, rare: 2, common: 3 } as const;
    return [...pool].sort((a, b) => rank[a.rarity] - rank[b.rarity] || b.hype - a.hype);
  }, [pool]);

  /* The rail scrolls, so every card is reachable and nothing is sliced
     away. Kept as its own name because the deck slot filters one out. */
  const hand5 = sorted;

  /*
    The room's format/mode/host/id come from the `rooms` table, not the live
    Socket.io state (which only carries the in-memory reign/vibe/players).
    Loaded once and kept current on the same realtime channel other rooms
    use, so controlModelFor() and canPlayCard() see the real format instead
    of always assuming a contested Disco.
  */
  /*
    Which room this screen is showing.

    This was pinned to ROOM_SLUG, so every player in the world was dropped
    into `basement-4am` on open -- you could not make a room, could not
    choose one, and two people could never be anywhere else. The slug is now
    state, remembered per device so returning to the tab does not silently
    move you.
  */
  /*
    Membership, from the database rather than from localStorage.

    The slug used to be remembered on the device and `useRoom` joined the
    socket on mount, so OPENING THE TAB put you in a room: the deck and
    hold-to-vibe were live before you had chosen anything, and there was no
    way to be outside a room at all. Membership is now a real row
    (`room_members`), so it survives a restart, the player count is honest,
    and "am I in a room" has a single answer the server agrees with.
  */
  const [membership, setMembership] = useState<RoomMembership | null>(null);
  const [memberState, setMemberState] = useState<'checking' | 'settled'>('checking');

  const refreshMembership = useCallback(async () => {
    const m = await fetchMyMembership();
    setMembership(m);
    setMemberState('settled');
  }, []);

  useEffect(() => {
    if (!isSignedIn) { setMembership(null); setMemberState('settled'); return; }
    void refreshMembership();
  }, [isSignedIn, refreshMembership]);

  /* A heartbeat, so a member who is present is not swept as stale. The
     sweep is what keeps lobby counts from counting ghosts. */
  useEffect(() => {
    if (!membership) return;
    const id = setInterval(() => void touchMembership(membership.roomId), 120_000);
    return () => clearInterval(id);
  }, [membership]);

  const roomSlug = membership?.slug ?? '';

  const enterRoom = useCallback(async (slug: string, code?: string) => {
    const res = await joinRoom(slug, code);
    if ('error' in res) return res;
    setDeckId(null);
    await refreshMembership();
    return res;
  }, [refreshMembership]);

  const exitRoom = useCallback(async () => {
    if (!membership) return;
    await leaveRoom(membership.roomId);
    setDeckId(null);
    await refreshMembership();
  }, [membership, refreshMembership]);

  const [dbRoom, setDbRoom] = useState<DbRoom | null>(null);
  useEffect(() => {
    const db = supabase();
    if (!db) return;
    let cancelled = false;
    setDbRoom(null); // never show the previous room's shape while switching
    if (!roomSlug) { setDbRoom(null); return; }
    db.from('rooms').select('id,slug,name,mode,host_id,vibe,solo_practice,is_open,updated_at,format,visibility,mic_mode').eq('slug', roomSlug).single().then(({ data }) => {
      if (!cancelled && data) setDbRoom(data as DbRoom);
    });
    const unsubscribe = subscribeToRoom(roomSlug, (r) => !cancelled && setDbRoom(r));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [roomSlug]);

  // Connects to the hosted server when one is configured; otherwise falls
  // back to local simulation and SAYS so via the badge below.
  //
  // roomId (the slug) and roomUuid (dbRoom.id) are deliberately two
  // different values: the Socket.io server keys rooms by slug, but
  // challengers.room_id is a UUID foreign key into `rooms`. Until dbRoom
  // has loaded, roomUuid is null and useRoom leaves the challenger line
  // empty rather than querying with the wrong identifier.
  const { mode, room, line, setHolding: pushHold, playCard: pushCard } = useRoom({
    // No membership, no socket. This is the gate that stops the tab from
    // silently joining you to a room you never chose.
    disabled: !membership,
    roomId: roomSlug,
    roomUuid: dbRoom?.id ?? null,
    playerId: profile.id,
    displayName: profile.display_name,
  });

  /*
    How many people are actually here, from the socket's live player list.
    Used instead of the challenger-line length for the SOLO PRACTICE label:
    an empty QUEUE is not an empty ROOM, and conflating the two is what made
    a room of four read as solo practice.

    Falls back to 1 (you) when the socket has not reported yet, so the label
    never claims a crowd it cannot see.
  */
  const roomPeople = Math.max(room?.players?.length ?? 1, 1);
  const alone = roomPeople <= 1;

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

  /*
    What is on the deck, whoever put it there.

    `deckId` is only ever MY card, so resolving against my own hand meant a
    card somebody else played could not be found -- I do not own it and it is
    not in my five. The room's reign is the authority on what is playing, and
    it names a cardId; the catalogue resolves it for everyone in the room.

    Falling back to the local hand keeps Solo Practice working, where there
    is no server reign at all.
  */
  const reignCardId = room?.reign?.cardId ?? null;
  const deckCard = useMemo(() => {
    const id = reignCardId ?? deckId;
    if (!id) return null;
    return hand5.find((c) => c.id === id) ?? cards.find((c) => c.id === id) ?? null;
  }, [hand5, cards, reignCardId, deckId]);

  /** True when the throne is somebody else's — I am listening, not playing. */
  const someoneElseHolds =
    Boolean(room?.reign) && room?.reign?.playerId !== profile.id;

  /*
    The room listens together.

    A reign is the room's now-playing, so when one starts every phone in the
    room plays that track -- not just the phone that played the card. This is
    the whole point of a listening room, and it was missing: card:play was
    never even emitted, so no reign existed to react to.

    Deliberately NOT seeked to a shared position. Phones join a reign at
    different moments and a hard seek on every state update would stutter the
    audio for everyone; starting from the top is the honest simple version.
    Real sync needs the server to broadcast a clock, which is its own change.
  */
  const reignStartedAt = room?.reign?.startedAt ?? null;
  useEffect(() => {
    if (!membership) return;

    // No reign: the room is silent. Stop whatever the room started.
    if (!reignCardId) { stopPlayback(); return; }

    const track = deckCard;
    if (!track?.previewUrl) return;

    // Autoplay needs a prior gesture on some browsers. The person who played
    // the card just tapped, and everyone else tapped to enter the room, so
    // in practice this is allowed -- and usePlayer reports 'error' rather
    // than throwing when it is not.
    startPlayback(track, [track]);
    // reignStartedAt changes on every new reign, which is what re-triggers
    // this for the next song rather than only the first.
  }, [membership, reignCardId, reignStartedAt, deckCard]);

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

    /*
      Tell the room. Without this the card was played PURELY locally: the
      socket never heard about it, no reign started, and nobody else saw or
      heard a thing -- each phone was running its own private jukebox.
    */
    pushCard(card.id);

    play('cardPlay');
    haptic('medium');
  }, [dbRoom, profile.id, deckId, owned, play, haptic, pushCard]);

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

  /*
    Not in a room: the tab is a lobby, not a deck.

    This branch is the whole point of the membership work. Everything below
    it -- the deck slot, hold-to-vibe, the hand, the queue -- assumes you
    have joined something, and it used to render before you had.
  */
  if (memberState === 'checking') {
    return (
      <PhoneShell>
        <div
          style={{
            padding: 'var(--sp-7)', textAlign: 'center',
            font: '400 9px/1 var(--font-tele)', letterSpacing: '.16em',
            color: 'var(--ink-25)',
          }}
        >
          LOADING…
        </div>
      </PhoneShell>
    );
  }

  if (!membership) {
    return (
      <PhoneShell>
        <RoomLobby onEnter={enterRoom} isSignedIn={isSignedIn} />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      {/* The card rail is the last thing on this screen and it sat flush
          against the tab bar, so the bottom row of every card was clipped.
          The extra bottom padding is the rail's breathing room, not the
          page's. */}
      <div style={{ padding: '4px 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        {/*
          Concert and Fest arbitrate the mic among themselves (solo hand-off,
          per-song vote, or a prior setlist — lib/domain/mic.ts). Gated on
          usesMic(), which is false for Clubbing: one DJ invited at room
          creation, nothing to arbitrate. Gating on "is spectator" would
          wrongly pull Clubbing in too. mic_mode is also required — a room
          can be a Concert/Fest format before a mode has been chosen.
        */}
        {usesMic(dbRoom?.format ?? DEFAULT_FORMAT) && dbRoom?.mic_mode && (
          <MicPanel mode={dbRoom.mic_mode} mic={mic} ownedCards={owned} />
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

        {/*
          Which room you are in, and the way out of it. Without this the
          screen was a dead end: one hardcoded room, no way to open another
          and no way to see that others existed.
        */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: -4 }}>
          <span style={{
            font: '400 15px/1.05 var(--font-title)', textTransform: 'uppercase',
            color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {dbRoom?.name ?? 'LOADING…'}
          </span>
          {/*
            LEAVE, not ROOMS. Browsing moved to the lobby (this screen when
            you have no membership), so the only room action from inside a
            room is getting out of it. The host handing over rather than
            closing the room is decided server-side in leave_room.
          */}
          <button
            onClick={() => { void exitRoom(); play('tap'); haptic('light'); }}
            data-press
            aria-label="Leave this room"
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 6,
              font: '600 11px/1 var(--font-body)', letterSpacing: '-0.01em',
              padding: '9px 13px', borderRadius: 'var(--radius-pill)',
              background: 'var(--glass-regular)',
              backdropFilter: 'var(--glass-blur-thin)',
              WebkitBackdropFilter: 'var(--glass-blur-thin)',
              border: 'var(--border-hair)',
              boxShadow: 'var(--glass-edge)',
              color: 'var(--ink)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden
                 stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
              <path d="m15 16 5-4-5-4" />
              <path d="M20 12H9" />
            </svg>
            LEAVE
          </button>
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
            /*
              Card and player SIDE BY SIDE, not stacked.

              Stacked, the slot came to 431px on a 390x844 phone -- the card
              art alone is 209px and the player sat underneath it -- which
              pushed 197px past the fold, so Hold to Vibe and the hand rail
              fell off the screen while a card was in play. Scrolling to
              reach the hold button mid-reign loses you the throne, which is
              the same reason the slot's height was clamped in the first
              place.

              A row fits both inside the clamp: the card shrinks to `sm`
              because at this size it is an identifier, not the thing you
              read stats off -- those are in the player beside it.
            */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', minWidth: 0 }}>
              {/*
                minWidth:0 on the ROW, not just its children.

                A flex item defaults to min-width:auto, which means it refuses
                to shrink below its content. The player's title and credit
                line are long, so the row sized to THEM -- 543px inside a
                358px slot -- and the ellipsis on the text below never got a
                chance to apply, because nothing was ever narrow enough to
                trigger it. The overflow then spilled past the panel's
                rounded border.
              */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minWidth: 0 }}>
                <SongCardView card={deckCard} size="sm" showSerial />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <NowPlaying
                    card={deckCard}
                    vibe={vibe}
                    compact
                    format={dbRoom?.format ?? DEFAULT_FORMAT}
                    credit={cardCredit}
                  />
                </div>
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
              {/*
                SOLO PRACTICE means you are genuinely alone -- CLAUDE.md §6
                calls it a labelled mode, never a silent fallback. It used to
                print whenever the CHALLENGER LINE was empty, so a live room
                with four people in it read as SOLO PRACTICE the moment
                nobody was queued, directly next to a LIVE ROOM badge saying
                the opposite. The room's player count is the honest signal.
              */}
              {alone
                ? 'SOLO PRACTICE'
                : dethroneable && line.length > 0
                  ? `${line.length} IN LINE`
                  : `${roomPeople} IN THE ROOM`}
            </span>
            <span>YOUR PULL {holdPct}%</span>
          </div>
        </div>

        {/* Hand — fanned, tap to play */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            {/* The collection count already sits in the room header above;
                repeating it here as "YOUR HAND" said the same number twice
                under two different names. */}
            <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)' }}>
              YOUR HAND
            </div>
            {/* A refused play is explained, never silently dropped. */}
            {refusal && (
              <div style={{ font: '500 9px/1 var(--font-tele)', letterSpacing: '.08em', color: 'var(--neon-pink)' }}>
                {refusal}
              </div>
            )}
          </div>
          {/*
            A scroll rail, not a pager.

            This was ‹ PREV / NEXT › over a five-card fan, so reaching card
            20 of 21 meant four taps and the fan could never show more than
            five. A horizontal snap rail carries the WHOLE collection: you
            flick through it the way you flick any iOS row, and each card
            settles into place because of scroll-snap rather than a
            transition we drive by hand.

            The count moves into the header above; the rail itself needs no
            chrome to explain it.
          */}
          <div
            role="list"
            aria-label={`Your cards, ${sorted.length} total`}
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
              // Breathing room so the first and last card can centre.
              padding: '4px 50% 10px',
              scrollPaddingInline: '50%',
            }}
          >
            {hand.map((c, i) => (
              <div
                key={c.id}
                role="listitem"
                data-rise
                style={{
                  scrollSnapAlign: 'center',
                  flexShrink: 0,
                  // Each card lands a beat after the one before it.
                  animationDelay: `${Math.min(i, 8) * 35}ms`,
                }}
              >
                <button
                  data-press
                  onClick={() => onPlayCard(c)}
                  style={{ display: 'block', background: 'none', border: 'none', padding: 0 }}
                  /* Stats belong in the label: choosing between a high-hype
                     burner and a high-stamina holder is the whole decision. */
                  aria-label={`Play ${c.title} by ${c.subtitle}. ${RARITY[c.rarity].label}. Hype ${c.hype}, stamina ${c.stamina}.`}
                >
                  <SongCardView card={c} size="sm" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

    </PhoneShell>
  );
}
