// Client entry point. Following GTAW's approach, the client does all the work it can (zone checks,
// diagnostics, animations, mini-games, the walking around) and only asks the server for what it cannot
// be trusted with: permission, stock, which part the mechanic holds, and the repair log.
//
// Gameplay loop: [E] near a car in a garage → tablet diagnostic → menu → "Réparer" → take the part at
// the garage rack → carry it to the car → [E] at the part → work animation + mini-game → installed.

import { partPositions, startWork, stopWork } from './animation.js';
import { focusPart, projectMarkers, rotateView, startView, stopView, viewActive } from './camera.js';
import { parseConfig } from './config.js';
import { diagnose, summarize } from './diagnostics.js';
import { emoteText } from './emotes.js';
import { Key, Stage, advance, objective, startJob } from './job.js';
import { errorMessage } from './messages.js';
import { onNui, sendNui } from './nui.js';
import {
  playPickupMotion,
  restrictCarryingControls,
  startCarrying,
  startTablet,
  stopCarrying,
  stopTablet,
} from './props.js';
import { createRpc } from './rpc.js';
import { applyRepair, delay, findNearestVehicle, readVehicleState, requestControl, vehicleDisplayName } from './vehicle.js';
import { WHEEL_OFF_STATE, showWheelOff } from './wheels.js';
import { Control, drawObjective, drawText3d, groundZ, pressed } from './world.js';
import { distance, findGarage, flatDistance } from './zones.js';

const RESOURCE = GetCurrentResourceName();
const PROMPT_INTERVAL_MS = 500;
const PROMPT_DISTANCE = 3.5;
const WATCH_INTERVAL_MS = 1000;
const LEAVE_MARGIN = 4.0;
const JOB_LEAVE_DISTANCE = 30.0;
const REACH = { rack: 1.5, part: 1.1 };
const TURN_MS = 800;
const AME_RANGE = 20.0;
const AME_MS = 7000;
const HEAD_BONE = 31086;

const config = parseConfig(LoadResourceFile(RESOURCE, 'config.json'));
const partsById = new Map(config.parts.map((part) => [part.id, part]));
const garagesById = new Map(config.garages.map((garage) => [garage.id, garage]));
const scanDuration = config.diagnostic?.duration ?? 3000;
const rpc = createRpc({ emitNet, onNet, prefix: RESOURCE });

/**
 * The inspection in progress: the menu is open, or a repair job runs in the world.
 * @type {{ vehicle: number, netId: number, garage: any, plate: string, job: any, prop: number, acting: boolean, watcher: any } | null}
 */
let session = null;
let isMechanic = false;
let opening = false;
let promptVehicle = 0;
let tick = null;
let shownPrompt = '[]';
/** /ame lines shown above heads, by server id. */
const emotes = new Map();

const ok = (data = null) => ({ ok: true, data });
const fail = (error) => ({ ok: false, error, message: errorMessage(error) });

// GTAW-style notification drawn by the NUI (components/Notifications.tsx), with or without the menu open.
function notify(message, kind = 'info') {
  sendNui('notify', { kind, message });
}

const notifyError = (code) => notify(errorMessage(code), 'error');

function inspect(vehicle) {
  const parts = diagnose(readVehicleState(vehicle), config.parts, config.thresholds);
  return { parts, condition: summarize(parts, config.thresholds) };
}

// The server only sends ids and numbers; labels come from the config the client already has.
function withItemLabels(stock) {
  return stock.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity, ...config.items[entry.itemId] }));
}

function withPartLabels(history) {
  return history.map((entry) => ({
    ...entry,
    partLabel: partsById.get(entry.partId)?.label ?? entry.partId,
    garageLabel: garagesById.get(entry.garageId)?.label ?? entry.garageId,
  }));
}

// GTAW-style key prompt drawn by the NUI (components/Prompt.tsx). Called every frame, sent only on change.
function setPrompt(lines) {
  const key = JSON.stringify(lines);
  if (key === shownPrompt) return;
  shownPrompt = key;
  sendNui('prompt', { lines });
}

// --- Per-frame work only runs while there is something to show: the prompt, or a job. ---

function updateTick() {
  const needed = promptVehicle !== 0 || Boolean(session?.job) || viewActive() || emotes.size > 0;
  if (needed && tick === null) tick = setTick(frame);
  if (!needed && tick !== null) {
    clearTick(tick);
    tick = null;
    setPrompt([]);
  }
}

