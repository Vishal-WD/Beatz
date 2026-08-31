'use client';

/**
 * Events, RSVPs and following from Supabase, falling back to seeded data.
 *
 * RSVP writes go through RLS: `rsvps_insert` requires auth.uid() = player_id,
 * so an anonymous viewer can browse but not commit. That is enforced by the
 * database, not by hiding the button.
 */

import { useCallback, useEffect, useState } from 'react';
import type { PartyEvent, SocialProfile, RsvpState } from '@/types/social';
import { EVENTS as SEEDED_EVENTS, SUGGESTED_PROFILES as SEEDED_PROFILES } from './social-data';
import { supabase, isSupabaseConfigured, type DbEvent } from './supabase';
import { avatarFor } from './rarity';

export type LiveSource = 'loading' | 'live' | 'seeded';

interface HostRow {
  id: string;
  display_name: string;
  initials: string;
  tier: string;
}

function toPartyEvent(
  e: DbEvent,
  hosts: Map<string, HostRow>,
  counts: Map<string, { going: number; interested: number }>,
  myRsvp: Map<string, RsvpState>,
): PartyEvent {
  const h = hosts.get(e.host_id);
  const c = counts.get(e.id) ?? { going: 0, interested: 0 };
  return {
    id: e.id,
    slug: e.slug,
    kind: e.kind,
    title: e.title,
    tagline: e.tagline,
    host: {
      userId: e.host_id,
      displayName: h?.display_name ?? 'Unknown',
      initials: h?.initials ?? '??',
      avatarGradient: avatarFor(e.host_id),
      followerCount: 0,
      isVerified: h?.tier === 'AUX MARSHAL',
    },
    posterGradient: e.poster_gradient,
    posterAccent: e.poster_accent,
    startsAt: e.starts_at,
    endsAt: null,
    status: e.status,
    venueName: e.venue_name,
    venueHint: e.venue_hint,
    isOnline: e.is_online,
    roomId: e.room_id,
    roomMode: 'casual',
    capacity: e.capacity,
    goingCount: c.going,
    interestedCount: c.interested,
    viewerRsvp: myRsvp.get(e.id) ?? null,
    genreTags: e.genre_tags ?? [],
    createdAt: e.starts_at,
  };
}

export function useLiveEvents() {
  const [events, setEvents] = useState<PartyEvent[]>(SEEDED_EVENTS);
  const [source, setSource] = useState<LiveSource>(
    isSupabaseConfigured ? 'loading' : 'seeded',
  );

  const load = useCallback(async () => {
    const db = supabase();
    if (!db) return;

    const [{ data: evs }, { data: hostRows }, { data: countRows }, { data: auth }] =
      await Promise.all([
        db.from('events').select('*').in('status', ['scheduled', 'live']).order('starts_at'),
        db.from('profiles').select('id,display_name,initials,tier'),
        db.from('event_counts').select('*'),
        db.auth.getUser(),
      ]);

    if (!evs || evs.length === 0) {
      setSource('seeded');
      return;
    }

    const hosts = new Map<string, HostRow>((hostRows ?? []).map((h) => [h.id, h as HostRow]));
    const counts = new Map(
      (countRows ?? []).map((c) => [
        c.event_id as string,
        { going: c.going_count ?? 0, interested: c.interested_count ?? 0 },
      ]),
    );

    const mine = new Map<string, RsvpState>();
    if (auth.user) {
      const { data: rs } = await db
        .from('rsvps')
        .select('event_id,state')
        .eq('player_id', auth.user.id);
      for (const r of rs ?? []) mine.set(r.event_id, r.state as RsvpState);
    }

    // Room modes come from the rooms table — Event Rooms block Guest Cards.
    const { data: rooms } = await db.from('rooms').select('id,mode');
    const modes = new Map((rooms ?? []).map((r) => [r.id as string, r.mode as 'casual' | 'event']));

    setEvents(
      (evs as DbEvent[]).map((e) => ({
        ...toPartyEvent(e, hosts, counts, mine),
        roomMode: modes.get(e.room_id) ?? 'casual',
      })),
    );
    setSource('live');
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void load().catch(() => setSource('seeded'));
  }, [load]);

  /** Optimistic: the UI must not wait a round-trip to acknowledge a tap. */
  const setRsvp = useCallback(
    async (eventId: string, state: RsvpState | null) => {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                viewerRsvp: state,
                goingCount:
                  e.goingCount +
                  (state === 'going' && e.viewerRsvp !== 'going' ? 1 : 0) -
                  (e.viewerRsvp === 'going' && state !== 'going' ? 1 : 0),
              }
            : e,
        ),
      );

      const db = supabase();
      if (!db) return;
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) return; // browsing anonymously: local-only, by design

      if (state === null) {
        await db.from('rsvps').delete().match({ event_id: eventId, player_id: auth.user.id });
      } else {
        await db.from('rsvps').upsert({ event_id: eventId, player_id: auth.user.id, state });
      }
    },
    [],
  );

  return { events, source, setRsvp, reload: load };
}

