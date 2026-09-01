'use client';

/**
 * A bottom sheet. Used by the create and join flows.
 *
 * Escape and backdrop both close. The body stops click propagation so a click
 * inside never reaches the backdrop handler.
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="sheet-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,.66)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '86dvh',
          overflowY: 'auto',
          background: 'var(--booth-panel)',
          borderTop: 'var(--border-strong)',
          borderRadius: 'var(--radius-none)',
          padding: 'var(--sp-5)',
          paddingBottom: 'calc(var(--sp-5) + var(--safe-bottom))',
        }}
      >
        <div
          style={{
            font: "400 20px/1 var(--font-heading)",
            textTransform: 'uppercase',
            letterSpacing: '.02em',
            marginBottom: 'var(--sp-4)',
          }}
        >
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
