// Rebuilds the client and the NUI on every save. FXServer does not hot-reload resources:
// type `restart gtaw-mechanic` in the server console to load the new build.
import { spawn } from 'node:child_process';

const watchers = [
  ['client/build.mjs', '--watch'],
  ['node_modules/vite/bin/vite.js', 'build', 'web', '--watch'],
].map((args) => spawn(process.execPath, args, { stdio: 'inherit' }));

const stopAll = () => watchers.forEach((child) => child.kill());
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
watchers.forEach((child) => child.on('exit', (code) => code && process.exit(code)));
