import { describe, it, expect } from 'vitest';
import * as ui from './index';

describe('ui barrel', () => {
  it('exports all eight primitives plus Frame', () => {
    for (const name of [
      'Frame', 'Button', 'Panel', 'Badge',
      'Field', 'Segmented', 'Stat', 'Sheet', 'EmptyState',
    ]) {
      expect(ui).toHaveProperty(name);
      expect(typeof (ui as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
