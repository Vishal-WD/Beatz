'use client';

/**
 * A framed surface. Panels are the one place the Industry "line drawing" rule
 * relaxes to a fill: they sit above the stage-black ground and need to read as
 * a distinct plane.
 */

import type { CSSProperties, ReactNode } from 'react';
import { Frame } from './Frame';

const PAD = {
  none: '0px',
  sm: 'var(--sp-2)',
  md: 'var(--sp-4)',
  lg: 'var(--sp-6)',
} as const;

export interface PanelProps {
  children: ReactNode;
  marks?: boolean;
  filled?: boolean;
  pad?: keyof typeof PAD;
  style?: CSSProperties;
}

export function Panel({
  children,
  marks = true,
  filled = true,
  pad = 'md',
  style,
}: PanelProps) {
  return (
    <Frame marks={marks} filled={filled} style={style}>
      <div data-ui="panel-body" style={{ padding: PAD[pad] }}>
        {children}
      </div>
    </Frame>
  );
}
