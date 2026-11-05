// Pressure gauge rules. The pressure leaks all the time and each pump pushes it up: the mechanic has to
// keep it in the green zone for `duration` seconds in total. Reaching the top bursts the line at once,
// and leaving the gauge empty for too long fails too. Pure and frame-based, so it is tested without a
// real animation loop.

import type { PressureGaugeConfig } from '../types';

export type PressureSettings = Omit<PressureGaugeConfig, 'type'>;

export type PressureOutcome = 'playing' | 'won' | 'burst' | 'empty';

export interface PressureState {
  /** 0 to 1. Reaching 1 bursts the line. */
  readonly pressure: number;
  /** Seconds still to hold in the green zone. */
  readonly holdLeft: number;
  /** How long the gauge has been empty, in milliseconds. */
  readonly emptyMs: number;
  readonly outcome: PressureOutcome;
}

export const EMPTY_TOLERANCE_MS = 500;

/** Starts in the middle of the green zone. */
export function createPressureState({ duration, minZone, maxZone }: Pick<PressureSettings, 'duration' | 'minZone' | 'maxZone'>): PressureState {
  return { pressure: (minZone + maxZone) / 2, holdLeft: duration, emptyMs: 0, outcome: 'playing' };
}

export function isInZone(pressure: number, { minZone, maxZone }: Pick<PressureSettings, 'minZone' | 'maxZone'>): boolean {
  return pressure >= minZone && pressure <= maxZone;
}

/** One frame: the leak, plus one pump if the mechanic pumped during the frame. */
export function tick(state: PressureState, deltaSeconds: number, settings: PressureSettings, pumped: boolean): PressureState {
  if (state.outcome !== 'playing') return state;

  const pressure = Math.max(0, state.pressure - settings.decay * deltaSeconds + (pumped ? settings.boost : 0));
  if (pressure >= 1) return { ...state, pressure: 1, outcome: 'burst' };

  const emptyMs = pressure === 0 ? state.emptyMs + deltaSeconds * 1000 : 0;
  if (emptyMs >= EMPTY_TOLERANCE_MS) return { ...state, pressure, emptyMs, outcome: 'empty' };

  const holdLeft = isInZone(pressure, settings) ? Math.max(0, state.holdLeft - deltaSeconds) : state.holdLeft;
  return { pressure, holdLeft, emptyMs, outcome: holdLeft === 0 ? 'won' : 'playing' };
}
