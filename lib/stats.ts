/**
 * Hype/stamina derivation and rarity bucketing.
 * Pure functions, no I/O — implements docs/CARD_SCHEMA.md §4 exactly.
 *
 * Shared by the seeding pipeline and runtime so a card minted offline and a
 * card minted live can never disagree.
 */

import type { Rarity, PopularitySnapshot } from '@/types/cards';
import { RARITY } from './rarity';

/** Composite popularity default when no source matched (CARD_SCHEMA.md §4.2). */
export const DEFAULT_P = 0.35;

/**
 * Deezer `rank` is long-tailed (~0–1,000,000, most tracks clustered low).
 *
 * A log10/6 curve (the first draft) saturated far too early — rank 50,000 scored
 * 0.78 and minted an *epic*, and a deezer-only catalog would have over-minted
 * legendaries. That matters because the deezer-only path is not hypothetical:
 * Spotify may become unavailable entirely (LICENSING_RIGHTS.md §0.1).
 *
 * A power curve tracks the real distribution far better. Calibrated against
 * Spotify-equivalent tracks, exponent 0.38 makes the two paths agree on tier for
 * 5 of 6 sample points, diverging only by one tier at a boundary.
 */
export const normalizeDeezerRank = (rank: number | null): number | null =>
  rank === null ? null : Math.min(1, Math.pow(Math.max(rank, 0) / 1_000_000, 0.38));

export const normalizeSpotifyPopularity = (pop: number | null): number | null =>
  pop === null ? null : pop / 100;

/**
 * Composite popularity P ∈ [0,1].
 *
 * Spotify is weighted higher because its `popularity` is recency-weighted and
 * better predicts "will the room react" — which is what hype means. But the
 * deezer-only branch is a first-class path, not a degraded fallback: Spotify
 * may become unavailable entirely (LICENSING_RIGHTS.md §0.1).
 */
export function compositePopularity(snap: PopularitySnapshot): number {
  const s = normalizeSpotifyPopularity(snap.spotifyPopularity);
  const d = normalizeDeezerRank(snap.deezerRank);

  if (s !== null && d !== null) return 0.6 * s + 0.4 * d;
  if (s !== null) return s;
  if (d !== null) return d;
  return DEFAULT_P;
}

export const HYPE_STAMINA_MIN = 80;
export const HYPE_STAMINA_MAX = 175;

export interface DerivedStats {
  hype: number;
  stamina: number;
  rarity: Rarity;
  /** True when no popularity source matched — needs manual review before demo. */
  needsReview: boolean;
}

/**
 * hype and stamina are INVERSELY correlated by design: a viral smash spikes the
 * Vibe Bar and burns out; a deep cut starts lower and holds. That trade-off is
 * the central decision when choosing which card to play, which is why the two
 * stats must not both track popularity.
 */
export function deriveStats(
  snap: PopularitySnapshot,
  artistReleaseCount: number,
): DerivedStats {
  const P = compositePopularity(snap);
  const needsReview =
    snap.spotifyPopularity === null && snap.deezerRank === null;

  // Exponent 0.85 lifts the mid-range — a linear map made too many cards
  // feel identically mediocre.
  let hype = Math.round(100 * Math.pow(P, 0.85));

  const catalogDepth = Math.min(1, artistReleaseCount / 20);
  let stamina = Math.round(100 * (0.35 + 0.5 * (1 - P) + 0.15 * catalogDepth));

  hype = clamp(hype, 0, 100);
  stamina = clamp(stamina, 0, 100);

  // Invariant: prevents both dead cards and unbeatable ones.
  const total = hype + stamina;
  if (total < HYPE_STAMINA_MIN) {
    stamina = clamp(stamina + (HYPE_STAMINA_MIN - total), 0, 100);
  } else if (total > HYPE_STAMINA_MAX) {
    stamina = clamp(stamina - (total - HYPE_STAMINA_MAX), 0, 100);
  }

  return { hype, stamina, rarity: rarityForP(P), needsReview };
}

/** Rarity is computed once at mint from P alone — universal (CLAUDE.md §2). */
export function rarityForP(P: number): Rarity {
  if (P >= 0.88) return 'legendary';
  if (P >= 0.7) return 'epic';
  if (P >= 0.45) return 'rare';
  return 'common';
}

/** Supply scales with the active user base (CLAUDE.md §3). */
export const SUPPLY_SCALE_N = 50;

export const supplyTotal = (rarity: Rarity, activeUsers: number): number =>
  RARITY[rarity].baseSupply + Math.floor(activeUsers / SUPPLY_SCALE_N);

/**
 * Vibe decay per tick. High stamina decays slower.
 *
 * Tuned so an unopposed reign lasts ~27–37s: long enough to feel like holding
 * something, short enough that the throne actually changes hands. The first
 * draft (3.4→0.9) burned a reign out in 10–13s, which was unplayable.
 * Crowd holds push the vibe back up, so contested reigns run longer.
 */
export const decayRateFor = (stamina: number): number =>
  1.15 - 0.83 * (stamina / 100);

/** Card hype sets the opening Vibe position, biased upward so a reign can start. */
export const startingVibeFor = (hype: number): number =>
  Math.round(45 + 0.45 * hype);

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
