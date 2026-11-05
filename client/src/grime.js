// The mechanic gets dirty: grease builds up on hands and clothes with each repair, up to three levels,
// until they wash at the garage's workbench. The level lives in a state bag on the player, so every
// client around draws it on that mechanic.

import { loadAnimDict } from './assets.js';
import { delay } from './vehicle.js';

export const DIRT_STATE = 'gtawMechanicDirt';
export const MAX_DIRT = 3;
const DIRT_PACK = 'Dirt_Mud';
const WASH = { dict: 'mp_arresting', name: 'a_uncuff', ms: 4000 };

/** The next dirt level after a repair. Pure. */
export const dirtier = (level) => Math.min(MAX_DIRT, (Number.isInteger(level) ? level : 0) + 1);

export const dirtLevel = () => LocalPlayer.state[DIRT_STATE] ?? 0;

/** Draws a mechanic's dirt level on their ped (called for every player, from the state bag). */
export function showDirt(ped, level) {
  ClearPedEnvDirt(ped);
  ClearPedBloodDamage(ped);
  ResetPedVisibleDamage(ped);
  if (level > 0) ApplyPedDamagePack(ped, DIRT_PACK, 0.0, level / MAX_DIRT);
}

// The local ped is drawn right away; the state bag carries the level to the other players.
function setDirt(level) {
  LocalPlayer.state.set(DIRT_STATE, level, true);
  showDirt(PlayerPedId(), level);
}

export function addDirt() {
  setDirt(dirtier(dirtLevel()));
}

/** Washes the grease off: an animation, then the dirt level back to 0. */
export async function washHands() {
  const ped = PlayerPedId();
  if (await loadAnimDict(WASH.dict)) {
    TaskPlayAnim(ped, WASH.dict, WASH.name, 8.0, -8.0, WASH.ms, 0, 0.0, false, false, false);
    RemoveAnimDict(WASH.dict);
  }
  await delay(WASH.ms);
  setDirt(0);
}
