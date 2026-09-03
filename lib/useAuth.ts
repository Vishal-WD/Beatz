'use client';

/**
 * Auth + the signed-in player's profile.
 *
 * Signing in is OPTIONAL. Without a session the app still runs on the public
 * card catalogue and a demo profile — a party app that demands an account
 * before showing you anything loses the room.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured, type DbProfile } from './supabase';

export type AuthState = 'loading' | 'signed-in' | 'anonymous';

/** Shown when nobody is signed in, so every screen has something to render. */
export const GUEST_PROFILE: DbProfile = {
  id: 'guest',
  handle: 'guest',
  display_name: 'Guest',
  initials: 'GU',
  avatar_gradient: null,
  bio: null,
  tier: 'ROOKIE',
  season_badge: null,
  drops: 0,
  total_reigns_won: 0,
  peak_vibe: 0,
  challenger_wins: 0,
  challenger_attempts: 0,
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(
    isSupabaseConfigured ? 'loading' : 'anonymous',
  );
  const [profile, setProfile] = useState<DbProfile>(GUEST_PROFILE);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const db = supabase();
    if (!db) return;
    // my_profile is a security_invoker view scoped to auth.uid(). The
    // `profiles` table is world-readable so the social layer can show
    // handles and tiers, which would also have exposed every player's
    // Drops balance; the private economy column lives behind this view.
    const { data } = await db.from('my_profile').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data as DbProfile);
      setState('signed-in');
    } else {
      // The signup trigger creates the row; a miss here means it has not
      // committed yet. Stay anonymous rather than rendering a broken profile.
      setState('anonymous');
    }
  }, []);

  useEffect(() => {
    const db = supabase();
    if (!db) return;

    let cancelled = false;

    db.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) void loadProfile(data.session.user.id);
      else setState('anonymous');
    });

    const { data: sub } = db.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) void loadProfile(session.user.id);
      else {
        setProfile(GUEST_PROFILE);
        setState('anonymous');
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

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
      const m = 'Check your email to confirm the account, then sign in.';
      setError(m);
      return { ok: false, message: m, needsConfirmation: true };
    }

    return { ok: true, message: '' };
  }, []);

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
  };
}
