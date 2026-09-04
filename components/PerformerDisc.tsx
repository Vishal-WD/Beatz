'use client';

/**
 * The performer's disc — spectator-format lead (Concert, Fest, Clubbing).
 *
 * A spectator room is a performance, not a duel: there is no throne to
 * take, so the top of the screen names who is performing instead of who
 * "holds". Spins slowly while something is playing, stands still when
 * paused or when a player prefers reduced motion.
 *
 * Rotation is a CSS `animation` (the `spin` keyframe in app/globals.css),
 * never a JS loop — cheaper, and it composes with the app-wide
 * `prefers-reduced-motion` rule in globals.css, which zeroes every
 * animation-duration. That rule is sufficient on its own; this component
 * does not duplicate a second reduced-motion check.
 */

interface Props {
  name: string;
  artworkUrl: string | null;
  spinning: boolean;
  onFollow: () => void;
  following: boolean;
}

const DISC_SIZE = 108;

export function PerformerDisc({ name, artworkUrl, spinning, onFollow, following }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '6px 0 2px' }}>
      <div
        style={{
          width: DISC_SIZE,
          height: DISC_SIZE,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '1px solid var(--hairline)',
          boxShadow: '0 0 0 1px var(--hairline)',
          // Plain token-coloured circle when there is no artwork, rather
          // than a broken <img> — a card can legitimately have null art.
          background: artworkUrl ? undefined : 'var(--art-slot)',
          display: 'grid',
          placeItems: 'center',
          animation: spinning ? 'spin 6s linear infinite' : 'none',
        }}
      >
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt={`${name} performing — cover art`}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em', color: 'var(--ink-25)' }}>
            ON STAGE
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: '400 9px/1 var(--font-tele)', letterSpacing: '.2em', color: 'var(--ink-40)' }}>
            PERFORMING
          </div>
          <div style={{ font: '400 18px/1 var(--font-title)', textTransform: 'uppercase', marginTop: 4 }}>
            {name}
          </div>
        </div>

        <button
          onClick={onFollow}
          aria-pressed={following}
          aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
          style={{
            padding: '7px 12px',
            borderRadius: 7,
            flexShrink: 0,
            background: following ? 'transparent' : 'var(--neon-cyan)',
            border: following ? 'var(--border-strong)' : '1px solid var(--neon-cyan)',
            color: following ? 'var(--ink-60)' : 'var(--ink-on-neon)',
            font: '700 8px/1 var(--font-tele)',
            letterSpacing: '.14em',
          }}
        >
          {following ? 'FOLLOWING' : 'FOLLOW'}
        </button>
      </div>
    </div>
  );
}
