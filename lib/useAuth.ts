'use client';

/**
 * Auth + the signed-in player's profile.
 *
 * Signing in is OPTIONAL. Without a session the app still runs on the public
 * card catalogue and a demo profile — a party app that demands an account
 * before showing you anything loses the room.
 */

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { supabase, isSupabaseConfigured, type DbProfile } from './supabase';

export type AuthState = 'loading' | 'signed-in' | 'anonymous';

/** Shown when nobody is signed in, so every screen has something to render. */
export const GUEST_PROFILE: DbProfile = {
  id: 'guest',
  handle: 'guest',
  display_name: 'Guest',
  initials: 'GU',
  avatar_gradient: null,
  avatar_url: null,
  bio: null,
  tier: 'ROOKIE',
  season_badge: null,
  drops: 0,
  onboarded_at: null,
  last_free_spin_at: null,
  total_reigns_won: 0,
  peak_vibe: 0,
  challenger_wins: 0,
  challenger_attempts: 0,
};


/*
  ONE shared auth state, not one per call site.

  useAuth() used plain useState, so every call created an independent copy
  with its own profile and its own fetch. The shop screen calls it once and
  usePacks() calls it again, so refreshProfile() after a spin updated one
  copy while the balance on screen was rendered from the other -- the Drops
  only appeared after navigating away and back, which remounted the second
  copy and made it refetch. The welcome screen called it three times.

  A module-level store with subscribers means every consumer sees the same
  profile the moment it changes, and the session is fetched once rather than
  once per hook.
*/
interface AuthSnapshot {
  state: AuthState;
  profile: DbProfile;
  error: string | null;
}

let snapshot: AuthSnapshot = {
  state: isSupabaseConfigured ? 'loading' : 'anonymous',
  profile: GUEST_PROFILE,
  error: null,
};

const listeners = new Set<() => void>();

