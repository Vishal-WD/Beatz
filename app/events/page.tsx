'use client';

/**
 * Screen 07 — Events. Disco / DJ nights / parties, with RSVP.
 *
 * Social layer, adopted by explicit override of CLAUDE.md §1 (see §1.1).
 * The guard rail that still binds: every event resolves into a room running
 * the normal core loop. An RSVP reserves a Challenger Line slot — it is not
 * a standalone reward, and it never touches rarity, odds, or supply.
 */

import { useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneChrome';
import { useSound } from '@/lib/useSound';
import { useHaptics } from '@/lib/useHaptics';
import { relativeTime } from '@/lib/social-data';
import { useLiveEvents } from '@/lib/useLiveEvents';
import { EVENT_KIND_LABEL } from '@/types/social';
import type { RsvpState } from '@/types/social';

type Filter = 'ALL' | 'LIVE' | 'GOING';

export default function EventsScreen() {
  const { play } = useSound();
  const haptic = useHaptics();
  const [filter, setFilter] = useState<Filter>('ALL');
  const { events, source, setRsvp } = useLiveEvents();

  // Interested -> going -> none. Persisted through RLS when signed in.
  const cycle = (id: string) => {
    const cur = events.find((e) => e.id === id)?.viewerRsvp ?? null;
    const next: RsvpState | null =
      cur === 'going' ? null : cur === 'interested' ? 'going' : 'interested';
    void setRsvp(id, next);
  };

  const shown = events.filter((e) =>
    filter === 'ALL' ? true : filter === 'LIVE' ? e.status === 'live' : e.viewerRsvp === 'going',
  );

  return (
    <PhoneShell>
      <div style={{ padding: '4px 16px 24px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ font: '400 26px/1 var(--font-title)', textTransform: 'uppercase' }}>Tonight</div>
          <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--neon-pink)', marginTop: 6 }}>
            {events.filter((e) => e.status === 'live').length} LIVE · {events.length} SCHEDULED
            {source === 'live' && <span style={{ color: 'var(--neon-mint)' }}> · LIVE DATA</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, marginBottom: 16 }}>
          {(['ALL', 'LIVE', 'GOING'] as Filter[]).map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  font: '700 8px/1 var(--font-tele)', letterSpacing: '.14em',
                  padding: '7px 11px', borderRadius: 6,
                  background: on ? 'var(--ink)' : 'rgba(255,255,255,.05)',
                  border: `1px solid ${on ? 'var(--ink)' : 'rgba(255,255,255,.14)'}`,
                  color: on ? '#0a0812' : 'var(--ink-60)',
                }}
              >
                {f}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((e) => {
            const rsvp = e.viewerRsvp;
            const live = e.status === 'live';
            const full = e.capacity !== null && e.goingCount >= e.capacity && rsvp !== 'going';

            return (
              <div
                key={e.id}
                style={{
                  borderRadius: 14, overflow: 'hidden',
                  background: 'var(--booth-panel)',
                  border: `1px solid ${live ? e.posterAccent : 'var(--hairline)'}`,
                }}
              >
                {/* Original poster art — never album art */}
                <Link href={`/events/${e.slug}`} style={{ display: 'block', textDecoration: 'none' }}>
                  <div style={{ height: 96, background: e.posterGradient, position: 'relative', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span
                        style={{
                          font: '700 7px/1 var(--font-tele)', letterSpacing: '.16em',
                          padding: '4px 6px', borderRadius: 4,
                          background: 'rgba(0,0,0,.42)', color: '#fff',
                        }}
                      >
                        {EVENT_KIND_LABEL[e.kind]}
                      </span>
                      {live ? (
                        <span
                          style={{
                            font: '700 7px/1 var(--font-tele)', letterSpacing: '.16em',
                            padding: '4px 6px', borderRadius: 4,
                            background: '#fff', color: '#0a0008',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: 3, background: '#ff2e88',
                                         animation: 'queue 1.6s ease-in-out infinite' }} />
                          LIVE
                        </span>
                      ) : (
                        <span style={{ font: '700 7px/1 var(--font-tele)', letterSpacing: '.14em',
                                       padding: '4px 6px', borderRadius: 4,
                                       background: 'rgba(0,0,0,.42)', color: '#fff' }}>
                          {relativeTime(e.startsAt).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        position: 'absolute', left: 12, bottom: 10, right: 12,
                        font: '400 26px/0.95 var(--font-title)',
                        textTransform: 'uppercase', color: '#fff',
                        textShadow: '0 2px 12px rgba(0,0,0,.45)',
                      }}
                    >
                      {e.title}
                    </div>
                  </div>
                </Link>

                <div style={{ padding: 12 }}>
                  <div style={{ font: '400 12px/1.45 var(--font-body)', color: 'var(--ink-60)' }}>{e.tagline}</div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <span
                      style={{
                        width: 22, height: 22, borderRadius: 7,
                        background: e.host.avatarGradient,
                        display: 'grid', placeItems: 'center',
                        font: '700 8px/1 var(--font-stat)', flexShrink: 0,
                      }}
                    >
                      {e.host.initials}
                    </span>
                    <span style={{ font: '500 9px/1 var(--font-tele)', letterSpacing: '.08em', color: 'var(--ink-60)' }}>
                      {e.host.displayName.toUpperCase()}
                      {e.host.isVerified && <span style={{ color: 'var(--neon-cyan)' }}> ✓</span>}
                    </span>
                    <span style={{ marginLeft: 'auto', font: '400 8px/1 var(--font-tele)',
                                   letterSpacing: '.1em', color: 'var(--ink-40)' }}>
                      {e.venueName.toUpperCase()}
                    </span>
                  </div>

                  {/* Event Rooms block Guest Cards — CLAUDE.md §4 */}
                  {e.roomMode === 'event' && (
                    <div style={{ font: '400 7px/1 var(--font-tele)', letterSpacing: '.14em',
                                  color: 'var(--neon-gold)', marginTop: 9 }}>
                      EVENT ROOM · OWNED CARDS ONLY
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                    <button
                      onClick={() => { cycle(e.id); play('tap'); haptic('light'); }}
                      disabled={full}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 8,
                        background: rsvp === 'going' ? e.posterAccent : 'transparent',
                        border: `1px solid ${rsvp ? e.posterAccent : 'rgba(255,255,255,.16)'}`,
                        color: rsvp === 'going' ? '#0a0812' : rsvp ? e.posterAccent : 'var(--ink-60)',
                        font: '700 9px/1 var(--font-tele)', letterSpacing: '.14em',
                        opacity: full ? 0.4 : 1,
                        cursor: full ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {full ? 'FULL' : rsvp === 'going' ? "✓ GOING" : rsvp === 'interested' ? 'INTERESTED' : 'RSVP'}
                    </button>
                    <span style={{ font: '400 8px/1.5 var(--font-tele)', letterSpacing: '.1em',
                                   color: 'var(--ink-40)', textAlign: 'right', minWidth: 62 }}>
                      {e.goingCount} GOING
                      {e.capacity !== null && <><br />CAP {e.capacity}</>}
                    </span>
                  </div>

                  {/* An RSVP is a Challenger Line reservation — the bridge back
                      to the core loop, not a standalone reward. */}
                  {rsvp === 'going' && (
                    <div style={{ font: '400 7px/1.5 var(--font-tele)', letterSpacing: '.12em',
                                  color: 'var(--neon-mint)', marginTop: 9 }}>
                      CHALLENGER SLOT RESERVED WHEN THE ROOM OPENS
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {shown.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0',
                          font: '400 10px/1.7 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-25)' }}>
              NOTHING HERE YET
              <br />
              <span style={{ color: 'var(--ink-40)' }}>RSVP TO AN EVENT TO SEE IT</span>
            </div>
          )}
        </div>
      </div>
    </PhoneShell>
  );
}
