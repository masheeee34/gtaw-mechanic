// Tire change in the world: the car goes up on a jack, the old wheel comes off and lies on the floor,
// the new wheel waits beside it, then goes on. GTA cannot hide a single wheel, so it is pushed far out
// with its X offset and put back where it was. A state bag on the vehicle carries the missing wheel to
// every player around; the jack and the loose wheels are local props, so a disconnect leaves none behind.

import { loadModel } from './assets.js';
import { WHEEL_BONES, hasBone } from './vehicle.js';

export const WHEEL_OFF_STATE = 'gtawMechanicWheelOff';
const OUT_OF_SIGHT = 1000.0;
const LIFT = 0.12;
const JACK = 'prop_carjack';
const LOOSE_WHEEL = 'prop_wheel_tyre';

/** The wheel taken off each vehicle on this client: its slot and original offset. */
const removed = new Map();

/** The tire change in progress on this client: the vehicle, its height before the jack, the props. */
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
 * Step 1 (the mechanic controls the vehicle): jack it up and set the new wheel down beside it.
 * `spot` is where the mechanic stands and the wheel itself, read before the wheel comes off.
 */
export async function jackUp(vehicle, { stand, face }) {
  if (change) return;
  const [x, y, z] = GetEntityCoords(vehicle, false);
  change = { vehicle, position: [x, y, z], jack: 0, newWheel: 0, oldWheel: 0 };
  FreezeEntityPosition(vehicle, true);
  SetEntityCoordsNoOffset(vehicle, x, y, z + LIFT, false, false, false);

  // The jack goes under the sill, between the mechanic and the wheel.
  const underSill = [(stand[0] + face[0]) / 2, (stand[1] + face[1]) / 2, stand[2]];
  const jack = await propOnFloor(JACK, vehicle, underSill, 0);
  const newWheel = await propOnFloor(LOOSE_WHEEL, vehicle, stand, 0.9);
  if (change?.vehicle !== vehicle) {
    // Jacked down while the props were loading.
    deleteProp(jack);
    deleteProp(newWheel);
    return;
  }
  change.jack = jack;
  change.newWheel = newWheel;
}

/** Step 2, nuts loosened: the old wheel comes off and lies on the floor. */
export async function removeWheel(vehicle, tyre, stand) {
  Entity(vehicle).state.set(WHEEL_OFF_STATE, tyre, true);
  showWheelOff(vehicle, tyre);
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
  if (!DoesEntityExist(vehicle)) return;
  Entity(vehicle).state.set(WHEEL_OFF_STATE, null, true);
  showWheelOff(vehicle, null);
}

/** Done or given up: wheel on, props away, the car back down on its wheels. */
export function jackDown(vehicle) {
  const current = change?.vehicle === vehicle ? change : null;
  change = current ? null : change;
  if (DoesEntityExist(vehicle) && removed.has(vehicle)) fitNewWheel(vehicle);
  if (!current) return;

  deleteProp(current.jack);
  deleteProp(current.newWheel);
  deleteProp(current.oldWheel);
  if (!DoesEntityExist(vehicle)) return;
  const [x, y, z] = current.position;
  SetEntityCoordsNoOffset(vehicle, x, y, z, false, false, false);
  FreezeEntityPosition(vehicle, false);
}
