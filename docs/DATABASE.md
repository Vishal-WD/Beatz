# DATABASE.md — Supabase Schema & Security

**Project:** `auxwars` · ref `ezrsnhpgklqcrnajigpc` · region `ap-south-1`
· Postgres 17 · free tier ($0/mo)
**URL:** `https://ezrsnhpgklqcrnajigpc.supabase.co`

Closes `docs/IMPROVEMENTS.md` #13 — the persistence gap that was documented
in `CARD_SCHEMA.md` §5 but never written.

---

## Why a separate project from "Circl"

The same Supabase organisation hosts **Circl**, a live training-academy
platform: 33 tables, 3,223 audit rows, RLS on every table, and table comments
recording real security incidents.

AuxWars was given its own project because the two have **incompatible
security models**:

| | Circl | AuxWars |
|---|---|---|
| Boundary | tenant (`company_id`) | player (`auth.uid()`) |
| Enforcement | composite FKs binding rows to a tenant | per-row ownership |
| Catalogue | private per tenant | deliberately public |

Sharing one database would mean every future RLS policy had to be correct
under both models simultaneously — the exact shape of mistake that leaks one
tenant's data to another. Circl's own comments show it has already been
probed for a weaker version of this. There were also direct name collisions
(`questions`, `subjects`).

**Circl was never read from, written to, or modified.**

---

## Schema

### Cards — a shared, scarce, public pool

```
artists         mb_artist_id PK, name, release_count
cards           id PK, mb_recording_id UNIQUE, rarity, hype, stamina,
                supply_total, supply_remaining, artwork_url, youtube_video_id,
                audio_analyzable, license_variant, …
card_artists    (card_id, mb_artist_id, role) PK, position, join_phrase
```

Constraints that enforce the rules rather than merely describing them:

| Constraint | Enforces |
|---|---|
| `hype_stamina_band` | `hype + stamina ∈ [80,175]` — `CARD_SCHEMA.md` §7.6 |
| `supply_not_over` | `supply_remaining ≤ supply_total` |
| `jamendo_needs_license` | analyzable ⇒ Jamendo id **and** a recorded licence |
| `analyzable_is_jamendo` | local audio analysis only on `jamendo_local` |

The last two are `LICENSING_RIGHTS.md` §2.6 and DO NOT #1 made unbreakable:
a track cannot be marked analyzable without its licence, at the schema level.

### Players

```
profiles        id PK → auth.users, handle UNIQUE, drops, total_reigns_won,
                peak_vibe, challenger_wins/attempts
card_ownership  id PK, owner_id, card_id, serial_number, pending_trade
pinned_cards    (owner_id, position) PK
```

`pending_trade` implements the trade-vs-dust race fallback (`CLAUDE.md` §6).

### Core loop

```
rooms           id PK, slug UNIQUE, mode(casual|event), vibe, solo_practice
reigns          id PK, room_id, player_id, card_id, started_at, ended_at
challengers     (room_id, player_id) PK, position UNIQUE per room
```

`one_live_reign_per_room` — a partial unique index on `(room_id) WHERE
ended_at IS NULL`. Two players cannot hold one throne; that is the game.

### Social layer

```
events          id PK, slug UNIQUE, kind, host_id, room_id NOT NULL,
                starts_at, status, capacity, genre_tags[]
rsvps           (event_id, player_id) PK, state
follows         (follower_id, followee_id) PK, no_self_follow
activity        id PK, actor_id, kind, subject, created_at
event_counts    VIEW (security_invoker)
```

`events.room_id` is **NOT NULL** — that is the §1.2 guard rail in the schema:
an event that opened into nothing would be the parallel mechanic `CLAUDE.md`
§1 forbids.

---

## The atomic supply decrement

`CLAUDE.md` §3 calls this a hard requirement. It now exists:

```sql
create function claim_card_supply(p_card_id uuid)
returns table (card_id uuid, serial_number integer, supply_remaining integer)
language sql security definer as $$
  update cards set supply_remaining = supply_remaining - 1
   where id = p_card_id and supply_remaining > 0
  returning id, (supply_total - supply_remaining)::integer, supply_remaining;
$$;
```

**Verified under contention.** Ten sequential claimants against three
remaining copies: **3 succeeded, 7 refused, supply floored at 0, never
negative.** Zero rows returned is the documented downgrade+refund path
(`CLAUDE.md` §6), not an error to retry.

> A first test appeared to show an oversell. It did not: all ten calls in one
> SQL statement share a single snapshot and collapse to one write. Real API
> calls arrive as separate transactions, which the corrected test simulates.
> Worth recording — the naive test is misleading in the *dangerous* direction.

---

## Security

RLS is enabled on **every** table. Verified live against the public anon key:

| Operation | Result |
|---|---|
| `SELECT cards` | ✅ 200 — catalogue is public knowledge |
| `INSERT cards` | ✅ 401 refused — cannot mint yourself a legendary |
| `RPC claim_card_supply` | ✅ 401 refused |
| `SELECT profiles` | ✅ 200 — intended, public leaderboard |
| `INSERT rsvps` | ✅ 401 refused — must be signed in |

