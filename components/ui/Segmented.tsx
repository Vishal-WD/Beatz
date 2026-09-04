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
      style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}
    >
      {options.map((o) => {
        const on = o === value;
        const accent = accentFor?.(o) ?? 'var(--ink)';
        return (
          <button
            key={o}
            type="button"
            data-ui="button"
            aria-pressed={on}
            onClick={() => onChange(o)}
            style={{
              padding: 'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${on ? accent : 'var(--hairline)'}`,
              background: on ? accent : 'transparent',
              color: on ? 'var(--ink-on-neon)' : accent,
              font: "700 8px/1 var(--font-tele)",
              letterSpacing: '.14em',
              cursor: 'pointer',
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
