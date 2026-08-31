# CARD_ART_GENERATION.md — Frame & Foil Treatment

**Scope: the frame, border, and foil treatment *around* album artwork.**
Never the artwork itself.

> **The hard line.** Album art is sourced per `docs/LICENSING_RIGHTS.md`
> and rendered **unmodified**. Do not AI-generate it, restyle it,
> upscale it, recolor it, or "enhance" it. Altering an artist's cover art
> creates a derivative work we have no right to make. The frame sits
> around a rectangle we never touch.

CSS values below are lifted from the approved design prototype
(`AuxWars.dc.html`, "HI-FI PASS 01 · DARK / NEON / FOIL"). They are the
agreed visual language, not fresh proposals.

---

## 1. Design tokens

```css
:root {
  /* Two surfaces only — neon does the talking */
  --stage-black:  #05050a;   /* page ground */
  --booth-panel:  #0e0e18;   /* card/panel ground */

  --neon-pink:    #ff2e88;
  --neon-cyan:    #4ce3ff;
  --neon-gold:    #ffd84d;
  --neon-violet:  #7b2bff;
  --neon-mint:    #7dffc3;
  --ink:          #f4f2ff;

  --font-title: Anton, sans-serif;              /* titles */
  --font-stat:  'Barlow Condensed', sans-serif; /* sport-card numerics */
  --font-tele:  'JetBrains Mono', monospace;    /* telemetry labels */
  --font-body:  Barlow, system-ui, sans-serif;
}
```

**Rule: foil appears only on rarity frames.** Nowhere else in the app.
The moment foil decorates a button or a header, rarity stops reading as
special.

---

## 2. The four rarity frames

Exact gradients from the prototype's `RAR` map:

```css
/* COMMON — bronze, matte, no animation */
.frame-common {
  --frame: linear-gradient(160deg, #8a6a42, #3a2c1a);
  --accent: #c79a5e;
  --badge-bg: rgba(138,106,66,.9);
  --badge-fg: #1d1408;
}

/* RARE — brushed silver, static sheen */
.frame-rare {
  --frame: linear-gradient(160deg, #dfe6ef, #7b8798 45%, #c9d3e0);
  --accent: #cfd8e4;
  --badge-bg: rgba(223,230,239,.92);
  --badge-fg: #1b2029;
}

/* EPIC — gold, animated sheen sweep */
.frame-epic {
  --frame: linear-gradient(160deg, #ffe9a8, #c9962b 42%, #ffd84d);
  --accent: #ffd84d;
  --badge-bg: #ffd84d;
  --badge-fg: #1d1400;
}

/* LEGENDARY — full-spectrum holo, tilt-reactive */
.frame-legendary {
  --frame: linear-gradient(115deg, #ff2e88, #7b2bff 30%, #4ce3ff 55%, #ffd84d 80%, #ff2e88);
  --accent: #ff8ac4;
  --badge-bg: linear-gradient(90deg, #ffd84d, #ff2e88);
  --badge-fg: #0b0512;
}
```

Frame renders as a **2px gradient border** via padding + background, with
the artwork inset:

```css
.card {
  padding: 2px;
  background: var(--frame);
  border-radius: 14px;
}
.card__inner {
  background: var(--booth-panel);
  border-radius: 12px;
  overflow: hidden;
}
```

**Escalation is deliberate:** matte → static sheen → animated sheen →
reactive holo. Rarity is legible from across a room before any text is
read.

---

## 3. The Legendary holo effect

Conic-gradient + `mix-blend-mode: color-dodge` + tilt. **No WebGL** — this
runs on a phone during a party.

```css
.card--legendary { position: relative; transform-style: preserve-3d; }

.card--legendary .holo {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  pointer-events: none;
  mix-blend-mode: color-dodge;
  opacity: .55;
  background: conic-gradient(
    from calc(var(--holo-angle, 0) * 1deg) at var(--holo-x, 50%) var(--holo-y, 50%),
    #ff2e88 0deg, #7b2bff 60deg, #4ce3ff 120deg,
    #7dffc3 180deg, #ffd84d 240deg, #ff2e88 360deg
  );
  transition: opacity .2s ease;
}

/* Second layer: a moving specular band, the "tilt into the light" read */
.card--legendary .holo::after {
  content: '';
  position: absolute;
  inset: -20%;
  background: linear-gradient(
    calc(var(--holo-angle, 0) * 1deg + 90deg),
    transparent 40%, rgba(255,255,255,.35) 50%, transparent 60%
  );
  mix-blend-mode: overlay;
}
```

