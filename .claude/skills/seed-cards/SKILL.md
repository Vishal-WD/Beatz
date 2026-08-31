---
name: seed-cards
description: Use when adding songs to the AuxWars card pool, refreshing album artwork, or when cards render with "COVER ART" placeholders instead of real covers. Runs the MusicBrainz + Cover Art Archive seeding pipeline.
---

# Seeding the card pool

Mints Song Cards from real music data. Album art comes from Cover Art
Archive; identity from MusicBrainz (CC0). **Never** artist photographs —
those are blocked pending rights review (`docs/LICENSING_RIGHTS.md` §3.8).

## Run it

```bash
npm run seed:cards                    # everything in seeds/cards.seed.json
npx tsx scripts/seed-cards.ts --limit 3   # quick check
```

Output: `lib/generated-cards.ts`, imported by `lib/seed-data.ts`.
Results cache per-MBID in `seeds/.cache/`, so a failed run resumes rather
than re-hammering rate-limited APIs. **Delete the cache to force a refetch.**

## Adding a song

You need its **MusicBrainz recording MBID** — the only required field.
Find it:

```bash
curl -H 'User-Agent: Beatz/0.1 (you@example.com)' \
  'https://musicbrainz.org/ws/2/recording?query=RECORDING%20AND%20artist:ARTIST&limit=3&fmt=json'
```

Take the result with `score: 100` that has a `releases` array — a
recording with no release usually has no cover art either.

Append to `seeds/cards.seed.json`:

```json
{
  "mbRecordingId": "<mbid>",
  "title": "Track Name",
  "artist": "Artist Name",
  "releaseGroupId": "<release-group mbid>",
  "tierHint": "epic",
  "flavorText": "One line of room-voice flavor.",
  "demoCritical": false
}
```

## Rules that matter

**`tierHint` is a fallback, not an assignment.** Real popularity data always
wins. Rarity is universal and derived (`CLAUDE.md` §2) — never hand-assign a
tier because a song "feels" legendary.

The hint exists because all three popularity sources can be down at once:
Spotify caps Dev Mode at 5 users, Deezer's free tier is geo-restricted, and
ListenBrainz now requires an auth token. Without a hint every card defaults
to `P=0.35` and the entire pool mints common.

**Every hinted card is flagged `needsReview: true`.** Before a demo, confirm
no `demoCritical` card is running on a hint (`docs/DEMO_FALLBACKS.md`).

**Rate limits are not advisory.** MusicBrainz allows ~1 req/s and blocks
IPs that exceed it. The pipeline sleeps 1.1s between calls — do not
parallelize it.

**A descriptive User-Agent is required.** Generic agents are refused
outright.

## Verifying

```bash
npx tsc --noEmit && npx next build
```

Then check the pool actually spread across tiers — a run where everything
lands in one tier means popularity lookup failed silently:

```bash
grep -o "rarity: '[a-z]*'" lib/generated-cards.ts | sort | uniq -c
grep -c "artworkUrl: \"http" lib/generated-cards.ts   # cards with real art
```

## When cards show placeholders

`artworkUrl: null` means Cover Art Archive had nothing for that release
group. Options, in order:

1. Find a different `releaseGroupId` for the same recording — compilations
   and reissues often have art when the original does not.
2. Leave it. The design renders a "COVER ART" placeholder deliberately, and
   it looks intentional.
3. **Do not** substitute an image from elsewhere without checking
   `docs/LICENSING_RIGHTS.md` §2.5 first — iTunes artwork carries store-badge
   obligations.
