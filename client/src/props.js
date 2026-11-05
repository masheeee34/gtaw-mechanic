// Objects held in the mechanic's hands: the diagnostic tablet and the part being carried.

import { loadAnimDict, loadModel } from './assets.js';
import { delay } from './vehicle.js';

const LEFT_HAND = 60309;
const RIGHT_HAND_PROP = 28422;
// Loop, upper body only, keep moving: the legs stay on the ped's own standing/walking animation.
const UPPER_BODY_LOOP = 49;

const CARRY_ANIMATION = { dict: 'anim@heists@box_carry@', name: 'idle' };
const DEFAULT_CARRY = { model: 'prop_cs_cardbox_01', bone: LEFT_HAND, offset: [0.025, 0.08, 0.255], rotation: [-145.0, 290.0, 0.0] };

// Standing "reading a map" pose with a tablet in the right hand. (A bus passenger tablet clip on the
// full body made the mechanic sit in mid-air.)
const TABLET = {
  model: 'prop_cs_tablet',
  bone: RIGHT_HAND_PROP,
  offset: [0.0, -0.03, 0.0],
  rotation: [20.0, -90.0, 0.0],
  dict: 'amb@world_human_tourist_map@male@base',
  name: 'base',
};

const PICKUP_ANIMATION = { dict: 'random@domestic', name: 'pickup_low' };

/** Spawns a prop in the player's hand. Returns 0 when the model does not exist or fails to load. */
async function attachProp({ model, bone, offset, rotation }) {
  const hash = GetHashKey(model);
  if (!IsModelInCdimage(hash) || !(await loadModel(hash))) return 0;

  const ped = PlayerPedId();
  const [x, y, z] = GetEntityCoords(ped, true);
  const prop = CreateObject(hash, x, y, z + 0.2, true, true, true);
  SetModelAsNoLongerNeeded(hash);
  AttachEntityToEntity(
    prop, ped, GetPedBoneIndex(ped, bone),
    offset[0], offset[1], offset[2], rotation[0], rotation[1], rotation[2],
    true, true, false, true, 1, true,
  );
  return prop;
}

function deleteProp(prop) {
  if (!prop || !DoesEntityExist(prop)) return;
  DetachEntity(prop, true, true);
  DeleteEntity(prop);
}

/** Starts carrying an item's prop with both hands. The item's `carry` settings override the default box. */
export async function startCarrying(item) {
  const custom = { ...DEFAULT_CARRY, ...item.carry };
  // An unknown model in config.json falls back to the box instead of carrying nothing.
  const spec = IsModelInCdimage(GetHashKey(custom.model)) ? custom : DEFAULT_CARRY;

  if (await loadAnimDict(CARRY_ANIMATION.dict)) {
    TaskPlayAnim(PlayerPedId(), CARRY_ANIMATION.dict, CARRY_ANIMATION.name, 8.0, -8.0, -1, UPPER_BODY_LOOP, 0.0, false, false, false);
  }
  return attachProp(spec);
}

export function stopCarrying(prop) {
  deleteProp(prop);
  StopAnimTask(PlayerPedId(), CARRY_ANIMATION.dict, CARRY_ANIMATION.name, 1.0);
}

export async function startTablet() {
  if (await loadAnimDict(TABLET.dict)) {
    TaskPlayAnim(PlayerPedId(), TABLET.dict, TABLET.name, 8.0, -8.0, -1, UPPER_BODY_LOOP, 0.0, false, false, false);
  }
  return attachProp(TABLET);
}

export function stopTablet(prop) {
  deleteProp(prop);
  StopAnimTask(PlayerPedId(), TABLET.dict, TABLET.name, 1.0);
}

/** Plays a realistic bending pickup gesture when taking a part at the stock rack. */
export async function playPickupMotion(durationMs = 550) {
  const ped = PlayerPedId();
  if (await loadAnimDict(PICKUP_ANIMATION.dict)) {
    TaskPlayAnim(ped, PICKUP_ANIMATION.dict, PICKUP_ANIMATION.name, 8.0, -8.0, durationMs, 0, 0.0, false, false, false);
    await delay(durationMs);
    StopAnimTask(ped, PICKUP_ANIMATION.dict, PICKUP_ANIMATION.name, 2.0);
  }
}

/** While carrying: no sprinting, jumping, fighting or getting into a car with the part in hand. */
export function restrictCarryingControls() {
  for (const control of [21, 22, 23, 24, 25, 44, 140, 141, 142]) DisableControlAction(0, control, true);
}
