import { describe, expect, it } from 'vitest';
import { Stage, advance, objective, startJob } from '../src/job.js';

const tire = { id: 'tire_fl', label: 'Pneu avant gauche', item: 'tire', quantity: 1 };
const tireItem = { label: 'Pneu' };

describe('repair job', () => {
  it('starts by sending the mechanic to fetch the part, empty-handed', () => {
    expect(startJob(tire)).toEqual({ partId: 'tire_fl', stage: Stage.FETCH, holdingPart: false });
  });

  it('goes fetch → install → working once the part is taken and the install starts', () => {
    let job = startJob(tire);
    job = advance(job, 'partTaken');
    expect(job).toMatchObject({ stage: Stage.INSTALL, holdingPart: true });

    job = advance(job, 'installStarted');
    expect(job).toMatchObject({ stage: Stage.WORKING, holdingPart: true });
  });

  it('sends the mechanic back to the car with the part after a failed mini-game', () => {
    const working = advance(advance(startJob(tire), 'partTaken'), 'installStarted');

    expect(advance(working, 'minigameFailed')).toMatchObject({ stage: Stage.INSTALL, holdingPart: true });
  });

  it('ignores events that do not fit the current stage', () => {
    const fetching = startJob(tire);

    expect(advance(fetching, 'installStarted')).toBe(fetching);
    expect(advance(fetching, 'minigameFailed')).toBe(fetching);
  });

  it('rejects unknown events', () => {
    expect(() => advance(startJob(tire), 'teleported')).toThrow(/Unknown job event/);
  });
});

describe('objective', () => {
  it('points to the rack while fetching, with the part and quantity to take', () => {
    const goal = objective(startJob(tire), tire, tireItem);

    expect(goal.target).toBe('rack');
    expect(goal.far[0].text).toContain('Allez chercher 1× Pneu');
    expect(goal.near[0]).toEqual({ key: 'E', text: 'Prendre 1× Pneu' });
  });

  it('points to the part while installing', () => {
    const goal = objective(advance(startJob(tire), 'partTaken'), tire, tireItem);

    expect(goal.target).toBe('part');
    expect(goal.near[0]).toEqual({ key: 'E', text: 'Installer : Pneu avant gauche' });
  });

  it('always offers to give up with Backspace while walking around', () => {
    const fetching = objective(startJob(tire), tire, tireItem);

    expect(fetching.far).toContainEqual({ key: 'Retour arrière', text: 'Abandonner' });
    expect(fetching.near).toContainEqual({ key: 'Retour arrière', text: 'Abandonner' });
  });

  it('shows nothing during the mini-game', () => {
    const working = advance(advance(startJob(tire), 'partTaken'), 'installStarted');

    expect(objective(working, tire, tireItem).target).toBeNull();
  });
});
