'use client';

/**
 * Supabase client — project "auxwars" (ap-south-1).
 *
 * Deliberately a SEPARATE project from "Circl". The two apps have
 * incompatible security models: Circl isolates by tenant (`company_id` with
 * composite foreign keys, hardened against cross-tenant leaks), AuxWars
 * isolates by player (`auth.uid()`). Mixing them in one database would mean
 * every future RLS policy has to be correct under both models at once.
 *
 * The publishable key below is safe in client code — it is the anon key, and
 * every table is protected by row-level security. It is NOT a secret; the
 * service role key (which bypasses RLS) never leaves the server and is never
 * given a NEXT_PUBLIC_ prefix.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ChartRow } from './domain/chart';
import type { FeedSources } from './domain/activity';
import type { PackTier } from './domain/packs';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False when no project is configured — the app then runs on seeded data. */
export const isSupabaseConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(URL, KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The APK has no URL bar, so there is no OAuth redirect fragment
        // to detect. Leaving this on causes a needless parse on every load.
        detectSessionInUrl: false,
      },
      realtime: {
        // The Vibe Bar ticks at 420ms. Anything slower than ~2 events/sec
        // makes a live room feel like a stale one.
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return client;
}

// ---------------------------------------------------------------------------
// Row types, mirroring the applied migrations.
// ---------------------------------------------------------------------------

export interface DbCard {
  id: string;
  mb_recording_id: string;
  title: string;
  subtitle: string;
  language: string | null;
  flavor_text: string | null;
  artwork_url: string | null;
  artwork_source: 'caa' | 'spotify' | 'itunes' | 'os_sync' | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  hype: number;
  stamina: number;
  supply_total: number;
  supply_remaining: number;
  youtube_video_id: string | null;
  /** Apple 30s preview. Present on chart-sourced cards; CORS-open. */
  preview_url: string | null;
  jamendo_track_id: string | null;
  playback_mode: 'youtube_embed' | 'spotify_handoff' | 'jamendo_local';
  audio_analyzable: boolean;
  license_variant: string | null;
  attribution_text: string | null;
  license_url: string | null;
  needs_review: boolean;
  created_at: string;
}

export interface DbProfile {
  id: string;
  handle: string;
  display_name: string;
  initials: string;
  avatar_gradient: string | null;
  bio: string | null;
  tier: string;
  season_badge: string | null;
  drops: number;
  total_reigns_won: number;
  peak_vibe: number;
  challenger_wins: number;
  challenger_attempts: number;
}

export interface DbRoom {
  id: string;
  slug: string;
  name: string;
  mode: 'casual' | 'event';
  host_id: string | null;
  vibe: number;
  solo_practice: boolean;
  is_open: boolean;
  updated_at: string;
  /** Which of the six formats this room runs (CLAUDE.md §1.1). */
  format: 'concert' | 'fest' | 'clubbing' | 'night_party' | 'disco' | 'private_party';
  /** Who may enter. Independent of `mode`, which is what may be played. */
  visibility: 'open' | 'guest_list';
}

export interface DbEvent {
  id: string;
  slug: string;
  kind: 'disco' | 'dj_night' | 'house_party' | 'listening' | 'tournament';
  title: string;
  tagline: string | null;
  host_id: string;
  poster_gradient: string;
  poster_accent: string;
  starts_at: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  venue_name: string;
  venue_hint: string | null;
  is_online: boolean;
  room_id: string;
  capacity: number | null;
  genre_tags: string[];
}

// ---------------------------------------------------------------------------
// Queries. Every one of these degrades to null rather than throwing, so a
// missing or unreachable backend leaves the app on seeded data instead of
// white-screening.
// ---------------------------------------------------------------------------

/**
 * Mints a Legendary for a live Peak Moment. Returns the card id, or null
 * when this reign has already minted.
 *
 * CLAUDE.md §3 allows exactly two legendary paths and this is the second.
 * The reign row itself is the guard — one mint per reign — so a vibe parked
 * at 100 cannot farm them.
 */
export async function mintPeakMoment(reignId: string): Promise<string | null> {
  const db = supabase();
  if (!db) return null;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await db.rpc('mint_peak_moment', {
    p_user: auth.user.id,
    p_reign: reignId,
  });
  if (error) {
    console.warn('[supabase] mintPeakMoment:', error.message);
    return null;
  }
  return (data as string) ?? null;
}

/**
 * Rows for the world chart. Scarcity is derived in lib/domain/chart.ts —
 * this only fetches what the database already tracks.
 */
