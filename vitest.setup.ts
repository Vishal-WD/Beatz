import '@testing-library/jest-dom/vitest';

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
