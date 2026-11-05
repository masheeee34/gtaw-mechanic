// Tire change: the wheel really comes off the car and lies on the floor until the new one is fitted.
// GTA cannot hide a single wheel, so it is pushed far out with its X offset, then put back where it was.
// A state bag on the vehicle carries this to every player around; the loose wheel on the floor is a
// local prop, so a disconnect never leaves one behind.

import { loadModel } from './assets.js';
import { WHEEL_BONES, hasBone } from './vehicle.js';

export const WHEEL_OFF_STATE = 'gtawMechanicWheelOff';
const OUT_OF_SIGHT = 1000.0;
const LOOSE_WHEEL = 'prop_wheel_tyre';
const FLOOR_SHIFT = 0.9;

/** The wheel taken off each vehicle on this client: its slot and original offset. */
const removed = new Map();
let looseWheel = 0;

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

function removeLooseWheel() {
  if (looseWheel !== 0 && DoesEntityExist(looseWheel)) DeleteEntity(looseWheel);
  looseWheel = 0;
}

/** Takes the wheel off (the mechanic controls the vehicle) and lays it on the floor beside `stand`. */
export async function takeWheelOff(vehicle, tyre, stand) {
  FreezeEntityPosition(vehicle, true);
  Entity(vehicle).state.set(WHEEL_OFF_STATE, tyre, true);
  showWheelOff(vehicle, tyre);

  const hash = GetHashKey(LOOSE_WHEEL);
  if (!IsModelInCdimage(hash) || !(await loadModel(hash)) || !removed.has(vehicle)) return;
  const [forwardX, forwardY] = GetEntityForwardVector(vehicle);
  removeLooseWheel();
  looseWheel = CreateObjectNoOffset(hash, stand[0] + forwardX * FLOOR_SHIFT, stand[1] + forwardY * FLOOR_SHIFT, stand[2], false, false, false);
  SetModelAsNoLongerNeeded(hash);
  PlaceObjectOnGroundProperly(looseWheel);
}

export function putWheelBack(vehicle) {
  removeLooseWheel();
  if (!DoesEntityExist(vehicle)) return;
  Entity(vehicle).state.set(WHEEL_OFF_STATE, null, true);
  showWheelOff(vehicle, null);
  FreezeEntityPosition(vehicle, false);
}
