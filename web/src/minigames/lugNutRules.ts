// Pure rules of the wheel mini-game: lug nuts have to be tightened in a star pattern, like a real
// mechanic does to seat the wheel evenly. The player picks the first nut and the direction freely.

export type Direction = 1 | -1;

export interface LugNutState {
  readonly count: number;
  readonly start: number | null;
  readonly direction: Direction | null;
  readonly tightened: readonly number[];
  readonly mistakes: number;
}

export type TightenOutcome = 'tightened' | 'wrong' | 'done' | 'failed' | 'ignored';

/**
 * Tightening order relative to the first nut. Odd counts skip one nut each time (5 nuts: 0 2 4 1 3),
 * even counts go back and forth across the wheel (4 nuts: 0 2 1 3).
 */
export function starPattern(count: number): number[] {
  if (!Number.isInteger(count) || count < 3 || count > 10) {
    throw new RangeError(`A wheel has between 3 and 10 lug nuts, got ${count}.`);
  }
  if (count % 2 === 1) return Array.from({ length: count }, (_, step) => (step * 2) % count);

  const half = count / 2;
  const order: number[] = [];
  for (let nut = 0; nut < half; nut++) order.push(nut, nut + half);
  return order;
}

export function createLugNuts(count: number): LugNutState {
  starPattern(count);
  return { count, start: null, direction: null, tightened: [], mistakes: 0 };
}

const wrap = (value: number, count: number) => ((value % count) + count) % count;

function nutAt(state: LugNutState, direction: Direction, step: number): number {
  return wrap((state.start ?? 0) + direction * starPattern(state.count)[step], state.count);
}

function candidateDirections(state: LugNutState): Direction[] {
  return state.direction ? [state.direction] : [1, -1];
}

export function isComplete(state: LugNutState): boolean {
  return state.tightened.length === state.count;
}

/** Nuts that would be accepted next. Empty before the first nut, since any nut can start. */
export function expectedNuts(state: LugNutState): number[] {
  if (state.start === null || isComplete(state)) return [];
  const step = state.tightened.length;
  return [...new Set(candidateDirections(state).map((direction) => nutAt(state, direction, step)))];
}

export function tighten(
  state: LugNutState,
  nut: number,
  maxMistakes: number,
): { state: LugNutState; outcome: TightenOutcome } {
  const over = isComplete(state) || state.mistakes > maxMistakes;
  if (over || state.tightened.includes(nut) || nut < 0 || nut >= state.count) return { state, outcome: 'ignored' };

  if (state.start === null) {
    return { state: { ...state, start: nut, tightened: [nut] }, outcome: 'tightened' };
  }

  const step = state.tightened.length;
  const matching = candidateDirections(state).filter((direction) => nutAt(state, direction, step) === nut);
  if (matching.length === 0) {
    const mistakes = state.mistakes + 1;
    return { state: { ...state, mistakes }, outcome: mistakes > maxMistakes ? 'failed' : 'wrong' };
  }

  // On even wheels the second nut is the same both ways, so the direction is only known later.
  const direction = matching.length === 1 ? matching[0] : state.direction;
  const next = { ...state, direction, tightened: [...state.tightened, nut] };
  return { state: next, outcome: isComplete(next) ? 'done' : 'tightened' };
}
