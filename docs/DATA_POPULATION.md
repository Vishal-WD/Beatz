# DATA_POPULATION.md — Seeding the Card Pool

How the initial pool of Song Cards is created before any user opens a
pack. Running this once produces a working card pool with **zero manual
DB editing**.

Prerequisites: `CLAUDE.md`, `docs/CARD_SCHEMA.md` (field definitions and
formulas), `docs/LICENSING_RIGHTS.md` (what each source permits).

---

## 1. Source selection — curated list, not a live scrape

**Decision: a hand-curated seed list committed to the repo.** Not a live
API crawl.

`CLAUDE.md` §6 establishes that demo timing must never depend on an
external API succeeding on stage. A live scrape violates that directly:
Spotify rate-limits, MusicBrainz throttles at ~1 req/s, and any of them
can be down during a demo.

Two further reasons specific to our situation:

- **Spotify's 5-user Dev Mode cap** (`LICENSING_RIGHTS.md` §0.1) means we
  cannot rely on Spotify at runtime at all. Enrichment happens **once, at
  seed time, on a developer machine**, and results are committed as data.
- **Batch endpoints are gone** (§0.2). Per-ID fetching at ~1 req/s makes
  bulk enrichment a minutes-long job — fine offline, unacceptable live.

### 1.1 Composition of the seed list

Target **240 cards** for launch — enough that a 5-card pack feels varied
and no tier is thin.

| Tier | Cards | Rationale |
|---|---|---|
| common | 120 (50%) | pack filler, must dominate |
| rare | 72 (30%) | |
| epic | 36 (15%) | |
| legendary | 12 (5%) | scarce enough to matter |

**Mandatory: ≥ 40 Jamendo CC BY tracks spread across all four tiers.**
These are the only cards with `audioAnalyzable: true`, and the Vibe Bar's
real FFT path must be demonstrable at every rarity — not just in the
common bucket.

Rarity here is a *target distribution*, not an assignment: pick songs
whose real popularity naturally lands in each band (`CARD_SCHEMA.md` §4.4).
If the computed tier disagrees with the intended slot, **the computed
tier wins** — forcing it would violate the universal-rarity rule.

### 1.2 Seed list format

`seeds/cards.seed.json`, committed:

```jsonc
[
  {
    "mbRecordingId": "8f3c1d05-2a7e-4b19-9c86-1f5d3e7a2b40",
    "intendedTier": "common",        // expectation only; computed value wins
    "jamendoTrackId": "1214935",     // set ⇒ analyzable, license REQUIRED
    "youtubeVideoId": null,
    "flavorText": "Somebody's cousin queued this.",
    "demoCritical": false            // see §5
  }
]
```

**MBID is the only required identifier.** Everything else is enriched or
nullable. MusicBrainz is CC0 and the one source with no access risk
(`LICENSING_RIGHTS.md` §2.1), so it anchors the pipeline.

---

## 2. The pipeline

Idempotent, resumable, safe to re-run. `pnpm seed:cards`.

```
seeds/cards.seed.json
   │
   ├─ Stage 1  MusicBrainz lookup      (canonical identity + artists)
   ├─ Stage 2  Popularity enrichment   (Spotify → Deezer, best effort)
   ├─ Stage 3  hype/stamina + rarity   (pure functions, no I/O)
   ├─ Stage 4  Artwork fallback chain  (CAA → Spotify → iTunes → null)
   ├─ Stage 5  Licensing gate          (REJECTS bad rows)
   └─ Stage 6  Atomic DB insert        (transaction per card)
```

Each stage writes `seeds/.cache/<mbid>.json`. **Re-running skips cached
stages** — a failed run at card 180 of 240 resumes, rather than
re-hammering rate-limited APIs.

### Stage 1 — MusicBrainz (canonical)

```
GET /ws/2/recording/{mbid}?inc=artist-credits+releases+release-groups&fmt=json
```

- Rate limit **1 req/s, single-threaded**. Non-negotiable — faster gets
  the IP blocked.
- `User-Agent: Beatz/0.1 (contact@example.com)` — **required**; generic
  agents are refused (`LICENSING_RIGHTS.md` §2.1).
- Extract: title, `artist-credit[]` → `card_artists` rows with `role` and
  `position`, preserving MB's own `joinphrase` so "A feat. B" renders in
  the artist's intended order.
- Fetch `release_count` per artist for `catalog_depth` (`CARD_SCHEMA.md`
  §4.3). Cache per artist — many cards share artists.
