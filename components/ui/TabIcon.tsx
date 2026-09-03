'use client';

/**
 * Tab bar icons.
 *
 * Inline SVG rather than an icon package: five glyphs do not justify a
 * dependency, and `currentColor` lets the tab own its colour so the icon
 * follows the active state and the theme without either being passed in.
 */

export type TabIconName = 'room' | 'feed' | 'shop' | 'chart' | 'you';

const PATHS: Record<TabIconName, string> = {
  // Play triangle — the room is where a card gets played.
  room: 'M5 3l14 9-14 9V3z',
  // Grid — the feed is a wall of event tiles.
  feed: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z',
  // Pack — a sealed wrapper.
  shop: 'M3 7l9-4 9 4v10l-9 4-9-4V7zm9-4v18',
  // Ascending bars — scarcity ranking.
  chart: 'M4 20V10m6 10V4m6 16v-7m6 7V7',
  // Person.
  you: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0',
};

export function TabIcon({ name, active }: { name: TabIconName; active: boolean }) {
  return (
    <svg
      // Decorative: the visible text label beside it is the accessible name,
      // so announcing the icon too would read the tab twice.
      aria-hidden="true"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
