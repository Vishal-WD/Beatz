'use client';

/**
 * The one button. Replaces eight different padding/radius combinations that
 * had drifted across the screens (measured 2026-08-31).
 *
 * `accent` overrides the fill color on `variant="primary"` only — this allows
 * rarity-coloured actions (e.g., a gold Epic pull, a pink Legendary) to reuse
 * this component instead of forking a ninth dialect.
 */

import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const PAD: Record<ButtonSize, string> = {
  sm: '6px 12px',
  md: '10px 18px',
  lg: '14px 24px',
};

const FONT: Record<ButtonSize, string> = {
  sm: '600 12px/1.2 var(--font-body)',
  md: '600 13px/1.2 var(--font-body)',
  lg: '600 15px/1.2 var(--font-body)',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  accent?: string;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  accent,
  style,
  type,
  children,
  ...rest
}: ButtonProps) {
  const fill = accent ?? 'var(--neon-pink)';

  const variantStyle =
    variant === 'primary'
      ? {
          background: fill,
          color: 'var(--ink-on-neon)',
          border: '1px solid transparent',
        }
      : variant === 'danger'
        ? {
            background: 'var(--surface-inset)',
            color: 'var(--neon-gold)',
            border: 'var(--border-strong)',
          }
        : variant === 'ghost'
          ? {
              background: 'transparent',
              color: 'var(--ink-60)',
              border: '1px solid transparent',
            }
          : {
              background: 'var(--surface-inset)',
              color: 'var(--ink)',
              border: 'var(--border-hair)',
            };

  return (
    <button
      // Defaults to "button": a bare <button> inside a form submits it, which
      // has caused accidental submits elsewhere in this codebase.
      type={type ?? 'button'}
      data-ui="button"
      style={{
        padding: PAD[size],
        font: FONT[size],
        letterSpacing: '-0.01em',
        width: block ? '100%' : undefined,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-2)',
        ...variantStyle,
        ...style,
        borderRadius: 'var(--radius-sm)',
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
