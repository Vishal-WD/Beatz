/**
 * Event detail route.
 *
 * `generateStaticParams` cannot live in a client component, so the
 * interactive view is split into EventDetailView. Static export requires
 * every event slug to be enumerated at build time.
 *
 * That enumeration used to come from the EVENTS fixture in
 * lib/social-data.ts, which meant the exported APK contained pages for five
 * invented nights and no page at all for the real ones. The feed reads
 * events from the database, so its tiles linked to slugs this list had
 * never heard of — two of three seeded events 404'd in the export while
 * working perfectly in dev, because dev renders any slug on demand.
 *
 * So the list is built from the same table the feed reads. Anonymous
 * SELECT on `events` is public (RLS policy `events_read`), which is why the
 * anon key is enough here.
 */

import { createClient } from '@supabase/supabase-js';
import { EventDetailView } from './EventDetailView';

export async function generateStaticParams() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // A build without credentials still has to produce a working bundle —
  // it just cannot know the slugs. Returning none exports no detail pages
  // rather than failing the build, and the runtime still resolves an event
  // by slug through useEventBySlug once it has a session.
  if (!url || !key) {
    console.warn('[events/[slug]] no Supabase credentials at build; exporting no event pages');
    return [];
  }

  const { data, error } = await createClient(url, key)
    .from('events')
    .select('slug');

  if (error) {
    // Failing loudly here beats shipping an APK whose event links 404.
    throw new Error(`generateStaticParams could not list event slugs: ${error.message}`);
  }

  return (data ?? []).map((e) => ({ slug: e.slug as string }));
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <EventDetailView slug={slug} />;
}
