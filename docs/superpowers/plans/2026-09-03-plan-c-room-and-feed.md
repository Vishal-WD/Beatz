# Plan C — Room Shapes and Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the room look and behave like the format it is running — a performance in Concert, a queue in Disco — add mic voting for Concert and Fest, and give the FEED tab a real screen.

**Architecture:** The room screen stays one route (`/deck`) that branches on the room's control model, which `lib/domain/formats.ts` already derives from `dbRoom.format`. Mic state is new: a `mic_mode` column on rooms plus two small tables for who holds the mic and what is nominated, with vote counting as a pure domain module. The feed is a new route reading events and deriving each tile's artwork from the cards actually played in that event's room.

**Tech Stack:** TypeScript, Next.js 15 static export, Vitest, Supabase Postgres, Capacitor.

**Spec:** `docs/superpowers/specs/2026-09-03-app-redesign-design.md` (sections 2 and 4)

**Runs after:** Plan A (tokens, navbar, auth) and Plan B (economy, onboarding, collection). The FEED tab already exists in the tab bar and currently 404s — Task 6 is what makes it resolve.

## Global Constraints

- **Exactly three control models** — `contested`, `delegated`, `spectator`. Never a fourth (CLAUDE.md §1). Mic modes are a property of spectator rooms, not a new model.
- **Spectator vibe scores a set and can never end one** (§1.2). No depletion, no dethroning, no forfeit in Concert, Fest or Clubbing. `canDethrone` already encodes this; the screen must stop implying otherwise.
- **Only mic people vote.** A crowd vote would make a spectator room delegated, which is drift.
- **Visibility and card rule stay independent axes.** Never merge `open|guest_list` with `casual|event` (§1.1).
- **Shoutouts are display-only** — no Drops, no odds, no mechanical advantage (§1.2).
- **Screens contain no raw colour values.** `app/no-raw-colours.test.ts` enforces this under `app/`.
- **A token used by a screen must exist in both palettes** unless it is genuinely theme-invariant.
- `lib/domain/` imports neither React nor Supabase.
- No new dependencies.

---

### Task 1: Mic modes and vote counting (pure)

**Files:**
- Create: `lib/domain/mic.ts`
- Test: `lib/domain/mic.test.ts`

**Interfaces:**
- Consumes: `FormatId`, `controlModelFor` from `lib/domain/formats.ts`.
- Produces: `type MicMode = 'solo' | 'vote_song' | 'setlist'`; `interface MicPerson { playerId: string; displayName: string }`; `interface Nomination { id: string; playerId: string; cardId: string; votes: string[] }`; `usesMic(f: FormatId): boolean`; `micModesFor(f: FormatId): MicMode[]`; `winningNomination(noms: Nomination[]): Nomination | null`; `stepInPasses(votes: string[], micPeople: MicPerson[], holderId: string): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
  usesMic, micModesFor, winningNomination, stepInPasses,
  type Nomination, type MicPerson,
} from './mic';

const people = (...ids: string[]): MicPerson[] =>
  ids.map((id) => ({ playerId: id, displayName: id.toUpperCase() }));

const nom = (id: string, playerId: string, cardId: string, votes: string[]): Nomination =>
  ({ id, playerId, cardId, votes });

describe('mic modes', () => {
  // Spec §2.1: Concert and Fest pick a mode at creation. Clubbing has one
  // invited DJ and never votes. The contested and delegated formats have no
  // mic concept at all.
  it('uses a mic only in Concert and Fest', () => {
    expect(usesMic('concert')).toBe(true);
    expect(usesMic('fest')).toBe(true);
    expect(usesMic('clubbing')).toBe(false);
    expect(usesMic('night_party')).toBe(false);
    expect(usesMic('disco')).toBe(false);
    expect(usesMic('private_party')).toBe(false);
  });

  it('offers all three modes to the formats that use a mic', () => {
    expect(micModesFor('concert')).toEqual(['solo', 'vote_song', 'setlist']);
    expect(micModesFor('fest')).toEqual(['solo', 'vote_song', 'setlist']);
  });

  it('offers no modes to a format without a mic', () => {
    expect(micModesFor('clubbing')).toEqual([]);
    expect(micModesFor('disco')).toEqual([]);
  });
});

describe('winningNomination', () => {
  it('returns the nomination with the most votes', () => {
    const out = winningNomination([
      nom('n1', 'a', 'c1', ['a']),
      nom('n2', 'b', 'c2', ['b', 'c']),
    ]);
    expect(out?.id).toBe('n2');
  });

  it('returns null when nothing is nominated', () => {
    expect(winningNomination([])).toBeNull();
  });

  it('returns null when every nomination has zero votes', () => {
    expect(winningNomination([nom('n1', 'a', 'c1', []), nom('n2', 'b', 'c2', [])]))
      .toBeNull();
  });

  // A tie must be broken deterministically, or two clients reading the same
  // rows would disagree about what plays next.
  it('breaks a tie on nomination id, so every client agrees', () => {
    const a = winningNomination([
      nom('n2', 'b', 'c2', ['x']),
      nom('n1', 'a', 'c1', ['y']),
    ]);
    const b = winningNomination([
      nom('n1', 'a', 'c1', ['y']),
      nom('n2', 'b', 'c2', ['x']),
    ]);
    expect(a?.id).toBe('n1');
    expect(b?.id).toBe('n1');
  });

  it('counts a duplicate vote from the same player only once', () => {
    const out = winningNomination([
      nom('n1', 'a', 'c1', ['x', 'x', 'x']),
      nom('n2', 'b', 'c2', ['y', 'z']),
    ]);
    expect(out?.id).toBe('n2');
  });
});

describe('stepInPasses', () => {
  const mics = people('holder', 'a', 'b', 'c');

  // "the other mic people vote" — the holder is not one of them, so the
  // majority is of the OTHERS, not of everyone.
  it('passes on a majority of the other mic people', () => {
    expect(stepInPasses(['a', 'b'], mics, 'holder')).toBe(true);
  });

  it('fails without a majority', () => {
    expect(stepInPasses(['a'], mics, 'holder')).toBe(false);
  });

  it('ignores a vote from the current holder', () => {
    // holder + a is 2 raw votes, but the holder cannot vote itself out, so
    // this is really 1 of 3 others.
    expect(stepInPasses(['holder', 'a'], mics, 'holder')).toBe(false);
  });

  it('ignores a vote from someone who is not a mic person', () => {
    expect(stepInPasses(['a', 'b', 'stranger'], mics, 'holder')).toBe(true);
    expect(stepInPasses(['a', 'stranger'], mics, 'holder')).toBe(false);
  });

  it('cannot pass when the holder is the only mic person', () => {
    expect(stepInPasses([], people('holder'), 'holder')).toBe(false);
    expect(stepInPasses(['holder'], people('holder'), 'holder')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/mic.test.ts`
