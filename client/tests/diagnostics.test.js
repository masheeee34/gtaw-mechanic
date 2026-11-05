import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config.js';
import { diagnose, statusFor, summarize } from '../src/diagnostics.js';

const config = parseConfig(readFileSync(new URL('../../config.json', import.meta.url), 'utf8'));
const { parts, thresholds } = config;

/** A brand new four-door car with every window. */
function healthyState(overrides = {}) {
  return {
    engineHealth: 1000,
    bodyHealth: 1000,
    tankHealth: 1000,
    wheels: [0, 1, 4, 5].map((index) => ({ index, burst: false, onRim: false })),
    windows: { total: 6, broken: [] },
    doors: { total: 4, damaged: [] },
    ...overrides,
  };
}

const byId = (diagnoses, id) => diagnoses.find((part) => part.id === id);

describe('statusFor', () => {
  it('maps health to good, worn and critical using the config thresholds', () => {
    expect(statusFor(100, thresholds)).toBe('good');
    expect(statusFor(70, thresholds)).toBe('good');
    expect(statusFor(69, thresholds)).toBe('worn');
    expect(statusFor(35, thresholds)).toBe('worn');
    expect(statusFor(34, thresholds)).toBe('critical');
  });
});

describe('diagnose', () => {
  it('reports every part as healthy on a new car', () => {
    const result = diagnose(healthyState(), parts, thresholds);

    expect(result.map((part) => part.id)).toEqual(parts.map((part) => part.id));
    expect(result.every((part) => part.health === 100 && part.status === 'good' && !part.needsRepair)).toBe(true);
  });

  it('carries the item and quantity each repair needs', () => {
    const body = byId(diagnose(healthyState(), parts, thresholds), 'body');

    expect(body).toMatchObject({ item: 'body_panel', quantity: 2, category: 'Carrosserie' });
  });

  it('clamps negative engine health to 0 and flags an engine failure', () => {
    const engine = byId(diagnose(healthyState({ engineHealth: -2500 }), parts, thresholds), 'engine');

    expect(engine).toMatchObject({ health: 0, status: 'critical', needsRepair: true });
    expect(engine.detail).toMatch(/hors service/);
  });

  it('takes damaged doors into account for the bodywork', () => {
    const body = byId(diagnose(healthyState({ doors: { total: 4, damaged: [1, 2] } }), parts, thresholds), 'body');

    expect(body.health).toBe(50);
    expect(body.status).toBe('worn');
    expect(body.detail).toContain('2 portières endommagées');
  });

  it('counts broken windows out of the windows the model has', () => {
    const windows = byId(diagnose(healthyState({ windows: { total: 4, broken: [0] } }), parts, thresholds), 'windows');

    expect(windows.health).toBe(75);
    expect(windows.detail).toBe('1 vitre cassée sur 4.');
  });

  it('separates a punctured tire from one running on the rim', () => {
    const wheels = [
      { index: 0, burst: true, onRim: false },
      { index: 1, burst: true, onRim: true },
      { index: 4, burst: false, onRim: false },
      { index: 5, burst: false, onRim: false },
    ];
    const result = diagnose(healthyState({ wheels }), parts, thresholds);

    expect(byId(result, 'tire_fl')).toMatchObject({ health: 0, status: 'critical', detail: 'Crevé.' });
    expect(byId(result, 'tire_fr').detail).toMatch(/jante/);
    expect(byId(result, 'tire_rl').needsRepair).toBe(false);
  });

  it('skips parts the vehicle does not have, like windows and side wheels on a bike', () => {
    const bike = healthyState({
      wheels: [0, 4].map((index) => ({ index, burst: false, onRim: false })),
      windows: { total: 0, broken: [] },
      doors: { total: 0, damaged: [] },
    });
    const ids = diagnose(bike, parts, thresholds).map((part) => part.id);

    expect(ids).toEqual(['engine', 'fuel_tank', 'body', 'tire_fl', 'tire_rl']);
  });
});

describe('summarize', () => {
  it('averages the health of every inspected part', () => {
    const diagnoses = [{ health: 100 }, { health: 50 }, { health: 0 }];

    expect(summarize(diagnoses, thresholds)).toEqual({ health: 50, status: 'worn' });
  });

  it('treats a vehicle with nothing to inspect as healthy', () => {
    expect(summarize([], thresholds)).toEqual({ health: 100, status: 'good' });
  });
});
