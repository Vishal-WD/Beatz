/**
 * Push the generated card pool into Supabase.
 *
 *   npx tsx scripts/push-to-supabase.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY — minting bypasses RLS by design.
 * There is deliberately no client-side write policy on `cards`: a client that
 * could insert there could mint itself a legendary.
 *
 * Idempotent: upserts on mb_recording_id, so re-running after a re-seed
 * updates rather than duplicating.
 */

import { createClient } from '@supabase/supabase-js';
import { GENERATED_CARDS } from '../lib/generated-cards';

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

const db = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log(`Pushing ${GENERATED_CARDS.length} cards to Supabase…\n`);

  // Artists first — cards reference them.
  const artists = new Map<string, { mb_artist_id: string; name: string }>();
  for (const c of GENERATED_CARDS) {
    for (const a of c.artists) {
      if (a.mbArtistId) artists.set(a.mbArtistId, { mb_artist_id: a.mbArtistId, name: a.name });
    }
  }

  if (artists.size > 0) {
    const { error } = await db
      .from('artists')
      .upsert([...artists.values()], { onConflict: 'mb_artist_id' });
    if (error) {
      console.error('artists:', error.message);
      process.exit(1);
    }
    console.log(`  ✓ ${artists.size} artists`);
  }

  const rows = GENERATED_CARDS.map((c) => ({
    mb_recording_id: c.mbRecordingId,
    mb_release_group_id: c.mbReleaseGroupId,
    title: c.title,
    subtitle: c.subtitle,
    language: c.language ?? null,
    flavor_text: c.flavorText,
    artwork_url: c.artworkUrl,
    artwork_source: c.artworkSource,
    rarity: c.rarity,
    hype: c.hype,
    stamina: c.stamina,
    supply_total: c.supplyTotal,
    supply_remaining: c.supplyRemaining,
    youtube_video_id: c.youtubeVideoId,
    // The generator fetches this from iTunes and it was never being sent, so
    // every pushed card arrived with no preview while still declaring a
    // playback mode most of them could not perform.
    preview_url: c.previewUrl ?? null,
    jamendo_track_id: c.jamendoTrackId,
    playback_mode: c.playbackMode,
    audio_analyzable: c.audioAnalyzable,
    license_variant: c.licenseVariant,
    attribution_text: c.attributionText,
    license_url: c.licenseUrl,
    popularity_snapshot: c.popularitySnapshot,
    // Curated tier hints are honest about being unmeasured.
    needs_review: c.popularitySnapshot.deezerRank === null,
  }));

  const { data, error } = await db
    .from('cards')
    .upsert(rows, { onConflict: 'mb_recording_id' })
    .select('id, mb_recording_id, title, rarity');

  if (error) {
    console.error('cards:', error.message);
    process.exit(1);
  }

  console.log(`  ✓ ${data?.length ?? 0} cards\n`);

  // Link artists to cards.
  const byMbid = new Map((data ?? []).map((r) => [r.mb_recording_id, r.id]));
  const links: Array<Record<string, unknown>> = [];
  for (const c of GENERATED_CARDS) {
    const cardId = byMbid.get(c.mbRecordingId);
    if (!cardId) continue;
    c.artists.forEach((a, i) => {
      if (!a.mbArtistId) return;
      links.push({
        card_id: cardId,
        mb_artist_id: a.mbArtistId,
        role: a.role,
        position: i,
        join_phrase: a.joinPhrase,
      });
    });
  }

  if (links.length > 0) {
    const { error: linkErr } = await db
      .from('card_artists')
      .upsert(links, { onConflict: 'card_id,mb_artist_id,role' });
    if (linkErr) console.warn('  card_artists:', linkErr.message);
    else console.log(`  ✓ ${links.length} artist links`);
  }

  const tiers = (data ?? []).reduce<Record<string, number>>((a, r) => {
    a[r.rarity] = (a[r.rarity] ?? 0) + 1;
    return a;
  }, {});
  console.log('\nTier distribution:', tiers);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