Expected: FAIL — cannot resolve `./mic`.

- [ ] **Step 3: Write the module**

```ts
/**
 * Mic control for the spectator formats that share it.
 *
 * Concert and Fest have several mic people who decide among themselves;
 * Clubbing has one DJ invited at room creation and never votes. This is a
 * property OF the spectator model, not a fourth control model — CLAUDE.md
 * §1 allows exactly three and adding one needs a recorded decision.
 *
 * Only mic people vote. A crowd vote would make the room delegated, which
 * is the drift §1.2 exists to prevent.
 */

import type { FormatId } from './formats';

export type MicMode = 'solo' | 'vote_song' | 'setlist';

export interface MicPerson {
  playerId: string;
  displayName: string;
}

export interface Nomination {
  id: string;
  playerId: string;
  cardId: string;
  /** Player ids. Duplicates are ignored when counting. */
  votes: string[];
}

/** Only Concert and Fest have several mic people to arbitrate between. */
export const usesMic = (f: FormatId): boolean => f === 'concert' || f === 'fest';

const ALL_MODES: MicMode[] = ['solo', 'vote_song', 'setlist'];

export const micModesFor = (f: FormatId): MicMode[] =>
  usesMic(f) ? [...ALL_MODES] : [];

const uniqueVotes = (votes: string[]): number => new Set(votes).size;

/**
 * The nomination that plays next, or null when nothing has any support.
 *
 * Ties break on `id` so that two clients reading the same rows in different
 * orders still agree — otherwise the room would disagree with itself about
 * what is playing.
 */
export function winningNomination(noms: Nomination[]): Nomination | null {
  const withVotes = noms.filter((n) => uniqueVotes(n.votes) > 0);
  if (withVotes.length === 0) return null;

  return [...withVotes].sort((a, b) => {
    const d = uniqueVotes(b.votes) - uniqueVotes(a.votes);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  })[0];
}

/**
 * Whether a STEP IN request has enough support to pass the mic.
 *
 * The vote is of the OTHER mic people: the current holder cannot vote on
 * their own replacement, and someone who is not a mic person has no say at
 * all. With a lone mic person there is nobody to outvote them, so it can
 * never pass.
 */
export function stepInPasses(
  votes: string[],
  micPeople: MicPerson[],
  holderId: string,
): boolean {
  const others = micPeople.filter((p) => p.playerId !== holderId);
  if (others.length === 0) return false;

  const eligible = new Set(others.map((p) => p.playerId));
  const counted = new Set(votes.filter((v) => eligible.has(v)));
  return counted.size > others.length / 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/mic.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/mic.ts lib/domain/mic.test.ts
git commit -m "feat(domain): mic modes and vote counting for Concert and Fest

Concert and Fest have several mic people who decide among themselves,
so the rules for who holds the mic and what plays next need somewhere
testable to live. This is a property of the spectator model, not a
fourth control model -- CLAUDE.md 1 allows exactly three.

A step-in vote is of the OTHER mic people: the holder cannot vote on
their own replacement and the crowd has no say, because a crowd vote
would make a spectator room delegated. Ties break on id so two clients
reading the same rows in different orders still agree on what plays."
```

---

### Task 2: Mic state in the database

**Files:**
- Apply migration via MCP `apply_migration`, name `mic_state`
- Modify: `lib/supabase.ts` — `DbRoom` gains `mic_mode`

