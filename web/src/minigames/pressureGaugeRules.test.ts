import { describe, expect, it } from 'vitest';
import { EMPTY_TOLERANCE_MS, createPressureState, isInZone, tick, type PressureSettings } from './pressureGaugeRules';

const settings: PressureSettings = { duration: 2, decay: 0.1, boost: 0.15, minZone: 0.4, maxZone: 0.7 };

describe('pressure gauge rules', () => {
  it('starts in the middle of the green zone', () => {
    const state = createPressureState(settings);

    expect(state.pressure).toBeCloseTo(0.55);
    expect(isInZone(state.pressure, settings)).toBe(true);
    expect(state.outcome).toBe('playing');
  });

  it('leaks pressure every frame and gains it on each pump', () => {
    const leaked = tick(createPressureState(settings), 0.5, settings, false);
    expect(leaked.pressure).toBeCloseTo(0.5);

    const pumped = tick(leaked, 0.5, settings, true);
    expect(pumped.pressure).toBeCloseTo(0.6);
  });

  it('only counts the time spent in the green zone', () => {
    const inZone = tick(createPressureState(settings), 0.5, settings, false);
    expect(inZone.holdLeft).toBeCloseTo(1.5);

    const tooLow = tick({ ...inZone, pressure: 0.3 }, 0.5, settings, false);
    expect(tooLow.holdLeft).toBeCloseTo(1.5);
  });

  it('wins once the pressure was held long enough', () => {
    let state = createPressureState(settings);
    for (let frame = 0; frame < 40 && state.outcome === 'playing'; frame++) {
      state = tick(state, 0.1, settings, state.pressure < 0.5);
    }

    expect(state.outcome).toBe('won');
    expect(state.holdLeft).toBe(0);
  });

  it('bursts at once when the pressure reaches the top', () => {
    const state = tick({ ...createPressureState(settings), pressure: 0.9 }, 0.01, settings, true);

    expect(state.outcome).toBe('burst');
    expect(state.pressure).toBe(1);
  });

  it('fails when the gauge stays empty too long, not before', () => {
    let state = { ...createPressureState(settings), pressure: 0 };
    state = tick(state, (EMPTY_TOLERANCE_MS - 100) / 1000, settings, false);
    expect(state.outcome).toBe('playing');

    state = tick(state, 0.1, settings, false);
    expect(state.outcome).toBe('empty');
  });

  it('forgets the empty time as soon as the mechanic pumps again', () => {
    let state = tick({ ...createPressureState(settings), pressure: 0 }, 0.3, settings, false);
    state = tick(state, 0.01, settings, true);

    expect(state.emptyMs).toBe(0);
  });

  it('does not change once finished', () => {
    const burst = { ...createPressureState(settings), pressure: 1, outcome: 'burst' as const };

    expect(tick(burst, 1, settings, false)).toBe(burst);
  });
});
