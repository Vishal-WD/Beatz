import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Frame } from './Frame';

describe('Frame', () => {
  it('renders its children', () => {
    render(<Frame><span>Naatu Naatu</span></Frame>);
    expect(screen.getByText('Naatu Naatu')).toBeInTheDocument();
  });

  it('draws four registration marks by default', () => {
    const { container } = render(<Frame>x</Frame>);
    expect(container.querySelectorAll('[data-mark]')).toHaveLength(4);
  });

  it('omits the marks when marks={false}', () => {
    const { container } = render(<Frame marks={false}>x</Frame>);
    expect(container.querySelectorAll('[data-mark]')).toHaveLength(0);
  });

  it('marks are decorative, so they are hidden from assistive tech', () => {
    const { container } = render(<Frame>x</Frame>);
    for (const m of container.querySelectorAll('[data-mark]')) {
      expect(m).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('is transparent by default and filled only on request', () => {
    const { container, rerender } = render(<Frame>x</Frame>);
    const el = () => container.firstElementChild as HTMLElement;
    expect(el().style.background).toBe('transparent');
    rerender(<Frame filled>x</Frame>);
    expect(el().style.background).not.toBe('transparent');
  });

  it('protects square corners even when caller passes borderRadius', () => {
    const { container } = render(<Frame style={{ borderRadius: '999px' }}>x</Frame>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.borderRadius).toBe('var(--radius-none)');
  });
});
