'use client';

/**
 * Screen 06 — World Chart (the marketplace).
 * Rows expand to ranked bids.
 *
 * Drops are EARN-ONLY (CLAUDE.md §3). There is deliberately no "buy Drops"
 * entry point anywhere on this screen — a real-money path alongside a
 * marketplace is a loot-box regulatory risk, and that constraint does not
 * relax just because we sideload the APK rather than ship to Play (§7.1).
 */

import { useState } from 'react';
import { PhoneShell } from '@/components/PhoneChrome';
import { useSound } from '@/lib/useSound';
import { RARITY, avatarFor } from '@/lib/rarity';
import { BIDS } from '@/lib/seed-data';
import { useCards } from '@/lib/useCards';
import { useAuth } from '@/lib/useAuth';

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 } as const;
const OFFERS = ['4,820', '3,140', '1,760', '1,205', '640', '115'];
const OFFER_COUNTS = [31, 22, 14, 9, 6, 3];

export default function ChartScreen() {
  const { play } = useSound();
  const { cards } = useCards();
  const { profile } = useAuth();
  const [openId, setOpenId] = useState<string | null>('l1');

  // Ordered by rarity: a common outranking a legendary would read as a bug
  // in the economy rather than a listing.
  const LISTINGS = [...cards]
    .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity])
    .slice(0, 6)
    .map((card, i) => ({ id: `l${i}`, card, topOffer: OFFERS[i], offerCount: OFFER_COUNTS[i] }));

  return (
    <PhoneShell>
      <div style={{ padding: '4px 16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ font: '400 26px/1 var(--font-title)', textTransform: 'uppercase' }}>World Chart</div>
            <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--neon-mint)', marginTop: 6 }}>
              OPEN OFFERS · LIVE
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em', color: 'var(--ink-40)' }}>
              YOUR DROPS
            </div>
            <div style={{ font: '700 20px/1 var(--font-stat)', color: 'var(--neon-gold)', marginTop: 4 }}>
              {profile.drops.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {LISTINGS.map((l) => {
            const r = RARITY[l.card.rarity];
            const open = openId === l.id;

            return (
              <div
                key={l.id}
                style={{
                  borderRadius: 12,
                  background: open ? 'rgba(255,255,255,.055)' : 'rgba(255,255,255,.028)',
                  border: `1px solid ${open ? r.color : 'rgba(255,255,255,.08)'}`,
                  overflow: 'hidden',
                  transition: 'border-color .2s ease, background .2s ease',
                }}
              >
                <button
                  onClick={() => { setOpenId(open ? null : l.id); play('tap'); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: 11, textAlign: 'left' }}
                  aria-expanded={open}
                >
                  {/* Rarity swatch stands in for cover art at row scale */}
                  <div style={{ width: 42, height: 56, borderRadius: 7, background: r.frame, flexShrink: 0, padding: 2 }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: 5, background: 'var(--booth-panel)' }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        font: '400 15px/1.1 var(--font-title)', textTransform: 'uppercase',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {l.card.title}
                    </div>
                    <div
                      style={{
                        font: '500 8px/1 var(--font-tele)', letterSpacing: '.1em',
                        color: 'var(--ink-40)', marginTop: 4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {l.card.subtitle}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                      <span
                        style={{
                          font: '700 7px/1 var(--font-tele)', letterSpacing: '.1em',
                          padding: '3px 5px', borderRadius: 4,
                          background: r.badgeBg, color: r.badgeColor,
                        }}
                      >
                        {r.label}
                      </span>
                      <span style={{ font: '400 7px/1 var(--font-tele)', letterSpacing: '.1em', color: 'var(--ink-40)' }}>
                        {l.offerCount} OFFERS
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ font: '400 7px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-40)' }}>
                      TOP OFFER
                    </div>
                    <div style={{ font: '700 19px/1 var(--font-stat)', color: r.color, marginTop: 3 }}>{l.topOffer}</div>
                    <div style={{ font: '400 7px/1 var(--font-tele)', letterSpacing: '.12em', color: 'var(--ink-40)', marginTop: 3 }}>
                      DROPS {open ? '▲' : '▼'}
                    </div>
                  </div>
                </button>

                {open && (
                  <div style={{ padding: '0 11px 12px' }}>
                    <div
                      style={{
                        font: '400 8px/1 var(--font-tele)', letterSpacing: '.2em',
                        color: 'var(--ink-40)', margin: '4px 0 9px',
                      }}
                    >
                      RANKED BIDS
                    </div>

                    {BIDS.map((b, i) => (
                      <div key={b.rank} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
                        <span style={{ font: '700 10px/1 var(--font-stat)', color: 'var(--ink-40)', width: 14 }}>
                          {b.rank}
                        </span>
                        <span
                          style={{
                            width: 26, height: 26, borderRadius: 8,
                            background: avatarFor(b.initials),
                            display: 'grid', placeItems: 'center',
                            font: '700 9px/1 var(--font-stat)', flexShrink: 0,
                          }}
                        >
                          {b.initials}
                        </span>
                        <span style={{ flex: 1, font: '500 10px/1 var(--font-tele)', letterSpacing: '.08em', color: 'var(--ink-60)' }}>
                          {b.name}
                        </span>
                        <span
                          style={{
                            font: '700 14px/1 var(--font-stat)',
                            color: i === 0 ? 'var(--neon-gold)' : 'var(--ink-60)',
                          }}
                        >
                          {b.amount}
                        </span>
                      </div>
                    ))}

                    <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                      <button
                        style={{
                          flex: 1, padding: '11px 0', borderRadius: 8,
                          background: r.color, color: '#0a0812',
                          font: '700 9px/1 var(--font-tele)', letterSpacing: '.16em',
                        }}
                      >
                        PLACE OFFER
                      </button>
                      <button
                        style={{
                          flex: 1, padding: '11px 0', borderRadius: 8,
                          border: '1px solid rgba(255,255,255,.16)', color: 'var(--ink-60)',
                          font: '700 9px/1 var(--font-tele)', letterSpacing: '.16em',
                        }}
                      >
                        WATCH
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PhoneShell>
  );
}
