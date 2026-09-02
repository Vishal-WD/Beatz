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
import type { FeedSources } from './domain/activity';

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
 * Atomic Challenger Line join (CLAUDE.md §6).
 * Position comes from the database, never from an array push — two players
 * tapping join in the same tick get distinct slots.
 */
export async function joinChallengerLine(roomId: string): Promise<number | null> {
  const db = supabase();
  if (!db) return null;
  const { data, error } = await db.rpc('join_challenger_line', { p_room_id: roomId });
  if (error) {
    console.warn('[supabase] joinChallengerLine:', error.message);
    return null;
  }
  return data as number;
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
