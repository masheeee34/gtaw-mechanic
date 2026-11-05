import { describe, expect, it } from 'vitest';
import { emoteText } from '../src/emotes.js';

const tire = (wheel) => ({ id: `tire_${wheel}`, type: 'tire', wheel, item: 'tire', label: 'Pneu' });

describe('emoteText', () => {
  const items = { tire: { label: 'Pneu' } };

  it('writes each action in French', () => {
    expect(emoteText('inspect', undefined, items)).toMatch(/tablette/);
    expect(emoteText('take', tire(0), items)).toBe("attrape un pneu neuf sur l'étagère.");
    expect(emoteText('install', tire(1), items)).toMatch(/roue avant droite/);
    expect(emoteText('remove', tire(0), items)).toBe('retire la roue avant gauche et la pose au sol.');
    expect(emoteText('refit', tire(0), items)).toMatch(/roue neuve/);
    expect(emoteText('done', { type: 'engine', label: 'Moteur' }, items)).toBe('termine de réparer le moteur.');
    expect(emoteText('rushed', { type: 'engine', label: 'Moteur' }, items)).toBe('répare le moteur à la va-vite.');
  });

  it('ignores unknown actions and missing parts', () => {
    expect(emoteText('dance', tire(0), items)).toBeNull();
    expect(emoteText('take', undefined, items)).toBeNull();
  });
});