**Interfaces:**
- Consumes: the `MicMode` values from Task 1.
- Produces: `rooms.mic_mode text`; tables `mic_people`, `nominations`, `nomination_votes`, `step_in_votes`; SQL `pass_mic(p_room uuid) returns uuid`; `DbRoom.mic_mode: 'solo' | 'vote_song' | 'setlist' | null`.

- [ ] **Step 1: Apply the migration**

```sql
-- Concert and Fest pick ONE mode when the room is created; the other four
-- formats have no mic concept, so the column is nullable rather than
-- defaulted. NULL means "this room does not use a mic" — distinguishable
-- from a room that chose a mode, which a default would not be.
alter table rooms
  add column if not exists mic_mode text
    check (mic_mode is null or mic_mode in ('solo','vote_song','setlist'));

-- Who may perform. For Clubbing this is the one invited DJ; for Concert
-- and Fest it is everyone who can hold the mic.
create table if not exists mic_people (
  room_id   uuid not null references rooms(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  -- Exactly one row per room may be the holder. Enforced by the partial
  -- unique index below rather than by application code, so two clients
  -- cannot both believe they hold the mic.
  is_holder boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

create unique index if not exists mic_people_one_holder
  on mic_people (room_id) where is_holder;

-- A card offered for the room to vote on (vote_song mode) or contributed
-- before the room opened (setlist mode).
create table if not exists nominations (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  player_id  uuid not null references profiles(id) on delete cascade,
  card_id    uuid not null references cards(id),
  played_at  timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists nominations_room on nominations (room_id, played_at);

-- One vote per player per nomination, enforced by the primary key so a
-- double tap cannot inflate a count.
create table if not exists nomination_votes (
  nomination_id uuid not null references nominations(id) on delete cascade,
  player_id     uuid not null references profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (nomination_id, player_id)
);

-- A pending STEP IN request and its votes. One request per room at a time.
create table if not exists step_in_votes (
  room_id       uuid not null references rooms(id) on delete cascade,
  candidate_id  uuid not null references profiles(id) on delete cascade,
  voter_id      uuid not null references profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (room_id, candidate_id, voter_id)
);

alter table mic_people       enable row level security;
alter table nominations      enable row level security;
alter table nomination_votes enable row level security;
alter table step_in_votes    enable row level security;

-- A room's mic state is public to anyone who can see the room: the point
-- of a performance is that the audience knows who is performing.
create policy mic_people_read on mic_people for select using (true);
create policy nominations_read on nominations for select using (true);
create policy nomination_votes_read on nomination_votes for select using (true);
create policy step_in_votes_read on step_in_votes for select using (true);

-- Writes are the caller's own only: you nominate your own card, you cast
-- your own vote. Nobody votes on someone else's behalf.
create policy nominations_insert_own on nominations for insert
  with check (player_id = auth.uid());
create policy nomination_votes_insert_own on nomination_votes for insert
  with check (player_id = auth.uid());
create policy nomination_votes_delete_own on nomination_votes for delete
  using (player_id = auth.uid());
create policy step_in_insert_own on step_in_votes for insert
  with check (voter_id = auth.uid());
create policy step_in_delete_own on step_in_votes for delete
  using (voter_id = auth.uid());

/*
  Passing the mic, atomically.

  Two clients observing the same passing vote must not both promote a
  candidate, and the holder must change in one statement rather than a
  clear-then-set that could leave a room with no holder or two. The partial
  unique index above makes a double holder impossible; this function makes
  the transition itself atomic.

  Returns the new holder's id, or null when the vote does not carry.
*/
create or replace function public.pass_mic(p_room uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_holder    uuid;
  v_others    int;
  v_candidate uuid;
  v_votes     int;
begin
  select player_id into v_holder from mic_people
   where room_id = p_room and is_holder;

  if v_holder is null then
    return null;
  end if;

  select count(*) into v_others from mic_people
   where room_id = p_room and player_id <> v_holder;

  if v_others = 0 then
    return null;   -- nobody to pass to
  end if;

  -- The best-supported candidate, counting only votes from OTHER mic
  -- people: the holder cannot vote on their own replacement and the crowd
  -- has no say (CLAUDE.md §1.2 -- a crowd vote would make this delegated).
  select s.candidate_id, count(*) into v_candidate, v_votes
    from step_in_votes s
    join mic_people m
      on m.room_id = s.room_id and m.player_id = s.voter_id
   where s.room_id = p_room
     and s.voter_id <> v_holder
     and s.candidate_id <> v_holder
   group by s.candidate_id
   order by count(*) desc, s.candidate_id
   limit 1;

  if v_candidate is null or v_votes * 2 <= v_others then
    return null;   -- no majority of the others
  end if;

  update mic_people set is_holder = false
   where room_id = p_room and is_holder;
  update mic_people set is_holder = true
   where room_id = p_room and player_id = v_candidate;

  delete from step_in_votes where room_id = p_room;

  return v_candidate;
end;
$$;

revoke execute on function public.pass_mic(uuid) from anon;
grant  execute on function public.pass_mic(uuid) to authenticated;
```

- [ ] **Step 2: Verify the migration**

Run this and confirm every row reads `true`:

