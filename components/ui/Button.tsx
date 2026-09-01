'use client';

/**
 * The one button. Replaces eight different padding/radius combinations that
 * had drifted across the screens (measured 2026-08-31).
 *
 * `accent` exists so a rarity-coloured action (a gold Epic pull, a pink
 * Legendary) reuses this component instead of forking a ninth dialect.
 */

import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const PAD: Record<ButtonSize, string> = {
  sm: 'var(--sp-2) var(--sp-3)',
  md: 'var(--sp-3) var(--sp-4)',
  lg: 'var(--sp-4) var(--sp-5)',
};

const FONT: Record<ButtonSize, string> = {
  sm: "700 8px/1 var(--font-tele)",
  md: "700 10px/1 var(--font-tele)",
  lg: "700 11px/1 var(--font-tele)",
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
      ? { background: fill, color: '#0a0008', border: '1px solid transparent' }
      : variant === 'danger'
        ? { background: 'transparent', color: 'var(--neon-gold)', border: 'var(--border-strong)' }
        : variant === 'ghost'
          ? { background: 'transparent', color: 'var(--ink-60)', border: '1px solid transparent' }
          : { background: 'transparent', color: 'var(--ink-60)', border: 'var(--border-strong)' };

  return (
    <button
      // Defaults to "button": a bare <button> inside a form submits it, which
      // has caused accidental submits elsewhere in this codebase.
      type={type ?? 'button'}
      data-ui="button"
      style={{
        padding: PAD[size],
        font: FONT[size],
        letterSpacing: '.16em',
        borderRadius: 'var(--radius-sm)',
        width: block ? '100%' : undefined,
        cursor: 'pointer',
        transition: 'background .18s ease, border-color .18s ease, opacity .18s ease',
        ...variantStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
