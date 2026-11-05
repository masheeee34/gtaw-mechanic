// Where the mechanic works on each part, and the work animation itself.

import { approachPoint } from './approach.js';
import { loadAnimDict } from './assets.js';
import { WHEEL_BONES, delay } from './vehicle.js';

const HOOD = 4;
const TURN_MS = 800;
const ANIM_LOOP = 1;

function partBone(part) {
  if (part.type === 'tire') return WHEEL_BONES[part.wheel];
  if (part.type === 'fuel_tank') return 'petrolcap';
  return null;
}

function boneLocalPosition(vehicle, bone) {
  if (!bone) return null;
  const index = GetEntityBoneIndexByName(vehicle, bone);
  if (index === -1) return null;
  const [x, y, z] = GetWorldPositionOfEntityBone(vehicle, index);
  const [localX, localY] = GetOffsetFromEntityGivenWorldCoords(vehicle, x, y, z);
  return { x: localX, y: localY };
}

/** World positions to stand on and to face for a part, recomputed each frame in case the car moves. */
export function partPositions(vehicle, part) {
  const [min, max] = GetModelDimensions(GetEntityModel(vehicle));
  const dimensions = { min: { x: min[0], y: min[1] }, max: { x: max[0], y: max[1] } };
  const { stand, face } = approachPoint(part.type, dimensions, boneLocalPosition(vehicle, partBone(part)));
  return {
    stand: GetOffsetFromEntityInWorldCoords(vehicle, stand.x, stand.y, 0.0),
    face: GetOffsetFromEntityInWorldCoords(vehicle, face.x, face.y, 0.0),
  };
}

/** Turns the mechanic to the part, opens the hood if needed and starts the work animation. */
export async function startWork(vehicle, part, positions = partPositions(vehicle, part)) {
  const ped = PlayerPedId();
  const { face } = positions;
  const [x, y, z] = face;
  TaskTurnPedToFaceCoord(ped, x, y, z, TURN_MS);
  await delay(TURN_MS);
  if (part.type === 'engine') SetVehicleDoorOpen(vehicle, HOOD, false, false);

  const { animation } = part;
  if (animation.scenario) {
    TaskStartScenarioInPlace(ped, animation.scenario, 0, true);
  } else if (await loadAnimDict(animation.dict)) {
    TaskPlayAnim(ped, animation.dict, animation.name, 8.0, -8.0, -1, ANIM_LOOP, 0.0, false, false, false);
    RemoveAnimDict(animation.dict);
  }
}

export function stopWork(vehicle, part) {
  const ped = PlayerPedId();

  if (part?.animation?.dict) {
    StopAnimTask(ped, part.animation.dict, part.animation.name, 3.0);
  } else {
    ClearPedTasks(ped);
  }

  if (part?.type === 'engine' && DoesEntityExist(vehicle)) SetVehicleDoorShut(vehicle, HOOD, false);
}
