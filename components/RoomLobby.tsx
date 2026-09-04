'use client';

/**
 * The ROOM tab when you are not in a room.
 *
 * Browsing and playing were the same screen before, and `useRoom` joined the
 * socket on mount — so opening the tab dropped you into a room with the deck
 * and hold-to-vibe already live. Those are two different jobs and this is
 * the first one: see what is running, walk into it, or open your own.
 *
 * Nothing about your deck, hand or vibe appears here. You have not joined.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, Field, EmptyState } from '@/components/ui';
import { FORMATS, type FormatId } from '@/lib/domain/formats';
import { micModesFor, usesMic, type MicMode } from '@/lib/domain/mic';
import { createRoom, fetchOpenRooms, fetchRoomCounts, type DbRoom } from '@/lib/supabase';

const MIC_LABEL: Record<MicMode, string> = {
  solo: 'SOLO MIC',
  vote_song: 'VOTE EACH SONG',
  setlist: 'PRIOR SETLIST',
};

type JoinResult = { error: string } | { roomId: string };

export function RoomLobby({
  onEnter,
  isSignedIn,
}: {
  onEnter: (slug: string, code?: string) => Promise<JoinResult>;
  isSignedIn: boolean;
}) {
  const [rooms, setRooms] = useState<DbRoom[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);

  // Which room is asking for a code, and what has been typed.
  const [codeFor, setCodeFor] = useState<DbRoom | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [format, setFormat] = useState<FormatId>('disco');
  const [cardRule, setCardRule] = useState<DbRoom['mode']>('casual');
  const [micMode, setMicMode] = useState<MicMode>('solo');

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([fetchOpenRooms(), fetchRoomCounts()]);
    setRooms(r);
    setCounts(c);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const attempt = useCallback(async (room: DbRoom, withCode?: string) => {
    setBusy(true);
    setError(null);
    const res = await onEnter(room.slug, withCode);
    setBusy(false);
    if ('error' in res) {
      // A guest-list room asks rather than refuses: the code is the door,
      // not a rejection.
      if (res.error === 'bad_code') {
        setCodeFor(room);
        setError(withCode ? 'That code does not match.' : null);
        return;
      }
      setError(
        res.error === 'room_closed' ? 'That room has closed.'
          : res.error === 'not_signed_in' ? 'Sign in to join a room.'
          : 'Could not join that room.',
      );
    }
  }, [onEnter]);

  const submitCreate = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await createRoom({
      name,
      format,
      // The door comes from the format table, so a Fest cannot be opened
      // guest-list or a Private Party opened to everyone.
      visibility: FORMATS[format].visibility,
      mode: cardRule,
      micMode: usesMic(format) ? micMode : null,
    });
    if ('error' in res) { setBusy(false); setError(res.error); return; }
    await onEnter(res.slug);
    setBusy(false);
    setCreating(false);
  }, [name, format, cardRule, micMode, onEnter]);

  /* Code prompt */
  if (codeFor) {
    return (
      <Panel>
        <Label>{codeFor.name.toUpperCase()}</Label>
        <Hint>This one is guest list. Ask the host for the code.</Hint>
        <Field
          label="ROOM CODE"
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          placeholder="ABC123"
          autoCapitalize="characters"
          maxLength={6}
        />
        {error && <Err>{error}</Err>}
        <Button onClick={() => void attempt(codeFor, code)} disabled={busy || code.length < 4}>
          {busy ? 'CHECKING…' : 'ENTER'}
        </Button>
        <TextButton onClick={() => { setCodeFor(null); setCode(''); setError(null); }}>
          BACK
        </TextButton>
      </Panel>
    );
  }

  /* Create */
  if (creating) {
    return (
      <Panel>
        <Label>OPEN A ROOM</Label>
        <Field label="ROOM NAME" value={name} onChange={setName} placeholder="Friday Night" />

        <Sub>FORMAT</Sub>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
          {Object.values(FORMATS).map((f) => (
            <button
              key={f.id}
              data-press
              onClick={() => setFormat(f.id)}
              style={{
                font: '600 11px/1.35 var(--font-body)', letterSpacing: '-0.01em',
                padding: '12px 11px', borderRadius: 'var(--radius-md)',
                background: format === f.id ? 'var(--ink)' : 'var(--surface-inset)',
                color: format === f.id ? 'var(--ink-on-neon)' : 'var(--ink-60)',
                border: format === f.id ? '1px solid transparent' : 'var(--border-hair)',
                textAlign: 'left',
              }}
            >
              {f.label.toUpperCase()}
              <span style={{ display: 'block', opacity: 0.7, marginTop: 3 }}>
                {f.control.toUpperCase()} · {f.visibility === 'open' ? 'OPEN' : 'GUEST LIST'}
              </span>
            </button>
          ))}
        </div>

        {usesMic(format) && (
          <>
            <Sub>HOW THE MIC MOVES</Sub>
            <div style={{ display: 'flex', gap: 7 }}>
              {micModesFor(format).map((m) => (
                <Pill key={m} on={micMode === m} onClick={() => setMicMode(m)}>{MIC_LABEL[m]}</Pill>
              ))}
            </div>
          </>
        )}

        {/*
          A separate question from the format's door on purpose: visibility
          and card rule are independent axes (CLAUDE.md §1.1). A public night
          can be owned-cards-only; a private one can allow Guest Cards.
        */}
        <Sub>WHAT MAY BE PLAYED</Sub>
        <div style={{ display: 'flex', gap: 7 }}>
          <Pill on={cardRule === 'casual'} onClick={() => setCardRule('casual')}>GUEST CARDS OK</Pill>
          <Pill on={cardRule === 'event'} onClick={() => setCardRule('event')}>OWNED CARDS ONLY</Pill>
        </div>

        {error && <Err>{error}</Err>}
        <Button onClick={submitCreate} disabled={busy || !isSignedIn || !name.trim()}>
          {busy ? 'OPENING…' : 'OPEN THE ROOM'}
        </Button>
        <TextButton onClick={() => { setCreating(false); setError(null); }}>BACK</TextButton>
      </Panel>
    );
  }

  /* Browse */
  const live = (rooms ?? []).filter((r) => (counts[r.id] ?? 0) > 0);
  const quiet = (rooms ?? []).filter((r) => (counts[r.id] ?? 0) === 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 16px 24px' }}>
      <div>
        <div style={{ font: '400 26px/1 var(--font-title)', textTransform: 'uppercase' }}>Rooms</div>
        <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--neon-cyan)', marginTop: 6 }}>
          {rooms === null ? 'LOADING' : `${live.length} LIVE · ${quiet.length} OPEN`}
        </div>
      </div>

      {error && <Err>{error}</Err>}

      {rooms !== null && rooms.length === 0 && (
        <EmptyState title="NO ROOMS OPEN" hint="Open one and it shows up here." />
      )}

      {live.length > 0 && <Sub>LIVE NOW</Sub>}
      {live.map((r, i) => (
        <RoomRow key={r.id} room={r} count={counts[r.id] ?? 0} i={i} onTap={() => void attempt(r)} />
      ))}

      {quiet.length > 0 && <Sub>OPEN</Sub>}
      {quiet.map((r, i) => (
        <RoomRow key={r.id} room={r} count={0} i={i} onTap={() => void attempt(r)} />
      ))}

      <Button onClick={() => setCreating(true)} disabled={!isSignedIn}>
        {isSignedIn ? '+ OPEN A ROOM' : 'SIGN IN TO OPEN A ROOM'}
      </Button>
    </div>
  );
}

