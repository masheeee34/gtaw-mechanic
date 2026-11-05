import { describe, expect, it } from 'vitest';
import type { PartDiagnosis, PartStatus } from '../types';
import { repairOrder } from './repairOrder';

const part = (id: string, type: string, status: PartStatus, needsRepair = true): PartDiagnosis => ({
  id,
  type,
  label: id,
  category: '',
  item: '',
  quantity: 1,
  health: status === 'good' ? 100 : status === 'worn' ? 50 : 10,
  status,
  detail: '',
  metrics: [],
  needsRepair,
});

describe('repairOrder', () => {
  it('puts critical parts first, then follows the safety order', () => {
    const order = repairOrder([
      part('body', 'body', 'critical'),
      part('engine', 'engine', 'worn'),
      part('tire_fl', 'tire', 'critical'),
      part('fuel_tank', 'fuel_tank', 'critical'),
    ]);

    expect(order.map((entry) => [entry.step, entry.part.id])).toEqual([
      [1, 'fuel_tank'],
      [2, 'tire_fl'],
      [3, 'body'],
      [4, 'engine'],
    ]);
    expect(order[0].reason).toMatch(/feu/);
  });

  it('leaves out the parts that need no repair', () => {
    expect(repairOrder([part('engine', 'engine', 'good', false)])).toEqual([]);
  });
});
