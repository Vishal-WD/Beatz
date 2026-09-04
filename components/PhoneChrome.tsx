'use client';

/** Status bar + bottom tab nav shared by the phone screens (02/04/05/06). */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSound } from '@/lib/useSound';
import { TabIcon } from '@/components/ui/TabIcon';

export const TABS = [
  { href: '/home',    label: 'HOME', icon: 'home' as const },
  { href: '/packs',   label: 'SHOP', icon: 'shop' as const },
  { href: '/deck',    label: 'ROOM', icon: 'room' as const },
  { href: '/profile', label: 'YOU',  icon: 'you'  as const },
];

export function StatusBar() {
  const { toggleMute, isMuted } = useSound();
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isMuted());
  }, [isMuted]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `calc(8px + var(--safe-top)) 20px 8px`,
        font: '600 13px/1 var(--font-body)',
        color: 'var(--ink)',
        letterSpacing: '-0.01em',
      }}
    >
      {/*
        The fake clock and battery duplicated the real Android status bar
        sitting directly above them -- two clocks, two batteries, one of
        each of them lying. Only the mute control survives, because that one
        does something.
      */}
      <span aria-hidden style={{ opacity: 0 }}>·</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => setMuted(toggleMute())}
          aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          aria-pressed={muted}
          style={{
            width: 34,
            height: 34,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--radius-pill)',
            border: 'var(--border-hair)',
            background: muted ? 'var(--surface-inset)' : 'transparent',
            color: muted ? 'var(--neon-pink)' : 'var(--ink-60)',
            transition: 'background .18s ease, color .18s ease, transform .18s ease',
          }}
        >
          <SpeakerIcon muted={muted} />
        </button>
      </div>
    </div>
  );
}

/**
 * Speaker, drawn rather than typed.
 *
 * This was the emoji 🔊 / 🔇, which renders in the system emoji font: a
 * different weight, a different colour, and a different size from every
 * other glyph in the bar, and it cannot inherit the theme. An inline SVG
 * takes currentColor, so it tracks the mute state and the palette.
 *
 * The muted state crosses out the waves rather than just dimming them --
 * colour alone is not a state anyone can read at 34px.
 */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden
         stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <path d="m16.5 9.5 5 5" />
          <path d="m21.5 9.5-5 5" />
        </>
      ) : (
        <>
          <path d="M15.6 8.4a5 5 0 0 1 0 7.2" />
          <path d="M18.4 5.6a9 9 0 0 1 0 12.8" />
        </>
      )}
    </svg>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      style={{
        display: 'flex',
        borderTop: 'var(--border-hair)',
        background: 'var(--apple-glass)',
        backdropFilter: 'var(--apple-glass-blur)',
        WebkitBackdropFilter: 'var(--apple-glass-blur)',
        paddingBottom: 'calc(4px + var(--safe-bottom))',
        flexShrink: 0,
      }}
    >
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 0 6px',
              textAlign: 'center',
              font: active ? '600 10px/1.2 var(--font-body)' : '500 10px/1.2 var(--font-body)',
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              color: active ? 'var(--neon-pink)' : 'var(--ink-40)',
              transition: 'color 0.16s ease, transform 0.16s ease',
            }}
          >
            <TabIcon name={t.icon} active={active} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Fixed-viewport shell — the game surface never scrolls as a document. */
export function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        maxWidth: 480,
        margin: '0 auto',
        background: 'var(--stage-black)',
        overflow: 'hidden',
      }}
    >
      <StatusBar />
      <main id="main" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        {children}
      </main>
      <TabBar />
    </div>
  );
}
