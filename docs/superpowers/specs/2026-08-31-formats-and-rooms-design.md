# Formats, Rooms & UI — Design Spec

**Date:** 2026-08-31 · **Status:** awaiting approval · **Path:** architectural

Covers: the six party formats and their control models, room creation and
joining, visibility and approval, floor size, shoutouts, navigation, the
design-system foundation, and a swappable playback provider interface.

**Nothing is hosted or deployed by this spec.** Playback is designed as an
interface only; licensed audio is procured separately before launch.

---

## 1. The founding rule, rewritten

`CLAUDE.md` §1 currently states there is exactly one loop and every feature
must be a variant of it. Three of the six formats below remove the dethrone
step, so the rule is **rewritten rather than exempted** (decided 2026-08-31).

> **The core loop is `Play → Vibe sustains or decays → the room responds`.**
> How the room responds depends on the format's **control model**:
>
> - **Contested** — the crowd can take the throne. Vibe collapse hands over
>   to the Challenger Line.
> - **Delegated** — one holder plays; the crowd feeds the pool they choose from.
> - **Spectator** — hosts play; the crowd sustains but never takes over.
>   Vibe scores the set.
>
> Every feature must be a variant of one of these three. A fourth control
> model requires an explicit decision recorded here.

**Guard rails that survive unchanged** — these were never in question:

- Vibe always means the room's live collective reaction.
- Playing a card is still the only way to start a reign.
- Rarity stays universal. No format alters pull odds or supply (§2, §3).
- Drops stay **earn-only** in every format (§3).
- Guest Cards stay blocked wherever the format is owned-only (§4).

---

## 2. The six formats

| Format | Control | Who plays | Cards from | Entry | Floor | Shoutouts |
|---|---|---|---|---|---|---|
| **Concert** | Spectator | One or more hosts | Hosts' own | Guest list | Any | — |
| **Fest** | Spectator | One or more hosts | Hosts' own | Open | Large | — |
| **Clubbing** | Spectator | One DJ | DJ's own only | Guest list | Large | **Yes** |
| **Night Party** | Delegated | One DJ | **Crowd offers, DJ picks** | Guest list | Any | — |
| **Disco** | Contested | Anyone | Own | Open | **Medium** | **Yes** |
| **Private Party** | Contested | Anyone | Own | Guest list | **Small** | **Yes** |

Notes on the pairs:

- **Concert / Fest** differ only by door and scale. Same mechanics.
- **Disco / Private Party** are the same contested loop; Disco is open and
  medium, Private Party is invite-only and small.
- **Clubbing** is a stricter Concert: exactly one performer, and the crowd
  never contributes cards.

### Categories (display grouping)

The six formats are presented under the club-vocabulary names approved
earlier: **Peak Hour · Afters · Sundown · Backroom · Head to Head · Season**.
These are browse/filter groupings in The Lineup, not separate mechanics.

---

## 3. Vibe by control model

| Model | Vibe means | On collapse |
|---|---|---|
| Contested | Grip on the throne | Handover to the Challenger Line |
| Delegated | Room's response to the DJ | DJ keeps control; pool signal weakens |
| **Spectator** | **The set's live score** | **Nothing is taken away** |

In spectator formats vibe **cannot end a set**. Sustained high vibe earns
Drops; a Peak Moment still mints a Legendary. Low vibe is a weak set the room
can see — reputational, not mechanical.

This raises the stakes on the Vibe Bar's text band (`VibeMeter.tsx`):
"LOSING IT" means *losing the throne* in Disco and *losing the room* in a
Concert. Same bar, different consequence — the label is what carries it, and
it is the only channel a screen-reader or colourblind player has.

---

## 4. Shoutouts

On **Disco, Clubbing and Private Party** only. All three kinds:

**Card credit.** When a card is played the room sees whose collection it came
from — "from @sashav's collection". This gives the collectible layer a social
payoff it currently lacks: today a rare card is only better stats.

**Occasion.** The night is dedicated to someone ("Tonight is for Rae"),
pinned on the shared display, with a fireable dedication moment mid-set.

**Requests.** The crowd asks for a specific card next; the requester is named
when it lands.

Constraint: shoutouts are **display-only**. They award no Drops, alter no
odds, and confer no mechanical advantage. A shoutout that paid out would make
social standing a second progression track, which §3 exists to prevent.

