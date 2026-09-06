# Deploying multiplayer

Multiplayer is built and verified locally. Two clients in one room see each
other by name, a card played by one reaches the other as `reign:started`,
vibe ticks stream live, and challenger joins propagate.

What is missing is a **host**. `NEXT_PUBLIC_API_URL` is empty, so every room
falls back to Solo Practice and the socket server never gets used. These are
the steps to change that. Nothing here has been done for you — deploying
publishes a service under your account, so it is yours to run.

---

## Why two hosts

Vercel's serverless functions cannot hold a persistent WebSocket, and
Socket.io needs a long-running process. So:

| Part | Host | Why |
|---|---|---|
| Next.js UI | Vercel (or the APK itself) | Static export, no server needed |
| Socket.io server | Render | Long-running process, holds connections |
| Database | Supabase | Already live |

`render.yaml` in the repo root is a Render blueprint that describes the
service. You do not need to write any config.

---

## Step 1 — push the branch

Render deploys from GitHub, so the branch has to be somewhere it can see.

```bash
git push -u origin core-domain-rebuild
```

(Or merge to `main` first if you would rather deploy from there.)

## Step 2 — create the Render service

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** →
   **Blueprint**.
2. Connect the GitHub repo and pick the branch you pushed.
3. Render reads `render.yaml` and proposes a service called
   **beatz-realtime**. Accept it.
4. It will ask for the two env vars marked `sync: false`:

   - **`ALLOWED_ORIGINS`** — comma-separated, no spaces. Use exactly:
     ```
     https://localhost,capacitor://localhost,http://localhost:3000
     ```
     The first two are what the Android WebView sends; the third is local
     development. Add your Vercel URL too if you deploy the web build.
     **Getting this wrong is the most likely failure** — the browser will
     report a CORS error and the socket will never connect.

   - **`REDIS_URL`** — leave it blank. Room state is in-memory today, which
     is fine for one instance. It is only required before running more than
     one, because two processes would each hold their own copy of a room.

   Then add two more that `render.yaml` does not declare, because they are
   secrets. **Without them nobody can play a card at all.** The server resolves
   every `card:play` against the card table; with no credentials that pool
   is empty, so it answers `CARD_NOT_FOUND` to every play, no reign starts,
   and the room stays silent for everyone -- which looks exactly like "my
   friend plays a song and I hear nothing". Reigns also go unrecorded — it
   logs `reign persistence OFF` at startup and the activity feed and profile
   stats stay empty however long people play:

   - **`SUPABASE_URL`** — the same project URL as `NEXT_PUBLIC_SUPABASE_URL`
     in `.env.local`.
   - **`SUPABASE_ANON_KEY`** — the same publishable key as
     `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. This reads the card
     catalogue; `cards` is public under RLS, so that read deliberately does
     not use the service key.
   - **`SUPABASE_SERVICE_ROLE_KEY`** — Supabase dashboard → **Project
     Settings → API → service_role**. This key bypasses RLS, which is why
     the server needs it (it writes reigns on behalf of whoever holds the
     throne) and why it must **never** be given a `NEXT_PUBLIC_` prefix or
     put in `.env.local`. Render's env vars are the right place for it.

5. Deploy. First build takes a few minutes.

## Step 3 — check it is alive

```bash
curl https://<your-service>.onrender.com/health
```

Expect `200`. If you get a timeout, the free instance is asleep — see the
cold-start note below.

## Step 4 — point the app at it

Put the URL in `.env.local`:

```
NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com
```

Then rebuild — this value is **baked in at build time**, so changing it
later means rebuilding the APK:

```bash
NODE_ENV=production CAPACITOR=1 npx next build
NODE_ENV=production npx cap sync android
cd android && ./gradlew assembleDebug
```

## Step 5 — prove it with two devices

Install the APK on two phones, open the same room on both, and play a card
on one. The other should show the reign starting and the vibe moving. The
deck screen's connection badge reads **LIVE** rather than **SOLO PRACTICE**
when the socket is connected — that badge is the fastest way to tell
whether Step 4 actually took effect.

---

## The free plan will bite you at a demo

Render spins free instances down after ~15 minutes idle, and a cold start
takes 30–60 seconds. During that window the app falls back to Solo Practice,
which is correct behaviour but not what you want an audience to see.

Either upgrade the instance, or hit `/health` a few minutes before you
present. `docs/DEMO_FALLBACKS.md` covers the hour-before checklist.

---

## What multiplayer does and does not do yet

**Works:** joining a room, seeing who else is there, playing a card,
live vibe ticks, the challenger line, the reconnect grace window (a dropped
socket holds the last known vibe for ~4s rather than collapsing instantly),
and the control model — a contested room hands over the throne, a spectator
set never ends on low vibe.

Reigns are written back to the `reigns` table when the two Supabase env
vars above are set, so multiplayer sessions do reach the activity feed, and
a reign ending folds into Total Reigns Won and Peak Vibe through a database
trigger. Verified at the SQL level: a slug resolves to its room, a reign
opens and closes, the domain's end reason maps onto the storage vocabulary,
stats increment once and not twice, and the feed can see the row.

**Not yet:** room state is per-process and in-memory, so it is lost on
restart and cannot span two instances (that is what `REDIS_URL` is for).
Guest Cards and the Night Party crowd-offer pool are unbuilt. The
persistence path has been verified in SQL but **not** end-to-end through a
running server, because that needs the service role key — do check the
startup log says `reign persistence ON` after you deploy.
