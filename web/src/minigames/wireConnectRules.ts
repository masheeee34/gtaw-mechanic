// Pure rules for the WireConnect mini-game: match coloured wires from source column to destination.

export interface WireConnectState {
  readonly count: number;
  /** mapping[sourceIndex] = expected destination index */
  readonly mapping: readonly number[];
  /** connected[sourceIndex] = destination index actually connected, or null */
  readonly connected: readonly (number | null)[];
  /** source wire currently selected by the player, or null */
  readonly selected: number | null;
  readonly mistakes: number;
}

export type ConnectOutcome = 'selected' | 'connected' | 'wrong' | 'done' | 'failed' | 'deselected';

export const MAX_MISTAKES = 2;

/** Fisher-Yates shuffle on a copy of the array. */
function shuffle<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a mapping array: mapping[i] = destination index that source i must connect to.
 * The destination labels are shuffled, so mapping is a permutation of 0..count-1.
 */
export function buildMapping(count: number, rand?: () => number): readonly number[] {
  const indices = Array.from({ length: count }, (_, i) => i);
  return shuffle(indices, rand);
}

export function createWireConnect(count: number, rand?: () => number): WireConnectState {
  if (!Number.isInteger(count) || count < 3 || count > 6) {
    throw new RangeError(`Le nombre de câbles doit être entre 3 et 6, reçu ${count}.`);
  }
  return {
    count,
    mapping: buildMapping(count, rand),
    connected: Array(count).fill(null),
    selected: null,
    mistakes: 0,
  };
}

export function isComplete(state: WireConnectState): boolean {
  return state.connected.every((v) => v !== null);
}

/**
 * Select a source wire. If the same wire is clicked again it is deselected.
 * Already-connected sources are ignored.
 */
export function selectSource(
  state: WireConnectState,
  sourceIndex: number,
): { state: WireConnectState; outcome: ConnectOutcome } {
  if (sourceIndex < 0 || sourceIndex >= state.count) return { state, outcome: 'deselected' };
  if (state.connected[sourceIndex] !== null) return { state, outcome: 'deselected' };
  if (state.selected === sourceIndex) return { state: { ...state, selected: null }, outcome: 'deselected' };
  return { state: { ...state, selected: sourceIndex }, outcome: 'selected' };
}

/**
 * Connect the currently-selected source to a destination wire.
 * Returns 'wrong' if the destination doesn't match the expected mapping.
 * Returns 'done' when all wires are connected.
 * Returns 'failed' when mistakes exceed the max.
 */
export function connectDestination(
  state: WireConnectState,
  destIndex: number,
): { state: WireConnectState; outcome: ConnectOutcome } {
  if (state.selected === null) return { state, outcome: 'deselected' };
  if (destIndex < 0 || destIndex >= state.count) return { state, outcome: 'deselected' };

  // Destination already taken by another connection
  const alreadyUsed = state.connected.some((v, i) => v === destIndex && i !== state.selected);
  if (alreadyUsed) {
    const mistakes = state.mistakes + 1;
    return {
      state: { ...state, selected: null, mistakes },
      outcome: mistakes >= MAX_MISTAKES ? 'failed' : 'wrong',
    };
  }

  const src = state.selected;
  const expected = state.mapping[src];

  if (destIndex !== expected) {
    const mistakes = state.mistakes + 1;
    return {
      state: { ...state, selected: null, mistakes },
      outcome: mistakes >= MAX_MISTAKES ? 'failed' : 'wrong',
    };
  }

  const connected = [...state.connected] as (number | null)[];
  connected[src] = destIndex;
  const next: WireConnectState = { ...state, connected, selected: null };
  return { state: next, outcome: isComplete(next) ? 'done' : 'connected' };
}