```sql
create temp table t(check_name text, passed boolean, detail text);
do $$
declare
  v_room uuid; v_h uuid; v_a uuid; v_b uuid; v_out uuid;
begin
  select id into v_h from profiles limit 1;
  select id into v_a from profiles offset 1 limit 1;
  select id into v_b from profiles offset 2 limit 1;
  if v_b is null then
    insert into t values ('need 3 profiles to test — skipped', false, ''); return;
  end if;

  insert into rooms (slug,name,format,visibility,mode,mic_mode)
    values ('t-mic','T Mic','concert','guest_list','event','solo')
    returning id into v_room;

  insert into mic_people (room_id,player_id,is_holder) values
    (v_room, v_h, true), (v_room, v_a, false), (v_room, v_b, false);

  -- One vote of two others is not a majority.
  insert into step_in_votes (room_id,candidate_id,voter_id) values (v_room, v_a, v_a);
  v_out := public.pass_mic(v_room);
  insert into t values ('1 of 2 others does not pass', v_out is null, coalesce(v_out::text,'null'));

  -- Two of two others is.
  insert into step_in_votes (room_id,candidate_id,voter_id) values (v_room, v_a, v_b);
  v_out := public.pass_mic(v_room);
  insert into t values ('2 of 2 others passes', v_out = v_a, coalesce(v_out::text,'null'));
  insert into t values ('exactly one holder after the pass',
    (select count(*) from mic_people where room_id=v_room and is_holder) = 1, '');
  insert into t values ('the new holder is the candidate',
    (select player_id from mic_people where room_id=v_room and is_holder) = v_a, '');
  insert into t values ('votes cleared after passing',
    (select count(*) from step_in_votes where room_id=v_room) = 0, '');

  -- The holder cannot vote themselves back in.
  insert into step_in_votes (room_id,candidate_id,voter_id) values (v_room, v_h, v_a);
  v_out := public.pass_mic(v_room);
  insert into t values ('1 of 2 others still does not pass', v_out is null, '');

  delete from step_in_votes where room_id=v_room;
  delete from mic_people where room_id=v_room;
  delete from rooms where id=v_room;
end $$;
select * from t;
```

Then confirm the one-holder index actually bites:

```sql
do $$
declare v_room uuid; v_a uuid; v_b uuid; v_err text := 'no error';
begin
  select id into v_a from profiles limit 1;
  select id into v_b from profiles offset 1 limit 1;
  insert into rooms (slug,name,format,visibility,mode)
    values ('t-two','T Two','concert','guest_list','event') returning id into v_room;
  insert into mic_people (room_id,player_id,is_holder) values (v_room,v_a,true);
  begin
    insert into mic_people (room_id,player_id,is_holder) values (v_room,v_b,true);
  exception when others then v_err := sqlerrm;
  end;
  raise notice 'two holders rejected: %', (v_err <> 'no error');
  delete from mic_people where room_id=v_room;
  delete from rooms where id=v_room;
end $$;
```

Expected: `two holders rejected: t`.

- [ ] **Step 3: Extend `DbRoom`**

In `lib/supabase.ts`, add to `interface DbRoom`:

```ts
  /**
   * Which mic mode a Concert or Fest runs. NULL for every other format —
   * they have no mic concept, and a default would make "no mic" and
   * "chose solo" indistinguishable (lib/domain/mic.ts).
   */
  mic_mode: 'solo' | 'vote_song' | 'setlist' | null;
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat(db): mic state for the spectator formats

Concert and Fest need to know who holds the mic and what has been
nominated. A partial unique index makes two simultaneous holders
impossible at the schema level rather than by convention, and pass_mic()
moves the mic in one statement so a room can never be left with none.

Only OTHER mic people count toward a step-in vote: the holder cannot
vote on their own replacement, and the crowd has no say -- a crowd vote
would make a spectator room delegated (CLAUDE.md 1.2).

Read policies are open because a performance's audience is meant to see
who is performing; writes are the caller's own row only."
```

---

### Task 3: Room queries for mic state

**Files:**
- Modify: `lib/supabase.ts`
- Create: `lib/useMic.ts`

**Interfaces:**
- Consumes: `MicPerson`, `Nomination`, `MicMode` from Task 1; `pass_mic` from Task 2.
- Produces: `fetchMicState(roomUuid: string): Promise<{ people: MicPerson[]; holderId: string | null; nominations: Nomination[] }>`; `nominateCard(roomUuid: string, cardId: string): Promise<boolean>`; `voteNomination(nominationId: string, on: boolean): Promise<boolean>`; `requestStepIn(roomUuid: string, candidateId: string): Promise<boolean>`; `passMic(roomUuid: string): Promise<string | null>`; `useMic(roomUuid: string | null)` returning `{ people, holderId, nominations, isHolder, isMicPerson, winner, nominate, vote, stepIn, refresh }`.

- [ ] **Step 1: Add the queries**

In `lib/supabase.ts`, following the existing "degrade to empty rather than throw" style used by `fetchChallengerLine`:

