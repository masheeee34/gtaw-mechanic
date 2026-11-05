import { describe, expect, it } from 'vitest';
import { Stage, advance, nutsMode, objective, repairLevel, startJob } from '../src/job.js';

const tire = { id: 'tire_fl', label: 'Pneu avant gauche', item: 'tire', quantity: 1 };
const tireItem = { label: 'Pneu' };

describe('repair job', () => {
  it('starts by sending the mechanic to fetch the part, empty-handed', () => {
    expect(startJob(tire)).toEqual({ partId: 'tire_fl', stage: Stage.FETCH, holdingPart: false, wheelOff: false });
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

  it('changes a tire in two mini-games: loosen, wheel off, then tighten the new one', () => {
    let job = advance(advance(startJob(tire), 'partTaken'), 'installStarted');
    expect(nutsMode(job)).toBe('loosen');

    job = advance(job, 'wheelRemoved');
    expect(job).toMatchObject({ stage: Stage.REMOUNT, wheelOff: true });

    job = advance(job, 'remountStarted');
    expect(job.stage).toBe(Stage.WORKING);
    expect(nutsMode(job)).toBe('tighten');
  });

  it('keeps the wheel off after a failed tightening, so only the new wheel is put on again', () => {
    const tightening = advance(advance(advance(advance(advance(startJob(tire), 'partTaken'), 'installStarted'), 'wheelRemoved'), 'remountStarted'), 'minigameFailed');

    expect(tightening).toMatchObject({ stage: Stage.REMOUNT, wheelOff: true, holdingPart: true });
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

describe('repairLevel', () => {
  it('restores a part completely after a careful job, to 85 % after a rushed one', () => {
    expect(repairLevel(1)).toBe(1);
    expect(repairLevel(0)).toBe(0.85);
    expect(repairLevel(0.5)).toBeCloseTo(0.925);
  });

  it('ignores a missing or bad quality', () => {
    expect(repairLevel(Number.NaN)).toBe(1);
    expect(repairLevel(7)).toBe(1);
  });
});

describe('tire objectives', () => {
  const wheel = { ...tire, type: 'tire' };

  it('asks to jack the car up at the wheel, then to put the new wheel on', () => {
    const job = advance(startJob(wheel), 'partTaken');
    expect(objective(job, wheel, tireItem).near[0].text).toBe('Lever la voiture et démonter : Pneu avant gauche');

    const remount = { ...job, stage: Stage.REMOUNT, wheelOff: true };
    expect(objective(remount, wheel, tireItem)).toMatchObject({ target: 'part', near: [{ key: 'E', text: 'Poser la roue neuve' }, expect.anything()] });
  });
});