- **Stay in core (CC0) tables only.** No annotations or non-core tables
  (§2.1 — those are CC BY-NC-SA).

### Stage 2 — Popularity (best effort, never fatal)

Attempt in order; **a total miss is not an error**:

1. **Spotify** — `GET /search?type=track&q=...` then `GET /tracks/{id}`
   for `popularity`, and `GET /artists/{id}` for `followers`.
   - **`GET /tracks` and `GET /artists` batch forms are REMOVED**
     (`LICENSING_RIGHTS.md` §0.2) — one ID per request.
   - Requires Premium + Dev Mode Client ID; ≤5 users. Seed-time only.
   - **Skip entirely if no credentials.** `SPOTIFY_CLIENT_ID` unset must
     degrade cleanly, not crash — this path may vanish permanently.
2. **Deezer** — `GET /search?q=...` → `rank`. No auth.
   - ⚠️ Free tier is **non-commercial** (`LICENSING_RIGHTS.md` §0.3).
     Fine for a demo; unresolved for commercial launch.
3. **Neither** → `P = 0.35` default, row flagged `needsReview: true`.

Match confidence: require ISRC match, or artist+title fuzzy ≥ 0.85.
**A weak match is worse than no match** — wrong popularity produces
wrong stats and a mispriced card. On low confidence, record null.

### Stage 3 — Stats (pure)

Apply `CARD_SCHEMA.md` §4 exactly: normalize → composite `P` → `hype`,
`stamina` → clamp to `[80, 175]` → rarity tier → `supply_total`.

No network calls. Unit-testable, deterministic. If the computed tier
differs from `intendedTier`, **log a warning and keep the computed
value** (`CLAUDE.md` §2 — rarity is universal).

### Stage 4 — Artwork chain

Stop at the first success:

1. **Cover Art Archive** — `https://coverartarchive.org/release-group/{id}/front-500`
   → `artworkSource: 'caa'`. Preferred.
2. **Spotify** `album.images[]` → `'spotify'`. Only if Stage 2 matched.
3. **iTunes Search** `artworkUrl100` → `'itunes'`. ⚠️ **Last resort** —
   requires a store badge + link on any card using it
   (`LICENSING_RIGHTS.md` §2.5). Cards flagged `requiresStoreBadge: true`.
4. **null** → frame-only placeholder. The design already handles this
   (`AuxWars.dc.html` renders "COVER ART" placeholders throughout).

Download and store to our own CDN/bucket, recording `artworkSource`.
**Never** hotlink iTunes.

### Stage 5 — Licensing gate (rejects)

Hard validation before any insert:

- `jamendoTrackId` set ⇒ `licenseVariant`, `attributionText`, `licenseUrl`
  all non-null, **and the variant is confirmed CC BY or CC BY-SA**.
  NC/ND variants are **rejected** for the default (commercial-intent)
  build (`LICENSING_RIGHTS.md` §2.6).
- `audioAnalyzable: true` ⇒ `jamendoTrackId` non-null. No exceptions —
  this is the same-origin FFT gate.