Driven by pointer on desktop, gyroscope on mobile:

```js
// --holo-x/y follow the pointer; --holo-angle drives the spectrum sweep
function applyTilt(el, xPct, yPct) {
  el.style.setProperty('--holo-x', `${xPct}%`);
  el.style.setProperty('--holo-y', `${yPct}%`);
  el.style.setProperty('--holo-angle', `${(xPct - 50) * 3.6}`);
  el.style.transform =
    `perspective(700px) rotateY(${(xPct - 50) / 6}deg) rotateX(${-(yPct - 50) / 8}deg)`;
}
```

### iOS gyroscope permission — the demo-day trap

`DeviceOrientationEvent` **silently does nothing** on iOS without an
explicit user-gesture permission request. No error, no console warning —
the effect just never fires.

```js
async function enableTilt() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    // MUST be called from inside a real tap handler
    const state = await DOE.requestPermission();   // 'granted' | 'denied'
    if (state !== 'granted') return false;
  }
  window.addEventListener('deviceorientation', onOrient);
  return true;
}
```

Requirements:
1. Call **only** from inside a genuine tap handler. Calling on page load
   fails silently.
2. Ship a visible "Tilt to shine ✨" affordance on the first Legendary
   reveal — that tap is both the opt-in and the permission gesture.
3. **Pointer/hover fallback must always work**, so desktop and
   permission-denied phones still see the holo.
4. **Test on a physical iPhone.** Desktop Chrome cannot reproduce this.
   → `docs/DEMO_FALLBACKS.md`.

### Performance and accessibility

- Animate only `transform` and `opacity`. Never `background-position` on
  a large element — it repaints every frame.
- `will-change: transform` on the **revealed** card only, never on grid
  items. A binder of 12 promoted layers will jank.
- Cap holo updates at ~60fps via `requestAnimationFrame`; gyroscope
  fires faster than paint.
