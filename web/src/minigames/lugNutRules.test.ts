import { describe, expect, it } from 'vitest';
import { createLugNuts, expectedNuts, starPattern, tighten, type LugNutState, type TightenOutcome } from './lugNutRules';

/** Presses the nuts in order and returns the final state and every outcome. */
function pressAll(nuts: number[], count = 5, maxMistakes = 1) {
  let state: LugNutState = createLugNuts(count);
  const outcomes: TightenOutcome[] = [];
  for (const nut of nuts) {
    const result = tighten(state, nut, maxMistakes);
    state = result.state;
    outcomes.push(result.outcome);
  }
  return { state, outcomes };
}

describe('starPattern', () => {
  it('skips one nut at a time on odd wheels', () => {
    expect(starPattern(5)).toEqual([0, 2, 4, 1, 3]);
  });

  it('goes back and forth across even wheels', () => {
    expect(starPattern(4)).toEqual([0, 2, 1, 3]);
    expect(starPattern(6)).toEqual([0, 3, 1, 4, 2, 5]);
  });

  it('rejects impossible wheels', () => {
    expect(() => starPattern(2)).toThrow(RangeError);
    expect(() => starPattern(11)).toThrow(RangeError);
    expect(() => starPattern(4.5)).toThrow(RangeError);
  });
});

describe('tighten', () => {
  it('accepts any first nut, then the star pattern clockwise', () => {
    const { outcomes, state } = pressAll([2, 4, 1, 3, 0]);

    expect(outcomes).toEqual(['tightened', 'tightened', 'tightened', 'tightened', 'done']);
    expect(state.tightened).toEqual([2, 4, 1, 3, 0]);
  });

  it('accepts the star pattern counter-clockwise too', () => {
    expect(pressAll([2, 0, 3, 1, 4]).outcomes.at(-1)).toBe('done');
  });

  it('locks the direction once the second nut shows it', () => {
    const { outcomes } = pressAll([0, 2, 3]);

    expect(outcomes).toEqual(['tightened', 'tightened', 'wrong']);
  });

  it('fails once the player makes more mistakes than allowed', () => {
    const { outcomes, state } = pressAll([0, 1, 1, 2]);

    expect(outcomes).toEqual(['tightened', 'wrong', 'failed', 'ignored']);
    expect(state.mistakes).toBe(2);
  });

  it('ignores a nut that is already tight', () => {
    expect(pressAll([0, 0]).outcomes).toEqual(['tightened', 'ignored']);
  });

  it('only learns the direction on the third nut of an even wheel', () => {
    expect(pressAll([0, 2, 3, 1], 4).outcomes.at(-1)).toBe('done');
    expect(pressAll([0, 2, 1, 3], 4).outcomes.at(-1)).toBe('done');
  });
});

describe('expectedNuts', () => {
  it('is empty before the first nut, since any nut can start', () => {
    expect(expectedNuts(createLugNuts(5))).toEqual([]);
  });

  it('offers both directions after the first nut, then only one', () => {
    const afterFirst = tighten(createLugNuts(5), 0, 1).state;
    const afterSecond = tighten(afterFirst, 3, 1).state;

    expect(expectedNuts(afterFirst).sort()).toEqual([2, 3]);
    expect(expectedNuts(afterSecond)).toEqual([1]);
  });
});
