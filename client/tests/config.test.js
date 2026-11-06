import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/config.js';

const shipped = readFileSync(new URL('../../config.json', import.meta.url), 'utf8');

/** The shipped config with one change applied, to check each validation rule on its own. */
function withChange(change) {
  const config = JSON.parse(shipped);
  change(config);
  return JSON.stringify(config);
}

describe('parseConfig', () => {
  it('accepts the shipped config.json', () => {
    const config = parseConfig(shipped);

    expect(config.garages.length).toBeGreaterThan(0);
    expect(config.parts.length).toBeGreaterThan(0);
  });

  it('rejects a missing file', () => {
    expect(() => parseConfig(null)).toThrow(/introuvable/);
    expect(() => parseConfig('')).toThrow(/introuvable/);
  });

  it.each([
    ['no garage', (c) => (c.garages = []), /au moins un garage/],
    ['a garage without a radius', (c) => (c.garages[0].radius = 0), /rayon positif/],
    ['inverted thresholds', (c) => (c.thresholds = { good: 30, worn: 60 }), /thresholds/],
    ['a part with an unknown item', (c) => (c.parts[0].item = 'turbo'), /article inconnu « turbo »/],
    ['a tire without a wheel index', (c) => delete c.parts.find((p) => p.type === 'tire').wheel, /index de roue/],
    ['a duplicate part id', (c) => c.parts.push({ ...c.parts[0] }), /en double/],
    ['an unknown part type', (c) => (c.parts[0].type = 'turbo'), /type inconnu/],
    ['an unknown minigame', (c) => (c.parts[0].minigame = { type: 'quiz' }), /mini-jeu/],
    ['a part without animation', (c) => delete c.parts[0].animation, /animation/],
    ['a rack that is not a position', (c) => (c.garages[0].rack = [1, 2]), /stock du garage/],
    ['a carried prop without model', (c) => (c.items.tire.carry = { offset: [0, 0, 0] }), /objet porté/],
  ])('rejects %s', (_name, change, message) => {
    expect(() => parseConfig(withChange(change))).toThrow(message);
  });
});
