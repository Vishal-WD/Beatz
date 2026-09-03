/**
 * Socket.io realtime server — deployed to Render (CLAUDE.md §7.1).
 *
 * Why a separate host from Vercel: Vercel's serverless functions cannot hold
 * persistent WebSocket connections. The Next.js UI ships to Vercel; this
 * long-running process owns the live room state.
 *
 * Authoritative for: vibe, reigns, the Challenger Line. Clients simulate
 * locally only for Solo Practice and during the reconnect grace window.
 */

import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  RoomState,
  Challenger,
} from '../types/game';
import {
  VIBE_TICK_MS,
  VIBE_MIN,
  VIBE_MAX,
  DETHRONE_THRESHOLD,
  RECONNECT_GRACE_MS,
} from '../types/game';
import { startingVibeFor } from '../lib/stats';
import { tickReign, type ReignState } from '../lib/domain/reign';
import { controlModelFor } from '../lib/domain/formats';
import { RoomStore } from './rooms/store';

const PORT = Number(process.env.PORT) || 3001;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const httpServer = createServer((req, res) => {
  // Render health check.
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: store.size() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    // Capacitor serves from https://localhost, so an empty allowlist in dev
    // must not silently block the APK. Configure ALLOWED_ORIGINS in prod.
    origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : true,
    methods: ['GET', 'POST'],
  },
});

const store = new RoomStore();

io.on('connection', (socket) => {
  let joinedRoom: string | null = null;
  let playerId: string | null = null;

  socket.on('room:join', ({ roomId, playerId: pid, displayName }) => {
    joinedRoom = roomId;
    playerId = pid;
    socket.join(roomId);

    const room = store.ensure(roomId);
    store.addPlayer(roomId, { id: pid, displayName });

    // A player rejoining within the grace window resumes their reign rather
    // than losing it (CLAUDE.md §6) — a dropped phone must not cost the throne.
    store.cancelGrace(roomId, pid);

    io.to(roomId).emit('room:state', room);
  });

  socket.on('challenger:join', ({ roomId }) => {
    if (!playerId) return;
    // Atomic increment, never an array push — simultaneous joins must not
    // collide on the same position (CLAUDE.md §6).
    const challenger: Challenger | null = store.joinChallengerLine(roomId, playerId);
    if (challenger) {
      io.to(roomId).emit('challenger:joined', challenger);
      io.to(roomId).emit('room:state', store.ensure(roomId));
    }
  });

  socket.on('card:play', ({ roomId, cardId }) => {
    if (!playerId) return;
    const result = store.playCard(roomId, playerId, cardId);

    if ('error' in result) {
      socket.emit('error:msg', result.error);
      return;
    }

    io.to(roomId).emit('reign:started', result.reign);
    io.to(roomId).emit('room:state', store.ensure(roomId));
  });

  socket.on('vibe:hold', ({ roomId, holding }) => {
    if (!playerId) return;
    store.setHolding(roomId, playerId, holding);
  });

  socket.on('room:leave', ({ roomId }) => {
    if (playerId) store.removePlayer(roomId, playerId);
    socket.leave(roomId);
    io.to(roomId).emit('room:state', store.ensure(roomId));
  });

  socket.on('disconnect', () => {
    if (!joinedRoom || !playerId) return;
    // Do not end the reign immediately: hold the last known vibe for the grace
    // window, then resume decay if they have not returned.
    store.startGrace(joinedRoom, playerId, RECONNECT_GRACE_MS, () => {
      const room = store.ensure(joinedRoom!);
      if (room.reign?.playerId === playerId) {
        store.endReign(joinedRoom!, 'left');
        io.to(joinedRoom!).emit('reign:ended', { playerId: playerId!, reason: 'left' });
      }
      store.removePlayer(joinedRoom!, playerId!);
      io.to(joinedRoom!).emit('room:state', room);
    });
  });
});

/** Global tick — one interval drives every room. */
setInterval(() => {
  for (const room of store.all()) {
    if (!room.reign) continue;
    if (store.isInGrace(room.roomId, room.reign.playerId)) continue;

    const holders = store.holdingCount(room.roomId);
    // Zero-mean drift in Solo Practice: a positive mean would outpace decay on
    // high-stamina cards and the throne would never change hands (CLAUDE.md §1).
    // In a live room, crowd holds are the only upward force.
    const crowd = room.soloPractice
      ? Math.random() * 3.2 - 1.6
      : holders * 1.35;

    /*
      Decay, clamping and the end-of-reign decision all come from
      lib/domain/reign.ts — the same tested module the client uses.

      This loop used to do its own arithmetic AND dethrone unconditionally,
      which meant a Concert or Clubbing set ended the moment vibe collapsed.
      CLAUDE.md §1.2 is explicit that in a spectator format vibe SCORES the
      set and cannot end it; low vibe is a weak set the room can see, not a
      forfeit. tickReign gates that on the control model, so the rule now
      lives in one place instead of being restated (differently) here.
    */
    const before: ReignState = {
      vibe: room.vibe,
      startedAt: room.reign.startedAt,
      peakVibe: room.reign.peakVibe,
      peakMoments: room.reign.peakMomentsTriggered,
      endedReason: null,
    };

    const after = tickReign(before, {
      control: controlModelFor(room.format),
      stamina: room.reign.decayRate,
      crowdPull: crowd,
      deltaMs: VIBE_TICK_MS,
      now: Date.now(),
    });

    room.vibe = after.vibe;
    room.reign.peakVibe = after.peakVibe;
    room.reign.peakMomentsTriggered = after.peakMoments;
    room.updatedAt = Date.now();

    io.to(room.roomId).emit('vibe:update', { vibe: Math.round(after.vibe), at: room.updatedAt });

    if (after.endedReason) {
      const dethroned = room.reign.playerId;
      store.endReign(room.roomId, 'dethroned');
      io.to(room.roomId).emit('reign:ended', { playerId: dethroned, reason: 'dethroned' });
      io.to(room.roomId).emit('room:state', room);
    }
  }
}, VIBE_TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`[beatz] realtime server on :${PORT}`);
});
