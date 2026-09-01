import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label as an accessible button', () => {
    render(<Button>Place offer</Button>);
    expect(screen.getByRole('button', { name: 'Place offer' })).toBeInTheDocument();
  });

  it('calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Join</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Join</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('uses square corners (Industry grammar, spec 7.1)', () => {
    render(<Button>Join</Button>);
    const el = screen.getByRole('button');
    expect(el.style.borderRadius).toBe('var(--radius-sm)');
  });

  it('defaults to type="button" so it cannot submit a form by accident', () => {
    render(<Button>Join</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('honours an explicit type', () => {
    render(<Button type="submit">Sign in</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('takes an accent override for rarity-coloured actions', () => {
    render(<Button variant="primary" accent="#ffd84d">Pull</Button>);
    expect(screen.getByRole('button').style.background).toBe('rgb(255, 216, 77)');
  });
});