export async function fetchChartRows(): Promise<ChartRow[] | null> {
  const db = supabase();
  if (!db) return null;
  const { data, error } = await db
    .from('cards')
    .select('id, title, subtitle, rarity, artwork_url, supply_total, supply_remaining');
  if (error) {
    console.warn('[supabase] fetchChartRows:', error.message);
    return null;
  }
  return (data ?? []).map((c) => ({
    cardId: c.id,
    title: c.title,
    subtitle: c.subtitle,
    rarity: c.rarity,
    artworkUrl: c.artwork_url,
    supplyTotal: c.supply_total,
    supplyRemaining: c.supply_remaining,
  }));
}

/**
 * The cards this player has pinned to their showcase.
 *
 * The profile screen used to pin `ALL_CARDS.slice(0, 4)` — the first four
 * cards of the global catalogue, identical for every player and unrelated
 * to anything they owned. The pinned_cards table has existed all along.
 *
 * Reads are public (a showcase is meant to be seen); writes are RLS-scoped
 * to the owner.
 */
export async function fetchPinnedCards(ownerId: string): Promise<DbCard[]> {
  const db = supabase();
  if (!db || !ownerId) return [];
  const { data, error } = await db
    .from('pinned_cards')
    .select('position, card_ownership(cards(*))')
    .eq('owner_id', ownerId)
    .order('position');
  if (error) {
    console.warn('[supabase] fetchPinnedCards:', error.message);
    return [];
  }
  return (data ?? [])
    .map((row) => {
      // postgrest types embedded rows as arrays; to-one relations arrive
      // as single objects at runtime. Accept either, at both levels.
      const r = row as unknown as {
        card_ownership: { cards: DbCard | DbCard[] | null } | { cards: DbCard | DbCard[] | null }[] | null;
      };
      const own = Array.isArray(r.card_ownership) ? r.card_ownership[0] : r.card_ownership;
      const card = own && (Array.isArray(own.cards) ? own.cards[0] : own.cards);
      return card ?? null;
    })
    .filter(Boolean) as DbCard[];
}

/** Pin or unpin one owned copy. Position is its slot in the showcase. */
export async function setPinned(
  ownershipId: string,
  position: number | null,
): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return false;

  if (position === null) {
    const { error } = await db
      .from('pinned_cards')
      .delete()
      .match({ owner_id: auth.user.id, ownership_id: ownershipId });
    return !error;
  }
  const { error } = await db
    .from('pinned_cards')
    .upsert({ owner_id: auth.user.id, ownership_id: ownershipId, position });
  return !error;
}

export interface LinePlayer {
  playerId: string;
  position: number;
  initials: string;
  displayName: string;
}

/**
 * The challenger line for a room, resolved to displayable players.
 *
 * The Throne Room screen rendered a fixture of invented initials (DR, SV,
 * ET, JU) as though those people were queued. That screen is the 1280x720
 * shared display an audience watches, so fabricated players are worse there
 * than anywhere else in the app.
 *
 * Takes the room's UUID, not its slug: the socket keys rooms by slug while
 * the database keys them by id, and passing the wrong one silently matches
 * no rows.
 */
export async function fetchChallengerLine(roomUuid: string): Promise<LinePlayer[]> {
  const db = supabase();
  if (!db || !roomUuid) return [];
  const { data, error } = await db
    .from('challengers')
    .select('player_id, position, profiles(initials, display_name)')
    .eq('room_id', roomUuid)
    .order('position');
  if (error) {
    console.warn('[supabase] fetchChallengerLine:', error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const row = r as unknown as {
      player_id: string;
      position: number;
      profiles: { initials: string; display_name: string } | { initials: string; display_name: string }[] | null;
    };
    // postgrest types an embedded row as an array; a to-one relation
    // arrives as a single object at runtime. Accept either.
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      playerId: row.player_id,
      position: row.position,
      initials: prof?.initials ?? '??',
      displayName: prof?.display_name ?? 'Challenger',
    };
  });
}

export interface PackPull {
  cardId: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  serialNumber: number;
  downgraded: boolean;
}

/**
 * Opens a pack: spends Drops and claims scarce supply.
 *
 * Both halves happen inside `open_pack`, in one transaction. A client-side
 * read-then-write would let two devices oversell the last copy of a card and
 * spend the same balance twice (CLAUDE.md §3), and a client that died
 * mid-call could leave Drops debited with no cards granted.
 *
 * The RPC's OUT columns are prefixed `out_` because a plain `rarity` collides
 * with `cards.rarity` inside the function's own pull query.
 */
