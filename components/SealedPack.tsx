'use client';

/**
 * The sealed Aux Pack — Screen 04's pack-opening illustration.
 *
 * The violet gradient wrapper, the gold spotlight bloom, and the foil
 * wordmark are artwork, not theming (docs/CARD_ART_GENERATION.md): they are
 * the pack's identity and must render the same regardless of theme, the way
 * a card's rarity frame does. Extracted out of app/packs/page.tsx so the
 * screen layer can stay literal-free without flattening this into a surface
 * token it was never meant to be.
 */

const TORN_CLIP =
  'polygon(0 14%,9% 10%,20% 15%,32% 9%,45% 15%,58% 9%,70% 15%,82% 10%,92% 15%,100% 11%,100% 100%,0 100%)';

interface Props {
  /** Spotlight bloom behind the reveal — shown once the card starts settling. */
  spotlight: boolean;
  /** The box itself — hidden once the pulled card has fully taken over. */
  visible: boolean;
  /** Tearing-open clip path, applied once the tap sequence advances past stage 0. */
  torn: boolean;
  cost: number;
}

export function SealedPack({ spotlight, visible, torn, cost }: Props) {
  return (
    <>
      {spotlight && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '38%',
            width: 460,
            height: 460,
            transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle,rgba(255,216,77,.22),transparent 65%)',
            animation: 'spotgrow .7s ease-out forwards',
            pointerEvents: 'none',
          }}
        />
      )}

      {visible && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 90,
            transform: 'translateX(-50%)',
            width: 176,
            height: 244,
            borderRadius: 14,
            background: 'linear-gradient(150deg,#1b1130,#3b1050 55%,#12081f)',
            border: '1px solid rgba(255,255,255,.14)',
            clipPath: torn ? TORN_CLIP : undefined,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'clip-path .4s ease',
            zIndex: 5,
          }}
        >
          <span
            style={{
              font: '400 34px/0.92 var(--font-title)',
              textTransform: 'uppercase',
              textAlign: 'center',
              background: 'linear-gradient(92deg,#fff,#ffd84d)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Aux
            <br />
            Pack
          </span>
          <span style={{ font: '400 8px/1 var(--font-tele)', letterSpacing: '.18em', color: 'var(--ink-40)' }}>
            {cost} DROPS · 5 CARDS
          </span>
        </div>
      )}
    </>
  );
}
