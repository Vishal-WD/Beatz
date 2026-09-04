/**
 * Push the Audius-sourced cards into Supabase.
 *
 *   node scripts/seed-audius.mjs        # writes seeds/audius.raw.json
 *   npx tsx scripts/push-audius.ts      # this
 *
 * Companion to push-to-supabase.ts, kept separate because the Audius rows have
 * their own id namespace and their own playback mode. Idempotent: upserts on
 * mb_recording_id (the `audius:<id>` key), so a re-run updates rather than
 * duplicating, and it never touches the 60 existing chart cards.
 *
 * Rarity/hype/stamina come from lib/stats.ts — the SAME functions the chart
 * pipeline uses (CLAUDE.md §2). Nothing here assigns a tier by hand.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { deriveStats, supplyTotal } from '../lib/stats';
import type { PopularitySnapshot } from '../types/cards';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error(
    'Missing env. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Find the service role key in: Supabase dashboard → Project Settings → API.\n' +
      'Keep it OUT of .env.local and out of git — it bypasses row-level security.',
  );
  process.exit(1);
}

interface AudiusRow {
  mbRecordingId: string;
  audiusTrackId: string;
  title: string;
  artist: string;
  language: string;
  genre: string | null;
  durationSeconds: number;
  artworkUrl: string;
  streamUrl: string;
  playCount: number;
  favoriteCount: number;
  popularityP: number;
  deezerRankEquivalent: number;
  flavorText: string;
}

const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  const path = join(process.cwd(), 'seeds', 'audius.raw.json');
  const rows: AudiusRow[] = JSON.parse(await readFile(path, 'utf8'));

  console.log(`Pushing ${rows.length} Audius cards to Supabase…\n`);

  const capturedAt = new Date().toISOString();

  const cards = rows.map((r) => {
    const snap: PopularitySnapshot = {
      spotifyPopularity: null,
      spotifyFollowers: null,
      // Audius popularity, expressed on the pipeline's existing scale so the
      // shared deriveStats sees one kind of number. seed-audius.mjs documents
      // the mapping; this is not a second rarity ladder.
      deezerRank: r.deezerRankEquivalent,
      capturedAt,
    };

    // Audius creators are mostly single-release accounts, so catalog depth is
    // genuinely shallow. Passing a fake count would inflate stamina.
    const stats = deriveStats(snap, 1);
    const total = supplyTotal(stats.rarity, 0);

    return {
      mb_recording_id: r.mbRecordingId,
      mb_release_group_id: null,
      title: r.title,
      subtitle: r.artist.toUpperCase(),
      language: r.language,
      flavor_text: r.flavorText,
      artwork_url: r.artworkUrl,
      // artwork_source is constrained to caa|spotify|itunes|os_sync. Audius
      // artwork is none of those, and widening a licensing constraint to make
      // a row fit is exactly the kind of quiet erosion CLAUDE.md §5 warns
      // about. NULL is honest and the constraint already permits it.
      artwork_source: null,
      rarity: stats.rarity,
      hype: stats.hype,
      stamina: stats.stamina,
      supply_total: total,
      supply_remaining: total,
      youtube_video_id: null,
      preview_url: null,
      jamendo_track_id: null,
      audius_track_id: r.audiusTrackId,
      playback_mode: 'audius_stream',
      // FFT needs same-origin audio; Audius streams cross-origin from a
      // content node, so this stays false (CARD_SCHEMA §7.3).
      audio_analyzable: false,
      license_variant: null,
      attribution_text: `${r.artist} via Audius`,
      license_url: `https://audius.co/legal/terms-of-use`,
      popularity_snapshot: {
        ...snap,
        audiusPlayCount: r.playCount,
        audiusFavoriteCount: r.favoriteCount,
        audiusP: r.popularityP,
      },
      // Measured from real listening data, not a curated hint.
      needs_review: false,
    };
  });

  const { data, error } = await db
    .from('cards')
    .upsert(cards, { onConflict: 'mb_recording_id' })
    .select('id, title, rarity');

  if (error) {
    console.error('cards:', error.message);
    process.exit(1);
  }

  const tiers = (data ?? []).reduce<Record<string, number>>((a, r) => {
    a[r.rarity] = (a[r.rarity] ?? 0) + 1;
    return a;
  }, {});

  console.log(`  ✓ ${data?.length ?? 0} cards`);
  console.log('\nTier distribution:', tiers);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
