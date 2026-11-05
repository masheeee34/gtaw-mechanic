import { describe, expect, it } from 'vitest';
import { createZone, isHit, needlePosition, roundSettings } from './skillCheckRules';

describe('needlePosition', () => {
  it('sweeps to the right edge, then bounces back', () => {
    expect(needlePosition(0, 1)).toBe(0);
    expect(needlePosition(500, 1)).toBe(0.5);
    expect(needlePosition(1000, 1)).toBe(1);
    expect(needlePosition(1500, 1)).toBe(0.5);
    expect(needlePosition(2000, 1)).toBe(0);
  });

  it('goes faster with a higher speed', () => {
    expect(needlePosition(250, 2)).toBe(0.5);
  });
});

describe('createZone', () => {
  it('keeps the zone away from both edges', () => {
    expect(createZone(0.2, () => 0)).toEqual({ start: 0.12, end: expect.closeTo(0.32) });
    expect(createZone(0.2, () => 1).end).toBeCloseTo(0.88);
  });

  it('never makes a zone smaller than the minimum', () => {
    const zone = createZone(0.001, () => 0.5);

    expect(zone.end - zone.start).toBeCloseTo(0.06);
  });
});

describe('isHit', () => {
  it('counts both edges of the zone as a hit', () => {
    const zone = { start: 0.4, end: 0.5 };

    expect(isHit(0.4, zone)).toBe(true);
    expect(isHit(0.5, zone)).toBe(true);
    expect(isHit(0.39, zone)).toBe(false);
    expect(isHit(0.51, zone)).toBe(false);
  });
});

describe('roundSettings', () => {
  it('keeps the first round as configured', () => {
    expect(roundSettings({ zoneSize: 0.2, speed: 1 }, 0)).toEqual({ zoneSize: 0.2, speed: 1 });
  });

  it('shrinks the zone and speeds up the needle each round', () => {
    const third = roundSettings({ zoneSize: 0.2, speed: 1 }, 2);

    expect(third.zoneSize).toBeCloseTo(0.152);
    expect(third.speed).toBeCloseTo(1.3);
  });

  it('never shrinks the zone below the minimum', () => {
    expect(roundSettings({ zoneSize: 0.1, speed: 1 }, 10).zoneSize).toBe(0.06);
  });
});
