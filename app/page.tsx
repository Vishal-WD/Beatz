'use client';

/**
 * Home — entry point, inside the app shell.
 *
 * This used to render a bare list of links with no status bar or bottom
 * nav, so it read as a plain website rather than a screen of the app. It now
 * sits in PhoneShell like every other route and shows the signed-in
 * player's own state (name, Drops, collection size) instead of a menu.
 */

import Link from 'next/link';
import { PhoneShell } from '@/components/PhoneChrome';
import { useAuth } from '@/lib/useAuth';
import { useOwnedCards } from '@/lib/useOwnedCards';

export default function Home() {
  const { profile, isSignedIn, isLoading } = useAuth();
  const { cards: owned, state: ownedState } = useOwnedCards();

  const collectionKnown = isSignedIn && ownedState === 'owned';

  if (isLoading) {
    return (
      <PhoneShell>
        <div
          style={{
            padding: 'var(--sp-7)',
            textAlign: 'center',
            font: '400 9px/1 var(--font-tele)',
            letterSpacing: '.16em',
            color: 'var(--ink-25)',
          }}
        >
          LOADING…
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <div style={{ padding: '24px 16px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <div style={{ font: '400 10px/1 var(--font-tele)', letterSpacing: '.24em', color: 'var(--neon-pink)' }}>
            DARK / NEON / FOIL
          </div>
          <h1
            style={{
              font: '400 clamp(40px,14vw,64px)/.9 var(--font-title)',
              textTransform: 'uppercase',
              margin: '12px 0 0',
              background: 'linear-gradient(92deg,var(--ink) 10%,var(--neon-cyan) 48%,var(--neon-pink) 88%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Beatz
          </h1>
        </div>

        {isSignedIn ? (
          <>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 16, borderRadius: 12,
                background: 'var(--booth-panel)', border: '1px solid var(--hairline)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '400 20px/1 var(--font-title)', textTransform: 'uppercase' }}>
                  {profile.display_name}
                </div>
                <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-40)', marginTop: 6 }}>
                  TIER · {profile.tier}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '700 26px/1 var(--font-stat)', color: 'var(--neon-cyan)' }}>
                  {profile.drops}
                </div>
                <div style={{ font: '400 7px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-40)', marginTop: 4 }}>
                  DROPS
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Stat
                label="COLLECTION"
                value={ownedState === 'loading' ? '—' : owned.length}
              />
              <Stat label="TOTAL REIGNS WON" value={profile.total_reigns_won} />
              <Stat label="PEAK VIBE" value={profile.peak_vibe} />
            </div>

            {!collectionKnown && ownedState !== 'loading' && (
              <div style={{ font: '400 10px/1.6 var(--font-body)', color: 'var(--ink-40)' }}>
                No cards yet — open a pack or play in a room to start a collection.
              </div>
            )}

            <Link
              href="/deck"
              style={{
                display: 'block', textAlign: 'center', padding: '16px 0',
                borderRadius: 10, background: 'var(--neon-cyan)', color: 'var(--ink-on-neon)',
                textDecoration: 'none', font: '700 13px/1 var(--font-tele)', letterSpacing: '.16em',
              }}
            >
              CONTINUE
            </Link>
          </>
        ) : (
          <>
            <p style={{ font: '400 14px/1.65 var(--font-body)', color: 'var(--ink-60)', maxWidth: 560 }}>
              Hold the throne. Keep the vibe above the line or the next challenger
              takes the aux. Every song is a card.
            </p>

            <Link
              href="/signin"
              style={{
                display: 'block', textAlign: 'center', padding: '16px 0',
                borderRadius: 10, background: 'var(--neon-pink)', color: 'var(--ink-on-neon)',
                textDecoration: 'none', font: '700 13px/1 var(--font-tele)', letterSpacing: '.16em',
              }}
            >
              SIGN IN
            </Link>
          </>
        )}
      </div>
    </PhoneShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        flex: 1, textAlign: 'center', padding: '14px 4px',
        borderRadius: 10, background: 'var(--booth-panel)', border: '1px solid var(--hairline)',
      }}
    >
      <div style={{ font: '700 22px/1 var(--font-stat)', color: 'var(--ink)' }}>{value}</div>
      <div
        style={{
          font: '400 7px/1.4 var(--font-tele)', letterSpacing: '.1em',
          color: 'var(--ink-40)', marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}
