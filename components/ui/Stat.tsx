'use client';

/**
 * A label over a large numeral. Four hand-rolled copies existed before
 * (profile stats, chart offers, deck drops, room vibe).
 */

export interface StatProps {
  label: string;
  value: string | number;
  accent?: string;
}

export function Stat({ label, value, accent = 'var(--ink)' }: StatProps) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div
        style={{
          font: "400 7px/1.4 var(--font-tele)",
          letterSpacing: '.12em',
          color: 'var(--ink-40)',
          // "\n" in a label renders as a line break — several stat labels are
          // two words stacked.
          whiteSpace: 'pre-line',
          minHeight: 20,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 'var(--sp-1)',
          font: "700 26px/1 var(--font-stat)",
          fontVariantNumeric: 'tabular-nums',
          color: accent,
        }}
      >
        {value}
      </div>
    </div>
  );
}
