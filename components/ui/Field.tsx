'use client';

/**
 * A labelled text input.
 *
 * onChange takes the string rather than the event, and `onChange`/`value` are
 * omitted from the spread props so the native handler cannot collide with it —
 * that collision was a real TypeScript error in the sign-in screen.
 */

import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function Field({ label, value, onChange, ...rest }: FieldProps) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          marginBottom: 'var(--sp-2)',
          font: "400 8px/1 var(--font-tele)",
          letterSpacing: '.18em',
          color: 'var(--ink-40)',
        }}
      >
        {label}
      </label>
      <input
        id={id}
        data-ui="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
        style={{
          width: '100%',
          padding: 'var(--sp-3)',
          background: 'var(--booth-panel)',
          border: 'var(--border-strong)',
          color: 'var(--ink)',
          font: "400 14px/1 var(--font-body)",
          // Guard: re-assert borderRadius after spread to prevent caller overrides
          borderRadius: 'var(--radius-sm)',
        }}
      />
    </div>
  );
}
