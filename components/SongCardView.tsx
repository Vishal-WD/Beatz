'use client';

/**
 * The card renderer — one component for every card in the app.
 * Implements docs/CARD_ART_GENERATION.md §2–5.
 *
 * Rarity escalation: matte → static sheen → animated sheen → reactive holo.
 * Rarity is ALWAYS carried by a text tag as well as color: color alone would
 * be invisible to a colorblind player (§3).
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type { SongCard } from '@/types/cards';
import { RARITY } from '@/lib/rarity';
import { useTilt } from '@/lib/useTilt';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { w: number; h: number; title: number; stat: number }> = {
  sm: { w: 96, h: 134, title: 11, stat: 15 },
  md: { w: 150, h: 210, title: 15, stat: 22 },
  lg: { w: 232, h: 324, title: 22, stat: 34 },
};

interface Props {
  card: SongCard;
  size?: Size;
  showFlavor?: boolean;
  showSerial?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * Cover Art Archive serves several sizes. A 96px binder thumbnail does not
 * need the 500px file — 9 cards at ~80KB each was 717KB per profile open,
 * about 14 seconds on 3G.
 */
function thumbUrl(url: string, size: Size): string {
  if (size === 'lg') return url;
  const want = size === 'sm' ? '250' : '500';
  return url.replace(/(_thumb)?(\d{3})?\.jpg$/i, (m) =>
    m.includes('thumb') ? `_thumb${want}.jpg` : m,
  );
}

