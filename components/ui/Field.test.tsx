import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Field } from './Field';
import { Segmented } from './Segmented';
import { Stat } from './Stat';

describe('Field', () => {
  it('associates its label with the input', () => {
    render(<Field label="EMAIL" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('EMAIL')).toBeInTheDocument();
  });

  it('reports the typed string, not the event', async () => {
    const onChange = vi.fn();
    render(<Field label="EMAIL" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('EMAIL'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

describe('Segmented', () => {
  const OPTS = ['ALL', 'LIVE', 'GOING'] as const;

  it('renders every option as a button', () => {
    render(<Segmented label="Filter" options={OPTS} value="ALL" onChange={() => {}} />);
    for (const o of OPTS) {
      expect(screen.getByRole('button', { name: o })).toBeInTheDocument();
    }
  });

  it('marks the selected option with aria-pressed', () => {
    render(<Segmented label="Filter" options={OPTS} value="LIVE" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'LIVE' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ALL' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the chosen option', async () => {
    const onChange = vi.fn();
    render(<Segmented label="Filter" options={OPTS} value="ALL" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'GOING' }));
    expect(onChange).toHaveBeenCalledWith('GOING');
  });

  it('names the group for assistive tech', () => {
    render(<Segmented label="Filter" options={OPTS} value="ALL" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Filter' })).toBeInTheDocument();
  });
});

describe('Stat', () => {
  it('renders label and value', () => {
    render(<Stat label="PEAK VIBE" value={99} />);
    expect(screen.getByText('PEAK VIBE')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('uses tabular numerals so columns of digits line up', () => {
    render(<Stat label="DROPS" value={1284} />);
    const el = screen.getByText('1284') as HTMLElement;
    expect(el.style.fontVariantNumeric).toBe('tabular-nums');
  });
});