### The advisor caught a real hole

Supabase's security advisor flagged, at **ERROR** level, that
`claim_card_supply` was callable by `anon` over `/rest/v1/rpc/`. **Anyone,
without signing in, could have decremented every legendary's supply to zero.**
Scarcity is the entire economy, so this was the most damaging possible hole
in the schema.

Migration `005` revoked `EXECUTE` from `anon`, `authenticated` and `public`
on `claim_card_supply` and `handle_new_user`, restricted
`join_challenger_line` to signed-in players, and rebuilt `event_counts` with
`security_invoker = true` so it can no longer bypass RLS.

**Re-run `get_advisors` after every migration.** One WARN remains and is
intentional: `join_challenger_line` *should* be player-callable — it derives
identity from `auth.uid()` rather than trusting a parameter.

### Columns clients cannot write

- `profiles.drops` — Drops are **earn-only** (`CLAUDE.md` §3). The update
  policy pins it to its current value, so a compromised client still cannot
  mint currency.
- `profiles.total_reigns_won`, `peak_vibe`, `challenger_wins/attempts` —
  earned, server-owned.
- `rooms.vibe` — a client that could set it could hold the throne forever.
- `cards.*` — no client write policy exists at all.

---

## Connecting

`.env.local` (gitignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ezrsnhpgklqcrnajigpc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_mlfvAP-kLrWLbQYpR5T6Ow_fRfyPXFF
```

The publishable key is **safe in client code** — every table is protected by
RLS. The **service role key bypasses RLS**, must never carry a
`NEXT_PUBLIC_` prefix, and must never be committed.

`lib/supabase.ts` degrades to `null` when unconfigured; `lib/useCards.ts`
falls back to the seeded pool. The app works with no database at all.

---

## Current data

| Table | Rows |
|---|---|
| `cards` | 10 (3 legendary, 4 epic, 2 rare, 1 common) |
| `artists` | 15 |
| `card_artists` | 18 |
| `profiles` | 5 demo accounts |
| `card_ownership` | 25 (5 each, claimed atomically) |
| `pinned_cards` | 20 |
| `rooms` | 5 (3 Event, 2 Casual) |
| `events` | 5 (1 live, 4 scheduled) |
| `rsvps` | 16 |
| `follows` | 5 |

9 cards carry real Cover Art Archive artwork; all 10 are playable via
YouTube. Tamil, Hindi and English.

### Demo accounts

Password for all: `auxwars-demo`

| Email | Player | Tier | Drops |
|---|---|---|---|
| `rae@auxwars.demo` | Rae K. | AUX MARSHAL | 1,284 |
| `mayaj` → `maya@auxwars.demo` | Maya J. | AUX MARSHAL | 3,120 |
| `sasha@auxwars.demo` | Sasha V. | AUX MARSHAL | 5,410 |
| `dom@auxwars.demo` | Dom R. | CHALLENGER | 880 |
| `eli@auxwars.demo` | Eli T. | ROOKIE | 210 |

### Two bugs found while seeding these

**1. Wrong initials.** The signup trigger derived them with
`substr(name,1,2)`, turning "Maya J." into `MA` rather than `MJ`. Initials
are the avatar on every screen, so this was visible everywhere. Migration
007 rewrote it to take the first letter of each word.

**2. Sign-in returned HTTP 500.** Creating users with raw SQL against
`auth.users` *looks* like it works — rows exist, the trigger fires, profiles
appear — and fails only when someone actually signs in. Two causes:

- **No `auth.identities` row.** GoTrue resolves an email login through
  `identities`, not `users.email`.
- **NULL token columns.** `confirmation_token`, `recovery_token` and the
  change tokens are nullable in Postgres but GoTrue scans them into
  non-nullable Go strings, so NULL errors before any credential is checked.

Migration 008 backfilled identities and coalesced the tokens to `''`. If you
add users by SQL again, do both — or use the signup endpoint.

## Verified end-to-end

Signed in as `rae@auxwars.demo` over the live API:

| Check | Result |
|---|---|
| Sign in | 200 ✓ |
| Read own profile | Rae K. · AUX MARSHAL · 1,284 drops |
| Read own cards | 5 owned, correct serials |
| RSVP while signed in | 201 accepted (anon was 401) |
| **Self-grant 999,999 Drops** | **403 — blocked, balance unchanged** |
| Edit own bio | 204 allowed |

The Drops result is the one that matters: **earn-only is enforced by RLS**,
not by hiding a button.

All flagged `needs_review: true`: tiers come from curated hints because all
three popularity APIs are unreachable from this network
(`LICENSING_RIGHTS.md` §0). Real popularity data overrides hints
automatically when the seeder next runs on a normal connection.

---

## Still to build

| Item | Note |
|---|---|
| Auth UI | Schema and trigger are ready; no sign-in screen yet |
| Pack-opening server flow | Must call `claim_card_supply` server-side |
| Migrate rooms off the in-memory store | Tables + Realtime ready; `server/rooms/store.ts` still authoritative |
| Trading | `pending_trade` exists; no offer table yet |