```ts
/**
 * Everything the room needs to render its mic state in one round trip.
 *
 * Takes the room's UUID, not its slug: the socket keys rooms by slug while
 * the database keys them by id, and passing the wrong one silently matches
 * no rows.
 */
export async function fetchMicState(roomUuid: string): Promise<{
  people: MicPerson[];
  holderId: string | null;
  nominations: Nomination[];
}> {
  const empty = { people: [], holderId: null, nominations: [] };
  const db = supabase();
  if (!db || !roomUuid) return empty;

  const [peopleRes, nomRes] = await Promise.all([
    db.from('mic_people')
      .select('player_id, is_holder, profiles(display_name)')
      .eq('room_id', roomUuid),
    db.from('nominations')
      .select('id, player_id, card_id, nomination_votes(player_id)')
      .eq('room_id', roomUuid)
      .is('played_at', null),
  ]);

  if (peopleRes.error || nomRes.error) {
    console.warn('[supabase] fetchMicState:',
      peopleRes.error?.message ?? nomRes.error?.message);
    return empty;
  }

  const people: MicPerson[] = (peopleRes.data ?? []).map((r) => {
    // postgrest types an embedded row as an array; a to-one relation
    // arrives as a single object at runtime. Accept either.
    const row = r as unknown as {
      player_id: string;
      is_holder: boolean;
      profiles: { display_name: string } | { display_name: string }[] | null;
    };
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { playerId: row.player_id, displayName: prof?.display_name ?? 'Performer' };
  });

  const holderRow = (peopleRes.data ?? []).find(
    (r) => (r as unknown as { is_holder: boolean }).is_holder,
  ) as unknown as { player_id: string } | undefined;

  const nominations: Nomination[] = (nomRes.data ?? []).map((r) => {
    const row = r as unknown as {
      id: string; player_id: string; card_id: string;
      nomination_votes: { player_id: string }[] | null;
    };
    return {
      id: row.id,
      playerId: row.player_id,
      cardId: row.card_id,
      votes: (row.nomination_votes ?? []).map((v) => v.player_id),
    };
  });

  return { people, holderId: holderRow?.player_id ?? null, nominations };
}

/** Offers one of your own cards for the room to vote on. */
export async function nominateCard(roomUuid: string, cardId: string): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return false;
  const { error } = await db.from('nominations')
    .insert({ room_id: roomUuid, player_id: auth.user.id, card_id: cardId });
  return !error;
}

/** Casts or withdraws your vote. The primary key makes a double vote a no-op. */
export async function voteNomination(nominationId: string, on: boolean): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return false;

  if (!on) {
    const { error } = await db.from('nomination_votes')
      .delete().match({ nomination_id: nominationId, player_id: auth.user.id });
    return !error;
  }
  const { error } = await db.from('nomination_votes')
    .upsert({ nomination_id: nominationId, player_id: auth.user.id });
  return !error;
}

/** Votes for a candidate to take the mic. */
export async function requestStepIn(roomUuid: string, candidateId: string): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return false;
  const { error } = await db.from('step_in_votes')
    .upsert({ room_id: roomUuid, candidate_id: candidateId, voter_id: auth.user.id });
  return !error;
}

/** Resolves a pending step-in. Returns the new holder, or null if it did not carry. */
export async function passMic(roomUuid: string): Promise<string | null> {
  const db = supabase();
  if (!db) return null;
  const { data, error } = await db.rpc('pass_mic', { p_room: roomUuid });
  if (error) {
    console.warn('[supabase] passMic:', error.message);
    return null;
  }
  return (data as string) ?? null;
}
```

Import `MicPerson` and `Nomination` as types from `./domain/mic` at the top of the file.

- [ ] **Step 2: Add the hook**

```ts
'use client';

/**
 * The room's mic state, for the spectator formats that have one.
 *
 * Returns empty state when `roomUuid` is null rather than guessing, so a
 * screen that has not yet resolved its room never renders a mic that does
 * not exist.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  fetchMicState, nominateCard, voteNomination, requestStepIn, passMic,
} from './supabase';
import { winningNomination, type MicPerson, type Nomination } from './domain/mic';
import { useAuth } from './useAuth';

export function useMic(roomUuid: string | null) {
  const { profile, isSignedIn } = useAuth();
  const [people, setPeople] = useState<MicPerson[]>([]);
  const [holderId, setHolderId] = useState<string | null>(null);
  const [nominations, setNominations] = useState<Nomination[]>([]);

  const refresh = useCallback(async () => {
    if (!roomUuid) {
      setPeople([]); setHolderId(null); setNominations([]);
      return;
    }
    const s = await fetchMicState(roomUuid);
    setPeople(s.people);
    setHolderId(s.holderId);
    setNominations(s.nominations);
  }, [roomUuid]);

  useEffect(() => { void refresh(); }, [refresh]);

  const nominate = useCallback(async (cardId: string) => {
    if (!roomUuid) return;
    await nominateCard(roomUuid, cardId);
    await refresh();
  }, [roomUuid, refresh]);

  const vote = useCallback(async (nominationId: string, on: boolean) => {
    await voteNomination(nominationId, on);
    await refresh();
  }, [refresh]);

  const stepIn = useCallback(async (candidateId: string) => {
    if (!roomUuid) return;
    await requestStepIn(roomUuid, candidateId);
    // The server decides whether the vote carries; passMic returns null
    // when it does not, which is a no-op rather than an error.
    await passMic(roomUuid);
    await refresh();
  }, [roomUuid, refresh]);

  return {
    people,
    holderId,
    nominations,
    isHolder: isSignedIn && holderId === profile.id,
    isMicPerson: isSignedIn && people.some((p) => p.playerId === profile.id),
    winner: winningNomination(nominations),
    nominate,
    vote,
    stepIn,
    refresh,
  };
}
```

