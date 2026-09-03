import { io } from 'socket.io-client';
const URL = 'http://localhost:3901';
const ROOM = 'probe-room';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const mk = (name) => new Promise((res, rej) => {
  const s = io(URL, { transports:['websocket'], reconnection:false });
  s.on('connect', () => res(s));
  s.on('connect_error', rej);
  setTimeout(() => rej(new Error(name+' connect timeout')), 8000);
});

console.log('=== TWO CLIENTS, ONE ROOM ===\n');
const a = await mk('A'), b = await mk('B');
console.log('both connected:', a.connected && b.connected);

let aSawState = null, bSawState = null, bSawReign = null, aVibes = 0;
a.on('room:state', s => { aSawState = s; });
b.on('room:state', s => { bSawState = s; });
b.on('reign:started', r => { bSawReign = r; });
a.on('vibe:update', () => { aVibes++; });

a.emit('room:join', { roomId: ROOM, playerId: 'p-a', displayName: 'Player A' });
await wait(600);
b.emit('room:join', { roomId: ROOM, playerId: 'p-b', displayName: 'Player B' });
await wait(1200);

console.log('A sees players    :', aSawState?.players?.length ?? 0);
console.log('B sees players    :', bSawState?.players?.length ?? 0);
console.log('B sees A by name  :', bSawState?.players?.some(p => p.displayName === 'Player A') ?? false);
console.log('solo practice off :', bSawState?.soloPractice === false);

console.log('\n--- A plays a card; B must see it ---');
// Real id from the server's own pool — 'c1' does not exist and the
// server correctly refused it.
a.on('error:msg', (m) => console.log('  server refused:', JSON.stringify(m).slice(0,80)));
a.emit('card:play', { roomId: ROOM, cardId: 'gen-000' });
await wait(1500);
console.log('B saw reign:started:', Boolean(bSawReign));
console.log('reign holder       :', bSawReign?.playerId ?? '(none)');

console.log('\n--- vibe ticks reach A ---');
await wait(2000);
console.log('vibe updates on A  :', aVibes, aVibes > 0 ? '(live)' : '(NONE — tick not reaching clients)');

console.log('\n--- B joins the challenger line ---');
b.emit('challenger:join', { roomId: ROOM });
await wait(1000);
console.log('challengers        :', bSawState?.challengers?.length ?? 0);

a.close(); b.close();
process.exit(0);
