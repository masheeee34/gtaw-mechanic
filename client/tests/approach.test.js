import { describe, expect, it } from 'vitest';
import { approachPoint } from '../src/approach.js';

// Rough bounding box of a sedan: 2 m wide, 4.6 m long.
const sedan = { min: { x: -1.0, y: -2.3 }, max: { x: 1.0, y: 2.3 } };

describe('approachPoint', () => {
  it('stands in front of the hood for the engine and faces it', () => {
    const { stand, face } = approachPoint('engine', sedan, null);

    expect(stand.x).toBe(0);
    expect(stand.y).toBeGreaterThan(sedan.max.y);
    expect(face.y).toBeLessThan(stand.y);
  });

  it('stands outside the wheel, on the side the wheel is on', () => {
    const left = approachPoint('tire', sedan, { x: -0.8, y: 1.4 });
    const right = approachPoint('tire', sedan, { x: 0.8, y: -1.4 });

    expect(left.stand.x).toBeLessThan(sedan.min.x);
    expect(left.stand.y).toBe(1.4);
    expect(left.face).toEqual({ x: -0.8, y: 1.4 });
    expect(right.stand.x).toBeGreaterThan(sedan.max.x);
  });

  it('falls back to the rear left side for a fuel tank without a fuel cap bone', () => {
    const { stand } = approachPoint('fuel_tank', sedan, null);

    expect(stand.x).toBeLessThan(sedan.min.x);
    expect(stand.y).toBeLessThan(0);
  });

  it('works on the bodywork from the driver side, facing the middle of the car', () => {
    expect(approachPoint('body', sedan, null)).toEqual({ stand: { x: -1.8, y: 0 }, face: { x: 0, y: 0 } });
  });
});