- [ ] **Step 3: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors; every existing test passes.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts lib/useMic.ts
git commit -m "feat(mic): read and write mic state from the client

One round trip fetches who may perform, who holds the mic, and what has
been nominated, so the room does not render in three stages. Writes are
the caller's own row only and rely on the schema's primary keys to make
a double vote a no-op rather than checking first and racing.

stepIn calls pass_mic afterwards because the server decides whether the
vote carries; a vote that does not carry returns null, which is a no-op
rather than an error."
```

---

### Task 4: The room, shaped by its format

**Files:**
- Modify: `app/deck/page.tsx`
- Create: `components/PerformerDisc.tsx`

**Interfaces:**
- Consumes: `controlModelFor`, `FormatId` from `lib/domain/formats.ts`; `useMic` from Task 3; `usesMic`, `micModesFor` from Task 1.
- Produces: `<PerformerDisc name={string} artworkUrl={string | null} spinning={boolean} onFollow={() => void} following={boolean} />`.

- [ ] **Step 1: Build the performer disc**

A spectator room is a performance, so the top of the screen carries who is
performing rather than a throne. Create `components/PerformerDisc.tsx`: a
circular element showing the current card's artwork, rotating slowly while
audio plays and still when paused, with the performer's name beneath it and
a FOLLOW button beside the name.

Use CSS `animation` with a `rotate` keyframe rather than a JS loop. Respect
`prefers-reduced-motion` — a permanently spinning disc is a real problem for
some players, so stop the rotation under that media query and keep the
artwork static.

Colours from tokens only. Artwork may be null (a card with no art), so
render a plain token-coloured circle in that case rather than a broken
image.

- [ ] **Step 2: Branch the room on its control model**

`app/deck/page.tsx` already resolves `dbRoom` and calls
`controlModelFor(dbRoom?.format ?? DEFAULT_FORMAT)`. Use that to pick one of
three shapes:

**Spectator (Concert, Fest, Clubbing)**
- `PerformerDisc` at the top, naming the mic holder.
- **No dethroning and no collapse copy anywhere.** The vibe bar stays, but
  it is applause: label it so it reads as scoring the set, never as a timer.
  `canDethrone` already returns false here — the screen must stop implying
  otherwise, which is the specific defect this task removes.
- Clubbing shows the single invited DJ and no voting affordance at all.
- Concert and Fest additionally render the mic UI from Task 5.

**Delegated (Night Party)**
- The crowd's offered pool, with the DJ picking from it. Keep the existing
  behaviour; only the framing changes — the holder is a DJ, not a monarch.

**Contested (Disco, Private Party)**
- The current player and the visible queue, as today. Dethroning survives
  here only.

- [ ] **Step 3: Verify the spectator rule on screen**

Write `scripts/probe/room-shapes.mjs`, modelled on the existing probes in
that directory (Playwright against a dev server on `http://localhost:3100`).
For each of the six formats, set the room's format in the database, load
`/deck`, and assert:

- Spectator formats render the performer disc and show **no** dethrone or
  collapse wording.
- Contested formats render the queue and do show the challenger line.
- No format renders both.

Paste the probe's real output into your report.

- [ ] **Step 4: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && NODE_ENV=production CAPACITOR=1 npx next build`
Expected: 0 errors; all tests pass, including `app/no-raw-colours.test.ts`; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/deck/page.tsx components/PerformerDisc.tsx scripts/probe/room-shapes.mjs
git commit -m "feat(room): shape the room like the format it is running

The room said THRONE in every format, so a Concert read as a contested
duel when it is a performance. A spectator room now leads with the
performer and a follow button, and carries no dethrone or collapse
wording at all -- the vibe bar there is applause scoring the set, which
CLAUDE.md 1.2 says can never end one.

Dethroning survives only in Disco and Private Party, where taking turns
is the point."
```

---

### Task 5: Mic UI for Concert and Fest

**Files:**
- Modify: `app/deck/page.tsx`
- Create: `components/MicPanel.tsx`

**Interfaces:**
- Consumes: `useMic` (Task 3); `usesMic`, `micModesFor`, `MicMode` (Task 1); `useOwnedCards`.
- Produces: `<MicPanel mode={MicMode} mic={ReturnType<typeof useMic>} ownedCards={SongCard[]} />`.

- [ ] **Step 1: Build the panel**

`components/MicPanel.tsx` renders one of three shapes, chosen by the room's
`mic_mode`:

**SOLO MIC** — names the holder and offers STEP IN to the other mic people.
A pending request shows its vote count against the threshold, so a voter can
see how close it is. The handover happens **after the current song ends**,
never mid-track — say so on screen, because a request that appears to do
nothing for two minutes otherwise reads as broken.

