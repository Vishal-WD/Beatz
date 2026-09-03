import '@testing-library/jest-dom/vitest';

/**
 * localStorage polyfill for jsdom environment.
 * jsdom doesn't provide localStorage by default in all configurations,
 * but the DOM Storage spec expects it to be available.
 */
if (typeof global.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  global.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(key => delete store[key]); },
    key: (index: number) => Object.keys(store)[index] || null,
    length: Object.keys(store).length,
  };
}

/*
  useAuth (and anything else reading isSupabaseConfigured) branches on these
  being present. Next.js loads .env.local automatically; Vitest does not, so
  without a stub the hook short-circuits to 'anonymous' and never exercises
  its 'loading' state — which is exactly the state the sign-in-flash tests
  need to observe.

  These are placeholders, not credentials: no test makes a network call.
*/
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
