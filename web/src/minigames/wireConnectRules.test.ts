import { describe, expect, it } from 'vitest';
import {
  MAX_MISTAKES,
  buildMapping,
  connectDestination,
  createWireConnect,
  isComplete,
  selectSource,
} from './wireConnectRules';

describe('createWireConnect', () => {
  it('cree un etat valide avec 4 cables', () => {
    const state = createWireConnect(4);
    expect(state.count).toBe(4);
    expect(state.mapping).toHaveLength(4);
    expect(state.connected).toHaveLength(4);
    expect(state.connected.every((v) => v === null)).toBe(true);
    expect(state.selected).toBeNull();
    expect(state.mistakes).toBe(0);
  });

  it('rejette un count hors bornes', () => {
    expect(() => createWireConnect(2)).toThrow(RangeError);
    expect(() => createWireConnect(7)).toThrow(RangeError);
  });
});

describe('buildMapping', () => {
  it('retourne une permutation de 0..n-1', () => {
    for (let n = 3; n <= 6; n++) {
      const mapping = buildMapping(n);
      expect([...mapping].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it('utilise le rand fourni (permutation deterministe)', () => {
    const mapping = buildMapping(4, () => 0);
    expect([...mapping].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });
});

describe('selectSource', () => {
  it('selectionne un cable source libre', () => {
    const state = createWireConnect(4);
    const { state: next, outcome } = selectSource(state, 1);
    expect(outcome).toBe('selected');
    expect(next.selected).toBe(1);
  });

  it('deselectionne un cable deja selectionne', () => {
    const state = { ...createWireConnect(4), selected: 2 };
    const { state: next, outcome } = selectSource(state, 2);
    expect(outcome).toBe('deselected');
    expect(next.selected).toBeNull();
  });

  it('ignore un cable deja connecte', () => {
    const base = createWireConnect(4);
    const connected = [0, null, null, null] as (number | null)[];
    const state = { ...base, connected };
    const { outcome } = selectSource(state, 0);
    expect(outcome).toBe('deselected');
  });
});

describe('connectDestination', () => {
  it('retourne "connected" sur un branchement correct', () => {
    const base = createWireConnect(4, () => 0.99);
    const state = { ...base, mapping: [2, 3, 0, 1] as readonly number[], selected: 0 };
    const { outcome, state: next } = connectDestination(state, 2);
    expect(outcome).toBe('connected');
    expect(next.connected[0]).toBe(2);
    expect(next.selected).toBeNull();
    expect(next.mistakes).toBe(0);
  });

  it('retourne "wrong" sur un mauvais branchement (< MAX_MISTAKES)', () => {
    const state = { ...createWireConnect(4), mapping: [2, 3, 0, 1] as readonly number[], selected: 0 };
    const { outcome, state: next } = connectDestination(state, 1);
    expect(outcome).toBe('wrong');
    expect(next.mistakes).toBe(1);
    expect(next.selected).toBeNull();
  });

  it('retourne "failed" apres MAX_MISTAKES erreurs', () => {
    const state = {
      ...createWireConnect(4),
      mapping: [2, 3, 0, 1] as readonly number[],
      selected: 0,
      mistakes: MAX_MISTAKES - 1,
    };
    const { outcome } = connectDestination(state, 1);
    expect(outcome).toBe('failed');
  });

  it('retourne "done" quand tous les cables sont connectes', () => {
    const mapping = [0, 1, 2] as readonly number[];
    const connected: (number | null)[] = [0, 1, null];
    const state = { ...createWireConnect(3), mapping, connected, selected: 2 };
    const { outcome } = connectDestination(state, 2);
    expect(outcome).toBe('done');
  });

  it('retourne "deselected" si aucun cable source nest selectionne', () => {
    const state = createWireConnect(4);
    const { outcome } = connectDestination(state, 1);
    expect(outcome).toBe('deselected');
  });

  it('compte une erreur si la destination est deja prise', () => {
    const mapping = [0, 1, 2, 3] as readonly number[];
    const connected: (number | null)[] = [0, null, null, null];
    const state = { ...createWireConnect(4), mapping, connected, selected: 1 };
    const { outcome, state: next } = connectDestination(state, 0);
    expect(outcome).toBe('wrong');
    expect(next.mistakes).toBe(1);
  });
});

describe('isComplete', () => {
  it('retourne false si des cables sont non connectes', () => {
    const state = createWireConnect(3);
    expect(isComplete(state)).toBe(false);
  });

  it('retourne true quand tous sont connectes', () => {
    const state = { ...createWireConnect(3), connected: [0, 1, 2] as readonly (number | null)[] };
    expect(isComplete(state)).toBe(true);
  });
});
