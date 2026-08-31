# Generation Prompts — run these in Claude Code, in order

Each prompt below is written to be pasted directly into a Claude Code
session inside the Beatz repo, with `CLAUDE.md` already present at the
repo root so context is loaded automatically. Run them in order —
later prompts assume earlier docs exist.

---

## Prompt 1 — `docs/LICENSING_RIGHTS.md`

```
Read CLAUDE.md first for project context.

Create docs/LICENSING_RIGHTS.md. This is the legal/legitimacy reference
for every data and audio source the app touches. For each source below,
research and document (as of today's date, not from training memory —
flag anything you're not certain is current):

1. MusicBrainz + Cover Art Archive — license terms for the metadata and
   artwork, attribution requirements if any, commercial-use terms.
2. Spotify Web API — current Client Credentials flow terms, exactly
   which endpoints are usable for a NEW app (note: preview_url and the
   audio-features/recommendations endpoints were deprecated for new
   apps as of Nov 27, 2024 — verify this is still the case), and what
   the May 2025 "extended access" policy change means for us at our
   scale.
3. Deezer API — free tier terms, attribution requirements.
4. iTunes Search API — terms of use for artwork and preview URLs.
5. Jamendo — exact CC license variants present in their catalog (some
   tracks may be CC-BY vs CC-BY-NC vs CC-BY-SA — these differ in what's
   allowed), and what attribution our app must display per-track.
6. YouTube IFrame Player API — confirm embedding via the official IFrame
   API does not require a content license on our part (we are not
   hosting audio, only embedding YouTube's own player).

For each source, output a table row: Source | What we use it for |
License type | Attribution required (Y/N + exact text if Y) |
Commercial use allowed (Y/N/conditions) | Verification date.

End the file with an explicit "DO NOT" list — sources or usage patterns
that were considered and rejected, and why (e.g. "Do not store or
redistribute any audio file from any source except Jamendo CC tracks
explicitly cleared for redistribution").
```

---

## Prompt 2 — `docs/CARD_SCHEMA.md`

```
Read CLAUDE.md first for project context.

Create docs/CARD_SCHEMA.md documenting the full data model for all
three card types (Song Card, Profile Card, Guest Card) as described in
CLAUDE.md Section 2. Include:

- Full field list per card type with types (use TypeScript interface
  syntax)
- The exact hype/stamina derivation formula from popularity data
  (pull real field names from docs/LICENSING_RIGHTS.md's approved
  sources — e.g. Spotify's `popularity` 0-100 field, Deezer's `rank`)
- The rarity tier boundaries (what stat range maps to Common/Rare/
  Epic/Legendary)
- The collab-card join table structure (artists[] with role tagging)
- A worked example: pick one real, clearly-licensed song and show the
  fully populated card object end to end

Do not invent a fourth card type. Do not add fields not justified by
a mechanic already described in CLAUDE.md.
```

---

## Prompt 3 — `docs/DATA_POPULATION.md`

```
Read CLAUDE.md and docs/CARD_SCHEMA.md first for context.

Create docs/DATA_POPULATION.md describing the pre-launch/pre-demo data
seeding process — how the initial pool of Song Cards gets created
before any user opens a pack. Cover:

1. Source selection — how we pick which songs/artists get minted as
   cards for the first batch (recommend: a curated list, not a live
   scrape, so demo timing never depends on an external API succeeding
   on stage — CLAUDE.md Section 6 already establishes this constraint)
2. The data pipeline: MusicBrainz ID lookup → Spotify/Deezer popularity
   fetch → hype/stamina calculation → rarity bucket assignment →
   Cover Art Archive / Spotify / iTunes artwork fallback chain → DB
   insert, with atomic supply initialization per CLAUDE.md Section 3
3. Collab handling — how a multi-artist MusicBrainz release maps to
   one card with an artists[] array, not duplicated per artist
4. A checklist for demo-day: which specific cards must be pre-seeded
   with enough supply headroom that a live pack-opening on stage can't
   hit an empty pool (cross-reference CLAUDE.md Section 6's fallback
   list)
5. How re-seeding/adding new songs post-launch differs from the initial
   batch (this should reuse the same pipeline, just triggered per-song
   instead of in bulk)

Output should be detailed enough that running this once populates a
working card pool with zero manual DB editing.
```

---

## Prompt 4 — `docs/CARD_ART_GENERATION.md`

```
Read CLAUDE.md and docs/CARD_SCHEMA.md first for context.

Create docs/CARD_ART_GENERATION.md describing how card frame art (NOT
the album cover itself — that's sourced per docs/LICENSING_RIGHTS.md,
never generated) gets produced for each rarity tier. This covers only
the frame/border/foil treatment around real, legitimately-sourced
album artwork — never AI-generate or alter the artist's actual cover
art.

Document:
1. The 4 rarity frame treatments (Common/Rare/Epic/Legendary) as CSS
   specs — border gradients, the Legendary holo effect (conic-gradient
   + mix-blend-mode: color-dodge + tilt-on-gyroscope/mouse, per the
   technique already agreed on in project discussion — no WebGL needed)
2. The Profile Card frame variant (visually related to Song Card frames
   but distinguishable at a glance — different accent color or icon)
3. The Guest Card frame variant (greyed/uncollected border, per
   CLAUDE.md Section 2)
4. Any static illustrative assets that DO need original generation
   (e.g. the throne visual, pack artwork, UI iconography) — list these
   explicitly as the only category of asset safe to AI-generate or
   design from scratch, since they involve no real artist's likeness
   or copyrighted material
5. A note reinforcing: real artist photos, if ever used instead of
   album art, need their own rights clearance separate from the music
   licensing in docs/LICENSING_RIGHTS.md — flag this as unresolved if
   the product ever wants artist-photo cards rather than album-art cards
```

---

## Prompt 5 — `docs/DEMO_FALLBACKS.md`

```
Read CLAUDE.md first for context, especially Section 6.

Create docs/DEMO_FALLBACKS.md as a pre-flight checklist for any live
demo of this app. Expand each item already listed in CLAUDE.md Section
6 into an actionable checklist entry (what to test, what to pre-seed,
what to verify on the actual demo network/devices beforehand), and add:

- iOS DeviceOrientationEvent/DeviceMotionEvent permission prompt
  handling (silently does nothing without an explicit tap-to-allow —
  must be tested on an actual iPhone before demo day, not just desktop
  Chrome)
- A pre-seeded demo account sitting exactly one milestone away from a
  guaranteed Legendary pull, so the pack-opening money-shot is
  reliable on cue
- Venue network contingency — what degrades gracefully if wifi lags
  (which visual feedback loops are most latency-sensitive and should
  be tested first)

Format as literal checkboxes, ordered by how close to demo day each
check should happen (week-before / day-before / hour-before).
```
