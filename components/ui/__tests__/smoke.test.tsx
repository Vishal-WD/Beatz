import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('test infrastructure', () => {
  it('renders a React element and finds it by role', () => {
    render(<button type="button">Play</button>);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});
