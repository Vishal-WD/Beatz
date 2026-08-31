# DEMO_FALLBACKS.md — Live Demo Pre-Flight Checklist

Every item in `CLAUDE.md` §6 expanded into something actionable, plus the
three failure modes that only appear on real hardware in a real venue.

Ordered by **when to run each check**. Do not defer week-before items to
the day before — several have fixes measured in days, not hours.

---

## WEEK BEFORE

### Data & seeding

- [ ] **Full seed run against a wiped DB.** `pnpm seed:cards` end to end,
      then `pnpm seed:verify` with zero failures.
      *Why now:* Spotify changed terms four times between Nov 2024 and
      Feb 2026. Assume the pipeline is broken until proven otherwise this
      week. → `docs/DATA_POPULATION.md` §4
- [ ] **Legendary supply headroom.** ≥ 3 legendary cards with
      `supply_remaining > 500`.
      ```sql
      SELECT title, supply_remaining FROM cards
      WHERE rarity = 'legendary' ORDER BY supply_remaining DESC LIMIT 5;
      ```
- [ ] **No tier exhausted.** Every tier > 0 with headroom. An exhausted
      tier triggers downgrade+refund (`CLAUDE.md` §6) — correct behavior,
      terrible optics on stage.
- [ ] **Analyzable card in every tier.** ≥ 1 Jamendo CC BY card per
      rarity so the real FFT Vibe Bar is demonstrable.
- [ ] **All demo artwork on our own storage.** Zero external image
      requests during the demo.
      ```sql
      SELECT count(*) FROM cards
      WHERE artwork_url LIKE '%itunes%' OR artwork_url LIKE '%scdn.co%';
      -- expect 0
      ```

### Milestone account (the money shot)

- [ ] **Demo account seeded exactly one milestone short** of a guaranteed
      legendary pull, so the pack-opening lands on cue.
      *Critical:* this must use the **milestone path**, never
      probability-scaled odds — `CLAUDE.md` §3 rejected smooth scaling
      precisely because it makes the key demo moment un-triggerable.
- [ ] **Rehearse the pull end to end** on the demo account, then **reset
      it**. Verify the reset actually restores the pre-milestone state.
- [ ] **Second demo account** seeded identically as a hot spare.

### iOS device testing — cannot be done on desktop

- [ ] **`DeviceOrientationEvent.requestPermission()` on a physical
      iPhone.** iOS **silently does nothing** without an explicit
      tap-to-allow — no error, no console warning, the holo tilt just
      never fires. Desktop Chrome cannot reproduce this.
      → `docs/CARD_ART_GENERATION.md` §3
- [ ] Permission prompt fires from a **real tap handler** (not page load,
      not a timer, not an async continuation after an `await`).
- [ ] **Denied-permission path** still shows the holo via pointer
      fallback. Test by denying, then in Settings → Safari → clearing to
      re-prompt.
- [ ] Test **Safari and Chrome on iOS**, and in **Low Power Mode** (which
      throttles motion events and `requestAnimationFrame`).
- [ ] **Android gyroscope** sanity check — different event semantics, no
      permission prompt.

### Licensing sanity

- [ ] **No non-Jamendo audio is stored or proxied anywhere.**
      → `LICENSING_RIGHTS.md` DO NOT #1
- [ ] Every analyzable card renders its **per-track attribution** and
      license link.
- [ ] Any iTunes-sourced artwork carries its **store badge + link**
      (§2.5), or those cards are swapped out.
- [ ] YouTube embeds are **≥ 200×200px** with a valid Referer, otherwise
      playback is blocked (§2.7).

---

## DAY BEFORE

### Venue network — test on the actual demo wifi

Latency-sensitive in order of visibility:

- [ ] **Vibe Bar updates (most sensitive).** Real-time collective
      reaction is the core loop; lag here reads as "broken," not "slow."
      Measure Socket.io round-trip on venue wifi. **> 400ms and the bar
      feels dead** — switch to the local-simulation fallback.
- [ ] **Throne handover.** Confirm the dethrone transition fires cleanly
      with 6+ real devices on venue wifi.
- [ ] **Pack opening.** Should be fully client-side after the pull
      resolves — verify no mid-animation network round-trip.
- [ ] **WebSocket drop mid-reign** → 3–5s grace window holds the last
      known Vibe value before decay resumes (`CLAUDE.md` §6). Test by
      turning wifi off mid-reign on one device. **Must not instant-zero.**