export async function openPack(tier: PackTier): Promise<PackPull[] | { error: string }> {
  const db = supabase();
  if (!db) return { error: 'No backend configured.' };
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: 'Sign in to open packs.' };

  const { data, error } = await db.rpc('open_pack', {
    p_user: auth.user.id,
    p_tier: tier,
  });
  if (error) {
    return {
      error: error.message.includes('insufficient_drops')
        ? 'Not enough Drops for that pack.'
        : 'Could not open the pack. Try again.',
    };
  }
  return (data ?? []).map((r: {
    out_card_id: string;
    out_rarity: PackPull['rarity'];
    out_serial: number;
    out_downgraded: boolean;
  }) => ({
    cardId: r.out_card_id,
    rarity: r.out_rarity,
    serialNumber: r.out_serial,
    downgraded: r.out_downgraded,
  }));
}

export async function fetchCards(): Promise<DbCard[] | null> {
  const db = supabase();
  if (!db) return null;
  const { data, error } = await db.from('cards').select('*').order('rarity');
  if (error) {
    console.warn('[supabase] fetchCards:', error.message);
    return null;
  }
  return data as DbCard[];
}

/**
 * The cards THIS player owns.
 *
 * Distinct from fetchCards(), which returns the whole catalogue. The deck
 * previously drew a "hand" straight from the catalogue, so every player saw
 * the same five cards and owned nothing — card_ownership existed in the
 * schema but nothing read it. Ownership is what makes a collection real, and
 * what the supply rules in CLAUDE.md §3 are protecting.
 *
 * Returns null when signed out, which the caller shows as a guest preview.
 */
export async function fetchOwnedCards(): Promise<DbCard[] | null> {
  const db = supabase();
  if (!db) return null;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await db
    .from('card_ownership')
    .select('serial_number, acquired_at, cards(*)')
    .eq('owner_id', auth.user.id)
    .order('acquired_at', { ascending: false });

  if (error) {
    console.warn('[supabase] fetchOwnedCards:', error.message);
    return null;
  }

  // The join nests the card; lift it out and keep the owner's own serial,
  // which is per-copy and not a property of the catalogue row.
  // postgrest-js types an embedded row as an array; at runtime a to-one
  // relationship arrives as a single object. Accept either.
  return (data ?? [])
    .map((row) => {
      const r = row as unknown as { serial_number: number; cards: DbCard | DbCard[] | null };
      const c = Array.isArray(r.cards) ? r.cards[0] : r.cards;
      return c ? { ...c, supply_total: c.supply_total, __serial: r.serial_number } : null;
    })
    .filter(Boolean) as DbCard[];
}

export async function fetchEvents(): Promise<DbEvent[] | null> {
  const db = supabase();
  if (!db) return null;
  const { data, error } = await db
    .from('events')
    .select('*')
    .in('status', ['scheduled', 'live'])
    .order('starts_at');
  if (error) {
    console.warn('[supabase] fetchEvents:', error.message);
    return null;
  }
  return data as DbEvent[];
}

/** Live RSVP counts, from the security_invoker view. */
export async function fetchEventCounts(): Promise<Map<string, number>> {
  const db = supabase();
  const counts = new Map<string, number>();
  if (!db) return counts;
  const { data } = await db.from('event_counts').select('*');
  for (const row of data ?? []) counts.set(row.event_id, row.going_count ?? 0);
  return counts;
}

/**
 * Raw material for the activity feed (lib/domain/activity.ts).
 *
 * Three independent reads, shaped into FeedSources for buildFeed(). Note on
 * `pulls`: RLS scopes card_ownership SELECT to the caller's own rows
 * (owner_id = auth.uid()), so this only ever surfaces the signed-in
 * player's own pulls — that's the security model, not a bug to work around.
 *
 * Returns null on error so the caller renders an empty state rather than a
 * stale fixture.
 */
