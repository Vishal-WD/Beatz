/**
 * Human-readable times for event listings.
 *
 * These used to live in lib/social-data.ts alongside the EVENTS and
 * SUGGESTED_PROFILES fixtures. Every screen that wanted to say "in 3d" had
 * to import from a file whose main export was invented data, which is how
 * the fixture stayed reachable long after the app started reading real
 * events. Pure date formatting belongs in the domain layer, so the fixture
 * could be deleted outright.
 */

/** "in 5h", "in 3d", "live now" — events are read at a glance. */
export function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60_000);
  if (mins < -1) return 'live now';
  if (mins < 60) return `in ${Math.max(1, mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.round(hrs / 24)}d`;
}

/** "12m", "3h", "5d" — how long ago something happened. */
export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}
