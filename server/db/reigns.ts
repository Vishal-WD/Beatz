/**
 * Writing reigns back to Postgres.
 *
 * The socket server held every room in memory and never touched the
 * database, so a whole multiplayer session left no trace: the activity feed
 * (which reads `reigns`) stayed empty, and Total Reigns Won / Peak Vibe on
 * the profile screen never moved however long people played. The loop
 * worked and then forgot itself.
 *
 * This is deliberately best-effort. A database that is slow or unreachable
 * must never stall the tick loop or drop a socket — a party app that
 * freezes because a write timed out is worse than one with a gappy feed.
 * Every function here swallows its errors and logs them.
 *
 * Uses the SERVICE ROLE key, which bypasses RLS. That is correct here and
 * only here: this process is trusted, runs server-side, and writes reigns
 * on behalf of whichever player holds the throne. The key must never be
 * given a NEXT_PUBLIC_ prefix or reach the client.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** False when the server is running without credentials — then it just
 *  keeps everything in memory, exactly as it did before. */
export const persistenceEnabled = Boolean(URL && SERVICE_KEY);

let client: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  if (!persistenceEnabled) return null;
  if (!client) {
    client = createClient(URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Room slug -> room UUID, so we resolve each slug at most once. */
const roomIdCache = new Map<string, string | null>();

async function roomUuid(slug: string): Promise<string | null> {
  if (roomIdCache.has(slug)) return roomIdCache.get(slug) ?? null;
  const c = db();
  if (!c) return null;
  const { data, error } = await c.from('rooms').select('id').eq('slug', slug).maybeSingle();
  if (error) {
    console.warn('[beatz:db] roomUuid:', error.message);
    return null;
  }
  const id = data?.id ?? null;
  roomIdCache.set(slug, id);
  return id;
}

/**
 * Opens a reign row. Returns its id so the tick loop can close the same row
 * later, or null when persistence is off or the write failed.
 */
export async function openReign(args: {
  roomSlug: string;
  playerId: string;
  cardId: string;
  startingVibe: number;
  decayRate: number;
}): Promise<string | null> {
  const c = db();
  if (!c) return null;
  try {
    const room = await roomUuid(args.roomSlug);
    if (!room) return null;

    const { data, error } = await c
      .from('reigns')
      .insert({
        room_id: room,
        player_id: args.playerId,
        card_id: args.cardId,
        starting_vibe: Math.round(args.startingVibe),
        peak_vibe: Math.round(args.startingVibe),
        decay_rate: args.decayRate,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[beatz:db] openReign:', error.message);
      return null;
    }
    return data.id as string;
  } catch (e) {
    console.warn('[beatz:db] openReign threw:', (e as Error).message);
    return null;
  }
}

/**
 * Closes a reign and folds it into the player's lifetime stats.
 *
 * `end_reign` is the same function the client path uses, so the handover
 * rule (only a contested room promotes a challenger) is enforced in exactly
 * one place. It maps the domain's end reasons onto the storage vocabulary.
 */
export async function closeReign(
  reignId: string,
  reason: 'collapsed' | 'skipped' | 'set_ended',
  peakVibe: number,
): Promise<void> {
  const c = db();
  if (!c) return;
  try {
    await c.from('reigns').update({ peak_vibe: Math.round(peakVibe) }).eq('id', reignId);
    const { error } = await c.rpc('end_reign', { p_reign: reignId, p_reason: reason });
    if (error) console.warn('[beatz:db] closeReign:', error.message);
  } catch (e) {
    console.warn('[beatz:db] closeReign threw:', (e as Error).message);
  }
}

/**
 * The playable card pool, by id.
 *
 * `playCard` used to validate against `cardById` from lib/seed-data.ts — a
 * ten-card design fixture whose ids look like `gen-000`, while every real
 * card id is a uuid. The two pools shared no id at all, so once the app read
 * real cards, EVERY play of a real card was rejected as CARD_NOT_FOUND.
 * Multiplayer card play only worked for cards that no longer existed.
 *
 * Loaded once and cached: the pool changes when someone runs a seed script,
 * not during a night, and `playCard` is on the hot path of every tap.
 */
export interface ServerCard {
  id: string;
  kind: 'song';
  title: string;
  subtitle: string;
  hype: number;
  stamina: number;
}

let cardCache: Map<string, ServerCard> | null = null;
let cardLoad: Promise<Map<string, ServerCard>> | null = null;

export async function loadCards(): Promise<Map<string, ServerCard>> {
  if (cardCache) return cardCache;
  if (cardLoad) return cardLoad;

  cardLoad = (async () => {
    const c = db();
    if (!c) return new Map<string, ServerCard>();

    const { data, error } = await c
      .from('cards')
      .select('id, title, subtitle, hype, stamina');

    if (error || !data) {
      console.warn('[db] loadCards:', error?.message ?? 'no rows');
      // Do NOT cache a failure: a transient outage must not leave the
      // server permanently unable to accept a play.
      cardLoad = null;
      return new Map<string, ServerCard>();
    }

    cardCache = new Map(
      data.map((r) => [
        r.id as string,
        {
          id: r.id as string,
          kind: 'song' as const,
          title: r.title as string,
          subtitle: r.subtitle as string,
          hype: r.hype as number,
          stamina: r.stamina as number,
        },
      ]),
    );
    return cardCache;
  })();

  return cardLoad;
}

/** Test seam: forget the cached pool so a re-seed can be picked up. */
export function resetCardCache(): void {
  cardCache = null;
  cardLoad = null;
}