**VOTE EACH SONG** — mic people nominate a card from their own collection
and vote. Show each nomination with its card, who offered it, and its vote
count, with the current winner marked. Tapping a nomination toggles your
vote.

**PRIOR SETLIST** — the agreed list in order, with what has already played
marked. Contributions happen before the room opens, so during a set this is
read-only.

In every mode, **only mic people get controls.** The crowd sees the state
and no affordances — `mic.isMicPerson` gates every button. A crowd vote
would make the room delegated, which is exactly the drift to avoid.

Colours from tokens only.

- [ ] **Step 2: Wire it into the room**

In `app/deck/page.tsx`, render `MicPanel` only when
`usesMic(dbRoom?.format ?? DEFAULT_FORMAT)` and `dbRoom?.mic_mode` is set.
Clubbing must not render it — it has one invited DJ and no vote.

- [ ] **Step 3: Verify only mic people get controls**

Extend `scripts/probe/room-shapes.mjs`, or add
`scripts/probe/mic.mjs` beside it: with a Concert room in `vote_song` mode,
assert that a signed-in player who is NOT in `mic_people` sees the
nominations but no vote buttons, and that one who IS sees both. Paste the
real output into your report.

- [ ] **Step 4: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && NODE_ENV=production CAPACITOR=1 npx next build`
Expected: 0 errors; all tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/deck/page.tsx components/MicPanel.tsx scripts/probe/mic.mjs
git commit -m "feat(mic): let Concert and Fest decide among themselves

Three modes, chosen when the room is created: one person holds the mic
until the others vote them out, the mic people vote on each song, or an
agreed setlist plays through.

Only mic people get controls. The crowd sees the state and no buttons,
because a crowd vote would make a spectator room delegated -- the exact
drift CLAUDE.md 1.2 exists to prevent.

A step-in says on screen that the handover happens after the current
song, because a request that appears to do nothing for two minutes
otherwise reads as broken."
```

---

### Task 6: The feed

**Files:**
- Create: `lib/domain/collage.ts`
- Test: `lib/domain/collage.test.ts`
- Create: `app/feed/page.tsx`
- Create: `lib/useFeed.ts`
- Modify: `lib/supabase.ts` — add `fetchFeedTiles()`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `interface FeedTile { eventId: string; slug: string; title: string; tagline: string | null; status: string; startsAt: string; posterGradient: string; artwork: string[] }`; `collageFor(artwork: string[]): string[]`; `fetchFeedTiles(): Promise<FeedTile[] | null>`; `useFeed(): { tiles: FeedTile[]; state: 'loading' | 'live' | 'empty' }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { collageFor } from './collage';

describe('collageFor', () => {
  // A tile is a 2x2 mosaic. Fewer than four images is the normal case for
  // a new event, and must not render as a broken grid.
  it('returns four cells when there are four or more images', () => {
    expect(collageFor(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('repeats what it has to fill four cells', () => {
    expect(collageFor(['a', 'b'])).toEqual(['a', 'b', 'a', 'b']);
    expect(collageFor(['a'])).toEqual(['a', 'a', 'a', 'a']);
  });

  it('returns an empty array for no images, so the caller can fall back', () => {
    expect(collageFor([])).toEqual([]);
  });

  it('ignores empty strings rather than rendering a broken image', () => {
    expect(collageFor(['a', '', 'b', ''])).toEqual(['a', 'b', 'a', 'b']);
  });

  it('does not mutate the caller’s array', () => {
    const src = ['a', 'b', 'c', 'd', 'e'];
    collageFor(src);
    expect(src).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/collage.test.ts`
Expected: FAIL — cannot resolve `./collage`.

- [ ] **Step 3: Write the module**

```ts
/**
 * A 2x2 artwork mosaic for an event tile, like a playlist cover.
 *
 * Built from the cards actually played in that event's room, so a night
 * looks like the music that happened there. An event with no plays yet
 * returns an empty array and the caller falls back to the poster gradient
 * rather than rendering an empty grid.
 */

const CELLS = 4;

export function collageFor(artwork: string[]): string[] {
  const usable = artwork.filter((a) => a && a.length > 0);
  if (usable.length === 0) return [];

  // Repeat rather than pad with blanks: three real covers and one hole
  // reads as broken, while a repeat reads as deliberate.
  const out: string[] = [];
  for (let i = 0; i < CELLS; i++) out.push(usable[i % usable.length]);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/collage.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Fetch the tiles**

In `lib/supabase.ts`:

```ts
/**
 * Events for the feed, each with the artwork of cards played in its room.
 *
 * The join is events -> rooms -> reigns -> cards: a reign records which
 * card was played in which room, and an event names the room it opens
 * into. An event whose room has seen no reigns comes back with an empty
 * `artwork` array and the tile falls back to its poster gradient.
 */
