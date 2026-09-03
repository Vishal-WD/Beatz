'use client';

/**
 * Screen 08 — Social. Activity feed + following.
 *
 * Social layer per CLAUDE.md §1.1. Guard rail: following NEVER affects
 * rarity, pull odds, or supply. It is a discovery mechanism — how you find
 * whose rooms to join — not a second progression track.
 */

import { useState } from 'react';
import { PhoneShell } from '@/components/PhoneChrome';
import { EmptyState } from '@/components/ui';
import { useSound } from '@/lib/useSound';
import { useHaptics } from '@/lib/useHaptics';
import { timeAgo } from '@/lib/social-data';
import { useLiveProfiles } from '@/lib/useLiveEvents';
import { useActivityFeed } from '@/lib/useActivityFeed';
import { avatarFor } from '@/lib/rarity';

/** "Maya J." -> "MJ" — the feed has no stored initials, only a name. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Tab = 'FEED' | 'PEOPLE';

const KIND_ACCENT: Record<string, string> = {
  reign_won: 'var(--neon-cyan)',
  peak_moment: 'var(--neon-gold)',
  card_pulled: 'var(--neon-rose)',
  followed: 'var(--ink-40)',
  rsvp: 'var(--neon-pink)',
};

export default function SocialScreen() {
  const { play } = useSound();
  const haptic = useHaptics();
  const [tab, setTab] = useState<Tab>('FEED');
  const { profiles, source, toggleFollow } = useLiveProfiles();
  const { events: activity, state: feedState } = useActivityFeed();

  const followingCount = profiles.filter((p) => p.viewerFollows).length;

  return (
    <PhoneShell>
      <div style={{ padding: '4px 16px 24px' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ font: '400 26px/1 var(--font-title)', textTransform: 'uppercase' }}>Around You</div>
          <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--neon-cyan)', marginTop: 6 }}>
            FOLLOWING {followingCount} · {activity.length} UPDATES
            {source === 'live' && <span style={{ color: 'var(--neon-mint)' }}> · LIVE</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, marginBottom: 18 }}>
          {(['FEED', 'PEOPLE'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 7,
                  background: on ? 'var(--ink)' : 'var(--hairline)',
                  border: `1px solid ${on ? 'var(--ink)' : 'var(--hairline)'}`,
                  color: on ? 'var(--ink-on-neon)' : 'var(--ink-60)',
                  font: '700 9px/1 var(--font-tele)', letterSpacing: '.16em',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {tab === 'FEED' ? (
          feedState === 'loading' ? (
            <EmptyState
              title="LOADING…"
              hint="Pulling the latest activity."
            />
          ) : activity.length === 0 ? (
            <EmptyState
              title="NOTHING YET"
              hint="Play a card to start the feed."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activity.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', gap: 11, padding: '13px 2px',
                    borderBottom: i < activity.length - 1 ? '1px solid var(--hairline)' : 'none',
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                      background: avatarFor(a.actorName),
                      display: 'grid', placeItems: 'center',
                      font: '700 12px/1 var(--font-stat)',
                    }}
                  >
                    {initialsOf(a.actorName)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '400 13px/1.4 var(--font-body)', color: 'var(--ink)' }}>
                      <b style={{ fontWeight: 600 }}>{a.actorName}</b>{' '}
                      <span style={{ color: 'var(--ink-60)' }}>{a.subject}</span>
                    </div>
                    {a.detail && (
                      <div
                        style={{
                          font: '400 8px/1 var(--font-tele)', letterSpacing: '.12em',
                          color: KIND_ACCENT[a.kind] ?? 'var(--ink-40)', marginTop: 6,
                        }}
                      >
                        {a.detail.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span style={{ font: '400 8px/1 var(--font-tele)', color: 'var(--ink-25)', flexShrink: 0 }}>
                    {timeAgo(a.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {profiles.map((p) => {
              const following = Boolean(p.viewerFollows);
              return (
                <div
                  key={p.userId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: 12,
                    borderRadius: 12, background: 'var(--booth-panel)',
                    border: '1px solid var(--hairline)',
                  }}
                >
                  <span
                    style={{
                      width: 40, height: 40, borderRadius: 13, flexShrink: 0,
                      background: p.avatarGradient,
                      display: 'grid', placeItems: 'center',
                      font: '700 14px/1 var(--font-stat)',
                    }}
                  >
                    {p.initials}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '400 17px/1 var(--font-title)', textTransform: 'uppercase' }}>
                      {p.displayName}
                    </div>
                    <div
                      style={{
                        font: '400 8px/1 var(--font-tele)', letterSpacing: '.12em',
                        color: 'var(--ink-40)', marginTop: 5,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {p.tier} · {p.totalReignsWon} REIGNS · {Math.round(p.challengerWinRate * 100)}% WIN
                    </div>
                  </div>

                  <button
                    onClick={() => { void toggleFollow(p.userId, !following); play('tap'); haptic('light'); }}
                    style={{
                      padding: '8px 12px', borderRadius: 7, flexShrink: 0,
                      background: following ? 'transparent' : 'var(--neon-cyan)',
                      border: following ? 'var(--border-strong)' : '1px solid var(--neon-cyan)',
                      color: following ? 'var(--ink-60)' : 'var(--ink-on-neon)',
                      font: '700 8px/1 var(--font-tele)', letterSpacing: '.14em',
                    }}
                  >
                    {following ? 'FOLLOWING' : 'FOLLOW'}
                  </button>
                </div>
              );
            })}

            <p
              style={{
                font: '400 10px/1.6 var(--font-body)', color: 'var(--ink-25)',
                textAlign: 'center', margin: '10px 0 0', padding: '0 20px',
              }}
            >
              Following changes whose rooms you see. It never changes your pull
              odds or card rarity.
            </p>
          </div>
        )}
      </div>
    </PhoneShell>
  );
}