- Respect reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .card--legendary .holo { animation: none; opacity: .4; }
  .card--epic .sheen { animation: none; }
}
```
  The static gradient still communicates rarity — motion is enhancement,
  never the only signal.
- Rarity must **never** be conveyed by color alone: every card shows its
  tag (`CMN`/`RARE`/`EPIC`/`LGND`) as text.

---

## 4. Profile Card frame

Same construction, **distinguishable at a glance** — it is the user, not
a collectible.

```css
.frame-profile {
  --frame: linear-gradient(160deg, #4ce3ff, #7b2bff 55%, #4ce3ff);
  --accent: #4ce3ff;
  --badge-bg: rgba(76,227,255,.9);
  --badge-fg: #041016;
}
```

Distinguishers, in order of legibility:
1. **Cyan/violet axis** — no rarity tier uses cyan as its primary.
2. **Crown glyph (♛)** in the badge slot where song cards show rarity.
3. **Portrait aspect** — circular avatar, not a square cover.
4. **Stat labels differ**: `TOTAL REIGNS WON` / `PEAK VIBE` /
   `CHALLENGER WIN RATE` instead of `HYPE` / `STAMINA`.

A Profile Card at high tier may carry the **Epic sheen** (earned status),
but **never the Legendary holo** — holo means scarce supply, and a
profile is not scarce.

---

## 5. Guest Card frame

Deliberately the least attractive card in the game. Greyed, dashed,
unmistakably temporary (`CLAUDE.md` §2).

```css
.frame-guest {
  --frame: repeating-linear-gradient(
    45deg, #3a3a44 0 6px, #2a2a33 6px 12px
  );
  --accent: rgba(244,242,255,.45);
  --badge-bg: rgba(58,58,68,.9);
  --badge-fg: rgba(244,242,255,.6);
}
.card--guest .card__inner { opacity: .82; }
.card--guest::after {
  content: 'GUEST · NOT OWNED';
  position: absolute;
  bottom: 8px; left: 50%;
  transform: translateX(-50%);
  font: 400 9px/1 var(--font-tele);
  letter-spacing: .18em;
  color: rgba(244,242,255,.4);
}
```

No foil, no sheen, no holo, **ever**. The visual gap between a Guest Card
and a Common is the entire argument for collecting. In an Event Room
these are blocked outright, so the UI should render them disabled with
"OWNED CARDS ONLY".

---

## 6. Assets safe to originate

**This is the only category safe to design from scratch or AI-generate** —
none involves a real artist's likeness or copyrighted material.

| Asset | Notes |
|---|---|
| Throne visual (screen 01) | Original iconography — crown/aux-cable motif |
| Pack artwork | "AUX PACK · 5 CARDS · SERIES 01" wrapper |
| UI iconography | Play, trade, filter, queue, lock |
| Rarity badges | `CMN`/`RARE`/`EPIC`/`LGND` shapes |
| Frame/foil textures | Everything in §2–5 |
| Placeholder art | The `COVER ART` fallback when `artworkUrl` is null |
| Avatar gradients | The `AV[]` palette from the prototype |
| Peak-moment shards | 54 confetti particles, screen 01 |
| Empty/loading states | Deck slot, binder skeletons |

Everything else — album covers, artist photos, logos, wordmarks — is
**sourced, never generated**.

---

## 7. Artist photos — UNRESOLVED

The product currently uses **album art only**. If artist-photo cards are
ever wanted, they need **rights clearance entirely separate** from the
music licensing in `docs/LICENSING_RIGHTS.md`:

- Photo copyright belongs to the **photographer**, not the artist or
  label.
- Personality/publicity rights are a **separate** claim on the likeness.
- Neither MusicBrainz CC0 nor any API's terms grant either. Spotify and
  Deezer artist images are licensed for **their** display contexts, not
  for us to reprint on a tradeable card.

**Status: blocked pending legal review.** Do not add artist-photo cards
without it. Album art carries no personality-rights exposure, which is
exactly why the design chose it.

---

## 8. Implementation checklist

- [ ] Tokens in `theme.css`; no hard-coded hex in components
- [ ] One `<Card>` component, `kind` + `rarity` props select the frame
- [ ] `artworkSource` drives attribution (iTunes ⇒ store badge, §2.5)
- [ ] Holo only on `rarity === 'legendary'`
- [ ] Tilt behind an explicit tap; pointer fallback always live
- [ ] `prefers-reduced-motion` honored
- [ ] Rarity always has a text tag, never color alone
- [ ] Guest Cards render disabled in Event Rooms
- [ ] Album artwork rendered unmodified — no filters, no AI passes

---

## 9. Sound design (added pass 2 — see docs/IMPROVEMENTS.md #1)

Two entirely separate layers. Conflating them is a licensing error.

### 9.1 UI feedback — `lib/useSound.ts`

Synthesized with Web Audio oscillators. **No sample files.** Zero bytes to
download (the APK ships to phones on venue wifi) and zero licensing
questions, since we generate the waveform ourselves.

| Cue | Shape | Fires on |
|---|---|---|
| `tap` | 420Hz sine, 50ms | any press |
| `cardPlay` | 320→620Hz rise + 880Hz ping | card into the deck slot |
| `throne` | major triad, ascending | you take the throne |
| `dethrone` | 440→180Hz saw fall | you lose it |
| `peak` | stacked rising triangles | Peak Moment |
| `packTear` | 180→90Hz saw + noise burst | pack stage 1 |
| `legendary` | 4-note ascending flourish | legendary reveal |
| `warn` | 260→200Hz square | vibe crosses into critical |

Rules:
- **Rising = gain, falling = loss.** Never invert this.
- Envelopes decay exponentially — a linear ramp to zero clicks audibly.
- `prefers-reduced-motion` suppresses all of it, treated as a
  reduce-sensory-load signal.
- A **mute toggle sits in the status bar on every screen** and persists to
  `localStorage`. Non-negotiable: this runs on someone's personal phone.

### 9.2 Music playback — `lib/usePlayback.ts`

The YouTube IFrame embed, and nothing else. This is what keeps the app
copyright-clean (`LICENSING_RIGHTS.md` §2.7): we display YouTube's own
player rather than hosting audio.

Hard constraints, all enforced in `components/NowPlaying.tsx`:
- Player viewport **≥ 200×200px** and visible while playing. Hiding or
  shrinking it violates YouTube's terms.
- Never download, cache, proxy, or synthesize a real track (DO NOT #1, #2).
- Failure is surfaced, not swallowed — a video pulled by its rights holder
  shows "This track cannot be played here", not silence.

**Do not** add a second playback path (Spotify SDK, direct audio URLs)
without re-reading `LICENSING_RIGHTS.md` §0.1 and §3 first.