function RoomRow({
  room, count, i, onTap,
}: { room: DbRoom; count: number; i: number; onTap: () => void }) {
  const guestList = room.visibility === 'guest_list';
  return (
    <button
      data-press
      data-rise
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, padding: 14, borderRadius: 'var(--radius-lg)',
        background: 'var(--glass-regular)',
        backdropFilter: 'var(--glass-blur-thin)',
        WebkitBackdropFilter: 'var(--glass-blur-thin)',
        border: 'var(--border-hair)',
        boxShadow: 'var(--glass-edge)',
        textAlign: 'left',
        animationDelay: `${Math.min(i, 8) * 40}ms`,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', font: '600 15px/1.2 var(--font-body)',
          color: 'var(--ink)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {room.name}
        </span>
        <span style={{
          display: 'block', font: '400 8px/1 var(--font-tele)',
          letterSpacing: '.12em', color: 'var(--ink-40)', marginTop: 5,
        }}>
          {FORMATS[room.format].label.toUpperCase()}
          {guestList && ' · GUEST LIST'}
          {room.mode === 'event' && ' · OWNED CARDS ONLY'}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {count > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3, background: 'var(--neon-mint)',
              animation: 'queue 1.6s ease-in-out infinite',
            }} />
            <span style={{ font: '700 11px/1 var(--font-stat)', color: 'var(--neon-mint)' }}>{count}</span>
          </span>
        )}
        <span style={{ font: '700 8px/1 var(--font-tele)', letterSpacing: '.14em', color: 'var(--ink-60)' }}>
          {guestList ? 'CODE' : 'JOIN'}
        </span>
      </span>
    </button>
  );
}

/* small shared bits */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 16px 24px' }}>
      {children}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ font: '400 26px/1 var(--font-title)', textTransform: 'uppercase' }}>{children}</div>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)', marginTop: 4 }}>
      {children}
    </div>
  );
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ font: '400 12px/1.5 var(--font-body)', color: 'var(--ink-60)' }}>{children}</div>;
}
function Err({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" style={{ font: '500 11px/1.4 var(--font-body)', color: 'var(--neon-pink)' }}>
      {children}
    </div>
  );
}
function TextButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      data-press
      onClick={onClick}
      style={{
        font: '600 11px/1 var(--font-body)', color: 'var(--ink-60)',
        background: 'none', border: 'none', padding: '10px 0',
      }}
    >
      {children}
    </button>
  );
}
function Pill({
  children, on, onClick,
}: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button
      data-press
      onClick={onClick}
      style={{
        flex: 1, font: '600 11px/1 var(--font-body)', letterSpacing: '-0.01em',
        padding: '11px 6px', borderRadius: 'var(--radius-pill)',
        background: on ? 'var(--ink)' : 'var(--surface-inset)',
        color: on ? 'var(--ink-on-neon)' : 'var(--ink-60)',
        border: on ? '1px solid transparent' : 'var(--border-hair)',
      }}
    >
      {children}
    </button>
  );
}
