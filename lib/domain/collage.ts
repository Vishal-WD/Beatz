/**
 * A 2x2 artwork mosaic for an event tile, like a playlist cover.
 *
 * Built from the cards actually played in that event's room, so a night
 * looks like the music that happened there. An event with no plays yet
 * returns an empty array and the caller falls back to the poster gradient
 * rather than rendering an empty grid.
 */

/** One event as the feed needs it. `artwork` is raw; run it through collageFor. */
export interface FeedTile {
  eventId: string;
  slug: string;
  title: string;
  tagline: string | null;
  status: string;
  startsAt: string;
  posterGradient: string;
  /**
   * The room's control model, which is what a tile actually tells a reader
   * about the night — not the event's listing category. The two are
   * separate enums and must not be collapsed (CLAUDE.md §1.1).
   */
  format: string | null;
  artwork: string[];
}

const CELLS = 4;

export function collageFor(artwork: string[]): string[] {
  const usable = artwork.filter((a) => a && a.length > 0);
  if (usable.length === 0) return [];

  // Repeat rather than pad with blanks: three real covers and one hole
  // reads as broken, while a repeat reads as deliberate.
  const out: string[] = [];
  for (let i = 0; i < CELLS; i++) out.push(usable[i % usable.length]);
  return out;
}
