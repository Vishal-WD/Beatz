import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TabBar } from './PhoneChrome';

/*
  The active tab is conveyed visually by colour + a top border, which a
  screen reader can't see. aria-current="page" is the one signal that
  survives without sight -- this pins that exactly one tab carries it,
  matching the route, and that the rest carry none (not aria-current="false",
  which some screen readers announce -- worse than omitting it).
*/

vi.mock('next/navigation', () => ({
  usePathname: () => '/packs',
}));

describe('TabBar', () => {
  it('marks only the tab matching the current route as aria-current="page"', () => {
    render(<TabBar />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);

    const current = links.filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '/packs');

    for (const link of links) {
      if (link.getAttribute('href') !== '/packs') {
        expect(link.getAttribute('aria-current')).toBeNull();
      }
    }
  });
});
