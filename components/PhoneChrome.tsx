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
        padding: `calc(8px + var(--safe-top)) 20px 8px`,
        font: '600 13px/1 var(--font-body)',
        color: 'var(--ink)',
        letterSpacing: '-0.01em',
      }}
    >
      <span>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Apple iOS Mute Toggle */}
        <button
          onClick={() => setMuted(toggleMute())}
          aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          aria-pressed={muted}
          style={{
            font: '500 12px/1 var(--font-body)',
            color: muted ? 'var(--neon-pink)' : 'var(--ink-60)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-pill)',
            background: muted ? 'var(--surface-inset)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        {/* Apple iOS Battery Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div
            style={{
              width: 22,
              height: 11,
              borderRadius: 3.5,
              border: '1.2px solid var(--ink-40)',
              padding: 1.5,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '75%',
                height: '100%',
                borderRadius: 1.5,
                background: 'var(--ink)',
              }}
            />
          </div>
          <div
            style={{
              width: 1.5,
              height: 4,
              borderRadius: '0 1px 1px 0',
              background: 'var(--ink-40)',
            }}
          />
        </div>
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
