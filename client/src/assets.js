// Streaming: models and animation dictionaries are loaded on demand, with a timeout so a missing asset
// never blocks the job.

import { delay } from './vehicle.js';

async function waitUntil(loaded, timeoutMs) {
  const start = GetGameTimer();
  while (!loaded()) {
    if (GetGameTimer() - start > timeoutMs) return false;
    await delay(0);
  }
  return true;
}

export function loadModel(hash, timeoutMs = 3000) {
  RequestModel(hash);
  return waitUntil(() => HasModelLoaded(hash), timeoutMs);
}

export function loadAnimDict(dict, timeoutMs = 3000) {
  RequestAnimDict(dict);
  return waitUntil(() => HasAnimDictLoaded(dict), timeoutMs);
}