export async function fetchFeedSources(): Promise<FeedSources | null> {
  const db = supabase();
  if (!db) return null;

  try {
    const [{ data: reignRows, error: reignErr }, { data: pullRows, error: pullErr }, { data: followRows, error: followErr }] =
      await Promise.all([
        db
          .from('reigns')
          .select('id, peak_vibe, ended_at, profiles(display_name), cards(title)')
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(50),
        db
          .from('card_ownership')
          .select('id, acquired_at, acquired_via, cards(title, rarity)')
          .in('acquired_via', ['pack', 'peak_moment'])
          .order('acquired_at', { ascending: false })
          .limit(50),
        db
          .from('follows')
          .select('follower_id, followee_id, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

    if (reignErr || pullErr || followErr) {
      console.warn(
        '[supabase] fetchFeedSources:',
        reignErr?.message ?? pullErr?.message ?? followErr?.message,
      );
      return null;
    }

    // Follower/followee names need a profile lookup the join above can't
    // reach directly (follows has no FK alias set up for two profile rows).
    const { data: auth } = await db.auth.getUser();
    const followIds = new Set<string>();
    for (const f of followRows ?? []) {
      followIds.add(f.follower_id);
      followIds.add(f.followee_id);
    }
    const profileRows = followIds.size
      ? (await db.from('profiles').select('id, display_name').in('id', Array.from(followIds))).data
      : [];
    const nameById = new Map<string, string>((profileRows ?? []).map((p) => [p.id, p.display_name]));

    const reigns = (reignRows ?? []).map((r) => {
      const row = r as unknown as {
        id: string;
        peak_vibe: number;
        ended_at: string;
        profiles: { display_name: string } | { display_name: string }[] | null;
        cards: { title: string } | { title: string }[] | null;
      };
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
      return {
        id: row.id,
        playerName: profile?.display_name ?? 'Someone',
        cardTitle: card?.title ?? 'a card',
        peakVibe: row.peak_vibe,
        endedAt: row.ended_at,
      };
    });

    const pulls = (pullRows ?? []).map((p) => {
      const row = p as unknown as {
        id: string;
        acquired_at: string;
        cards: { title: string; rarity: string } | { title: string; rarity: string }[] | null;
      };
      const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
      return {
        id: row.id,
        playerName: auth.user ? 'You' : 'Someone',
        cardTitle: card?.title ?? 'a card',
        rarity: card?.rarity ?? 'common',
        acquiredAt: row.acquired_at,
      };
    });

    const follows = (followRows ?? []).map((f) => ({
      id: `${f.follower_id}:${f.followee_id}:${f.created_at}`,
      followerName: nameById.get(f.follower_id) ?? 'Someone',
      followeeName: nameById.get(f.followee_id) ?? 'someone',
      createdAt: f.created_at,
    }));

    return { reigns, pulls, follows };
  } catch (e) {
    console.warn('[supabase] fetchFeedSources:', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function setRsvp(
  eventId: string,
  state: 'going' | 'interested' | null,
): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return false;

  if (state === null) {
    const { error } = await db
      .from('rsvps')
      .delete()
      .match({ event_id: eventId, player_id: auth.user.id });
    return !error;
  }

  const { error } = await db
    .from('rsvps')
    .upsert({ event_id: eventId, player_id: auth.user.id, state });
  return !error;
}

export async function toggleFollow(followeeId: string, follow: boolean): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return false;

  if (follow) {
    const { error } = await db
      .from('follows')
      .upsert({ follower_id: auth.user.id, followee_id: followeeId });
    return !error;
  }
  const { error } = await db
    .from('follows')
    .delete()
    .match({ follower_id: auth.user.id, followee_id: followeeId });
  return !error;
}

/**
 * Live room subscription. Returns an unsubscribe function.
 *
 * NOTE: `claim_card_supply` is deliberately NOT callable from here. EXECUTE
 * was revoked from anon and authenticated after the Supabase advisor flagged
 * that anyone could otherwise drain every legendary's supply over the public
 * REST API without even signing in. Pulls go through server-side logic.
 */
export function subscribeToRoom(
  roomSlug: string,
  onChange: (room: DbRoom) => void,
): () => void {
  const db = supabase();
  if (!db) return () => {};

  const channel = db
    .channel(`room:${roomSlug}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `slug=eq.${roomSlug}` },
      (payload) => {
        if (payload.new) onChange(payload.new as DbRoom);
      },
    )
    .subscribe();

  return () => {
    void db.removeChannel(channel);
  };
}

/** Map a database row onto the app's SongCard shape. */
export function dbCardToSongCard(c: DbCard) {
  return {
    id: c.id,
    kind: 'song' as const,
    title: c.title,
    subtitle: c.subtitle,
    artworkUrl: c.artwork_url,
    artworkSource: c.artwork_source,
    rarity: c.rarity,
    primaryStat: c.hype,
    secondaryStat: c.stamina,
    flavorText: c.flavor_text,
    language: c.language,
    createdAt: c.created_at,
    mbRecordingId: c.mb_recording_id,
    mbReleaseGroupId: null,
    isrc: null,
    spotifyTrackId: null,
    deezerTrackId: null,
    youtubeVideoId: c.youtube_video_id,
    previewUrl: c.preview_url,
    jamendoTrackId: c.jamendo_track_id,
    artists: [],
    isCollab: false,
    hype: c.hype,
    stamina: c.stamina,
    popularitySnapshot: {
      spotifyPopularity: null,
      spotifyFollowers: null,
      deezerRank: null,
      capturedAt: c.created_at,
    },
    serialNumber: c.supply_total - c.supply_remaining + 1,
    supplyTotal: c.supply_total,
    supplyRemaining: c.supply_remaining,
    playbackMode: c.playback_mode,
    audioAnalyzable: c.audio_analyzable,
    licenseVariant: c.license_variant,
    attributionText: c.attribution_text,
    licenseUrl: c.license_url,
  };
}
