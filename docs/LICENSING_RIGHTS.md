# LICENSING_RIGHTS.md — Data & Audio Source Legitimacy Reference

**Verification date: 2026-08-31.** Every claim below was checked against
primary sources on that date, not recalled from training data. Terms
change often — Spotify alone shipped four breaking policy changes between
Nov 2024 and Feb 2026. **Re-verify anything older than ~90 days before
relying on it for a launch decision.**

This file is the legal/legitimacy reference for every data and audio
source Beatz touches. See `CLAUDE.md` §5 for the summary; this is the
detail behind it.

---

## ⚠️ Section 0 — Three findings that contradict current project assumptions

These surfaced during verification and **need a product decision**. They
are not style notes; each one invalidates something written elsewhere in
the repo.

### 0.1 Spotify Development Mode was gutted (Feb 2026) — BLOCKING

`CLAUDE.md` §7 lists "Spotify OAuth+Search (PKCE)" as core stack. As of
the [February 6, 2026 announcement](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security),
Development Mode is restricted — effective **11 Feb 2026** for new Client
IDs and **9 March 2026 for all existing integrations**:

- Requires a **Spotify Premium account** to use
- **One** Development Mode Client ID per developer
- **Maximum five authorized users** per Client ID
- Reduced endpoint set

**Impact on Beatz:** a five-user cap makes Spotify unusable for a live
multiplayer party app. A demo room with six people in it exceeds the
limit. Extended quota mode is not an escape hatch: since 15 May 2025
Spotify [only accepts applications from organizations, not individuals](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access).

**Recommended resolution:** demote Spotify to an *optional, per-user
account-linking convenience* and make **MusicBrainz + Deezer the primary
popularity/metadata path**. Do not let the card-minting pipeline have a
hard dependency on Spotify. Flagged for the user — this is a §7 stack
change and per `CLAUDE.md` must not be made silently.

### 0.2 Batch endpoints removed — pipeline design constraint

`GET /tracks`, `GET /artists`, `GET /albums`, `GET /episodes`, `GET /shows`
(the multi-ID batch forms) are **REMOVED** per the
[February 2026 changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026).
Also removed: `GET /artists/{id}/top-tracks`, `GET /browse/new-releases`,
`GET /markets`, `GET /browse/categories`.

Still available: `GET /search`, `GET /tracks/{id}`, `GET /artists/{id}`,
`GET /albums/{id}`, `GET /albums/{id}/tracks`, `GET /artists/{id}/albums`.

**Impact:** `docs/DATA_POPULATION.md` must fetch **one ID per request**
with rate-limit backoff. Any design assuming 50-ID batch calls is dead.

### 0.3 Deezer free tier is non-commercial only — ECONOMY CONFLICT

Deezer's [developer terms](https://developers.deezer.com/termsofuse)
permit free API use for **non-commercial purposes**. Beatz has a Drops
economy and a card marketplace. Even with earn-only currency, a
marketplace pushes this toward commercial use.

**Impact:** if Beatz is ever commercial, Deezer needs a paid/negotiated
plan, or must be dropped as a source. **Unresolved — needs a decision
before launch.** Safe for a non-commercial demo today.

---

## Section 1 — Source-by-source terms

| Source | What we use it for | License type | Attribution required | Commercial use | Verified |
|---|---|---|---|---|---|
| **MusicBrainz** (core data) | Canonical track/artist/release IDs, collab relationships | **CC0** (public domain) | **N** — courtesy only | **Y** — unrestricted | 2026-08-31 |
| **MusicBrainz** (non-core tables) | Annotations, some supplementary tables | **CC BY-NC-SA 3.0** | **Y** | **N** without MetaBrainz license | 2026-08-31 |
| **Cover Art Archive** | Album artwork | Per-image; hosted by Internet Archive | **Y** — varies per image | **Conditional** — see §2.2 | 2026-08-31 |
| **Spotify Web API** | Popularity (`popularity` 0–100), followers, artwork URLs | Proprietary ToS | **Y** — Spotify branding + attribution | **Conditional** — dev mode is non-commercial, ≤5 users | 2026-08-31 |
| **Deezer API** | Popularity (`rank`), artwork | Proprietary ToS | **Y** | **N** on free tier — see §0.3 | 2026-08-31 |
| **iTunes Search API** | Artwork fallback, 30s previews | Apple Media Services ToS | **Y** — "provided courtesy of iTunes" | **Conditional** — strict, see §2.5 | 2026-08-31 |
| **Jamendo** | The **only** locally-analyzable audio (Web Audio FFT) | Per-track CC variants | **Y** — always, per track | **Depends on variant** — see §2.6 | 2026-08-31 |
| **YouTube IFrame API** | Playback of mainstream tracks | YouTube API ToS | **N** content license needed | **Y** — with policy compliance | 2026-08-31 |

