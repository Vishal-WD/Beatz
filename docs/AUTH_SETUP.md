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

## RESOLVED — fixed in the database, not the dashboard

The dashboard toggle would not persist: `mailer_autoconfirm` stayed `false`
through several attempts, and `signInWithPassword` kept answering
"Email not confirmed". Rather than leave auth broken, the fix moved into a
migration (`auto_confirm_new_users_demo`) where it is version-controlled and
verifiable.

`public.handle_new_user()` — the existing AFTER INSERT trigger on
`auth.users` that creates the profile row — now also sets
`email_confirmed_at` and clears `confirmation_token`. Accounts already
stranded were confirmed by the same migration.

Verified end to end in a real browser:

```
1. REGISTER   200 signup session=true  -> token stored, redirect to /deck
2. NEW TAB    SIGNED IN | TEST PLAYER | @aux_c91331ae7655 · ROOKIE · 500 DROPS
3. SIGN OUT   token cleared, back to signed-out screen
```

The 429 "email rate limit exceeded" also disappeared, because no
confirmation mail is sent any more. That rate limit was a symptom of this
same setting, not a separate problem.

> **REMOVE BEFORE ANY REAL LAUNCH.** Auto-confirmation means anyone can
> register with an address they do not own. Drop the `update auth.users`
> block from `handle_new_user()`, turn "Confirm email" back on, and
> configure a real SMTP sender. Fine for a hackathon demo; not for
> production.

## The original dashboard route (did not work here)

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
