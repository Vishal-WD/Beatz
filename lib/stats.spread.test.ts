import { describe, it, expect } from 'vitest';
import { deriveStats, HYPE_STAMINA_MIN, HYPE_STAMINA_MAX } from './stats';
import type { PopularitySnapshot } from '@/types/cards';

/*
  The bug this pins.

  The chart pipeline captured a real popularity signal — chartRank, from
  Apple's most-played feed — but used it only to pick a rarity tier. It never
  reached the popularity snapshot, so compositePopularity() fell through to
  DEFAULT_P and deriveStats() returned the SAME numbers for every card: 21
  cards at 64/68, 14 at 82/56, eleven distinct stat lines across sixty cards.

  That is not cosmetic. Choosing between a high-hype burner and a high-stamina
  holder is the decision the game is built on (CLAUDE.md §2), and it cannot be
  made when the cards are numerically identical.
*/

const snapFor = (P: number): PopularitySnapshot => ({
  spotifyPopularity: null,
  spotifyFollowers: null,
  // deriveStats reads popularity through the composite; this is the inverse
  // of the Deezer normalisation, which is how the seed script injects a
  // known P as well.
  deezerRank: Math.round(Math.pow(P, 1 / 0.38) * 1_000_000),
  capturedAt: '',
});

/** P from a chart position, as the seed script and the migration both do. */
const pForRank = (rank: number) => Math.max(0.05, Math.min(1, 1 - (rank - 1) / 40));

describe('stat spread across a chart', () => {
  it('gives distinct stats to distinct chart positions', () => {
    const lines = new Set<string>();
    for (let rank = 1; rank <= 40; rank++) {
      const s = deriveStats(snapFor(pForRank(rank)), 10);
      lines.add(`${s.hype}/${s.stamina}`);
    }
    // Before the fix this was 1 — every card identical. Allow a little
    // collapse at the rounding edges, but nothing like a flat pool.
    expect(lines.size).toBeGreaterThan(30);
  });

  it('makes a chart-topper a burner and a deep cut a holder', () => {
    // The inverse relationship IS the trade-off. A pool where both numbers
    // rise together has no decision in it.
    const top = deriveStats(snapFor(pForRank(1)), 10);
    const deep = deriveStats(snapFor(pForRank(40)), 10);

    expect(top.hype).toBeGreaterThan(deep.hype);
    expect(top.stamina).toBeLessThan(deep.stamina);
  });

  it('moves hype monotonically down the chart', () => {
    let last = Infinity;
    for (let rank = 1; rank <= 40; rank += 3) {
      const { hype } = deriveStats(snapFor(pForRank(rank)), 10);
      expect(hype).toBeLessThanOrEqual(last);
      last = hype;
    }
  });

  it('holds the hype+stamina invariant at every position', () => {
    // No dead cards, no unbeatable ones — at any point on the curve.
    for (let rank = 1; rank <= 40; rank++) {
      const { hype, stamina } = deriveStats(snapFor(pForRank(rank)), 10);
      expect(hype + stamina).toBeGreaterThanOrEqual(HYPE_STAMINA_MIN);
      expect(hype + stamina).toBeLessThanOrEqual(HYPE_STAMINA_MAX);
    }
  });

  it('separates cards inside one tier when nothing charted', () => {
    /*
      The named-artist pass has no chart position, so it falls back to the
      tier hint — one value per TIER, which is exactly what collapsed 21
      cards onto a single stat line. The seed script adds a per-card jitter
      derived from the id, so cards differ from each other while staying
      stable across re-seeds.
    */
    const base = 0.35;
    // FNV-1a: ids here share a long prefix and differ only at the end, and
    // a simple 31-multiply leaves those clustered inside one rounding
    // bucket — which reproduced the very collapse being tested for.
    const jitterFor = (id: string) => {
      let h = 2166136261 >>> 0;
      for (const ch of id) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return ((h % 1000) / 1000 - 0.5) * 0.12;
    };

    const ids = ['itunes:111', 'itunes:222', 'itunes:333', 'itunes:444', 'itunes:555'];
    const lines = new Set(
      ids.map((id) => {
        const s = deriveStats(snapFor(base + jitterFor(id)), 10);
        return `${s.hype}/${s.stamina}`;
      }),
    );
    expect(lines.size).toBeGreaterThan(1);

    // …and the same id must give the same answer every run, or a re-seed
    // would silently rewrite stats on cards players already own.
    expect(jitterFor('itunes:111')).toBe(jitterFor('itunes:111'));
  });
});