- [ ] **Reconnect storm.** All devices back on simultaneously after an AP
      blip — no duplicated Challenger Line entries.
- [ ] **Captive portal check.** Venue guest wifi with a login page will
      silently break WebSockets. Test on the actual SSID.
- [ ] **Phone hotspot as fallback**, verified working, with data
      allowance confirmed.

### Core loop fallbacks (`CLAUDE.md` §6)

- [ ] **Simultaneous Challenger Line joins** → atomic increment, not
      array push. Test with 5+ devices tapping join at once; expect
      distinct sequential positions.
- [ ] **Empty/solo room** → "Solo Practice" mode simulates baseline crowd
      energy, **clearly labeled as practice**. This is the likely opening
      state on stage before the audience joins.
- [ ] **Trade race vs. Dust** → card locks `pending_trade` on offer and
      blocks dust/other trades until resolved or expired.
- [ ] **Rarity tier exhausted** → downgrade one tier + refund the Drops
      difference. Never a hard pull failure.
- [ ] **Guest Card blocked in Event Rooms** with a clear message, allowed
      in Casual (`CLAUDE.md` §4).
- [ ] **Atomic supply under concurrency.** Hammer the last copy of one
      card from 10 clients; exactly one wins, nine get the downgrade path.

### Build & deploy

- [ ] **Production build deployed and smoke-tested**, not a dev server.
      Dev-only timing masks race conditions.
- [ ] **Rollback ready** — previous deployment one command away.
- [ ] **Local offline build** on the demo laptop, runnable with no
      internet at all.
- [ ] Fonts (Anton, Barlow, Barlow Condensed, JetBrains Mono)
      **self-hosted**, not from Google Fonts CDN.
- [ ] `prefers-reduced-motion` path still legible (rarity via text tags).

---

## HOUR BEFORE

### Hardware

- [ ] Shared display at **1280×720** showing screen 01 (The Throne Room),
      driven by the demo laptop. Confirm the actual projector resolution
      — a 16:9 design on a 4:3 projector crops the vibe ring.
- [ ] **Screen sleep / screensaver disabled** on every device.
- [ ] Demo phones **charged > 80%**, Low Power Mode **off** (it throttles
      motion events and `rAF`).
- [ ] **Notifications silenced** on all demo devices.
- [ ] Browser zoom at **100%**, caches cleared, no stale service worker.

### Final state

- [ ] Demo account confirmed **one milestone from legendary** (re-verify
      after any rehearsal).
- [ ] Room created and joinable; join code/QR displayed and **tested from
      a phone that was never on the dev network**.
- [ ] Vibe Bar responds to a real hold on a real phone.
- [ ] One full loop rehearsed **on venue wifi**: play a card → hold
      throne → vibe decays → dethrone → next challenger crowned.
- [ ] `SPOTIFY_CLIENT_ID` — confirm the app **degrades cleanly** if unset.
      Do not let a five-user Dev Mode cap (`LICENSING_RIGHTS.md` §0.1)
      break a room with six people in it. **If in doubt, run the demo
      with Spotify disabled entirely.**

---

## Known-risk register

Things that can still go wrong, with the pre-decided response.

| Risk | Likelihood | Response |
|---|---|---|
| **Spotify 5-user cap hit mid-demo** | **High** if enabled | Run with Spotify off; MusicBrainz+Deezer seeded data covers everything |
| Venue wifi degrades | High | Solo Practice mode + phone hotspot |
| iOS tilt permission denied | Medium | Pointer fallback (already required) |
| Captive portal blocks WebSocket | Medium | Hotspot; test day-before |
| Legendary pool exhausted | Low (if seeded) | Downgrade+refund path is correct behavior |
| Projector crops 16:9 | Medium | Verify resolution hour-before |
| Reconnect storm dupes queue | Low | Atomic increment; tested day-before |

### The single highest-risk item

**Spotify's Dev Mode five-user cap** (`LICENSING_RIGHTS.md` §0.1).
A multiplayer party demo with more than five participants will hit it.
The mitigation is not a workaround — it is **running the demo entirely on
pre-seeded MusicBrainz + Deezer data with Spotify disabled**, which the
architecture already supports because `DATA_POPULATION.md` enriches
offline at seed time rather than at runtime.

Confirm this path works **week-before**, not hour-before.
