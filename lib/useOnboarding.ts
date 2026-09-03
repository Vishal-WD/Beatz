'use client';

/**
 * Whether this player still needs the welcome.
 *
 * A route guard, not a wizard: `needsWelcome` is false while auth is still
 * resolving, so a returning player never flashes the welcome screen on the
 * way to the app -- the same class of bug as the sign-in flash.
 */

import { useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { markOnboarded } from './supabase';

export function useOnboarding() {
  const { isLoading, isSignedIn, profile } = useAuth();
  const [finished, setFinished] = useState(false);

  const finish = useCallback(async () => {
    setFinished(true);
    await markOnboarded();
  }, []);

  return {
    needsWelcome:
      !isLoading &&
      isSignedIn &&
      !finished &&
      (profile as { onboarded_at?: string | null }).onboarded_at == null,
    finish,
  };
}
