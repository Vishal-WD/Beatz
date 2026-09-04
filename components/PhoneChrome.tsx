'use client';

/** Status bar + bottom tab nav shared by the phone screens (02/04/05/06). */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSound } from '@/lib/useSound';
import { TabIcon } from '@/components/ui/TabIcon';

export const TABS = [
  { href: '/deck',    label: 'ROOM',  icon: 'room'  as const },
  { href: '/packs',   label: 'SHOP',  icon: 'shop'  as const },
  { href: '/chart',   label: 'CHART', icon: 'chart' as const },
  { href: '/profile', label: 'YOU',   icon: 'you'   as const },
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
        padding: `calc(6px + var(--safe-top)) 16px 6px`,
        font: '500 11px/1 var(--font-tele)',
        color: 'var(--ink-40)',
        letterSpacing: '.08em',
      }}
    >
      <span>4:12</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* A party app that makes noise must always offer a way to stop it. */}
        <button
          onClick={() => setMuted(toggleMute())}
          aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          aria-pressed={muted}
          style={{
            font: '500 11px/1 var(--font-tele)',
            color: muted ? 'var(--neon-pink)' : 'var(--ink-40)',
            padding: '2px 4px',
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <span>▮▮▮ 82%</span>
      </div>
    </div>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      style={{
        display: 'flex',
        borderTop: '1px solid var(--hairline)',
        background: 'var(--booth-panel)',
        paddingBottom: 'var(--safe-bottom)',
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
              // Five tabs (down from six) give each one more width, so the
              // label no longer has to carry the tab alone at 9px — the icon
              // above it does the at-a-glance identification.
              padding: '10px 0 9px',
              textAlign: 'center',
              font: '700 9px/1 var(--font-tele)',
              letterSpacing: '.1em',
              textDecoration: 'none',
              color: active ? 'var(--neon-pink)' : 'var(--ink-40)',
              borderTop: `2px solid ${active ? 'var(--neon-pink)' : 'transparent'}`,
              marginTop: -1,
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
