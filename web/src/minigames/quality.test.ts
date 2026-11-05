import { describe, expect, it } from 'vitest';
import { qualityLevel, scoreRun } from './quality';
import { precision } from './skillCheckRules';

describe('mini-game quality', () => {
  it('rewards a fast run without mistakes', () => {
    expect(scoreRun({ timeLeft: 10, timeLimit: 10, mistakes: 0, maxMistakes: 1 })).toBe(1);
    expect(scoreRun({ timeLeft: 0, timeLimit: 10, mistakes: 1, maxMistakes: 1 })).toBe(0.25);
  });

  it('names the level of the work', () => {
    expect(qualityLevel(0.9)).toBe('soigné');
    expect(qualityLevel(0.7)).toBe('correct');
    expect(qualityLevel(0.3)).toBe('bâclé');
  });

  it('measures how close to the middle of the zone the needle stopped', () => {
    const zone = { start: 0.4, end: 0.6 };
    expect(precision(0.5, zone)).toBe(1);
    expect(precision(0.45, zone)).toBeCloseTo(0.5);
    expect(precision(0.7, zone)).toBe(0);
  });
});
