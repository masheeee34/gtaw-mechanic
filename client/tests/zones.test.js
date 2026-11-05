import { describe, expect, it } from 'vitest';
import { distance, findGarage, flatDistance } from '../src/zones.js';

const garages = [
  { id: 'burton', center: [0, 0, 0], radius: 25 },
  { id: 'annex', center: [30, 0, 0], radius: 25 },
];

describe('distance', () => {
  it('is the 3D distance between two points', () => {
    expect(distance([0, 0, 0], [3, 4, 12])).toBe(13);
  });
});

describe('flatDistance', () => {
  it('ignores height, so a marker counts as reached from its ground ring', () => {
    expect(flatDistance([0, 0, 0], [3, 4, 50])).toBe(5);
  });
});

describe('findGarage', () => {
  it('returns the garage the position is in', () => {
    expect(findGarage([5, 5, 0], garages)?.id).toBe('burton');
  });

  it('includes the edge of the zone', () => {
    expect(findGarage([-25, 0, 0], garages)?.id).toBe('burton');
  });

  it('returns null outside every zone', () => {
    expect(findGarage([0, 100, 0], garages)).toBeNull();
  });

  it('ignores a position high above the garage', () => {
    expect(findGarage([0, 0, 40], garages)).toBeNull();
  });

  it('picks the closest center when zones overlap', () => {
    expect(findGarage([14, 0, 0], garages)?.id).toBe('burton');
    expect(findGarage([16, 0, 0], garages)?.id).toBe('annex');
  });
});
