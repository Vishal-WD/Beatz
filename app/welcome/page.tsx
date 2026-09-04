'use client';

/**
 * Screen 00 — Welcome / first-run onboarding.
 *
 * Greet → Open → Done, one screen, three stages. A brand-new signup drops
 * the 21-card starter pack into card_ownership atomically, server-side,
 * before this screen ever renders — the "TEAR IT OPEN" moment here only
 * REVEALS those cards via useOwnedCards. It never grants anything: calling
 * a pack-opening or grant function here would double the 21 cards.
 *
 * isLoading is checked before anything else so a returning player (whose
 * onboarded_at is already set) never flashes this screen on the way to
 * /deck -- the same class of bug as the sign-in flash.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SongCardView } from '@/components/SongCardView';
import { useAuth } from '@/lib/useAuth';
import { useOwnedCards } from '@/lib/useOwnedCards';
import { useOnboarding } from '@/lib/useOnboarding';
import { useSound } from '@/lib/useSound';
import { useHaptics } from '@/lib/useHaptics';

type Stage = 'greet' | 'open' | 'done';

// How long to show the spinner before offering an escape. The grant is
// server-side and already committed by the time this screen loads, so this
// is not "give up and assume failure" -- it's "stop leaving the player with
// nothing to do while we wait."
const STARTER_PACK_TIMEOUT_MS = 10_000;

export default function WelcomeScreen() {
  const router = useRouter();
  const { isLoading, isSignedIn, profile } = useAuth();
  const { cards, owned, refetch } = useOwnedCards();
  const { finish } = useOnboarding();
  const { play } = useSound();
  const haptic = useHaptics();

  const [stage, setStage] = useState<Stage>('greet');
  const [revealed, setRevealed] = useState(0);
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  /*
    A returning player (onboarded_at already set) landed here by a guessed
    redirect -- forward them on rather than showing the starter pack again.

    Derived from THIS component's own useAuth()/profile, not from
    useOnboarding()'s needsWelcome: useOnboarding() calls useAuth()
    internally, which is a second, independent hook instance with its own
    getSession()/onAuthStateChange subscription. The two instances can
    resolve on different render passes, and cross-checking one against the
    other produced a false "already onboarded" for one tick right after a
    fresh signup -- sending a brand-new player straight to /deck before
    they ever saw the welcome screen.
  */
  const alreadyOnboarded =
    !isLoading && isSignedIn && profile.onboarded_at != null && stage === 'greet';

  // Redirects must happen in an effect, not during render: calling
  // router.replace() while WelcomeScreen itself is rendering produces
  // "Cannot update a component while rendering a different component"
  // and the navigation races with this component's own render.
  useEffect(() => {
    if (isLoading) return;
    if (!isSignedIn) {
      router.replace('/signin');
    } else if (alreadyOnboarded) {
      router.replace('/deck');
    }
  }, [isLoading, isSignedIn, alreadyOnboarded, router]);

  const openPack = useCallback(() => {
    play('packTear');
    haptic('medium');
    setRevealed(0);
    setWaitedTooLong(false);
    setStage('open');
  }, [play, haptic]);

  // The starter-pack grant is server-side and already committed before this
  // screen ever renders -- but replica lag (or a genuinely failed grant)
  // can leave `owned` false for a while. Rather than spin forever, give the
  // player an honest way out after a reasonable wait.
  useEffect(() => {
    if (stage !== 'open' || owned) {
      setWaitedTooLong(false);
      return;
    }
    const timer = setTimeout(() => setWaitedTooLong(true), STARTER_PACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [stage, owned]);

  const retry = useCallback(() => {
    setWaitedTooLong(false);
    refetch();
  }, [refetch]);

  const advanceCard = useCallback(() => {
    setRevealed((r) => {
      const next = r + 1;
      if (next >= cards.length) {
        play('legendary');
        haptic('success');
        setStage('done');
        void finish();
        return r;
      }
      play('tap');
      haptic('light');
      return next;
    });
  }, [cards.length, play, haptic, finish]);

  const hero = useMemo(() => cards[Math.min(revealed, cards.length - 1)] ?? null, [cards, revealed]);

  if (isLoading || !isSignedIn || alreadyOnboarded) {
    return <Shell><Loading /></Shell>;
  }

  if (stage === 'greet') {
    return (
      <Shell>
        <div style={{ font: '400 10px/1 var(--font-tele)', letterSpacing: '.24em', color: 'var(--neon-pink)' }}>
          WELCOME TO BEATZ
        </div>
        <h1
          style={{
            font: '400 clamp(34px,10vw,52px)/.95 var(--font-title)',
            textTransform: 'uppercase',
            margin: '14px 0 10px',
          }}
        >
          {profile.display_name}
        </h1>
        <p style={{ font: '400 14px/1.6 var(--font-body)', color: 'var(--ink-60)', maxWidth: 320, margin: '0 0 28px' }}>
          Every song is a collectible card. Play one onto the deck and the
          room&rsquo;s live reaction — the Vibe Bar — decides how it goes.
          You&rsquo;ve already been granted a starter pack.
        </p>
        <button onClick={openPack} style={btnPrimary}>
          TEAR IT OPEN
        </button>
      </Shell>
    );
  }

  if (stage === 'open') {
    // The grant is server-side and already committed. If the collection
    // hasn't loaded yet, that's a loading state, not "nothing was granted".
    if (!owned) {
      if (waitedTooLong) {
        return (
          <Shell>
            <div style={{ font: '400 10px/1 var(--font-tele)', letterSpacing: '.24em', color: 'var(--neon-gold)' }}>
              STILL ON THE WAY
            </div>
            <p style={{ font: '400 14px/1.6 var(--font-body)', color: 'var(--ink-60)', maxWidth: 300, margin: '18px 0 28px' }}>
              Your starter pack hasn&rsquo;t arrived yet. It&rsquo;s already
              been granted on our end — this is just taking longer than
              usual to show up.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={retry} style={btnPrimary}>RETRY</button>
              <Link href="/deck" style={btnGhost}>GO TO DECK</Link>
            </div>
          </Shell>
        );
      }

      return (
        <Shell>
          <Loading label="OPENING…" />
        </Shell>
      );
    }

    return (
      <Shell>
        <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.24em', color: 'var(--neon-pink)', marginBottom: 20 }}>
          STARTER PACK
        </div>
        <div
          onClick={advanceCard}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advanceCard(); } }}
          aria-label={`Card ${Math.min(revealed + 1, cards.length)} of ${cards.length}. Tap for the next card.`}
          style={{ cursor: 'pointer' }}
        >
          {hero ? (
            <SongCardView card={hero} size="lg" showSerial showFlavor />
          ) : (
            <Loading label="OPENING…" />
          )}
        </div>
        <div
          style={{
            marginTop: 22,
            font: '700 10px/1 var(--font-tele)',
            letterSpacing: '.2em',
            color: 'var(--ink-40)',
            textAlign: 'center',
          }}
        >
          TAP FOR THE NEXT CARD
          <div style={{ font: '400 8px/1 var(--font-tele)', color: 'var(--ink-25)', marginTop: 8 }}>
            CARD {Math.min(revealed + 1, cards.length)} OF {cards.length}
          </div>
        </div>
      </Shell>
    );
  }

  // stage === 'done'
  return (
    <Shell>
      <div style={{ font: '400 10px/1 var(--font-tele)', letterSpacing: '.24em', color: 'var(--neon-mint)' }}>
        YOU&rsquo;RE IN
      </div>
      <div
        style={{
          font: '400 clamp(44px,14vw,64px)/.9 var(--font-title)',
          margin: '14px 0 4px',
          color: 'var(--neon-gold)',
        }}
      >
        {profile.drops.toLocaleString()}
      </div>
      <div style={{ font: '400 10px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)', marginBottom: 30 }}>
        DROPS
      </div>
      <p style={{ font: '400 13px/1.6 var(--font-body)', color: 'var(--ink-60)', maxWidth: 300, margin: '0 0 28px' }}>
        {cards.length} cards are in your deck. Play one to start a
        reign, or spend Drops on another pack.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <Link href="/deck" style={btnPrimary}>GO TO DECK</Link>
        <Link href="/packs" style={btnGhost}>SHOP</Link>
      </div>
    </Shell>
  );
}

function Loading({ label = 'LOADING…' }: { label?: string }) {
  return (
    <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.16em', color: 'var(--ink-25)' }}>
      {label}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--stage-black)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px 20px',
        color: 'var(--ink)',
      }}
    >
      {children}
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '14px 24px',
  borderRadius: 10,
  background: 'var(--neon-pink)',
  color: 'var(--ink-on-neon)',
  border: 'none',
  textDecoration: 'none',
  font: '700 10px/1 var(--font-tele)',
  letterSpacing: '.16em',
  cursor: 'pointer',
  textAlign: 'center',
};

const btnGhost: React.CSSProperties = {
  padding: '13px 22px',
  borderRadius: 10,
  background: 'transparent',
  border: 'var(--border-strong)',
  color: 'var(--ink-60)',
  textDecoration: 'none',
  font: '700 10px/1 var(--font-tele)',
  letterSpacing: '.16em',
  cursor: 'pointer',
  textAlign: 'center',
};
