'use client';

/**
 * The Drops mark.
 *
 * Drops were written as the bare word "DROPS" next to a number, so the
 * currency read as a label rather than as a thing you hold. A currency needs
 * a glyph you recognise before you read it.
 *
 * A droplet, in gold, with a highlight — gold because --neon-gold is already
 * the value colour everywhere else in the app (pack prices, the wheel's
 * jackpot), so the currency and the numbers that describe it agree.
 *
 * Inline SVG rather than an emoji: an emoji renders in the system font at a
 * different weight and colour from everything around it, and cannot take
 * currentColor or a gradient.
 */

export function DropsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, display: 'block' }}
    >
      <defs>
        {/* Unique per size so two icons on one screen cannot share a gradient
            id and inherit each other's stops. */}
        <linearGradient id={`drop-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe89a" />
          <stop offset="55%" stopColor="var(--neon-gold)" />
          <stop offset="100%" stopColor="#c8940a" />
        </linearGradient>
      </defs>
      {/* The droplet: a point at the top opening into a round bowl. */}
      <path
        d="M12 2.5c0 0 6.6 7.1 6.6 11.3A6.6 6.6 0 0 1 12 20.4a6.6 6.6 0 0 1-6.6-6.6C5.4 9.6 12 2.5 12 2.5Z"
        fill={`url(#drop-${size})`}
      />
      {/* A single specular highlight, so it reads as liquid rather than as a
          flat teardrop shape. */}
      <ellipse cx="9.6" cy="14.2" rx="1.5" ry="2.2" fill="#fffbe8" opacity="0.55" />
    </svg>
  );
}

/**
 * A Drops amount with its mark. Use this anywhere a balance or a price is
 * shown, so the currency looks the same everywhere.
 */
export function DropsAmount({
  value,
  size = 14,
  tone = 'var(--neon-gold)',
  weight = 700,
}: {
  value: number | string;
  size?: number;
  tone?: string;
  weight?: number;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <DropsIcon size={size} />
      <span style={{ font: `${weight} ${size}px/1 var(--font-stat)`, color: tone }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </span>
  );
}
