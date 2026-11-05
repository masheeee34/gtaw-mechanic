// Bundles the client into one file: FiveM client scripts cannot import modules.
import { context } from 'esbuild';

const watch = process.argv.includes('--watch');

const ctx = await context({
  entryPoints: ['client/src/main.js'],
  outfile: 'client/dist/client.js',
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  target: 'es2020',
  logLevel: 'info',
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