export function SongCardView({
  card,
  size = 'md',
  showFlavor = false,
  showSerial = false,
  onClick,
  style,
}: Props) {
  const r = RARITY[card.rarity];
  const s = SIZES[size];
  const ref = useRef<HTMLDivElement>(null);
  const [artError, setArtError] = useState(false);

  // Gyroscope where available, pointer everywhere else. Only Legendary cards
  // pay the sensor cost (CARD_ART_GENERATION.md §3).
  const isHolo = RARITY[card.rarity].effect === 'holo';
  const { tilt, needsPermission, requestPermission, onPointerMove, onPointerLeave } = useTilt(isHolo);

  const holoAngle = (tilt.x - 50) * 3.6;
  const rotY = tilt.active ? (tilt.x - 50) / 6 : 0;
  const rotX = tilt.active ? -(tilt.y - 50) / 8 : 0;

  return (
    <div
      ref={ref}
      onClick={() => {
        // iOS grants DeviceOrientation only from inside a real tap.
        if (needsPermission) void requestPermission();
        onClick?.();
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role={onClick ? 'button' : 'group'}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      /* Rarity, stats and language all read aloud — none of them are
         available to a screen reader from the visual treatment alone. */
      aria-label={`${card.title} by ${card.subtitle}. ${r.label}. Hype ${card.hype}, stamina ${card.stamina}.${
        card.language ? ` ${card.language}.` : ''
      }`}
      style={{
        width: s.w,
        height: s.h,
        padding: 2,
        borderRadius: 16,
        background: r.frame,
        position: 'relative',
        transform: `perspective(700px) rotateY(${rotY}deg) rotateX(${rotX}deg)`,
        transformStyle: 'preserve-3d',
        transition: tilt.active ? 'none' : 'transform .35s ease',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        boxShadow: 'var(--apple-card-shadow)',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 14,
          background: 'var(--booth-panel)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Artwork area — "COVER ART" placeholder when artworkUrl is null.
            Album art is rendered UNMODIFIED; never filtered or restyled. */}
        <div
          style={{
            flex: '1 1 52%',
            background: 'var(--art-slot)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {card.artworkUrl && !artError && (
            /* A real <img> rather than a CSS background so it can lazy-load
               and, crucially, report failure — a dead CAA link used to render
               an empty box indistinguishable from a design choice. */
            <img
              src={thumbUrl(card.artworkUrl, size)}
              alt={`Album art for ${card.title} by ${card.subtitle}`}
              loading="lazy"
              decoding="async"
              onError={() => setArtError(true)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}

          {(!card.artworkUrl || artError) && (
            <span
              style={{
                font: `400 ${size === 'sm' ? 7 : 9}px/1 var(--font-tele)`,
                letterSpacing: '.2em',
                color: 'var(--ink-25)',
              }}
            >
              COVER ART
            </span>
          )}

          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              font: `700 ${size === 'sm' ? 7 : 8}px/1 var(--font-tele)`,
              letterSpacing: '.12em',
              padding: '3px 5px',
              borderRadius: 4,
              background: r.badgeBg,
              color: r.badgeColor,
            }}
          >
            {size === 'sm' ? r.tag : r.label}
          </span>

          {showSerial && card.rarity === 'legendary' && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                font: '700 8px/1 var(--font-tele)',
                letterSpacing: '.1em',
                color: 'var(--neon-gold)',
                textShadow: '0 1px 4px var(--scrim)',
              }}
            >
              {card.serialNumber} OF {card.supplyTotal}
            </span>
          )}

          {/* Language tag — a mixed Tamil/Hindi/English pool needs to read
              at a glance which is which. */}
          {card.language && size !== 'sm' && (
            <span
              style={{
                position: 'absolute',
                bottom: 6,
                left: 6,
                font: '700 7px/1 var(--font-tele)',
                letterSpacing: '.14em',
                padding: '3px 5px',
                borderRadius: 3,
                background: 'var(--scrim)',
                color: 'var(--ink-60)',
              }}
            >
              {card.language.toUpperCase()}
            </span>
          )}
        </div>

        {/* Title block */}
        <div style={{ padding: size === 'sm' ? '5px 7px 3px' : '8px 10px 4px' }}>
          <div
            style={{
              font: `400 ${s.title}px/1.05 var(--font-title)`,
              textTransform: 'uppercase',
              letterSpacing: '.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              font: `500 ${size === 'sm' ? 7 : 9}px/1.3 var(--font-tele)`,
              letterSpacing: '.1em',
              color: 'var(--ink-40)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {card.subtitle}
          </div>
        </div>

        {/* Stats — Barlow Condensed for sport-card numerics */}
        <div
          style={{
            padding: size === 'sm' ? '0 7px 6px' : '0 10px 9px',
            display: 'flex',
            gap: size === 'sm' ? 8 : 12,
            marginTop: 'auto',
          }}
        >
          <Stat label="HYPE" value={card.hype} color={r.color} size={s.stat} compact={size === 'sm'} />
          <Stat label="STAMINA" value={card.stamina} color={r.color} size={s.stat} compact={size === 'sm'} />
        </div>

        {showFlavor && card.flavorText && (
          <div
            style={{
              padding: '0 10px 9px',
              font: 'italic 400 10px/1.35 var(--font-body)',
              color: 'var(--ink-40)',
            }}
          >
            &ldquo;{card.flavorText}&rdquo;
          </div>
        )}

        {/* Epic: animated sheen sweep */}
        {r.effect === 'sheen-animated' && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-40%',
                left: 0,
                width: '35%',
                height: '180%',
                background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)',
                animation: 'sheen 3.4s ease-in-out infinite',
              }}
            />
          </div>
        )}

        {/* Legendary: conic holo + specular band, color-dodge blended */}
        {isHolo && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              pointerEvents: 'none',
              mixBlendMode: 'color-dodge',
              opacity: tilt.active ? 0.62 : 0.4,
              transition: 'opacity .2s ease',
              background: `conic-gradient(from ${holoAngle}deg at ${tilt.x}% ${tilt.y}%,
                #ff2e88 0deg,#7b2bff 60deg,#4ce3ff 120deg,#7dffc3 180deg,#ffd84d 240deg,#ff2e88 360deg)`,
            }}
          />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  size,
  compact,
}: {
  label: string;
  value: number;
  color: string;
  size: number;
  compact: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          font: `400 ${compact ? 6 : 8}px/1 var(--font-tele)`,
          letterSpacing: '.14em',
          color: 'var(--ink-40)',
        }}
      >
        {label}
      </div>
      <div style={{ font: `700 ${size}px/1 var(--font-stat)`, color, marginTop: 1 }}>
        {value}
      </div>
      <div
        style={{
          height: 2,
          borderRadius: 2,
          background: 'var(--hairline)',
          marginTop: 3,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${value}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}