export async function fetchFeedTiles(): Promise<FeedTile[] | null> {
  const db = supabase();
  if (!db) return null;

  const { data, error } = await db
    .from('events')
    .select('id, slug, title, tagline, status, starts_at, poster_gradient, room_id')
    .in('status', ['scheduled', 'live'])
    .order('starts_at');

  if (error) {
    console.warn('[supabase] fetchFeedTiles:', error.message);
    return null;
  }
  const events = data ?? [];
  if (events.length === 0) return [];

  // One query for every room's played artwork, rather than one per event.
  const roomIds = events.map((e) => e.room_id).filter(Boolean);
  const { data: plays } = await db
    .from('reigns')
    .select('room_id, cards(artwork_url)')
    .in('room_id', roomIds)
    .order('started_at', { ascending: false })
    .limit(200);

  const byRoom = new Map<string, string[]>();
  for (const p of plays ?? []) {
    const row = p as unknown as {
      room_id: string;
      cards: { artwork_url: string | null } | { artwork_url: string | null }[] | null;
    };
    const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
    if (!card?.artwork_url) continue;
    const list = byRoom.get(row.room_id) ?? [];
    if (list.length < 8) list.push(card.artwork_url);
    byRoom.set(row.room_id, list);
  }

  return events.map((e) => ({
    eventId: e.id,
    slug: e.slug,
    title: e.title,
    tagline: e.tagline,
    status: e.status,
    startsAt: e.starts_at,
    posterGradient: e.poster_gradient,
    artwork: byRoom.get(e.room_id) ?? [],
  }));
}
```

Import `FeedTile` as a type from `./domain/collage`, and declare the
interface there beside `collageFor`.

- [ ] **Step 6: Build the screen**

`lib/useFeed.ts` follows the shape of the existing `useActivityFeed`:
fetch on mount, cancel on unmount, report `'loading' | 'live' | 'empty'`.

`app/feed/page.tsx` renders a grid of tiles inside `PhoneShell`. Each tile:

- shows its 2×2 collage when `collageFor(tile.artwork)` returns four cells,
  and the poster gradient when it returns none;
- carries the event title, its format label, and a pulse indicator when
  `status === 'live'`;
- links to `/events/{slug}`.

`'loading'` must render a skeleton, and `'empty'` the `EmptyState` primitive
with a message like `NOTHING SCHEDULED YET` — never placeholder tiles, which
is the fixture problem this whole redesign removes.

Colours from tokens only.

- [ ] **Step 7: Seed one event so the tab is not empty**

`events` and `rooms` were emptied by Plan A's wipe, so the feed would render
its empty state and nothing else — correct behaviour, but it makes the
screen impossible to review and the FEED tab pointless on a fresh install.

Apply a migration named `seed_demo_events` creating **three** events, each
opening into a room, covering three different formats and three statuses
(one `live`, two `scheduled`). Give them real titles and venues in the
app's voice. Do **not** create fake reigns to populate the collages — an
event with no plays correctly falls back to its gradient, and inventing
plays would reintroduce exactly the fabricated data this redesign removed.

Verify with a query showing three events, each with a room, and their
formats.

- [ ] **Step 8: Typecheck, test, build**

Run: `npx tsc --noEmit && npx vitest run && NODE_ENV=production CAPACITOR=1 npx next build`
Expected: 0 errors; all tests pass; the build lists `/feed`.

- [ ] **Step 9: Verify in a browser**

Write `scripts/probe/feed.mjs` modelled on the existing probes: load `/feed`,
assert three tiles render, that the live one carries its indicator, that a
tile with no plays shows its gradient rather than a broken grid, and that
tapping a tile reaches `/events/{slug}`. Paste the real output.

- [ ] **Step 10: Commit**

```bash
git add lib/domain/collage.ts lib/domain/collage.test.ts lib/useFeed.ts \
        lib/supabase.ts app/feed/page.tsx scripts/probe/feed.mjs
git commit -m "feat(feed): give the FEED tab a screen

The tab has pointed at a 404 since the navbar was rebuilt. It now shows
tonight's events as tiles, each illustrated by the artwork of cards
actually played in that event's room -- a night looks like the music that
happened there.

An event with no plays yet falls back to its poster gradient rather than
rendering three covers and a hole. Seeded three demo events because the
data wipe left the table empty, but deliberately seeded no reigns: an
empty collage is correct, and inventing plays would reintroduce the
fabricated data this redesign removed."
```

---

## Verification

After Task 6, all of the following must hold:

1. `npx vitest run` — all tests pass, including the new `mic` and `collage` suites.
2. `npx vitest run app/no-raw-colours.test.ts` — still green.
3. `grep -rn "from 'react'\|from '.*supabase'" lib/domain/` returns nothing.
4. A Concert, Fest or Clubbing room renders the performer disc and **no** dethrone or collapse wording anywhere.
5. A Disco or Private Party room renders the queue and the challenger line.
6. In a `vote_song` Concert, a signed-in player who is not a mic person sees nominations but no vote controls.
7. `pass_mic` promotes only on a majority of the OTHER mic people, leaves exactly one holder, and clears the votes.
8. Two rows in `mic_people` for one room cannot both be `is_holder`.
9. `/feed` lists three seeded events, marks the live one, and links to `/events/{slug}`.
10. An event with no plays renders its poster gradient, not a partial grid.
11. `NODE_ENV=production CAPACITOR=1 npx next build` succeeds with `/feed` in the route list.
