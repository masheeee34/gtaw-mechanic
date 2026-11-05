import { describe, expect, it } from 'vitest';
import { MAX_DIRT, dirtier } from '../src/grime.js';

describe('dirtier', () => {
  it('gets dirtier with each repair, up to the maximum', () => {
    expect(dirtier(0)).toBe(1);
    expect(dirtier(MAX_DIRT)).toBe(MAX_DIRT);
  });

  it('starts from clean when the level is missing', () => {
    expect(dirtier(undefined)).toBe(1);
  });
});
