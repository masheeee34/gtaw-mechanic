// Tire change in the world: the old wheel comes off and lies on the floor, the new wheel waits beside
// it, then goes on. GTA cannot hide a single wheel, so it is pushed far out with its X offset and put
// back where it was. The server owns which wheels are off (it gives them back when the mechanic leaves)
// and tells every player; the loose wheels are local props, so a disconnect leaves none behind.

import { loadModel } from './assets.js';
import { WHEEL_BONES, hasBone } from './vehicle.js';

const OUT_OF_SIGHT = 1000.0;
const LOOSE_WHEEL = 'prop_wheel_tyre';

/** The wheel taken off each vehicle on this client: its slot and original offset. */
const removed = new Map();

/** What the server says: the tyre that is off, by vehicle network id. */
const desired = new Map();

/** The tire change in progress on this client: the vehicle and the two loose wheels. */
let change = null;

/**
 * Index of a tyre in the wheel list the offset natives use: all six wheels of a 6-wheeler in tyre
 * order, otherwise the wheels the model has, front left to rear right. Null if the model lacks it.
 */
export function wheelSlot(tyre, presentTyres, wheelCount) {
  if (wheelCount === 6) return tyre;
  const slot = presentTyres.indexOf(tyre);
  return slot === -1 ? null : slot;
}

/** Applies the state on this client: takes `tyre` off, or puts the wheel back when it is null. */
export function showWheelOff(vehicle, tyre) {
  const current = removed.get(vehicle);
  if (current) {
    if (DoesEntityExist(vehicle)) SetVehicleWheelXOffset(vehicle, current.slot, current.offset);
    removed.delete(vehicle);
  }
  if (tyre === null || tyre === undefined || !DoesEntityExist(vehicle)) return;

  const present = Object.keys(WHEEL_BONES)
    .map(Number)
    .filter((index) => hasBone(vehicle, WHEEL_BONES[index]));
  const slot = wheelSlot(tyre, present, GetVehicleNumberOfWheels(vehicle));
  if (slot === null) return;
  removed.set(vehicle, { slot, offset: GetVehicleWheelXOffset(vehicle, slot) });
  SetVehicleWheelXOffset(vehicle, slot, OUT_OF_SIGHT);
}

function applyWheel(netId) {
  if (!NetworkDoesEntityExistWithNetworkId(netId)) return;
  const vehicle = NetworkGetEntityFromNetworkId(netId);
  if (!DoesEntityExist(vehicle)) return;
  const tyre = desired.get(netId);
  if (tyre === undefined) {
    if (removed.has(vehicle)) showWheelOff(vehicle, null);
  } else if (!removed.has(vehicle)) {
    showWheelOff(vehicle, tyre);
  }
}

/** The server says a vehicle has a wheel off (tyre 0 or more) or has it back (negative tyre). */
export function setWheelOff(netId, tyre) {
  if (tyre < 0) desired.delete(netId);
  else desired.set(netId, tyre);
  applyWheel(netId);
}

/** The server's full list, as [vehicle network id, tyre] pairs: on join or when this script restarts. */
export function replaceWheelsOff(pairs) {
  const before = [...desired.keys()];
  desired.clear();
  for (const [netId, tyre] of pairs) desired.set(netId, tyre);
  for (const netId of new Set([...before, ...desired.keys()])) applyWheel(netId);
}

/** Twice a second: a vehicle that streams in later gets its missing wheel, a gone one is forgotten. */
export function reconcileWheels() {
  for (const vehicle of removed.keys()) if (!DoesEntityExist(vehicle)) removed.delete(vehicle);
  for (const netId of desired.keys()) applyWheel(netId);
}

function deleteProp(prop) {
  if (prop && DoesEntityExist(prop)) DeleteEntity(prop);
}

/** A local prop on the floor at `point`, moved `shift` metres along the car. 0 if the model is missing. */
async function propOnFloor(model, vehicle, point, shift) {
  const hash = GetHashKey(model);
  if (!IsModelInCdimage(hash) || !(await loadModel(hash))) return 0;
  const [forwardX, forwardY] = GetEntityForwardVector(vehicle);
  const prop = CreateObjectNoOffset(hash, point[0] + forwardX * shift, point[1] + forwardY * shift, point[2], false, false, false);
  SetModelAsNoLongerNeeded(hash);
  PlaceObjectOnGroundProperly(prop);
  SetEntityHeading(prop, GetEntityHeading(vehicle));
  return prop;
}

/**
 * Step 1 (the mechanic controls the vehicle): hold the car still and set the new wheel down beside
 * it. `stand` is where the mechanic stands, read before the wheel comes off.
 */
export async function startWheelChange(vehicle, { stand }) {
  if (change) return;
  change = { vehicle, newWheel: 0, oldWheel: 0 };
  FreezeEntityPosition(vehicle, true);

  const newWheel = await propOnFloor(LOOSE_WHEEL, vehicle, stand, 0.9);
  if (change?.vehicle !== vehicle) {
    // The change ended while the model was loading.
    deleteProp(newWheel);
    return;
  }
  change.newWheel = newWheel;
}

/** Step 2, nuts loosened: the old wheel comes off and lies on the floor. */
export async function removeWheel(vehicle, tyre, stand) {
  setWheelOff(NetworkGetNetworkIdFromEntity(vehicle), tyre);
  const oldWheel = await propOnFloor(LOOSE_WHEEL, vehicle, stand, -0.9);
  if (change?.vehicle === vehicle) change.oldWheel = oldWheel;
  else deleteProp(oldWheel);
}

/** Step 3: the new wheel, waiting on the floor, goes on the car (the nuts still to tighten). */
export function fitNewWheel(vehicle) {
  if (change?.vehicle === vehicle) {
    deleteProp(change.newWheel);
    change.newWheel = 0;
  }
  if (DoesEntityExist(vehicle)) setWheelOff(NetworkGetNetworkIdFromEntity(vehicle), -1);
}

/** Done or given up: wheel on, loose wheels away, the car free again. */
export function endWheelChange(vehicle) {
  const current = change?.vehicle === vehicle ? change : null;
  change = current ? null : change;
  if (DoesEntityExist(vehicle) && removed.has(vehicle)) fitNewWheel(vehicle);
  if (!current) return;

  deleteProp(current.newWheel);
  deleteProp(current.oldWheel);
  if (DoesEntityExist(vehicle)) FreezeEntityPosition(vehicle, false);
}
