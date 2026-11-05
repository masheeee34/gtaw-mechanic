import { describe, expect, it } from 'vitest';
import { matchesQuery } from './search';

describe('matchesQuery', () => {
  const fields = ['Front left tire', 'Punctured.', 'Wheels'];

  it('matches everything when the query is blank', () => {
    expect(matchesQuery(fields, '')).toBe(true);
    expect(matchesQuery(fields, '   ')).toBe(true);
  });

  it('is case-insensitive and searches every field', () => {
    expect(matchesQuery(fields, 'TIRE')).toBe(true);
    expect(matchesQuery(fields, 'wheels')).toBe(true);
  });

  it('needs every word of the query, in any field', () => {
    expect(matchesQuery(fields, 'left punctured')).toBe(true);
    expect(matchesQuery(fields, 'right punctured')).toBe(false);
  });

  it('skips empty fields', () => {
    expect(matchesQuery([null, undefined, 'Engine'], 'engine')).toBe(true);
    expect(matchesQuery([null, undefined], 'null')).toBe(false);
  });
});
