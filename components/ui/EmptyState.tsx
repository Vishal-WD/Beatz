'use client';

/** Consistent "nothing here" treatment. Three ad-hoc variants existed before. */

import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  hint?: string;
  action?: ReactNode;
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--sp-7) var(--sp-4)' }}>
      <div
        style={{
          font: "400 10px/1.6 var(--font-tele)",
          letterSpacing: '.16em',
          color: 'var(--ink-25)',
        }}
      >
        {title}
      </div>
      {hint && (
        <div
          style={{
            marginTop: 'var(--sp-2)',
            font: "400 11px/1.6 var(--font-body)",
            color: 'var(--ink-40)',
          }}
        >
          {hint}
        </div>
      )}
      {action && <div style={{ marginTop: 'var(--sp-4)' }}>{action}</div>}
    </div>
  );
}
