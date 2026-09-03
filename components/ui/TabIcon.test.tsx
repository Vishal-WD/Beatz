import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TabIcon } from './TabIcon';

describe('TabIcon', () => {
  it('renders an svg for every tab name', () => {
    for (const n of ['room', 'feed', 'shop', 'chart', 'you'] as const) {
      const { container, unmount } = render(<TabIcon name={n} active={false} />);
      expect(container.querySelector('svg'), `no svg for ${n}`).toBeTruthy();
      unmount();
    }
  });

  it('marks the icon decorative — the label carries the name', () => {
    const { container } = render(<TabIcon name="room" active={false} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('uses currentColor so the tab controls its own colour', () => {
    const { container } = render(<TabIcon name="room" active />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('stroke') ?? svg.getAttribute('fill')).toBe('currentColor');
  });
});
