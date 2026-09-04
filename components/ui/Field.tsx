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
          marginBottom: 6,
          font: '600 11px/1.2 var(--font-body)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
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
          padding: '12px 14px',
          background: 'var(--surface-inset)',
          border: 'var(--border-strong)',
          color: 'var(--ink)',
          font: '400 15px/1.3 var(--font-body)',
          borderRadius: 'var(--radius-md)',
          outline: 'none',
          transition: 'border-color 0.16s ease',
        }}
      />
    </div>
  );
}