function frame() {
  if (emotes.size > 0) drawEmotes();
  if (session?.job) return setPrompt(jobFrame());
  if (viewActive()) {
    const markers = projectMarkers();
    if (markers) sendNui('markers', { markers });
    return setPrompt([]);
  }
  if (promptVehicle === 0) return setPrompt([]);
  setPrompt([{ key: Key.INTERACT, text: 'Inspecter le véhicule' }]);
  if (pressed(Control.INTERACT)) void openInspection(promptVehicle);
}

// Twice a second, not every frame: is a mechanic on foot next to a car, inside a garage?
function refreshPrompt() {
  promptVehicle = 0;
  if (isMechanic && !session && !opening) {
    const ped = PlayerPedId();
    if (!IsPedInAnyVehicle(ped, false) && findGarage(GetEntityCoords(ped, true), config.garages)) {
      const vehicle = findNearestVehicle(PROMPT_DISTANCE);
      if (vehicle !== 0 && NetworkGetEntityIsNetworked(vehicle)) promptVehicle = vehicle;
    }
  }
  updateTick();
}

async function checkAccess() {
  const response = await rpc.request('checkAccess');
  isMechanic = Boolean(response.ok && response.data.allowed);
}

// --- Inspection: diagnostic animation, then the menu. ---

async function playDiagnostic(vehicle) {
  const ped = PlayerPedId();
  TaskTurnPedToFaceEntity(ped, vehicle, TURN_MS);
  await delay(TURN_MS);
  const tablet = await startTablet();
  const steps = diagnose(readVehicleState(vehicle), config.parts, config.thresholds).map((part) => part.label);
  sendNui('scan', { duration: scanDuration, steps });
  await delay(scanDuration);
  stopTablet(tablet);
}

async function openInspection(target = 0) {
  if (session || opening) return;

  const ped = PlayerPedId();
  if (IsPedInAnyVehicle(ped, false)) return notify("Sortez du véhicule pour l'inspecter.");

  const garage = findGarage(GetEntityCoords(ped, true), config.garages);
  if (!garage) return notifyError('not_in_garage');

  const vehicle = target || findNearestVehicle(config.interactionDistance);
  if (vehicle === 0) return notify('Aucun véhicule à proximité.');
  if (!NetworkGetEntityIsNetworked(vehicle)) return notifyError('not_networked');

  opening = true;
  promptVehicle = 0;
  updateTick();
  ame('inspect');
  try {
    const netId = NetworkGetNetworkIdFromEntity(vehicle);
    // The diagnostic animation covers the server round trip.
    const [response] = await Promise.all([rpc.request('openSession', garage.id, netId), playDiagnostic(vehicle)]);
    if (!response.ok) {
      sendNui('close');
      return notifyError(response.error);
    }

    const { plate, stock, history } = response.data;
    session = { vehicle, netId, garage, plate, job: null, prop: 0, acting: false, watcher: setInterval(watchSession, WATCH_INTERVAL_MS) };
    sendNui('open', {
      vehicle: { model: vehicleDisplayName(vehicle), plate, garageId: garage.id, garageLabel: garage.label },
      ...inspect(vehicle),
      stock: withItemLabels(stock),
      history: withPartLabels(history),
    });
    SetNuiFocus(true, true);
    startView(vehicle, config.parts);
    updateTick();
  } finally {
    opening = false;
  }
}

async function closeInspection() {
  if (!session) return;
  const current = session;
  session = null;
  clearInterval(current.watcher);
  stopView();
  SetNuiFocus(false, false);
  sendNui('close');
  updateTick();
  await endJob(current, { putBack: true });
}

// Closes everything if the car disappears or the mechanic walks off (further away during a job,
// since the rack can be across the garage).
function watchSession() {
  if (!session) return;
  const position = GetEntityCoords(PlayerPedId(), true);
  const gone = !DoesEntityExist(session.vehicle);
  const limit = session.job ? JOB_LEAVE_DISTANCE : config.interactionDistance + LEAVE_MARGIN;
  const tooFar = !gone && distance(position, GetEntityCoords(session.vehicle, false)) > limit;
  const leftGarage = !findGarage(position, config.garages);
  if (!gone && !tooFar && !leftGarage) return;

  void closeInspection();
  notifyError(gone ? 'vehicle_not_found' : leftGarage ? 'not_in_garage' : 'too_far');
}

