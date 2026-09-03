'use client';

/**
 * Event detail — the bridge from the social layer back into the core loop.
 * "Enter the room" is the only terminal action; everything else here is
 * context for that one button.
 */

import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneChrome';
import { relativeTime } from '@/lib/social-data';
import { useEventBySlug, useLiveEvents } from '@/lib/useLiveEvents';
import { EVENT_KIND_LABEL } from '@/types/social';
import type { RsvpState } from '@/types/social';

export function EventDetailView({ slug }: { slug: string }) {
  // Reads the same live source as the events list. It used to call
  // eventBySlug() — a fixture — so tapping an event showed different data
  // from the card that led to it.
  const { event, state } = useEventBySlug(slug);
  const { setRsvp: persistRsvp } = useLiveEvents();
  const rsvp: RsvpState | null = event?.viewerRsvp ?? null;
  const setRsvp = (next: RsvpState | null) => {
    if (event) void persistRsvp(event.id, next);
  };

  // "Not fetched yet" is not "no such event" — saying so would flash
  // EVENT NOT FOUND on every open.
  if (state === 'loading') {
    return (
      <PhoneShell>
        <div style={{ padding: 40, textAlign: 'center',
                      font: '400 9px/1 var(--font-tele)', letterSpacing: '.16em',
                      color: 'var(--ink-25)' }}>
          LOADING…
        </div>
      </PhoneShell>
    );
  }

  if (!event) {
    return (
      <PhoneShell>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ font: '400 22px/1 var(--font-title)', textTransform: 'uppercase' }}>No such event</div>
          <Link href="/events" style={{ font: '700 9px/1 var(--font-tele)', letterSpacing: '.16em',
                                        color: 'var(--neon-cyan)', textDecoration: 'none',
                                        display: 'inline-block', marginTop: 16 }}>
            ← BACK TO EVENTS
          </Link>
        </div>
      </PhoneShell>
    );
  }

  const live = event.status === 'live';
  const going = event.goingCount + (rsvp === 'going' && event.viewerRsvp !== 'going' ? 1 : 0);

  return (
    <PhoneShell>
      <div>
        {/* Poster — original art, never album art */}
        <div style={{ height: 190, background: event.posterGradient, position: 'relative', padding: 16 }}>
          <Link href="/events" style={{ font: '700 9px/1 var(--font-tele)', letterSpacing: '.16em',
                                        color: '#fff', textDecoration: 'none', opacity: .85 }}>
            ← EVENTS
          </Link>
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <span style={{ font: '700 7px/1 var(--font-tele)', letterSpacing: '.16em',
                             padding: '4px 6px', borderRadius: 4,
                             background: 'rgba(0,0,0,.42)', color: '#fff' }}>
                {EVENT_KIND_LABEL[event.kind]}
              </span>
              {live && (
                <span style={{ font: '700 7px/1 var(--font-tele)', letterSpacing: '.16em',
                               padding: '4px 6px', borderRadius: 4, background: '#fff', color: '#0a0008' }}>
                  ● LIVE NOW
                </span>
              )}
            </div>
            <div style={{ font: '400 36px/0.92 var(--font-title)', textTransform: 'uppercase',
                          color: '#fff', textShadow: '0 2px 14px rgba(0,0,0,.5)' }}>
              {event.title}
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ font: '400 14px/1.55 var(--font-body)', color: 'var(--ink-60)', margin: 0 }}>
            {event.tagline}
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <Detail label="WHEN" value={live ? 'LIVE NOW' : relativeTime(event.startsAt).toUpperCase()} />
            <Detail label="WHERE" value={event.venueName.toUpperCase()} />
            <Detail label="GOING" value={String(going)} />
          </div>

          {event.venueHint && (
            <div style={{ font: '400 10px/1.6 var(--font-tele)', letterSpacing: '.1em',
                          color: 'var(--ink-40)', padding: '10px 12px', borderRadius: 8,
                          background: 'rgba(255,255,255,.03)', border: '1px solid var(--hairline)' }}>
              {event.venueHint.toUpperCase()}
            </div>
          )}

          {/* Host */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 12, borderRadius: 12,
                        background: 'var(--booth-panel)', border: '1px solid var(--hairline)' }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: event.host.avatarGradient,
                           display: 'grid', placeItems: 'center', font: '700 14px/1 var(--font-stat)' }}>
              {event.host.initials}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '400 17px/1 var(--font-title)', textTransform: 'uppercase' }}>
                {event.host.displayName}
                {event.host.isVerified && <span style={{ color: 'var(--neon-cyan)', fontSize: 13 }}> ✓</span>}
              </div>
              <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.14em',
                            color: 'var(--ink-40)', marginTop: 5 }}>
                HOST · {event.host.followerCount.toLocaleString()} FOLLOWERS
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {event.genreTags.map((t) => (
              <span key={t} style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.14em',
                                     padding: '6px 9px', borderRadius: 5,
                                     border: '1px solid rgba(255,255,255,.14)', color: 'var(--ink-40)' }}>
                {t}
              </span>
            ))}
          </div>

          {event.roomMode === 'event' && (
            <div style={{ padding: '11px 13px', borderRadius: 9,
                          background: 'rgba(255,216,77,.08)', border: '1px solid rgba(255,216,77,.3)' }}>
              <div style={{ font: '700 8px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--neon-gold)' }}>
                EVENT ROOM
              </div>
              <div style={{ font: '400 11px/1.5 var(--font-body)', color: 'var(--ink-60)', marginTop: 6 }}>
                Owned cards only. Guest Cards from desktop sync are blocked here.
              </div>
            </div>
          )}

          {/* Terminal action: everything above exists to get you here */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {live ? (
              <Link
                href="/deck"
                style={{
                  padding: '15px 0', borderRadius: 11, textAlign: 'center', textDecoration: 'none',
                  background: event.posterAccent, color: '#0a0812',
                  font: '700 11px/1 var(--font-tele)', letterSpacing: '.18em',
                }}
              >
                ENTER THE ROOM →
              </Link>
            ) : (
              <button
                onClick={() => setRsvp(rsvp === 'going' ? null : 'going')}
                style={{
                  padding: '15px 0', borderRadius: 11,
                  background: rsvp === 'going' ? event.posterAccent : 'transparent',
                  border: `1px solid ${event.posterAccent}`,
                  color: rsvp === 'going' ? '#0a0812' : event.posterAccent,
                  font: '700 11px/1 var(--font-tele)', letterSpacing: '.18em',
                }}
              >
                {rsvp === 'going' ? "✓ YOU'RE GOING" : "I'M GOING"}
              </button>
            )}

            {rsvp === 'going' && !live && (
              <div style={{ font: '400 8px/1.6 var(--font-tele)', letterSpacing: '.12em',
                            color: 'var(--neon-mint)', textAlign: 'center' }}>
                CHALLENGER SLOT RESERVED · YOU&apos;LL BE PINGED WHEN IT OPENS
              </div>
            )}
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, padding: '10px 11px', borderRadius: 9,
                  background: 'var(--booth-panel)', border: '1px solid var(--hairline)' }}>
      <div style={{ font: '400 7px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-40)' }}>
        {label}
      </div>
      <div style={{ font: '700 15px/1 var(--font-stat)', color: 'var(--ink)', marginTop: 6 }}>{value}</div>
    </div>
  );
}