function setSnapshot(patch: Partial<AuthSnapshot>) {
  // A new object identity every time, so useSyncExternalStore actually
  // notices. Mutating in place would leave every consumer stale.
  snapshot = { ...snapshot, ...patch };
  for (const l of listeners) l();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

const getSnapshot = () => snapshot;

/** Reads the profile row behind the private view. Shared by every consumer. */
async function loadProfileInto(userId: string) {
  const db = supabase();
  if (!db) return;
  // my_profile is a security_invoker view scoped to auth.uid(). The
  // `profiles` table is world-readable so the social layer can show handles
  // and tiers, which would also have exposed every player's Drops balance;
  // the private economy columns live behind this view.
  const { data } = await db.from('my_profile').select('*').eq('id', userId).single();
  if (data) { setSnapshot({ profile: data as DbProfile, state: 'signed-in' }); return; }

  /*
    The row is created by the handle_new_user trigger, so immediately after
    signup it may not have committed yet. Reporting `anonymous` there is
    what bounced brand-new players off /welcome and back to /signin -- they
    never saw the avatar picker or the starter-pack tear.

    Retry a few times before giving up. A signed-in user with no profile row
    is a race, not an anonymous visitor.
  */
  for (let attempt = 0; attempt < 4; attempt++) {
    await new Promise((r) => setTimeout(r, 300));
    const { data: retry } = await db.from('my_profile').select('*').eq('id', userId).single();
    if (retry) { setSnapshot({ profile: retry as DbProfile, state: 'signed-in' }); return; }
  }

  setSnapshot({ state: 'anonymous' });
}

/** Re-reads the profile. Call after anything that changes it server-side. */
export async function refreshAuthProfile() {
  const db = supabase();
  if (!db) return;
  const { data } = await db.auth.getUser();
  if (data.user) await loadProfileInto(data.user.id);
}

/*
  The session listener is installed ONCE for the process, not once per
  mounted hook. Several hooks mounting used to mean several subscriptions
  and several redundant fetches of the same session.
*/
let wired = false;
function ensureWired() {
  if (wired) return;
  const db = supabase();
  if (!db) return;
  wired = true;

  void db.auth.getSession().then(({ data }) => {
    if (data.session?.user) void loadProfileInto(data.session.user.id);
    else setSnapshot({ state: 'anonymous' });
  });

  db.auth.onAuthStateChange((_event, session) => {
    if (session?.user) void loadProfileInto(session.user.id);
    else setSnapshot({ state: 'anonymous', profile: GUEST_PROFILE });
  });
}

export function useAuth() {
  /*
    Subscribes to the ONE shared snapshot rather than holding its own. Every
    call site now sees the same profile the instant it changes; previously
    each call had private state, so a refresh in one component left the
    others showing a stale balance until they happened to remount.
  */
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { state, profile, error } = snap;

  useEffect(() => { ensureWired(); }, []);

  const setError = useCallback((msg: string | null) => setSnapshot({ error: msg }), []);

  const signIn = useCallback(async (email: string, password: string) => {
    const db = supabase();
    if (!db) return { ok: false, message: 'No backend configured.' };
    setError(null);
    const { error: e } = await db.auth.signInWithPassword({ email, password });
    if (e) {
      setError(e.message);
      return { ok: false, message: e.message };
    }
    return { ok: true, message: '' };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const db = supabase();
    if (!db) return { ok: false, message: 'No backend configured.' };
    setError(null);
    const { data, error: e } = await db.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (e) {
      setError(e.message);
      return { ok: false, message: e.message };
    }

    /*
      A successful signUp does NOT always mean a signed-in user. When the
      project has email confirmation enabled, Supabase creates the user but
      returns a null session, and the account cannot be used until the link
      is clicked. Reporting ok:true there sent the caller on to /deck as if
      signed in, while the app was still a guest — no token was ever stored,
      so a new tab showed GUEST and no sign-out button appeared.

      Report the real outcome instead so the UI can say what happened.
    */
    if (!data.session) {
      /*
        No session does not always mean "go and read your email".

        Supabase also returns a null session when the account was created
        and is immediately usable -- and a player who is told to check their
        inbox for a mail that never arrives is simply stuck at the door with
        a working account. So try signing in with the credentials just used
        before reporting a wall: if that succeeds, confirmation was never
        required and the signup is complete.
      */
      const { data: signInData, error: signInErr } =
        await db.auth.signInWithPassword({ email, password });
      if (!signInErr) {
        // Load the profile before returning, so the caller navigates with a
        // resolved session rather than racing onAuthStateChange.
        if (signInData.user) await loadProfileInto(signInData.user.id);
        return { ok: true, message: '' };
      }

      const m = 'Check your email to confirm the account, then sign in.';
      setError(m);
      return { ok: false, message: m, needsConfirmation: true };
    }

    // Same reason as above: resolve the profile before the caller routes,
    // or /welcome sees isSignedIn false for a tick and bounces to /signin.
    if (data.user) await loadProfileInto(data.user.id);
    return { ok: true, message: '' };
  }, []);

  /* Refreshes the SHARED snapshot, so every consumer updates at once —
     the shop balance, the profile card, the welcome screen. */
  const refreshProfile = useCallback(() => refreshAuthProfile(), []);

  const signOut = useCallback(async () => {
    await supabase()?.auth.signOut();
  }, []);

  return {
    state,
    profile,
    error,
    isSignedIn: state === 'signed-in',
    /*
      Distinguish "not known yet" from "known to be signed out". Screens
      that branch on isSignedIn alone render their signed-out view during
      the initial session check, which is the sign-in flash on every load.
    */
    isLoading: state === 'loading',
    isAnonymous: state === 'anonymous',
    signIn,
    signUp,
    signOut,
    /* Re-reads the profile row. Needed after a change made outside this
       hook -- an avatar upload writes straight to `profiles`, and without
       this the header keeps showing the old picture until a reload. */
    refreshProfile,
  };
}
