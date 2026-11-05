import { describe, expect, it } from 'vitest';
import { wheelSlot } from '../src/wheels.js';

describe('wheelSlot', () => {
  it('numbers the wheels of a car front left to rear right', () => {
    const car = [0, 1, 4, 5];
    expect([0, 1, 4, 5].map((tyre) => wheelSlot(tyre, car, 4))).toEqual([0, 1, 2, 3]);
  });

  it('numbers the two wheels of a bike', () => {
    expect(wheelSlot(4, [0, 4], 2)).toBe(1);
  });

  it('keeps the tyre order on a 6-wheeler', () => {
    expect(wheelSlot(5, [0, 1, 4, 5], 6)).toBe(5);
  });

  it('has no slot for a wheel the model lacks', () => {
    expect(wheelSlot(1, [0, 4], 2)).toBeNull();
  });
});
