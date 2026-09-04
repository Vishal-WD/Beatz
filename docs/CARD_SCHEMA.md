# CARD_SCHEMA.md — Full Data Model for All Card Types

Source of truth for the three card types described in `CLAUDE.md` §2.
Field names for external data come from sources verified in
`docs/LICENSING_RIGHTS.md` (verified 2026-08-31).

**Three card types. Do not add a fourth.** Song, Profile, Guest.

---

## 1. Shared base

All three types render through one visual template (see
`docs/CARD_ART_GENERATION.md`), so they share a display contract even
though their data sources differ completely.

```ts
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
type CardKind = 'song' | 'profile' | 'guest';

/** Everything the card renderer needs, regardless of type. */
interface CardDisplayBase {
  id: string;                 // uuid
  kind: CardKind;
  title: string;              // song title | player name
  subtitle: string;           // artist | tier | "NOW PLAYING"
  artworkUrl: string | null;  // null → frame-only placeholder
  artworkSource: 'caa' | 'spotify' | 'itunes' | 'os_sync' | null;
  rarity: Rarity;             // guest is always 'common'
  primaryStat: number;        // 0-100 — hype   | total reigns won
  secondaryStat: number;      // 0-100 — stamina| peak vibe
  flavorText: string | null;
  createdAt: string;          // ISO 8601
}
```

**Why `artworkSource` is stored:** attribution requirements differ per
source. iTunes artwork requires a store badge and link; CAA requires
credit. The renderer cannot comply without knowing the origin
(`LICENSING_RIGHTS.md` §2.5, §2.2).

---

## 2. Song Card

The collectible. Owned, scarce, dragged onto the deck slot to start a
reign. The only card type that enters the supply pool.

```ts
interface SongCard extends CardDisplayBase {
  kind: 'song';

  // --- Identity (MusicBrainz is canonical — CC0, commercial-safe) ---
  mbRecordingId: string;          // MBID, the join key across all sources
  mbReleaseGroupId: string | null;
  isrc: string | null;            // cross-service reconciliation

  // --- External refs (nullable: no source is guaranteed present) ---
  spotifyTrackId: string | null;
  deezerTrackId: string | null;
  youtubeVideoId: string | null;  // playback path
  jamendoTrackId: string | null;  // set ⇒ real FFT analysis available

  // --- Artists (array, never duplicated per artist — see §5) ---
  artists: CardArtist[];
  isCollab: boolean;              // derived: artists.filter(primary).length > 1

  // --- Game stats (see §4 for derivation) ---
  hype: number;                   // 0-100, sets STARTING vibe position
  stamina: number;                // 0-100, sets DECAY RATE
  popularitySnapshot: PopularitySnapshot;

  // --- Scarcity (CLAUDE.md §3 — atomic ops only) ---
  serialNumber: number;           // 1-indexed; "1 OF 250" on the card
  supplyTotal: number;
  supplyRemaining: number;

  // --- Playback licensing gate ---
  playbackMode: 'youtube_embed' | 'apple_preview' | 'spotify_handoff' | 'jamendo_local';
  audioAnalyzable: boolean;       // TRUE ONLY for jamendo_local
  licenseVariant: string | null;  // e.g. 'CC BY 4.0' — REQUIRED if jamendo
  attributionText: string | null; // rendered verbatim in card detail
  licenseUrl: string | null;
}

interface CardArtist {
  mbArtistId: string;
  name: string;
  role: 'primary' | 'featured' | 'remixer' | 'producer';
  joinPhrase: string | null;      // MB's own " feat. " / " & " — preserves order
}

interface PopularitySnapshot {
  spotifyPopularity: number | null;  // 0-100, `popularity` (NOT deprecated)
  spotifyFollowers: number | null;   // artist-level
  deezerRank: number | null;         // `rank`, ~0-1,000,000 scale
  capturedAt: string;                // ISO 8601 — stats are a point-in-time mint
}
```

