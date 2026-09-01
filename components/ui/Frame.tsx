'use client';

/**
 * The wireframe frame every card, panel and figure wears.
 *
 * Square corners and four "+" registration marks are the Industry grammar's
 * signature (spec §7.1). Objects are drawn rather than filled: `filled` is
 * opt-in, for the few surfaces that need to sit above the ground.
 */

import type { CSSProperties, ReactNode } from 'react';

const CORNERS = [
  { key: 'tl', style: { top: -1, left: -1 } },
  { key: 'tr', style: { top: -1, right: -1 } },
  { key: 'bl', style: { bottom: -1, left: -1 } },
  { key: 'br', style: { bottom: -1, right: -1 } },
] as const;

export interface FrameProps {
  children: ReactNode;
  marks?: boolean;
  accent?: string;
  filled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Frame({
  children,
  marks = true,
  accent = 'var(--ink-25)',
  filled = false,
  className,
  style,
}: FrameProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        border: 'var(--border-hair)',
        background: filled ? 'var(--booth-panel)' : 'transparent',
        ...style,
        // `border` and `position` above are intentionally caller-overridable
        // via `...style` — only borderRadius is re-asserted after the spread.
        // Square corners are a hard global constraint (spec §7.1); re-assert
        // borderRadius last so callers cannot break this invariant.
        borderRadius: 'var(--radius-none)',
      }}
    >
      {children}
      {marks &&
        CORNERS.map((c) => (
          <i
            key={c.key}
            data-mark={c.key}
            aria-hidden="true"
            style={{
              position: 'absolute',
              width: 'var(--mark-size)',
              height: 'var(--mark-size)',
              pointerEvents: 'none',
              // The "+" is drawn with two gradients rather than glyphs, so it
              // stays crisp at any size and needs no font.
              backgroundImage: `
                linear-gradient(${accent}, ${accent}),
                linear-gradient(${accent}, ${accent})`,
              backgroundSize: '100% 1px, 1px 100%',
              backgroundPosition: 'center center, center center',
              backgroundRepeat: 'no-repeat',
              ...c.style,
            }}
          />
        ))}
    </div>
  );
}
