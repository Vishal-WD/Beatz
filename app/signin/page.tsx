'use client';

/**
 * Sign in / sign up.
 *
 * Deliberately skippable: the app works without an account, so this is never
 * a wall in front of the product. Signing in is what makes cards *yours*.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useSound } from '@/lib/useSound';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, signUp, isSignedIn, isLoading, profile, signOut } = useAuth();
  const { play } = useSound();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res =
      mode === 'in'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, name.trim() || 'New Challenger');
    setBusy(false);
    if (res.ok) {
      play('throne');
      router.push('/deck');
    } else {
      setMsg(res.message);
    }
  }

  if (isLoading) {
    return (
      <Shell>
        <div
          style={{
            padding: 'var(--sp-7)',
            textAlign: 'center',
            font: '400 9px/1 var(--font-tele)',
            letterSpacing: '.16em',
            color: 'var(--ink-25)',
          }}
        >
          LOADING…
        </div>
      </Shell>
    );
  }

  if (isSignedIn) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ font: '400 10px/1 var(--font-tele)', letterSpacing: '.24em', color: 'var(--neon-mint)' }}>
            SIGNED IN
          </div>
          <div style={{ font: '400 40px/.95 var(--font-title)', textTransform: 'uppercase' }}>
            {profile.display_name}
          </div>
          <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-40)' }}>
            @{profile.handle} · {profile.tier} · {profile.drops.toLocaleString()} DROPS
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'center' }}>
            <Link href="/deck" style={btnPrimary}>GO TO DECK</Link>
            <button onClick={() => void signOut()} style={btnGhost}>SIGN OUT</button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ font: '400 10px/1 var(--font-tele)', letterSpacing: '.24em', color: 'var(--neon-pink)' }}>
          {mode === 'in' ? 'WELCOME BACK' : 'NEW CHALLENGER'}
        </div>
        <h1
          style={{
            font: '400 clamp(40px,12vw,58px)/.9 var(--font-title)',
            textTransform: 'uppercase',
            margin: '12px 0 6px',
            background: 'linear-gradient(92deg,#fff 10%,#4ce3ff 48%,#ff2e88 88%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          AuxWars
        </h1>
        <p style={{ font: '400 13px/1.6 var(--font-body)', color: 'var(--ink-60)', margin: '0 0 22px' }}>
          Sign in to own your cards and keep your Drops. You can look around
          without an account.
        </p>

        {!isSupabaseConfigured && (
          <div style={warnBox}>
            NO BACKEND CONFIGURED — running on local data. Set
            NEXT_PUBLIC_SUPABASE_URL to enable accounts.
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {mode === 'up' && (
            <Field label="DISPLAY NAME" value={name} onChange={setName}
              placeholder="Rae K." autoComplete="name" />
          )}
          <Field label="EMAIL" value={email} onChange={setEmail} type="email"
            placeholder="you@example.com" autoComplete="email" required />
          <Field label="PASSWORD" value={password} onChange={setPassword} type="password"
            placeholder="••••••••" autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            required minLength={6} />

          {msg && (
            <div role="alert" style={{ font: '400 11px/1.5 var(--font-body)', color: 'var(--neon-gold)' }}>
              {msg}
            </div>
          )}

          <button type="submit" disabled={busy || !isSupabaseConfigured}
            style={{ ...btnPrimary, opacity: busy || !isSupabaseConfigured ? 0.5 : 1, marginTop: 4 }}>
            {busy ? 'WORKING…' : mode === 'in' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}
          style={{ ...btnGhost, width: '100%', marginTop: 10 }}
        >
          {mode === 'in' ? 'CREATE AN ACCOUNT' : 'I ALREADY HAVE ONE'}
        </button>

        <Link href="/deck" style={{ ...btnGhost, width: '100%', marginTop: 10, display: 'block', textAlign: 'center' }}>
          SKIP FOR NOW
        </Link>

        {isSupabaseConfigured && (
          <div style={{ font: '400 8px/1.7 var(--font-tele)', letterSpacing: '.1em',
                        color: 'var(--ink-25)', marginTop: 20, textAlign: 'center' }}>
            DEMO ACCOUNT · rae@auxwars.demo / auxwars-demo
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--stage-black)', display: 'grid',
                  placeItems: 'center', padding: '32px 20px' }}>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, ...rest
}: {
  label: string;
  value: string;
  /** Takes the string, not the event — `onChange` is omitted from the spread
      below so the native handler cannot collide with this one. */
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  const id = `f-${label.toLowerCase().replace(/\s/g, '-')}`;
  return (
    <div>
      <label htmlFor={id} style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em',
                                   color: 'var(--ink-40)', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '12px 13px', borderRadius: 9,
          background: 'var(--booth-panel)', border: '1px solid rgba(255,255,255,.14)',
          color: 'var(--ink)', font: '400 14px/1 var(--font-body)',
        }}
        {...rest}
      />
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '14px 20px', borderRadius: 10, background: 'var(--neon-pink)',
  color: '#0a0008', border: 'none', textDecoration: 'none',
  font: '700 10px/1 var(--font-tele)', letterSpacing: '.16em', cursor: 'pointer',
  textAlign: 'center',
};

const btnGhost: React.CSSProperties = {
  padding: '13px 20px', borderRadius: 10, background: 'transparent',
  border: '1px solid rgba(255,255,255,.16)', color: 'var(--ink-60)',
  textDecoration: 'none', font: '700 10px/1 var(--font-tele)',
  letterSpacing: '.16em', cursor: 'pointer',
};

const warnBox: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 8, marginBottom: 16,
  background: 'rgba(255,216,77,.08)', border: '1px solid rgba(255,216,77,.3)',
  font: '400 9px/1.6 var(--font-tele)', letterSpacing: '.1em', color: 'var(--neon-gold)',
};