function reopenMenu(stock) {
  if (stock) sendNui('update', { stock: withItemLabels(stock) });
  sendNui('show');
  SetNuiFocus(true, true);
  startView(session.vehicle, config.parts);
  updateTick();
}

// --- Repair job: fetch the part, carry it, install it. ---

function jobTarget(current) {
  if (current.job.stage === Stage.FETCH) return current.garage.rack ?? current.garage.center;
  return partPositions(current.vehicle, partsById.get(current.job.partId)).stand;
}

function jobFrame() {
  const current = session;
  const { job } = current;
  if (job.holdingPart && job.stage !== Stage.WORKING) restrictCarryingControls();
  if (job.stage === Stage.WORKING || current.acting) return [];

  const part = partsById.get(job.partId);
  const goal = objective(job, part, config.items[part.item]);
  const target = jobTarget(current);
  drawObjective(target, groundZ(target));

  const near = flatDistance(GetEntityCoords(PlayerPedId(), true), target) <= REACH[goal.target];
  if (pressed(Control.CANCEL)) void abandonJob();
  else if (near && pressed(Control.INTERACT)) void (job.stage === Stage.FETCH ? takePart() : installPart());
  return near ? goal.near : goal.far;
}

async function takePart() {
  const current = session;
  const part = partsById.get(current.job.partId);
  const item = config.items[part.item];
  current.acting = true;
  await playPickupMotion(550);
  const response = await rpc.request('takePart', current.garage.id, part.id);

  if (session !== current) {
    // The inspection closed while the server answered: do not keep a part nobody carries.
    if (response.ok) void rpc.request('returnPart');
    return;
  }
  current.acting = false;
  if (!response.ok) {
    notifyError(response.error);
    await endJob(current, { putBack: false });
    return reopenMenu(null);
  }

  current.job = advance(current.job, 'partTaken');
  current.prop = await startCarrying(item);
  sendNui('update', { stock: withItemLabels(response.data.stock) });
  notify(`${part.quantity}× ${item.label} récupéré : apportez la pièce au véhicule.`);
  ame('take', part.id);
}

async function installPart() {
  const current = session;
  const part = partsById.get(current.job.partId);
  current.acting = true;
  if (!(await requestControl(current.vehicle))) {
    current.acting = false;
    return notifyError('no_control');
  }

  stopCarrying(current.prop);
  current.prop = 0;
  current.job = advance(current.job, 'installStarted');
  ame('install', part.id);
  await startWork(current.vehicle, part);
  if (session !== current) return;

  current.acting = false;
  sendNui('minigame', { partId: part.id, minigame: part.minigame });
  SetNuiFocus(true, true);
}

/** Stops the job's props and animations, and puts the part back on the shelf when asked to. */
async function endJob(current, { putBack }) {
  const { job } = current;
  if (!job) return null;
  current.job = null;
  stopCarrying(current.prop);
  current.prop = 0;
  if (job.stage === Stage.WORKING) stopWork(current.vehicle, partsById.get(job.partId));
  if (!putBack || !job.holdingPart) return null;

  const response = await rpc.request('returnPart');
  return response.ok ? response.data.stock : null;
}

async function abandonJob() {
  const current = session;
  const { holdingPart, partId } = current.job;
  const stock = await endJob(current, { putBack: true });
  if (holdingPart) ame('abandon', partId);
  if (session !== current) return;
  notify(holdingPart ? 'Réparation abandonnée, la pièce est remise en stock.' : 'Réparation abandonnée.');
  reopenMenu(stock);
}

// --- NUI callbacks ---

onNui('close', () => {
  void closeInspection();
  return ok();
});

onNui('repair:start', ({ partId }) => {
  const part = partsById.get(partId);
  if (!session) return fail('no_session');
  if (!part) return fail('unknown_part');
  if (session.job) return fail('busy');

  const diagnosis = inspect(session.vehicle).parts.find((candidate) => candidate.id === partId);
  if (!diagnosis) return fail('unknown_part');
  if (!diagnosis.needsRepair) return fail('nothing_to_repair');

  session.job = startJob(part);
  stopView();
  SetNuiFocus(false, false);
  updateTick();
  notify(`Allez chercher ${part.quantity}× ${config.items[part.item].label} au stock du garage.`);
  return ok();
});

