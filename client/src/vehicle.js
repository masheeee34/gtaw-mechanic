// Everything that reads or changes the vehicle through GTA natives.

export const WINDOW_BONES = { 0: 'window_lf', 1: 'window_rf', 2: 'window_lr', 3: 'window_rr', 6: 'windscreen', 7: 'windscreen_r' };
export const WHEEL_BONES = { 0: 'wheel_lf', 1: 'wheel_rf', 4: 'wheel_lr', 5: 'wheel_rr' };
const DOOR_COUNT = 6;

export const delay = (ms) => new Promise((resolve) => setTimeout(() => resolve(undefined), ms));

export const hasBone = (vehicle, bone) => GetEntityBoneIndexByName(vehicle, bone) !== -1;

// Window and wheel indexes are fixed by GTA, but not every model has all of them.
const indexesWithBone = (vehicle, bones) =>
  Object.entries(bones)
    .filter(([, bone]) => hasBone(vehicle, bone))
    .map(([index]) => Number(index));

/** @returns {import('./diagnostics.js').VehicleState} */
export function readVehicleState(vehicle) {
  const windows = indexesWithBone(vehicle, WINDOW_BONES);
  const doors = Array.from({ length: DOOR_COUNT }, (_, door) => door).filter((door) => GetIsDoorValid(vehicle, door));

  return {
    engineHealth: GetVehicleEngineHealth(vehicle),
    engineTemperature: GetVehicleEngineTemperature(vehicle),
    oilLevel: GetVehicleOilLevel(vehicle),
    fuelLevel: GetVehicleFuelLevel(vehicle),
    bodyHealth: GetVehicleBodyHealth(vehicle),
    tankHealth: GetVehiclePetrolTankHealth(vehicle),
    wheels: indexesWithBone(vehicle, WHEEL_BONES).map((index) => ({
      index,
      burst: IsVehicleTyreBurst(vehicle, index, false),
      onRim: IsVehicleTyreBurst(vehicle, index, true),
    })),
    windows: { total: windows.length, broken: windows.filter((index) => !IsVehicleWindowIntact(vehicle, index)) },
    doors: { total: doors.length, damaged: doors.filter((door) => IsVehicleDoorDamaged(vehicle, door)) },
  };
}

/** Repairs a part; `level` (0 to 1) is how much of its health it gets back, from the mini-game quality. */
export function applyRepair(vehicle, part, level = 1) {
  switch (part.type) {
    case 'engine':
      SetVehicleEngineHealth(vehicle, 1000.0 * level);
      break;
    case 'fuel_tank':
      SetVehiclePetrolTankHealth(vehicle, 1000.0 * level);
      break;
    case 'tire':
      SetVehicleTyreFixed(vehicle, part.wheel);
      break;
    case 'windows':
      Object.keys(WINDOW_BONES).forEach((index) => FixVehicleWindow(vehicle, Number(index)));
      break;
    case 'body':
      repairBody(vehicle, level);
      break;
    default:
      throw new Error(`Unknown part type "${part.type}".`);
  }
}

// GTA can only restore doors and deformation with SetVehicleFixed, which repairs the whole vehicle.
// Take a snapshot first and break the other parts again, so only the bodywork changes.
function repairBody(vehicle, level) {
  const before = readVehicleState(vehicle);
  SetVehicleFixed(vehicle);
  SetVehicleDeformationFixed(vehicle);
  SetVehicleEngineHealth(vehicle, before.engineHealth);
  SetVehiclePetrolTankHealth(vehicle, before.tankHealth);
  before.wheels.filter((wheel) => wheel.burst).forEach((wheel) => SetVehicleTyreBurst(vehicle, wheel.index, wheel.onRim, 1000.0));
  before.windows.broken.forEach((index) => SmashVehicleWindow(vehicle, index));
  SetVehicleBodyHealth(vehicle, 1000.0 * level);
}

/** Closest vehicle to the player within `maxDistance` meters, or 0. */
export function findNearestVehicle(maxDistance) {
  const [px, py, pz] = GetEntityCoords(PlayerPedId(), true);
  let nearest = 0;
  let nearestDistance = maxDistance;
  for (const vehicle of GetGamePool('CVehicle')) {
    const [x, y, z] = GetEntityCoords(vehicle, false);
    const gap = Math.hypot(x - px, y - py, z - pz);
    if (gap < nearestDistance) {
      nearest = vehicle;
      nearestDistance = gap;
    }
  }
  return nearest;
}

/** Damage natives only sync from the entity owner, so take ownership before changing anything. */
export async function requestControl(entity, timeoutMs = 1500) {
  const start = GetGameTimer();
  while (!NetworkHasControlOfEntity(entity)) {
    if (GetGameTimer() - start > timeoutMs) return false;
    NetworkRequestControlOfEntity(entity);
    await delay(50);
  }
  return true;
}

export function vehicleDisplayName(vehicle) {
  const code = GetDisplayNameFromVehicleModel(GetEntityModel(vehicle));
  const make = GetLabelText(GetMakeNameFromVehicleModel(GetEntityModel(vehicle)));
  const label = GetLabelText(code);
  const model = label === 'NULL' ? code : label;
  return make && make !== 'NULL' ? `${make} ${model}` : model;
}
