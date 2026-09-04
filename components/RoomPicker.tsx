'use client';

/**
 * Open a room, or walk into one that is already running.
 *
 * Neither was possible before: the deck screen was pinned to a single
 * hardcoded slug, so every player in the world shared one room and "create a
 * room" was not a feature you could reach. The database already allowed it
 * (the `rooms_create` RLS policy); only this was missing.
 *
 * The format decides the rest. Visibility is defaulted from the format table
 * (CLAUDE.md §1.1) rather than re-decided here, and the mic mode is offered
 * only for the formats that use one — a Disco with a `mic_mode` would be
 * claiming a mechanic it never runs.
 *
 * Visibility and card rule stay INDEPENDENT axes (§1.1): a public night can
 * be owned-cards-only, a private one can allow Guest Cards. They are two
 * questions on this form for exactly that reason.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, Field, Sheet, EmptyState } from '@/components/ui';
import { FORMATS, type FormatId } from '@/lib/domain/formats';
import { micModesFor, usesMic, type MicMode } from '@/lib/domain/mic';
import { createRoom, fetchOpenRooms, type DbRoom } from '@/lib/supabase';

const MIC_LABEL: Record<MicMode, string> = {
  solo: 'SOLO MIC',
  vote_song: 'VOTE EACH SONG',
  setlist: 'PRIOR SETLIST',
};

export function RoomPicker({
  open,
  onClose,
  currentSlug,
  onEnter,
  isSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  currentSlug: string;
  onEnter: (slug: string) => void;
  isSignedIn: boolean;
}) {
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [rooms, setRooms] = useState<DbRoom[] | null>(null);

  const [name, setName] = useState('');
  const [format, setFormat] = useState<FormatId>('disco');
  const [cardRule, setCardRule] = useState<DbRoom['mode']>('casual');
  const [micMode, setMicMode] = useState<MicMode>('solo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRooms(null);
    void fetchOpenRooms().then((r) => { if (!cancelled) setRooms(r); });
    return () => { cancelled = true; };
  }, [open, tab]);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await createRoom({
      name,
      format,
      // The door comes from the format table, so a Fest cannot be created
      // guest-list or a Private Party open.
      visibility: FORMATS[format].visibility,
      mode: cardRule,
      micMode: usesMic(format) ? micMode : null,
    });
    setBusy(false);
    if ('error' in res) { setError(res.error); return; }
    onEnter(res.slug);
    onClose();
  }, [name, format, cardRule, micMode, onEnter, onClose]);

  return (
    <Sheet open={open} onClose={onClose} title="ROOMS">
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['join', 'create'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              font: '700 9px/1 var(--font-tele)', letterSpacing: '.16em',
              padding: '9px 0', borderRadius: 'var(--radius-sm)',
              background: tab === t ? 'var(--ink)' : 'var(--surface-inset)',
              color: tab === t ? 'var(--ink-on-neon)' : 'var(--ink-60)',
              border: 'var(--border-hair)',
            }}
          >
            {t === 'join' ? 'JOIN' : 'OPEN A ROOM'}
          </button>
        ))}
      </div>

      {tab === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rooms === null && (
            <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-25)' }}>
              LOADING…
            </div>
          )}
          {rooms?.length === 0 && (
            <EmptyState title="NO ROOMS OPEN" hint="Open one and it shows up here." />
          )}
          {rooms?.map((r) => {
            const here = r.slug === currentSlug;
            return (
              <button
                key={r.id}
                onClick={() => { if (!here) { onEnter(r.slug); onClose(); } }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, padding: 12, borderRadius: 'var(--radius-sm)',
                  background: 'var(--booth-panel)',
                  border: 'var(--border-hair)', textAlign: 'left',
                  opacity: here ? 0.55 : 1,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'block', font: '400 15px/1.05 var(--font-title)',
                    textTransform: 'uppercase', color: 'var(--ink)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.name}
                  </span>
                  <span style={{
                    display: 'block', font: '400 8px/1 var(--font-tele)',
                    letterSpacing: '.12em', color: 'var(--ink-40)', marginTop: 4,
                  }}>
                    {FORMATS[r.format].label.toUpperCase()} · {r.visibility === 'open' ? 'OPEN' : 'GUEST LIST'}
                    {r.mode === 'event' && ' · OWNED CARDS ONLY'}
                  </span>
                </span>
                <span style={{
                  font: '700 8px/1 var(--font-tele)', letterSpacing: '.14em',
                  color: here ? 'var(--ink-40)' : 'var(--neon-mint)', flexShrink: 0,
                }}>
                  {here ? 'YOU ARE HERE' : 'ENTER'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {tab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isSignedIn && (
            <div style={{ font: '400 9px/1.5 var(--font-tele)', letterSpacing: '.1em', color: 'var(--neon-pink)' }}>
              SIGN IN TO OPEN A ROOM.
            </div>
          )}

          <Field label="ROOM NAME" value={name} onChange={setName} placeholder="Friday Night" />

          <div>
            <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-40)', marginBottom: 7 }}>
              FORMAT
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {Object.values(FORMATS).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  style={{
                    font: '700 8px/1.3 var(--font-tele)', letterSpacing: '.1em',
                    padding: '10px 8px', borderRadius: 'var(--radius-sm)',
                    background: format === f.id ? 'var(--ink)' : 'var(--surface-inset)',
                    color: format === f.id ? 'var(--ink-on-neon)' : 'var(--ink-60)',
                    border: 'var(--border-hair)', textAlign: 'left',
                  }}
                >
                  {f.label.toUpperCase()}
                  <span style={{ display: 'block', opacity: 0.7, marginTop: 3 }}>
                    {f.control.toUpperCase()} · {f.visibility === 'open' ? 'OPEN' : 'GUEST LIST'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Only the mic formats get this. */}
          {usesMic(format) && (
            <div>
              <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-40)', marginBottom: 7 }}>
                HOW THE MIC MOVES
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                {micModesFor(format).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMicMode(m)}
                    style={{
                      flex: 1, font: '700 8px/1 var(--font-tele)', letterSpacing: '.1em',
                      padding: '9px 6px', borderRadius: 'var(--radius-sm)',
                      background: micMode === m ? 'var(--ink)' : 'var(--surface-inset)',
                      color: micMode === m ? 'var(--ink-on-neon)' : 'var(--ink-60)',
                      border: 'var(--border-hair)',
                    }}
                  >
                    {MIC_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            {/*
              Deliberately a separate question from the format's door: a
              public night can be owned-cards-only and a private one can
              allow Guest Cards (CLAUDE.md §1.1, §4).
            */}
            <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-40)', marginBottom: 7 }}>
              WHAT MAY BE PLAYED
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              {([['casual', 'GUEST CARDS OK'], ['event', 'OWNED CARDS ONLY']] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setCardRule(v)}
                  style={{
                    flex: 1, font: '700 8px/1 var(--font-tele)', letterSpacing: '.1em',
                    padding: '9px 6px', borderRadius: 'var(--radius-sm)',
                    background: cardRule === v ? 'var(--ink)' : 'var(--surface-inset)',
                    color: cardRule === v ? 'var(--ink-on-neon)' : 'var(--ink-60)',
                    border: 'var(--border-hair)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ font: '500 9px/1.4 var(--font-tele)', letterSpacing: '.08em', color: 'var(--neon-pink)' }}>
              {error.toUpperCase()}
            </div>
          )}

          <Button onClick={submit} disabled={busy || !isSignedIn || !name.trim()}>
            {busy ? 'OPENING…' : 'OPEN THE ROOM'}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
