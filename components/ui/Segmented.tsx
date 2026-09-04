'use client';

/**
 * The filter-pill row. Three hand-rolled copies of this existed before
 * (events, social, profile).
 *
 * role="group" + aria-pressed rather than a radiogroup: these are toggles that
 * act immediately, not a form value awaiting submission.
 */

export interface SegmentedProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  accentFor?: (v: T) => string | undefined;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accentFor,
  label,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 3,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--surface-inset)',
        border: 'var(--border-hair)',
        flexWrap: 'wrap',
      }}
    >
      {options.map((o) => {
        const on = o === value;
        const accent = accentFor?.(o) ?? 'var(--neon-pink)';
        return (
          <button
            key={o}
            type="button"
            data-ui="button"
            aria-pressed={on}
            onClick={() => onChange(o)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid transparent',
              background: on ? accent : 'transparent',
              color: on ? 'var(--ink-on-neon)' : 'var(--ink-60)',
              font: '600 12px/1.2 var(--font-body)',
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              transition: 'background 0.16s ease, color 0.16s ease',
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