// After the mini-game. `show` tells the page whether the menu comes back or the job goes on in the world.
onNui('repair:finish', async ({ partId, success, cancelled }) => {
  const current = session;
  if (!current?.job || current.job.partId !== partId || current.job.stage !== Stage.WORKING) return fail('no_session');
  const part = partsById.get(partId);

  if (cancelled) {
    const stock = await endJob(current, { putBack: true });
    if (stock) sendNui('update', { stock: withItemLabels(stock) });
    SetNuiFocus(true, true);
    startView(current.vehicle, config.parts);
    updateTick();
    return { ...fail('cancelled'), show: true };
  }

  stopWork(current.vehicle, part);
  const retry = async (error) => {
    current.job = advance(current.job, 'minigameFailed');
    current.prop = await startCarrying(config.items[part.item]);
    SetNuiFocus(false, false);
    notifyError(error);
    return { ...fail(error), show: false };
  };
  if (!success) {
    ame('failed', partId);
    return retry('minigame_failed');
  }
  if (!(await requestControl(current.vehicle))) return retry('no_control');

  // The server checks permission, position and the part in hand, then logs the repair.
  // Only then is the damage actually fixed.
  const response = await rpc.request('repair', current.garage.id, current.netId, partId);
  if (session !== current) return fail('no_session');
  if (!response.ok) return retry(response.error);

  current.job = null;
  applyRepair(current.vehicle, part);
  ame('done', partId);
  SetNuiFocus(true, true);
  startView(current.vehicle, config.parts);
  updateTick();
  return ok({
    ...inspect(current.vehicle),
    stock: withItemLabels(response.data.stock),
    history: withPartLabels(response.data.history),
  });
});

// The 3D view: move onto a part (or back to the whole car), turn around the car.
onNui('view:focus', ({ partId }) => {
  focusPart(partId ? partsById.get(partId) : null);
  return ok();
});

onNui('view:rotate', ({ delta }) => {
  const degrees = Number(delta);
  if (Number.isFinite(degrees)) rotateView(Math.max(-90, Math.min(90, degrees)));
  return ok();
});

// --- /ame: the mechanic's actions, written above their head for the players around ---

const ame = (action, partId = '') => emitNet(`${RESOURCE}:ame`, action, partId);

onNet(`${RESOURCE}:ame`, (serverId, name, action, partId) => {
  const text = emoteText(action, partsById.get(partId), config.items);
  const player = GetPlayerFromServerId(serverId);
  if (!text || player === -1) return;
  const ped = GetPlayerPed(player);
  if (!DoesEntityExist(ped)) return;
  if (distance(GetEntityCoords(ped, true), GetEntityCoords(PlayerPedId(), true)) > AME_RANGE) return;
  emotes.set(serverId, { ped, text: `* ${String(name).replace(/~/g, '')} ${text}`, until: GetGameTimer() + AME_MS });
  updateTick();
});

function drawEmotes() {
  const now = GetGameTimer();
  for (const [id, emote] of emotes) {
    if (now > emote.until || !DoesEntityExist(emote.ped)) {
      emotes.delete(id);
      continue;
    }
    const [x, y, z] = GetPedBoneCoords(emote.ped, HEAD_BONE, 0.0, 0.0, 0.0);
    drawText3d(x, y, z + 0.45, emote.text);
  }
  if (emotes.size === 0) updateTick();
}

// A wheel taken off by any mechanic, shown on every client that has the vehicle (wheels.js).
AddStateBagChangeHandler(WHEEL_OFF_STATE, '', (bagName, _key, value) => {
  const vehicle = GetEntityFromStateBagName(bagName);
  if (vehicle !== 0) showWheelOff(vehicle, value ?? null);
});

// --- Entry points ---

RegisterCommand('mecano', () => void openInspection(), false);
RegisterKeyMapping('mecano', 'Inspecter le véhicule le plus proche (mécanicien)', 'keyboard', 'F7');

setInterval(refreshPrompt, PROMPT_INTERVAL_MS);
void checkAccess();
on('playerSpawned', () => void checkAccess());

on('onResourceStop', (resource) => {
  if (resource !== RESOURCE) return;
  stopView(true);
  if (!session) return;
  stopCarrying(session.prop);
  stopWork(session.vehicle, session.job ? partsById.get(session.job.partId) : null);
  ClearPedTasks(PlayerPedId());
  SetNuiFocus(false, false);
});
