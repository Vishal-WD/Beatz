'use client';

/**
 * Global error boundary.
 *
 * Inside the APK there is no URL bar and no refresh button — without this a
 * thrown render error white-screens the app and the only escape is a
 * force-quit. Give people a way back in.
 */

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[auxwars]', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--stage-black)',
        color: 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        textAlign: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          font: "400 10px/1 var(--font-tele)",
          letterSpacing: '.24em',
          color: 'var(--neon-pink)',
        }}
      >
        THE AUX CUT OUT
      </div>

      <h1
        style={{
          font: "400 clamp(36px,10vw,58px)/.92 var(--font-title)",
          textTransform: 'uppercase',
          margin: 0,
          maxWidth: 520,
        }}
      >
        Something broke mid-reign
      </h1>

      <p
        style={{
          font: "400 14px/1.6 var(--font-body)",
          color: 'var(--ink-60)',
          maxWidth: 380,
          margin: 0,
        }}
      >
        The room is still there. Try again — you keep your cards and your
        Drops.
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={reset}
          style={{
            padding: '14px 22px',
            borderRadius: 10,
            background: 'var(--neon-pink)',
            color: 'var(--ink-on-neon)',
            border: 'none',
            font: "700 10px/1 var(--font-tele)",
            letterSpacing: '.16em',
            cursor: 'pointer',
          }}
        >
          TRY AGAIN
        </button>
        <a
          href="/"
          style={{
            padding: '14px 22px',
            borderRadius: 10,
            border: 'var(--border-strong)',
            color: 'var(--ink-60)',
            textDecoration: 'none',
            font: "700 10px/1 var(--font-tele)",
            letterSpacing: '.16em',
          }}
        >
          BACK TO START
        </a>
      </div>

      {error.digest && (
        <div
          style={{
            marginTop: 18,
            font: "400 9px/1 var(--font-tele)",
            letterSpacing: '.1em',
            color: 'var(--ink-25)',
          }}
        >
          REF {error.digest}
        </div>
      )}
    </div>
  );
}
