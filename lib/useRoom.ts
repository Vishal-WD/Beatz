'use client';

/**
 * Realtime room connection.
 *
 * The hosted Socket.io server (server/index.ts, deployed to Render) is
 * authoritative when reachable. When it is not — no backend configured, venue
 * wifi down, free-tier instance cold-starting — we fall back to local
 * simulation and SAY SO. Silently simulating a multiplayer game is worse than
 * showing the user they are alone (CLAUDE.md §6: Solo Practice is always
 * clearly labelled).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  RoomState,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/types/game';
import { RECONNECT_GRACE_MS } from '@/types/game';
import type { Challenger } from '@/lib/domain/challengers';
import { supabase } from '@/lib/supabase';

export type ConnectionMode = 'connecting' | 'live' | 'solo' | 'reconnecting';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Options {
  roomId: string;
  playerId: string;
  displayName: string;
  /** Skip the network entirely — used by screens that only need the sim. */
  disabled?: boolean;
}

export function useRoom({ roomId, playerId, displayName, disabled = false }: Options) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [mode, setMode] = useState<ConnectionMode>(disabled || !API_URL ? 'solo' : 'connecting');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [serverVibe, setServerVibe] = useState<number | null>(null);
  const [line, setLine] = useState<Challenger[]>([]);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /*
    The Challenger Line — who is actually queued to take the throne. This
    used to be entirely absent from useRoom's return, so no screen could
    ever know a real position and printed a fixed "Challenger #2" for
    every visitor instead (CLAUDE.md §6 forbids inventing plausible state).
  */
  const loadLine = useCallback(async () => {
    const db = supabase();
    if (!db || !roomId) return;
    const { data } = await db
      .from('challengers')
      .select('player_id, position')
      .eq('room_id', roomId)
      .order('position');
    setLine((data ?? []).map((r) => ({ playerId: r.player_id, position: r.position })));
  }, [roomId]);

  useEffect(() => {
    void loadLine();
  }, [loadLine]);

  useEffect(() => {
    if (disabled || !API_URL) {
      setMode('solo');
      return;
    }

    let cancelled = false;

    // Dynamic import keeps socket.io-client out of the bundle for screens
    // that never connect — it is ~40KB.
    import('socket.io-client')
      .then(({ io }) => {
        if (cancelled) return;

        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
          transports: ['websocket'],
          reconnectionAttempts: 5,
          reconnectionDelay: 900,
          timeout: 8000,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          if (cancelled) return;
          clearTimeout(graceTimer.current);
          setMode('live');
          socket.emit('room:join', { roomId, playerId, displayName });
        });

        socket.on('room:state', (s) => {
          if (cancelled) return;
          setRoom(s);
          // The room row changed — the challenger line may have too.
          void loadLine();
        });
        socket.on('vibe:update', ({ vibe }) => !cancelled && setServerVibe(vibe));

        socket.on('challenger:joined', () => {
          if (cancelled) return;
          void loadLine();
        });

        socket.on('disconnect', () => {
          if (cancelled) return;
          setMode('reconnecting');
          // Hold the last known state through the grace window rather than
          // dropping to zero (CLAUDE.md §6). Only fall back to solo if the
          // server does not come back.
          clearTimeout(graceTimer.current);
          graceTimer.current = setTimeout(() => {
            if (!cancelled) setMode('solo');
          }, RECONNECT_GRACE_MS);
        });

        socket.on('connect_error', () => {
          if (!cancelled) setMode('solo');
        });
      })
      .catch(() => {
        if (!cancelled) setMode('solo');
      });

    return () => {
      cancelled = true;
      clearTimeout(graceTimer.current);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [roomId, playerId, displayName, disabled, loadLine]);

  const playCard = useCallback(
    (cardId: string) => socketRef.current?.emit('card:play', { roomId, cardId }),
    [roomId],
  );

  const setHolding = useCallback(
    (holding: boolean) => socketRef.current?.emit('vibe:hold', { roomId, holding }),
    [roomId],
  );

  const joinLine = useCallback(
    () => socketRef.current?.emit('challenger:join', { roomId }),
    [roomId],
  );

  return {
    mode,
    room,
    serverVibe,
    line,
    isLive: mode === 'live',
    playCard,
    setHolding,
    joinLine,
  };
}

/** Human-readable connection label — always visible, never hidden from the user. */
export const MODE_LABEL: Record<ConnectionMode, { text: string; color: string }> = {
  connecting: { text: 'CONNECTING…', color: 'rgba(244,242,255,.4)' },
  live: { text: 'LIVE ROOM', color: '#7dffc3' },
  reconnecting: { text: 'RECONNECTING…', color: '#ffd84d' },
  solo: { text: 'SOLO PRACTICE', color: '#4ce3ff' },
};
