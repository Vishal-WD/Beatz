import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Panel } from './Panel';
import { Badge } from './Badge';

describe('Panel', () => {
  it('renders its children', () => {
    render(<Panel><span>Challenger line</span></Panel>);
    expect(screen.getByText('Challenger line')).toBeInTheDocument();
  });

  it('carries registration marks by default', () => {
    const { container } = render(<Panel>x</Panel>);
    expect(container.querySelectorAll('[data-mark]')).toHaveLength(4);
  });

  it('supports a padding scale', () => {
    const { container } = render(<Panel pad="none">x</Panel>);
    const inner = container.querySelector('[data-ui="panel-body"]') as HTMLElement;
    expect(inner.style.padding).toBe('0px');
  });
});

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>LIVE</Badge>);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('uses square corners', () => {
    render(<Badge>LIVE</Badge>);
    expect((screen.getByText('LIVE') as HTMLElement).style.borderRadius)
      .toBe('var(--radius-sm)');
  });

  it('takes an accent override so rarity tags reuse it', () => {
    render(<Badge accent="#ff8ac4">LGND</Badge>);
    expect((screen.getByText('LGND') as HTMLElement).style.color)
      .toBe('rgb(255, 138, 196)');
  });
});
