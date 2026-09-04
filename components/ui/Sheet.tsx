'use client';

/**
 * A bottom sheet. Used by the create and join flows.
 *
 * Escape and backdrop both close. The body stops click propagation so a click
 * inside never reaches the backdrop handler.
 */

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Focus management: move focus into the dialog on open, trap Tab within
    // it while open, and restore focus to whatever had it beforehand on
    // close. Required because role="dialog" + aria-modal="true" is a promise
    // to assistive tech that focus is contained — without this, focus stays
    // on the trigger behind the backdrop and Tab walks into the inert page.
    const previouslyFocused =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

    dialogRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !dialog.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
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
        background: 'var(--scrim-modal)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
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
