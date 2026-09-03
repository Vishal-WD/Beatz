'use client';

/**
 * Screen 05 — Profile & Showcase.
 * The Profile Card IS the user's profile (CLAUDE.md §2) — same visual
 * template as a Song Card, different data source.
 */

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SongCardView } from '@/components/SongCardView';
import { PhoneShell } from '@/components/PhoneChrome';
import { PROFILE_FRAME, RARITY, avatarFor } from '@/lib/rarity';
import { useOwnedCards } from '@/lib/useOwnedCards';
import { useAuth } from '@/lib/useAuth';
import { fetchPinnedCards, dbCardToSongCard } from '@/lib/supabase';
import type { SongCard } from '@/types/cards';
import type { Rarity } from '@/types/cards';

const FILTERS: Array<'ALL' | Uppercase<Rarity>> = ['ALL', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

export default function ProfileScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const { profile, isSignedIn, isLoading, signOut } = useAuth();
  /*
    The binder is the player's OWN collection. It used to render the whole
    global catalogue, so every player's binder looked identical and showed
    cards they had never pulled.
  */
  const { cards: owned, owned: hasCollection } = useOwnedCards();
  const [pinned, setPinned] = useState<SongCard[]>([]);

  useEffect(() => {
    if (!isSignedIn || !profile.id) { setPinned([]); return; }
    let cancelled = false;
    void fetchPinnedCards(profile.id).then((rows) => {
      if (!cancelled) setPinned(rows.map(dbCardToSongCard) as SongCard[]);
    });
    return () => { cancelled = true; };
  }, [isSignedIn, profile.id]);

  const binder = useMemo(
    () =>
      filter === 'ALL'
        ? owned
        : owned.filter((c) => c.rarity === filter.toLowerCase()),
    [filter, owned],
  );

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
      <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Profile Card — cyan/violet frame, crown badge, never holo */}
        <div style={{ padding: 2, borderRadius: 16, background: PROFILE_FRAME.frame }}>
          <div style={{ background: 'var(--booth-panel)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 54, height: 54, borderRadius: '50%',
                  background: avatarFor(profile.id),
                  display: 'grid', placeItems: 'center',
                  font: '700 20px/1 var(--font-stat)',
                }}
              >
                {profile.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '400 24px/1 var(--font-title)', textTransform: 'uppercase' }}>
                  {profile.display_name}
                </div>
                <div
                  style={{
                    font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em',
                    color: PROFILE_FRAME.color, marginTop: 5,
                  }}
                >
                  TIER · {profile.tier}
                </div>
              </div>
              <span
                style={{
                  font: '700 9px/1 var(--font-tele)', padding: '5px 7px', borderRadius: 5,
                  background: PROFILE_FRAME.badgeBg, color: PROFILE_FRAME.badgeColor,
                }}
              >
                ♛ {profile.season_badge ?? 'S1'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <ProfileStat label={'TOTAL REIGNS\nWON'} value={profile.total_reigns_won} />
              <ProfileStat label={'PEAK\nVIBE'} value={profile.peak_vibe} />
              <ProfileStat
                label={'CHALLENGER\nWIN RATE'}
                value={`${profile.challenger_attempts > 0 ? Math.round((profile.challenger_wins / profile.challenger_attempts) * 100) : 0}%`}
              />
            </div>
          </div>
        </div>

        {/* Pinned */}
        <div>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em',
              color: 'var(--ink-40)', marginBottom: 12,
            }}
          >
            <span>PINNED · {pinned.length}</span>
            {isSignedIn
              ? <button onClick={() => void signOut()} style={{ font:'inherit', letterSpacing:'inherit', color:'var(--neon-cyan)' }}>SIGN OUT</button>
              : <Link href="/signin" style={{ color:'var(--neon-cyan)', textDecoration:'none' }}>SIGN IN</Link>}
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {pinned.length === 0 ? (
              <div
                style={{
                  font: '400 10px/1.6 var(--font-tele)', letterSpacing: '.14em',
                  color: 'var(--ink-25)', padding: '18px 0',
                }}
              >
                {isSignedIn
                  ? 'NOTHING PINNED YET'
                  : 'SIGN IN TO BUILD A SHOWCASE'}
              </div>
            ) : (
              pinned.map((c) => <SongCardView key={c.id} card={c} size="sm" />)
            )}
          </div>
        </div>

        {/* Binder */}
        <div>
          <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)', marginBottom: 12 }}>
            BINDER · {owned.length} CARD{owned.length === 1 ? '' : 'S'}
          </div>

          <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => {
              const on = filter === f;
              const col = f === 'ALL' ? 'var(--ink)' : RARITY[f.toLowerCase() as Rarity].color;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    font: '700 8px/1 var(--font-tele)', letterSpacing: '.14em',
                    padding: '7px 10px', borderRadius: 6,
                    background: on ? col : 'rgba(255,255,255,.05)',
                    border: `1px solid ${on ? col : 'rgba(255,255,255,.14)'}`,
                    color: on ? '#0a0812' : col,
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, justifyItems: 'center' }}>
            {binder.map((c) => (
              <SongCardView key={c.id} card={c} size="sm" />
            ))}
          </div>

          {binder.length === 0 && (
            <div
              style={{
                textAlign: 'center', padding: '32px 0',
                font: '400 10px/1.6 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-25)',
              }}
            >
              NO CARDS IN THIS TIER YET
            </div>
          )}
        </div>
      </div>
    </PhoneShell>
  );
}

function ProfileStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div
        style={{
          font: '400 7px/1.4 var(--font-tele)', letterSpacing: '.12em',
          color: 'var(--ink-40)', whiteSpace: 'pre-line', minHeight: 20,
        }}
      >
        {label}
      </div>
      <div style={{ font: '700 26px/1 var(--font-stat)', color: PROFILE_FRAME.color, marginTop: 5 }}>
        {value}
      </div>
    </div>
  );
}
