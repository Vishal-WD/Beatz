'use client';

/**
 * Screen 05 — Profile & Showcase.
 * The Profile Card IS the user's profile (CLAUDE.md §2) — same visual
 * template as a Song Card, different data source.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { SongCardView } from '@/components/SongCardView';
import { PhoneShell } from '@/components/PhoneChrome';
import { Avatar } from '@/components/Avatar';
import { AccountSettings } from '@/components/AccountSettings';
import { PROFILE_FRAME, RARITY, avatarFor, rarityTextVar } from '@/lib/rarity';
import { useOwnedCards } from '@/lib/useOwnedCards';
import { useAuth } from '@/lib/useAuth';
import { usePreviewAudio } from '@/lib/usePreviewAudio';
import { fetchPinnedCards, dbCardToSongCard, updateDisplayName } from '@/lib/supabase';
import { filterCollection, languagesIn, countsByRarity } from '@/lib/domain/collection';
import type { RarityFilter, LanguageFilter } from '@/lib/domain/collection';
import type { SongCard } from '@/types/cards';
import type { Rarity } from '@/types/cards';

const RARITY_CHIPS: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export default function ProfileScreen() {
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('all');
  const { profile, isSignedIn, isLoading, signOut, refreshProfile } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  /*
    The binder is the player's OWN collection. It used to render the whole
    global catalogue, so every player's binder looked identical and showed
    cards they had never pulled.
  */
  const { cards: owned, owned: hasCollection } = useOwnedCards();
  const [pinned, setPinned] = useState<SongCard[]>([]);

  // Which card, if any, is currently playing its preview. A single id
  // drives a single usePreviewAudio call below — one <audio> element for
  // the whole binder, never one per card, so playback can never overlap.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playingCard = owned.find((c) => c.id === playingId) ?? null;
  const previewUrl = playingCard?.previewUrl ?? null;
  const { playing, toggle: togglePreview, stop: stopPreview } = usePreviewAudio(previewUrl);

  // usePreviewAudio only builds an <audio> element once its url effect has
  // run for the NEW id — the togglePreview captured by handleCardTap's own
  // render is still bound to the previous (possibly null) url and would
  // no-op. Recording the intent and acting on it from an effect keyed on
  // the resolved url means the effect always sees the CURRENT togglePreview,
  // the one actually wired to the new <audio> element.
  const pendingPlayRef = useRef<string | null>(null);

  const handleCardTap = (c: SongCard) => {
    if (!c.previewUrl) return;
    if (playingId === c.id) {
      stopPreview();
      setPlayingId(null);
      pendingPlayRef.current = null;
      return;
    }
    pendingPlayRef.current = c.id;
    setPlayingId(c.id);
  };

  useEffect(() => {
    if (!previewUrl) return;
    if (pendingPlayRef.current !== playingId) return;
    if (playing) return;
    pendingPlayRef.current = null;
    togglePreview();
  }, [previewUrl, playingId, playing, togglePreview]);

  // Edit display name — the only identity field a player can change
  // themselves. The handle is generated at signup and read-only: other
  // players may already know it.
  const [nameDraft, setNameDraft] = useState(profile.display_name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState(false);
  useEffect(() => { setNameDraft(profile.display_name); }, [profile.display_name]);

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === profile.display_name) return;
    setNameSaving(true);
    setNameSaved(false);
    setNameError(false);
    const ok = await updateDisplayName(trimmed);
    setNameSaving(false);
    if (ok) {
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } else {
      setNameError(true);
      setTimeout(() => setNameError(false), 2500);
    }
  };

  useEffect(() => {
    if (!isSignedIn || !profile.id) { setPinned([]); return; }
    let cancelled = false;
    void fetchPinnedCards(profile.id).then((rows) => {
      if (!cancelled) setPinned(rows.map(dbCardToSongCard) as SongCard[]);
    });
    return () => { cancelled = true; };
  }, [isSignedIn, profile.id]);

  const binder = useMemo(
    () => filterCollection(owned, { rarity: rarityFilter, language: languageFilter }),
    [owned, rarityFilter, languageFilter],
  );
  const languages = useMemo(() => languagesIn(owned), [owned]);
  const rarityCounts = useMemo(() => countsByRarity(owned), [owned]);

  // A filter change can drop the currently-playing card out of view. Its
  // PLAYING badge and TAP TO STOP affordance vanish with it, so leaving the
  // audio running would be uncontrollable — stop it the moment the card it
  // belongs to is no longer in the filtered binder. Only fires when the
  // playing card actually leaves the list, not on every filter change.
  useEffect(() => {
    if (!playingId) return;
    if (binder.some((c) => c.id === playingId)) return;
    stopPreview();
    setPlayingId(null);
    pendingPlayRef.current = null;
    // binder is the only dependency that should retrigger this — playingId/
    // stopPreview changing on their own must not stop playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binder]);

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
              <Avatar
                id={profile.id}
                initials={profile.initials}
                url={profile.avatar_url}
                size={54}
              />
              <div style={{ flex: 1 }}>
                <div style={{ font: '400 24px/1 var(--font-title)', textTransform: 'uppercase' }}>
                  {profile.display_name}
                </div>
                <div
                  style={{
                    font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em',
                    color: 'var(--profile-text)', marginTop: 5,
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

        {/* Edit profile — display name only. The handle is generated at
            signup and stays read-only; other players may already know it. */}
        {isSignedIn && (
          <div>
            <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)', marginBottom: 12 }}>
              EDIT PROFILE
            </div>
            <div style={{ background: 'var(--booth-panel)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-40)' }}>
                  DISPLAY NAME
                </span>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={40}
                  style={{
                    font: '400 14px/1 var(--font-body)', color: 'var(--ink)',
                    background: 'var(--hairline)', border: '1px solid var(--hairline)',
                    borderRadius: 6, padding: '9px 10px',
                  }}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => void saveName()}
                  disabled={nameSaving || !nameDraft.trim() || nameDraft.trim() === profile.display_name}
                  style={{
                    font: '700 9px/1 var(--font-tele)', letterSpacing: '.14em',
                    padding: '9px 14px', borderRadius: 6,
                    background: 'var(--neon-cyan)', color: 'var(--ink-on-neon)',
                    opacity: nameSaving || !nameDraft.trim() || nameDraft.trim() === profile.display_name ? 0.4 : 1,
                  }}
                >
                  {nameSaving ? 'SAVING…' : 'SAVE'}
                </button>
                {nameSaved && (
                  <span style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.1em', color: 'var(--neon-mint)' }}>
                    SAVED
                  </span>
                )}
                {nameError && (
                  <span style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.1em', color: 'var(--neon-pink)' }}>
                    SAVE FAILED
                  </span>
                )}
                <span style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.1em', color: 'var(--ink-25)', marginLeft: 'auto' }}>
                  @{profile.handle}
                </span>
              </div>
            </div>
          </div>
        )}

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
              ? (
                <span style={{ display: 'flex', gap: 14 }}>
                  <button
                    onClick={() => setAccountOpen(true)}
                    style={{ font:'inherit', letterSpacing:'inherit', color:'var(--neon-cyan)' }}
                  >
                    ACCOUNT
                  </button>
                  <button onClick={() => void signOut()} style={{ font:'inherit', letterSpacing:'inherit', color:'var(--neon-cyan)' }}>SIGN OUT</button>
                </span>
              )
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

          {/* Rarity chips — counts so a player can see what they hold. */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setRarityFilter('all')}
              style={{
                font: '700 8px/1 var(--font-tele)', letterSpacing: '.14em',
                padding: '7px 10px', borderRadius: 6,
                background: rarityFilter === 'all' ? 'var(--ink)' : 'var(--hairline)',
                border: `1px solid ${rarityFilter === 'all' ? 'var(--ink)' : 'var(--hairline)'}`,
                color: rarityFilter === 'all' ? 'var(--ink-on-neon)' : 'var(--ink)',
              }}
            >
              ALL · {owned.length}
            </button>
            {RARITY_CHIPS.map((r) => {
              const on = rarityFilter === r;
              // Fill keeps the true rarity colour (identity); the unselected
              // LABEL uses the text-safe variant, which is the same hue but
              // readable on cream. See rarityTextVar.
              const col = RARITY[r].color;
              const textCol = rarityTextVar(r);
              return (
                <button
                  key={r}
                  onClick={() => setRarityFilter(r)}
                  style={{
                    font: '700 8px/1 var(--font-tele)', letterSpacing: '.14em',
                    padding: '7px 10px', borderRadius: 6,
                    background: on ? col : 'var(--hairline)',
                    border: `1px solid ${on ? col : 'var(--hairline)'}`,
                    color: on ? 'var(--ink-on-neon)' : textCol,
                  }}
                >
                  {RARITY[r].label} · {rarityCounts[r]}
                </button>
              );
            })}
          </div>

          {/* Language chips — derived from the cards themselves (languagesIn),
              so a fifth catalogue language needs no change here. */}
          {languages.length > 0 && (
            <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
              <button
                onClick={() => setLanguageFilter('all')}
                style={{
                  font: '700 8px/1 var(--font-tele)', letterSpacing: '.14em',
                  padding: '6px 9px', borderRadius: 6,
                  background: languageFilter === 'all' ? 'var(--neon-violet)' : 'var(--hairline)',
                  border: `1px solid ${languageFilter === 'all' ? 'var(--neon-violet)' : 'var(--hairline)'}`,
                  color: languageFilter === 'all' ? 'var(--ink-on-neon)' : 'var(--ink-40)',
                }}
              >
                ALL LANGUAGES
              </button>
              {languages.map((l) => {
                const on = languageFilter === l;
                return (
                  <button
                    key={l}
                    onClick={() => setLanguageFilter(l)}
                    style={{
                      font: '700 8px/1 var(--font-tele)', letterSpacing: '.14em',
                      padding: '6px 9px', borderRadius: 6,
                      background: on ? 'var(--neon-violet)' : 'var(--hairline)',
                      border: `1px solid ${on ? 'var(--neon-violet)' : 'var(--hairline)'}`,
                      color: on ? 'var(--ink-on-neon)' : 'var(--ink-40)',
                    }}
                  >
                    {l.toUpperCase()}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, justifyItems: 'center' }}>
            {binder.map((c) => {
              const isPlaying = playingId === c.id && playing;
              const canPlay = Boolean(c.previewUrl);
              return (
                <div
                  key={c.id}
                  // The "TAP TO PLAY"/"TAP TO STOP" label used to sit outside
                  // the card's own onClick, as a plain sibling span — it read
                  // as part of the tap target but silently ate clicks. The
                  // handler now lives on this shared wrapper so the whole
                  // card-plus-label group is one tap target; role/tabIndex/
                  // onKeyDown are restated here since SongCardView no longer
                  // gets onClick directly (that would double-fire on a card
                  // click, since the click still bubbles up to this div).
                  onClick={canPlay ? () => handleCardTap(c) : undefined}
                  role={canPlay ? 'button' : undefined}
                  tabIndex={canPlay ? 0 : undefined}
                  onKeyDown={
                    canPlay
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCardTap(c);
                          }
                        }
                      : undefined
                  }
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: canPlay ? 'pointer' : 'default' }}
                >
                  <div style={{ position: 'relative' }}>
                    <SongCardView
                      card={c}
                      size="sm"
                      style={!canPlay ? { opacity: 0.55 } : undefined}
                    />
                    {isPlaying && (
                      <span
                        style={{
                          position: 'absolute', top: 6, left: 6,
                          font: '700 7px/1 var(--font-tele)', letterSpacing: '.1em',
                          padding: '3px 5px', borderRadius: 3,
                          background: 'var(--neon-mint)', color: 'var(--ink-on-neon)',
                        }}
                      >
                        ▶ PLAYING
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      font: '400 7px/1 var(--font-tele)', letterSpacing: '.1em',
                      color: canPlay ? 'var(--ink-40)' : 'var(--ink-25)',
                    }}
                  >
                    {canPlay ? (isPlaying ? 'TAP TO STOP' : 'TAP TO PLAY') : 'NO PREVIEW'}
                  </span>
                </div>
              );
            })}
          </div>

          {binder.length === 0 && (
            <div
              style={{
                textAlign: 'center', padding: '32px 0',
                font: '400 10px/1.6 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-25)',
              }}
            >
              NO CARDS MATCH THESE FILTERS
            </div>
          )}
        </div>

        {/*
          The light theme is gone, not hidden. It was never finished -- the
          accents were tuned for a dark ground and collapsed on a light one,
          and half-working is worse than absent. Dark is the only palette,
          which is also what the neon-on-glass material actually wants.
        */}
      </div>

      <AccountSettings
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        profile={profile}
        onProfileChanged={() => void refreshProfile()}
        /* Deleting signs you out server-side; sending the player home means
           they land on the signed-out screen rather than a profile that no
           longer exists. */
        onDeleted={() => { setAccountOpen(false); window.location.href = '/'; }}
      />
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
      <div style={{ font: '700 26px/1 var(--font-stat)', color: 'var(--profile-text)', marginTop: 5 }}>
        {value}
      </div>
    </div>
  );
}