---

## 5. Data model

```sql
-- rooms (extending the existing table)
+ format       concert|fest|clubbing|night_party|disco|private_party
+ control      spectator|delegated|contested        -- derived, stored
+ visibility   open|guest_list
+ floor_size   integer                              -- null = unlimited
+ ended_at     timestamptz

-- mode (casual|event) stays EXACTLY as §4 defines it. Format sets its
-- default; it never replaces it. Card rule remains one enum, one conditional.

room_hosts     (room_id, player_id)     -- Concert/Fest permit several
room_requests  (room_id, player_id) PK, state, requested_at, decided_at, decided_by
deck_pool      Night Party offers: room_id, ownership_id, offered_by, played_at
shoutouts      room_id, kind, actor_id, subject_id, text, created_at
```

**Why `room_requests` is its own table** rather than a column on
`challengers`: a request exists *before* someone is in the room, and a
decline must persist so a declined guest cannot re-request repeatedly.
Folding it in would put rows in the Challenger Line for people never
admitted — and that line drives the core loop.

### Atomic join

```sql
create function join_room(p_room_id uuid) returns text
-- 'admitted' | 'pending' | 'full' | 'declined'
```

Floor size is checked **inside the function**, exactly like
`claim_card_supply`. Ten people tapping join on a 25-floor with 24 in: one
gets `admitted`, nine get `full`. Read-then-write would oversell the floor the
same way it would oversell a legendary.

Open rooms admit directly. Guest-list rooms insert a request and return
`pending`.

### Night Party earn path

The card's owner earns Drops when their offered card is played. This is a new
**earn** path, which §3 permits — it is earning, not buying — and it touches
neither rarity nor supply.

### RLS

- **Open** rooms: readable by all, listed in The Lineup.
- **Guest-list** rooms: readable by host, admitted players, and pending
  requesters. Not public, not listed.
- `room_requests`: a player sees only their own; a host sees all for rooms
  they host.
- `deck_pool`: readable by everyone in the room; only the owner may offer,
  only the DJ may mark played.
- `shoutouts`: readable by the room; writable by the actor.

**Run `get_advisors` after every migration.** That check caught an ERROR-level
hole previously — `claim_card_supply` callable by `anon`, which would have let
anyone drain every legendary's supply without signing in.

---

## 6. Navigation

Today: six flat tabs, no hierarchy, no room creation anywhere.

```
DECK      your hand, the live floor you are on
LINEUP    browse formats; entry point to create
CREW      feed + following  (was SOCIAL)
PACKS     opening
CHART     marketplace
YOU       profile, binder, sign-out
```

New routes:

```
/lineup                browse, filter by category
/lineup/new            create — format → door → floor → schedule
/lineup/[slug]         detail, join / request, host approval queue
/lineup/[slug]/manage  host: requests, hosts, dedication
```

`/events` and `/room` redirect to `/lineup` and `/lineup/[slug]` so existing
links keep working.

**Creation is one flow.** Format is the first choice and pre-fills sensible
defaults (approved earlier); everything stays host-overridable.

| Format | Door | Card rule | Floor |
|---|---|---|---|
| Concert | Guest list | Owned only | — |
| Fest | Open | Owned only | 500 |
| Clubbing | Guest list | Owned only | 200 |
| Night Party | Guest list | Open floor | 60 |
| Disco | Open | Open floor | 120 |
| Private Party | Guest list | Open floor | 25 |

---

## 7. Design-system foundation

**The finding:** 311 inline `style={{}}` blocks across 13 screens against 4
shared components. Three different button dialects already exist. A polish
pass without fixing this is repainting on sand.

```
components/ui/
  Button · Panel · Badge · Field · Sheet · Segmented · Stat · EmptyState
```

Plus spacing and radius tokens in `globals.css`, alongside the colour and
type tokens already there.

Not doing: Tailwind or a component library. `CLAUDE.md` §7 fixes the stack,
the design is already expressed in these tokens, and swapping now means
rewriting 13 screens.

**Trade-off, stated plainly:** this is real work before anything visibly
changes. The alternative — new screens first, extract later — writes the new
UI twice.

### 7.1 Visual direction — Industry grammar on AuxWars ground