**`audioAnalyzable` is a hard licensing gate, not a convenience flag.**
Web Audio FFT requires same-origin audio, and only Jamendo CC tracks may
be served that way (`LICENSING_RIGHTS.md` §2.6, DO NOT #1). Any code path
that runs an analyser must check this field.

**Stats are frozen at mint.** `popularitySnapshot.capturedAt` records
when. A song getting popular later does not retroactively buff existing
cards — otherwise every card's stats drift and the trading economy
becomes unpriceable.

---

## 3. Profile Card & Guest Card

```ts
/** The player's own stats. THIS IS THE USER'S PROFILE — not a separate screen. */
interface ProfileCard extends CardDisplayBase {
  kind: 'profile';
  userId: string;
  displayName: string;
  initials: string;               // "RK" — avatar fallback
  tier: string;                   // "AUX MARSHAL"
  seasonBadge: string | null;     // "S3"

  totalReignsWon: number;         // → primaryStat
  peakVibe: number;               // 0-100 → secondaryStat
  challengerWinRate: number;      // 0-1, rendered as %
  totalDrops: number;
  cardsOwned: number;

  rarity: Rarity;                 // derived from milestones, NOT purchasable
}

/** Auto-generated from OS "now playing". Never owned, never scarce. */
interface GuestCard extends CardDisplayBase {
  kind: 'guest';
  rarity: 'common';               // ALWAYS. Never rolls a tier.
  sourceRoomId: string;
  expiresAt: string;              // ephemeral — Redis, never Postgres
  osSyncSource: 'mpris2' | 'manual';
  rawTitle: string;               // unreconciled OS string
  rawArtist: string;
  mbRecordingId: string | null;   // best-effort match; may stay null
  hype: number;                   // neutral baseline, see below
  stamina: number;
  isOwnable: false;               // literal — enforced by type
  allowedInEventRoom: false;      // literal — CLAUDE.md §4
}
```

**Guest Cards must never touch the supply pool.** `isOwnable` and
`allowedInEventRoom` are literal `false` types so a mistaken assignment
fails at compile time rather than silently minting scarce supply.

Guest stats use a **neutral baseline** (`hype: 50, stamina: 50`), nudged
only if the OS string reconciles to a real MBID. Unreconciled tracks
must not out-compete owned cards — that would undercut collecting.

---

## 4. Hype & stamina derivation

Both are 0–100 and derive from popularity data at mint time.

### 4.1 Normalizing sources

```
spotify_norm = spotifyPopularity / 100                    // already 0-100
deezer_norm  = min(1, log10(max(deezerRank, 1)) / 6)      // log: rank is long-tailed
```

Deezer's `rank` spans ~0–1,000,000 with most tracks clustered low, so a
linear map would crush everything into the bottom decile. Log-scaling
spreads the mid-range where most cards live.

### 4.2 Composite popularity

```
if both present:  P = 0.6 × spotify_norm + 0.4 × deezer_norm
if spotify only:  P = spotify_norm
if deezer only:   P = deezer_norm
if neither:       P = 0.35                 // conservative default, flag for review
```

**Weighting rationale:** Spotify's `popularity` is recency-weighted and
better reflects "will the room react," which is what hype means.
Deezer's `rank` is more cumulative. Given `LICENSING_RIGHTS.md` §0.1
(Spotify may become unavailable), **the deezer-only branch must stay a
first-class path, not a degraded fallback.**

### 4.3 The two stats

```
hype    = round(100 × P^0.85)                              // 0-100
stamina = round(100 × (0.35 + 0.5 × (1 - P) + 0.15 × catalog_depth))
```

`hype` gets an exponent of 0.85 to lift the mid-range slightly — a
linear map made too many cards feel identically mediocre in playtest
terms.

**`stamina` is inversely correlated with `hype` by design.** A viral
smash spikes the Vibe Bar and burns out; a deep cut starts lower and
holds. This is the central risk/reward decision when choosing which card
to play, and it is why the two stats must not both track popularity.

```
catalog_depth = min(1, artist_release_count / 20)   // MusicBrainz count
```

Clamps so prolific artists get a modest longevity bonus.

**Invariant:** `hype + stamina` must land in `[80, 175]`. Outside that,
clamp and log. Prevents both dead cards and unbeatable ones.

### 4.4 Rarity tiers

Rarity is computed **once, at mint, from `P` alone** — universal across
all users (`CLAUDE.md` §2).

| Tier | `P` range | Base supply | Frame |
|---|---|---|---|
| `common` | `P < 0.45` | 10,000 | bronze |
| `rare` | `0.45 ≤ P < 0.70` | 2,500 | silver |
| `epic` | `0.70 ≤ P < 0.88` | 600 | gold |
| `legendary` | `P ≥ 0.88` | 250 | holo |

```
supply_total = base_supply[rarity] + floor(active_users / N)
```
with `N = 50`. Per `CLAUDE.md` §3 all decrements are atomic:
```sql
UPDATE cards SET supply_remaining = supply_remaining - 1
WHERE id = $1 AND supply_remaining > 0
RETURNING supply_remaining;
```
Zero rows returned ⇒ tier exhausted ⇒ downgrade one tier and refund the
Drops difference (`CLAUDE.md` §6). Never a hard failure.

**Personalization affects only *which* card within an already-rolled
tier** — `0.7 × affinity + 0.3 × random`. It never shifts tier odds.

---

## 5. Collab join table

One card per song, `artists[]` array — **never one card per artist**.

```sql
CREATE TABLE cards (
  id                  UUID PRIMARY KEY,
  mb_recording_id     TEXT UNIQUE NOT NULL,   -- dedupe key
  title               TEXT NOT NULL,
  rarity              rarity_enum NOT NULL,
  hype                SMALLINT NOT NULL CHECK (hype BETWEEN 0 AND 100),
  stamina             SMALLINT NOT NULL CHECK (stamina BETWEEN 0 AND 100),
  supply_total        INTEGER NOT NULL,
  supply_remaining    INTEGER NOT NULL CHECK (supply_remaining >= 0),
  playback_mode       playback_enum NOT NULL,
  audio_analyzable    BOOLEAN NOT NULL DEFAULT FALSE,
  license_variant     TEXT,
  attribution_text    TEXT,
  artwork_url         TEXT,
  artwork_source      TEXT,
  popularity_snapshot JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Jamendo local audio REQUIRES a recorded license variant
  CONSTRAINT jamendo_needs_license CHECK (
    NOT audio_analyzable OR license_variant IS NOT NULL
  )
);

CREATE TABLE artists (
  mb_artist_id TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  release_count INTEGER NOT NULL DEFAULT 0   -- feeds catalog_depth
);

CREATE TABLE card_artists (
  card_id      UUID REFERENCES cards(id) ON DELETE CASCADE,
  mb_artist_id TEXT REFERENCES artists(mb_artist_id),
  role         artist_role_enum NOT NULL,     -- primary|featured|remixer|producer
  position     SMALLINT NOT NULL,             -- display order
  join_phrase  TEXT,
  PRIMARY KEY (card_id, mb_artist_id, role)
);

CREATE INDEX ON card_artists (mb_artist_id);
```

The `jamendo_needs_license` CHECK enforces `LICENSING_RIGHTS.md` §2.6 at
the schema level — an analyzable track without a recorded license
variant cannot be inserted at all.

`isCollab` derives from `count(role='primary') > 1`; it is not stored.

---

## 6. Worked example

**"Werewolf" by Rob Hancock** — Jamendo, **CC BY 4.0**, chosen precisely
because it is the one category with unambiguous rights: freely
redistributable, commercially usable, and locally analyzable.

```jsonc
{
  "id": "e1f4c8a2-3b7d-4e91-a6c5-8d2f0b9e1a34",
  "kind": "song",
  "title": "Werewolf",
  "subtitle": "Rob Hancock",
  "artworkUrl": "https://coverartarchive.org/release-group/…/front-500.jpg",
  "artworkSource": "caa",

  "mbRecordingId": "8f3c1d05-2a7e-4b19-9c86-1f5d3e7a2b40",
  "mbReleaseGroupId": "b2e9f741-6c38-4a25-8d13-9e4f0a6c5b72",
  "isrc": null,

  "spotifyTrackId": null,          // not on Spotify — deezer/MB-only path
  "deezerTrackId": null,
  "youtubeVideoId": null,
  "jamendoTrackId": "1214935",     // ⇒ real FFT available

  "artists": [
    { "mbArtistId": "3d1a7c92-…", "name": "Rob Hancock",
      "role": "primary", "joinPhrase": null }
  ],
  "isCollab": false,

  // P = 0.35 (neither Spotify nor Deezer present → conservative default)
  // hype    = round(100 × 0.35^0.85)                      = 41
  // stamina = round(100 × (0.35 + 0.5×0.65 + 0.15×0.30))  = 72
  // hype+stamina = 113 ∈ [80,175] ✓
  // rarity: P=0.35 < 0.45 → common
  "hype": 41,
  "stamina": 72,
  "popularitySnapshot": {
    "spotifyPopularity": null,
    "spotifyFollowers": null,
    "deezerRank": null,
    "capturedAt": "2026-08-31T00:00:00Z"
  },

  "rarity": "common",
  "serialNumber": 1,
  "supplyTotal": 10000,
  "supplyRemaining": 10000,

  "playbackMode": "jamendo_local",
  "audioAnalyzable": true,
  "licenseVariant": "CC BY 4.0",
  "attributionText": "\"Werewolf\" by Rob Hancock, licensed CC BY 4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",

  "flavorText": "Somebody's cousin queued this.",
  "createdAt": "2026-08-31T00:00:00Z"
}
```

Note the shape this produces: low hype, high stamina — a slow burner
that holds a reign rather than spiking. Exactly the intended trade-off
from §4.3.

> **Verify before seeding.** MBIDs and the Jamendo track ID above are
> structurally correct illustrations. Confirm each against the live APIs
> during the `DATA_POPULATION.md` run; do not paste them into a
> migration unverified.

---

## 7. Invariants

1. Rarity computed once at mint from `P` alone. Never re-rolled, never
   personalized.
2. `supply_remaining` only ever changes via atomic conditional UPDATE.
3. `audioAnalyzable: true` ⇒ `jamendoTrackId` and `licenseVariant`
   non-null. Enforced by DB CHECK.
4. Guest Cards never enter `cards`. Redis only, TTL-expired.
5. One card per `mb_recording_id`. Collabs use `card_artists`.
6. `hype + stamina ∈ [80, 175]`.
7. Stats frozen at mint; `capturedAt` records when.
8. Profile Card rarity comes from milestones and is never purchasable.
