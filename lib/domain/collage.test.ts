import { describe, it, expect } from 'vitest';
import { collageFor } from './collage';

describe('collageFor', () => {
  // A tile is a 2x2 mosaic. Fewer than four images is the normal case for
  // a new event, and must not render as a broken grid.
  it('returns four cells when there are four or more images', () => {
    expect(collageFor(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('repeats what it has to fill four cells', () => {
    expect(collageFor(['a', 'b'])).toEqual(['a', 'b', 'a', 'b']);
    expect(collageFor(['a'])).toEqual(['a', 'a', 'a', 'a']);
  });

  it('returns an empty array for no images, so the caller can fall back', () => {
    expect(collageFor([])).toEqual([]);
  });

  it('ignores empty strings rather than rendering a broken image', () => {
    expect(collageFor(['a', '', 'b', ''])).toEqual(['a', 'b', 'a', 'b']);
  });

  it('does not mutate the caller’s array', () => {
    const src = ['a', 'b', 'c', 'd', 'e'];
    collageFor(src);
    expect(src).toHaveLength(5);
  });
});
