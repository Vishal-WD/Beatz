import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Sheet } from './Sheet';
import { EmptyState } from './EmptyState';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Create"><p>body</p></Sheet>);
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders its content when open', () => {
    render(<Sheet open onClose={() => {}} title="Create"><p>body</p></Sheet>);
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('is a labelled modal dialog', () => {
    render(<Sheet open onClose={() => {}} title="Create"><p>body</p></Sheet>);
    expect(screen.getByRole('dialog', { name: 'Create' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Create"><p>body</p></Sheet>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Create"><p>body</p></Sheet>);
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close when the sheet body is clicked', async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Create"><p>body</p></Sheet>);
    await userEvent.click(screen.getByText('body'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('renders title and hint', () => {
    render(<EmptyState title="NOTHING HERE YET" hint="RSVP to see it" />);
    expect(screen.getByText('NOTHING HERE YET')).toBeInTheDocument();
    expect(screen.getByText('RSVP to see it')).toBeInTheDocument();
  });
});
