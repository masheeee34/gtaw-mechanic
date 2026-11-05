/**
 * Case-insensitive search over several fields, like the GTAW settings search.
 * Every word of the query has to appear in at least one field.
 */
export function matchesQuery(fields: ReadonlyArray<string | number | null | undefined>, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = fields
    .filter((field) => field !== null && field !== undefined)
    .join(' ')
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