Decided 2026-08-31. The **Industry** Claude Design project (blueprint /
technical / light steel) supplies the *structural grammar*; AuxWars keeps its
*ground and colour*. A full adoption of Industry was considered and rejected —
see the trade-off below.

**Adopted from Industry:**

- **Square corners.** Radii go to 0 (or 2px at most) across cards, panels,
  buttons and inputs.
- **Hairline borders as the primary surface treatment** — objects are drawn,
  not filled.
- **Registration marks** — the `+` crosshair at the four corners of framed
  objects. This is Industry's signature and it survives intact.
- **Modular grid** — equal cells, strong horizontal and vertical rhythm.
- **Barlow Condensed** for headings, replacing Anton.
- **Themed interaction states** — hover tint, pressed step, and a
  `:focus-visible` ring drawn from the accent rather than a browser default.
  (AuxWars already has the focus ring; the hover/pressed steps are new.)

**Retained from AuxWars, and why:**

- **Stage black `#05050a`** ground. The product is a 4am basement, not a
  drawing office.
- **The four rarity accents** — bronze / silver / gold / spectrum. Industry's
  single-accent rule would flatten Common, Rare, Epic and Legendary into one
  appearance, deleting the collectible system's primary visual. Rarity would
  fall back to the text tag alone, which is the accessibility *floor*, not the
  design.
- **Foil, sheen and holo** on the rarity escalation
  (`CARD_ART_GENERATION.md` §2). Industry's "line drawings only" rule is
  relaxed for cards specifically — a card is the one object in this product
  allowed to be precious.
- **Album art rendered unmodified.** Industry requires photographs to pass
  through `.duotone`; `LICENSING_RIGHTS.md` forbids altering artist cover art.
  **The licensing rule wins.** This is a deliberate, documented divergence
  from Industry's "Do" list, not an oversight.

**What this supersedes:** `design/AuxWars.dc.html` remains the source for
colour, rarity treatment and screen inventory. Its rounded corners, filled
panels and Anton headings are superseded by the above.

**Sync direction:** `DesignSync` writes *to* a Claude Design project; it does
not read designs into code. The §7 primitives will be pushed to a **new
AuxWars project** once built — "Industry" is left untouched, since it is a
different system for a different product.

---

## 8. Playback provider interface

Designed as an interface so licensing is a config change, not a rewrite.

```ts
interface PlaybackProvider {
  readonly id: string;
  readonly canAnalyse: boolean;      // same-origin or CORS-open audio?
  search(q: string): Promise<Track[]>;
  load(trackRef: string): Promise<void>;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  analyser(): AnalyserNode | null;   // null when the provider cannot expose one
  on(event: 'ready'|'playing'|'paused'|'ended'|'error', cb): () => void;
}
```

Implementations plug in behind it. Nothing in the app assumes a vendor.

**On licensing.** Even fully licensed, the realistic model is *authorised
client to someone else's stream* — you do not host audio files. That keeps
`LICENSING_RIGHTS.md` DO NOT #1 intact under any commercial deal, and it is
why this interface shape survives the transition.

`canAnalyse` exists because the FFT-driven Vibe Bar (`CLAUDE.md` §7) needs
same-origin or CORS-open audio. Iframe-based providers cannot supply it; the
UI must degrade to the simulated vibe rather than break.

---

## 9. Build order

1. Design system foundation (§7) — everything else builds on it
2. Schema + RLS + `join_room` (§5), advisor check after
3. Create / browse / join / approve (§6)
4. Format rules and spectator vibe (§2, §3)
5. Shoutouts (§4)
6. UI/UX polish across all screens
7. Playback provider interface (§8) — no vendor implementation yet

---

## 10. Out of scope

- Any licensed-audio integration (procurement first)
- Scraping, ad-stripping clients, or stored audio — `LICENSING_RIGHTS.md`
  DO NOT #1 and #2, unchanged
- Room chat — a further mechanic, not decided
- Pre-invite by handle — request-and-approve covers the need
- Ticketing or cover charge — would collide with §3's earn-only rule

---

## 11. Open questions

1. Can a Concert have co-hosts *added after* creation, or only at creation?
2. Does a declined guest see they were declined, or just stay pending?
3. Should a Night Party DJ be able to return an offered card unplayed?
4. Do spectator-format set scores appear on the Profile Card, and if so as
   what — a separate stat from Total Reigns Won?
