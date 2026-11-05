// Reads the stylesheet from disk: Vitest stubs CSS imports (even `?raw`) to an empty string.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../web/src/styles.css', import.meta.url), 'utf8');

/** Body of the first rule whose selector is exactly `selector`. */
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1];
}

// The NUI page is drawn over the whole game screen. These guard the bug where a root
// `color-scheme: dark` made Chromium paint it dark grey and hide the game after loading.
describe('NUI page styles', () => {
  it('keeps the page itself transparent', () => {
    expect(rule('html')).toMatch(/background:\s*transparent/);
    expect(rule('body')).toMatch(/background:\s*transparent/);
  });

  it('never sets color-scheme on the root of the page', () => {
    for (const selector of [':root', 'html', 'body']) {
      expect(rule(selector)).toBeDefined();
      expect(rule(selector)).not.toMatch(/color-scheme/);
    }
  });
});
