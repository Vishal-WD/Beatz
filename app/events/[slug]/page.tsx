/**
 * Event detail route (server component).
 *
 * `generateStaticParams` cannot live in a client component, so the
 * interactive view is split into EventDetailView. Static export requires
 * every event slug to be enumerated at build time.
 */

import { EVENTS } from '@/lib/social-data';
import { EventDetailView } from './EventDetailView';

export function generateStaticParams() {
  return EVENTS.map((e) => ({ slug: e.slug }));
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <EventDetailView slug={slug} />;
}
