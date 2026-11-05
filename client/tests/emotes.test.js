import { describe, expect, it } from 'vitest';
import { emoteText } from '../src/emotes.js';

const tire = (wheel) => ({ id: `tire_${wheel}`, type: 'tire', wheel, item: 'tire', label: 'Pneu' });

describe('emoteText', () => {
  const items = { tire: { label: 'Pneu' } };

  it('writes each action in French', () => {
    expect(emoteText('inspect', undefined, items)).toMatch(/tablette/);
    expect(emoteText('take', tire(0), items)).toBe("attrape un pneu neuf sur l'étagère.");
    expect(emoteText('install', tire(1), items)).toMatch(/roue avant droite/);
    expect(emoteText('done', { type: 'engine', label: 'Moteur' }, items)).toBe('termine de réparer le moteur.');
  });

  it('ignores unknown actions and missing parts', () => {
    expect(emoteText('dance', tire(0), items)).toBeNull();
    expect(emoteText('take', undefined, items)).toBeNull();
  });
});