---

## Section 2 — Detail and gotchas

### 2.1 MusicBrainz

Core data is [CC0](https://musicbrainz.org/doc/About/Data_License) —
genuinely public domain, the safest layer in the stack and correctly
identified in `CLAUDE.md` as the "actual open source layer."

**Gotcha:** the license is **tiered**. Core tables are CC0; remaining
portions are **CC BY-NC-SA 3.0**. Stay in core tables (artist, release,
recording, release-group, artist-credit) and commercial use is clean.

**Rate limit:** ~1 request/second for the public endpoint. A meaningful
User-Agent string identifying the app and a contact address is required —
generic agents get blocked.

### 2.2 Cover Art Archive

CAA does **not** grant a blanket license. Internet Archive provides
hosting and legal protection; individual images carry their own rights.
In practice CAA is used widely for exactly this purpose, but the archive
is not warranting that each image is free of third-party rights.

**Practical stance:** use CAA artwork, cache it, credit it, and honor
takedowns promptly. Do **not** claim ownership or resell artwork as a
standalone asset. Since Beatz sells *cards* (game objects) rather than
artwork, this stays defensible — but see the DO NOT list.

### 2.3 Spotify Web API — read §0.1 first

Deprecated for new apps since [27 Nov 2024](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
and **confirmed still deprecated as of 2026-08-31**:

- `audio-features` and `audio-analysis` (the 13-field vector)
- `recommendations`
- `related-artists`
- **`preview_url`** (30-second previews)
- Featured/category playlists, Spotify editorial playlists

`CLAUDE.md` §5's warning is **correct and still current**. The `popularity`
field on track/artist objects is **not** deprecated and remains the
intended hype input.

### 2.4 Deezer — read §0.3 first

`rank` field is a useful popularity proxy and needs no auth for public
catalog reads. Good secondary/cross-check source. The non-commercial
restriction is the blocker, not the technology.

### 2.5 iTunes Search API — most restrictive terms here

Apple's terms are narrower than commonly assumed. Promotional content
(artwork, previews) may be used **only to promote store content, not for
entertainment purposes**, and must sit **proximate to an iTunes/App Store
badge linking to the store page**. Previews must be **streamed only** —
never downloaded, saved, cached, or synced to video — and carry
"provided courtesy of iTunes". 30s samples must only play on **US-based
sites** with a buy button.

**Impact:** iTunes artwork inside a *game card* is arguably not
"promoting store content." **Use iTunes strictly as a last-resort
artwork fallback**, with a store link on any card that uses it — or
better, prefer CAA and skip the complication. **Do not** use iTunes
previews for gameplay audio; that plainly violates the entertainment
restriction.

### 2.6 Jamendo — per-track license variance is the trap

`CLAUDE.md` correctly identifies Jamendo as the only source for real
waveform analysis (Web Audio FFT needs same-origin audio). The catalog
mixes **CC BY, CC BY-SA, CC BY-NC, CC BY-ND, CC BY-NC-SA, CC BY-NC-ND**.
These are **not** interchangeable:

| Variant | Commercial OK | Derivatives OK | Safe for Beatz? |
|---|---|---|---|
| CC BY | ✅ | ✅ | ✅ **Preferred** |
| CC BY-SA | ✅ | ✅ (share-alike) | ⚠️ viral terms |
| CC BY-NC | ❌ | ✅ | ⚠️ non-commercial demo only |
| CC BY-ND | ✅ | ❌ | ⚠️ no remixing |
| CC BY-NC-SA / NC-ND | ❌ | varies | ❌ avoid |

**Hard requirement:** store the exact license variant per track at
ingest and filter on it. **Never** assume a Jamendo track is CC BY.
Display per-track attribution: artist name, track title, and a link to
the specific license deed.

**Is FFT analysis a "derivative"?** Transient analysis for a visualizer
is not distribution of a derivative work, so ND is *likely* fine — but
prefer CC BY tracks and sidestep the question.

### 2.7 YouTube IFrame API

Embedding via the official IFrame player requires **no content license
on our part** — `CLAUDE.md` §5's reasoning is sound. We display
YouTube's own player; YouTube handles the licensing.

Conditions: player viewport ≥ **200×200px**; a valid HTTP Referer must
be sent (missing referer ⇒ blocked playback); no blocking, muting, or
obscuring ads; no autoplay-behind-other-content trickery; and the
[Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
require disclosing that the embed shares user data with YouTube — this
needs a **privacy-policy line**.

---

## Section 3 — DO NOT list

Rejected sources and usage patterns, with reasons. Reintroducing any of
these silently is the failure mode `CLAUDE.md` warns about.

1. **DO NOT store, cache, proxy, or redistribute any audio file** from
   any source except Jamendo tracks whose CC variant explicitly permits
   it. This single rule is what keeps Beatz copyright-clean.
2. **DO NOT use `yt-dlp`, `youtube-dl`, or any stream-ripping library.**
   Direct violation of YouTube ToS; instantly negates §2.7's safety.
3. **DO NOT use Spotify `preview_url`** — deprecated for new apps since
   Nov 2024 and unavailable regardless of intent.
4. **DO NOT use `audio-features`/`audio-analysis`** for hype/stamina.
   Unavailable to new apps. Use `popularity` + Deezer `rank` +
   MusicBrainz. (This is why local FFT on Jamendo exists.)
5. **DO NOT build the minting pipeline with a hard Spotify dependency** —
   see §0.1. Five-user cap kills it.
6. **DO NOT use iTunes previews as gameplay audio** — "entertainment
   purposes" is expressly excluded.
7. **DO NOT AI-generate or alter real album artwork.** Frame/foil
   treatment only — see `docs/CARD_ART_GENERATION.md`.
8. **DO NOT use artist photographs** as card art. Rights are separate
   from music licensing and are **unresolved**; album art only.
9. **DO NOT scrape Spotify/Deezer/Apple web pages** to route around API
   limits. Explicitly what the Nov 2024 and Feb 2026 lockdowns targeted.
10. **DO NOT rely on MusicBrainz non-core tables** for commercial
    features — CC BY-NC-SA, unlike the CC0 core.
11. **DO NOT ship real-money Drops purchases while a marketplace
    exists** — `CLAUDE.md` §3, a legal constraint (loot-box regulation),
    not a design preference.
12. **DO NOT let personalization affect rarity odds** — `CLAUDE.md` §2.
    Advertised odds must match actual odds; divergence is the fraud
    theory regulators pursue.

---

## Section 4 — Open items needing a decision

| # | Item | Blocks | Owner |
|---|---|---|---|
| 1 | Spotify demoted to optional? (§0.1) | Card pipeline architecture | Product |
| 2 | Is Beatz commercial? (§0.3) | Deezer viability | Product/Legal |
| 3 | iTunes fallback kept or dropped? (§2.5) | Artwork chain | Product |
| 4 | Privacy policy for YouTube data sharing (§2.7) | Public launch | Legal |
| 5 | Artist-photo cards — rights unresolved (§3.8) | Any photo-card feature | Legal |

---

## Sources

- [MusicBrainz Data License](https://musicbrainz.org/doc/About/Data_License)
- [Cover Art Archive](https://musicbrainz.org/doc/Cover_Art_Archive)
- [Spotify — Update on Developer Access and Platform Security (Feb 6, 2026)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- [Spotify — Web API Changelog, February 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)
- [Spotify — Updating the Criteria for Web API Extended Access (Apr 2025)](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- [Spotify — Changes to the Web API (Nov 27, 2024)](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- [Spotify — Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Deezer — Terms of use for Developers](https://developers.deezer.com/termsofuse)
- [iTunes Search API Overview](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html)
- [Jamendo — Creative Commons License conditions](https://help-music.jamendo.com/hc/en-us/articles/115005052929-Creative-Commons-License-conditions)
- [YouTube IFrame Player API Reference](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube API Services — Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
