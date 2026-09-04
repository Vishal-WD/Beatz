'use client';

/**
 * Tab bar icons.
 *
 * Inline SVG rather than an icon package: five glyphs do not justify a
 * dependency, and `currentColor` lets the tab own its colour so the icon
 * follows the active state and the theme without either being passed in.
 */

export type TabIconName = 'room' | 'feed' | 'shop' | 'home' | 'you';

const PATHS: Record<TabIconName, string> = {
  // Apple Music Listen Now / Play circle
  room: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm-2-14l6 4-6 4V8z',
  // Apple Music Browse / Grid
  feed: 'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z',
  // Apple Store / Bag
  shop: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  // House — the library, where your own collection lives. Drawn as an open
  // outline like `shop` and `you` rather than a filled slab, so it inherits
  // the same active treatment (weight + scale) the rest of the set uses.
  home: 'M3 10.2 12 3.5l9 6.7V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.2zM9.5 21v-6h5v6',
  // Apple Account / Person
  you: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
};

export function TabIcon({ name, active }: { name: TabIconName; active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: 'transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)',
        transform: active ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
