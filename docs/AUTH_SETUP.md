# Auth setup — one required dashboard change

## The problem

Registration creates the account but the user is never signed in.
`localStorage` holds no token, a new tab shows GUEST, and no SIGN OUT
button appears.

Verified against the project's own auth settings endpoint:

```
mailer_autoconfirm : false     <- confirmation required
external email     : true
```

Email confirmation is ON and **no SMTP sender is configured**, so the
confirmation mail can never arrive. Every signup is a dead end: the row
lands in `auth.users` with `email_confirmed_at = null` and a pending
`confirmation_token`, and Supabase returns a **null session**.

`auth.sessions` contained exactly one row (2026-08-31) across every signup
attempt — proof no account created through the UI has ever had a session.

## The fix (do this once, in the dashboard)

Supabase Dashboard → **Authentication → Sign In / Providers → Email** →
turn **"Confirm email" OFF** → Save.

This cannot be changed over the management API or MCP; it is a project auth
setting, not schema.

For a hackathon demo this is the right call: nobody can receive a
confirmation mail, so leaving it on makes registration impossible. Before
anything real ships, turn it back on **and** configure an SMTP sender.

### Existing unconfirmed accounts

Accounts registered while the setting was on stay unconfirmed. Either
delete them and re-register, or confirm them from
**Authentication → Users** (⋯ menu on the row).

## What the app does now

`signUp` used to return `{ok: true}` whenever Supabase returned no error —
including the confirmation case, where there is no session. The sign-in
screen then pushed to `/deck` as though the user were signed in, while the
app was still a guest. That mismatch is why the flow looked like it worked
and then silently wasn't.

It now inspects `data.session` and, when it is null, reports
`needsConfirmation` with a message telling the user to confirm and sign in,
instead of a false success. Once the dashboard setting above is off,
`signUp` returns a real session and the redirect is correct.

## What already works

- Sign-up / sign-in / sign-out through `supabase.auth` (`lib/useAuth.ts`)
- Session restore on load via `getSession`, plus `onAuthStateChange`
- `persistSession` and `autoRefreshToken` on (`lib/supabase.ts`), so a token
  survives reloads and refreshes itself
- The profile trigger: display name preserved, initials from word
  initials (`Probe Player` -> `PP`), generated handle, tier ROOKIE
- New players start with **500 Drops** (migration `starting_drops_grant`).
  Still earn-only per CLAUDE.md §3 — a signup grant is earned by joining,
  not bought, and touches no rarity, odds, or supply.

## Rate limit

Supabase free tier throttles signups (~4/hour) and returns **429** with a
generic failure. If registration suddenly stops working during testing,
check for a 429 before hunting for a bug.