- `playbackMode: 'youtube_embed'` ⇒ `youtubeVideoId` non-null.
- No card has a stored/proxied audio URL from any non-Jamendo source
  (DO NOT #1).

A rejected card **fails the seed run loudly**. It is never silently
downgraded — a licensing violation must not reach the DB.

### Stage 6 — Atomic insert

One transaction per card:

```sql
BEGIN;
INSERT INTO artists (mb_artist_id, name, release_count)
VALUES (...) ON CONFLICT (mb_artist_id) DO UPDATE SET release_count = EXCLUDED.release_count;

INSERT INTO cards (mb_recording_id, …, supply_total, supply_remaining)
VALUES (…, $supply, $supply)          -- remaining initialized = total
ON CONFLICT (mb_recording_id) DO NOTHING;

INSERT INTO card_artists (card_id, mb_artist_id, role, position, join_phrase)
VALUES (…) ON CONFLICT DO NOTHING;
COMMIT;
```

`ON CONFLICT (mb_recording_id) DO NOTHING` makes re-runs idempotent.
`supply_remaining` is initialized equal to `supply_total` **in the same
statement** — never a read-then-write (`CLAUDE.md` §3).

---

## 3. Collab handling

A multi-artist release maps to **one card**, never one per artist.

MusicBrainz `artist-credit` is an ordered array with join phrases:

```json
"artist-credit": [
  { "name": "Velvet Static", "joinphrase": " × ", "artist": { "id": "…" } },
  { "name": "Kosmic Haze",   "joinphrase": "",    "artist": { "id": "…" } }
]
```

→ one `cards` row, two `card_artists` rows (`position` 0 and 1, both
`role: 'primary'`, join phrases preserved).

Role assignment from MB credit semantics: default `primary`; `featured`
when the join phrase matches `/feat\.?|ft\.?|featuring/i`; `remixer` when
the recording carries a remixer relationship.

Dedupe on `mb_recording_id`. Two artists' pages listing the same
collaboration still yield one card — this is exactly why MBID is the key
rather than title+artist strings.

`isCollab` derives at read time (`count(role='primary') > 1`) and drives
the dual-portrait "EPIC · COLLAB" frame in the design.

---

## 4. Verification after seeding

`pnpm seed:verify` — fails loudly on any violation:

```sql
-- Every tier populated
SELECT rarity, count(*) FROM cards GROUP BY rarity;

-- Invariant: hype+stamina ∈ [80,175]   (expect 0 rows)
SELECT id, title, hype, stamina FROM cards
WHERE hype + stamina NOT BETWEEN 80 AND 175;

-- Invariant: analyzable ⇒ licensed     (expect 0 rows)
SELECT id, title FROM cards
WHERE audio_analyzable AND license_variant IS NULL;

-- Invariant: supply initialized        (expect 0 rows)
SELECT id, title FROM cards WHERE supply_remaining <> supply_total;

-- Analyzable coverage across tiers (each tier should be > 0)
SELECT rarity, count(*) FILTER (WHERE audio_analyzable) AS analyzable
FROM cards GROUP BY rarity;

-- Cards needing manual review (P defaulted to 0.35)
SELECT id, title FROM cards
WHERE popularity_snapshot->>'spotifyPopularity' IS NULL
  AND popularity_snapshot->>'deezerRank' IS NULL;
```

---

## 5. Demo-day checklist

Cross-references `CLAUDE.md` §6. Full pre-flight lives in
`docs/DEMO_FALLBACKS.md`; this covers **data seeding only**.

Cards marked `demoCritical: true` get **supply headroom ≥ 500** so a
live on-stage pack opening can never hit an exhausted pool.

- [ ] **≥ 3 legendary cards** with `supply_remaining > 500`. The
      money-shot pull (`AuxWars.dc.html` screen 04 — "Sirens at Dawn,
      LEGENDARY · 1 OF 250") must be reliable on cue.
- [ ] **Every tier non-empty** with headroom — an exhausted tier triggers
      the downgrade+refund path (`CLAUDE.md` §6) mid-demo. Correct
      behavior, terrible optics.
- [ ] **≥ 1 analyzable (Jamendo CC BY) card per tier** so the real FFT
      Vibe Bar is demonstrable, not just the simulated one.
- [ ] **≥ 1 collab card** seeded to show the dual-portrait frame.
- [ ] Demo account pre-seeded **one milestone short** of a guaranteed
      legendary pull (`CLAUDE.md` §3 — milestone path, never probability
      scaling).
- [ ] All demo-critical artwork **downloaded to our own storage**. Zero
      external image requests during the demo.
- [ ] **Full run against a wiped DB within 7 days of demo.** Verifies the
      pipeline still works against live APIs — Spotify has changed terms
      four times since Nov 2024; assume it will again.
- [ ] `needsReview` cards audited — no defaulted `P = 0.35` card is
      `demoCritical`.

---

## 6. Post-launch re-seeding

**Same pipeline, per-song trigger.** Do not write a second code path.

```
pnpm seed:cards --mbid=<mbid> --tier-hint=epic
```

Differences from the bulk run:

- **Concurrency:** MusicBrainz's 1 req/s still applies. Queue single-song
  adds; do not parallelize.
- **Supply:** `base_supply[rarity] + floor(active_users / 50)` is
  evaluated at insert time, so later cards get larger supply as the user
  base grows — intended (`CLAUDE.md` §3).
- **Existing cards are never re-statted.** Stats freeze at mint
  (`CARD_SCHEMA.md` §2). A re-run on an existing MBID is a no-op via
  `ON CONFLICT DO NOTHING`. Changing stats on live cards would
  retroactively reprice every trade.
- **Review gate:** admin approval before a new card goes live, so a bad
  popularity match cannot mint a wrongly-tiered legendary.

### Refreshing popularity without re-statting

If popularity refresh is ever wanted, it must mint a **new card** (a new
"printing" with its own serial range) rather than mutate existing rows.
This is a **product decision, currently unmade** — flagged rather than
assumed.