export function useLiveProfiles() {
  const [profiles, setProfiles] = useState<SocialProfile[]>(SEEDED_PROFILES);
  const [source, setSource] = useState<LiveSource>(
    isSupabaseConfigured ? 'loading' : 'seeded',
  );

  useEffect(() => {
    const db = supabase();
    if (!db) return;
    let cancelled = false;

    (async () => {
      const { data: auth } = await db.auth.getUser();
      const [{ data: rows }, { data: follows }] = await Promise.all([
        db.from('profiles').select('*'),
        db.from('follows').select('follower_id,followee_id'),
      ]);
      if (cancelled || !rows || rows.length === 0) {
        if (!cancelled) setSource('seeded');
        return;
      }

      const followerCount = new Map<string, number>();
      const followingCount = new Map<string, number>();
      const iFollow = new Set<string>();
      for (const f of follows ?? []) {
        followerCount.set(f.followee_id, (followerCount.get(f.followee_id) ?? 0) + 1);
        followingCount.set(f.follower_id, (followingCount.get(f.follower_id) ?? 0) + 1);
        if (auth.user && f.follower_id === auth.user.id) iFollow.add(f.followee_id);
      }

      setProfiles(
        rows
          // Never suggest that someone follow themselves.
          .filter((p) => !auth.user || p.id !== auth.user.id)
          .map((p) => ({
            userId: p.id,
            displayName: p.display_name,
            handle: '@' + p.handle,
            initials: p.initials,
            avatarGradient: avatarFor(p.id),
            bio: p.bio,
            tier: p.tier,
            followerCount: followerCount.get(p.id) ?? 0,
            followingCount: followingCount.get(p.id) ?? 0,
            eventsHosted: 0,
            viewerFollows: iFollow.has(p.id),
            totalReignsWon: p.total_reigns_won,
            peakVibe: p.peak_vibe,
            challengerWinRate:
              p.challenger_attempts > 0 ? p.challenger_wins / p.challenger_attempts : 0,
          })),
      );
      setSource('live');
    })().catch(() => {
      if (!cancelled) setSource('seeded');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFollow = useCallback(async (followeeId: string, follow: boolean) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.userId === followeeId
          ? {
              ...p,
              viewerFollows: follow,
              followerCount: p.followerCount + (follow ? 1 : -1),
            }
          : p,
      ),
    );

    const db = supabase();
    if (!db) return;
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return;

    if (follow) {
      await db.from('follows').upsert({ follower_id: auth.user.id, followee_id: followeeId });
    } else {
      await db
        .from('follows')
        .delete()
        .match({ follower_id: auth.user.id, followee_id: followeeId });
    }
  }, []);

  return { profiles, source, toggleFollow };
}
