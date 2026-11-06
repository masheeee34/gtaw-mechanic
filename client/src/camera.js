// Scripted camera of the inspection menu: shows the real car, goes close to its worst parts during the
// scan, turns around it, zooms, moves onto one spot, and projects every spot (parts, broken windows,
// damaged doors, dents, pinned notes) on the screen for the NUI.

import { readVehicleState } from './vehicle.js';
import { FOV, TOUR, dentSpots, facesCamera, focusPose, overviewPose, partSpots, tourDuration } from './view.js';

const MOVE_MS = 700;
const LEAVE_MS = 500;
const DEFAULT_YAW = -40;
const ZOOM = { min: 0.6, max: 1.5 };
const LIFT = { min: -1.0, max: 3.0 };
const XRAY_ALPHA = 110;
// A note floats a little above the spot it was pinned on, so both markers stay readable.
const NOTE_RAISE = 0.18;

/**
 * @type {{
 *   vehicle: number, dims: any, parts: Map<string, any>, spots: Map<string, any>, aspect: number,
 *   cam: number, yaw: number, zoom: number, lift: number, focused: any, xray: boolean,
 *   tour: { start: number, stops: string[], step: number } | null, last: string,
 * } | null}
 */
let view = null;

const toWorld = (vehicle, point) => GetOffsetFromEntityInWorldCoords(vehicle, point.x, point.y, point.z);
const round = (value) => Math.round(value * 10000) / 10000;
const clamp = (value, { min, max }) => Math.min(max, Math.max(min, value));

function readDims(vehicle) {
  const [min, max] = GetModelDimensions(GetEntityModel(vehicle));
  return { min: { x: min[0], y: min[1], z: min[2] }, max: { x: max[0], y: max[1], z: max[2] } };
}

function bonePosition(vehicle, bone) {
  const index = GetEntityBoneIndexByName(vehicle, bone);
  if (index === -1) return null;
  const [x, y, z] = GetWorldPositionOfEntityBone(vehicle, index);
  const [localX, localY, localZ] = GetOffsetFromEntityGivenWorldCoords(vehicle, x, y, z);
  return { x: localX, y: localY, z: localZ };
}

function dentDepth(vehicle, point) {
  const [x, y, z] = GetVehicleDeformationAtPos(vehicle, point.x, point.y, point.z);
  return Math.hypot(x, y, z);
}

function readSpots(vehicle, dims, parts, notes) {
  const state = readVehicleState(vehicle);
  const locate = (bone) => bonePosition(vehicle, bone);
  const spots = parts.flatMap((part) => partSpots(part, dims, locate, state));
  const body = parts.find((part) => part.type === 'body');
  if (body) spots.push(...dentSpots(body.id, dims, (point) => dentDepth(vehicle, point)));
  spots.push(...noteSpots(notes));
  return new Map(spots.map((spot) => [spot.id, spot]));
}

const noteSpots = (notes) =>
  notes.map((note) => ({ id: `note:${note.id}`, partId: null, label: null, note: note.id, anchor: { x: note.x, y: note.y, z: note.z } }));

function place(cam, vehicle, pose) {
  const [x, y, z] = toWorld(vehicle, pose.camera);
  const [targetX, targetY, targetZ] = toWorld(vehicle, pose.target);
  SetCamCoord(cam, x, y, z);
  PointCamAtCoord(cam, targetX, targetY, targetZ);
  SetCamFov(cam, FOV);
}

function destroyLater(cam, ms) {
  setTimeout(() => {
    if (DoesCamExist(cam)) DestroyCam(cam, false);
  }, ms + 100);
}

const overview = () => overviewPose(view.dims, view.yaw, view.aspect, view.zoom, view.lift);

function currentPose() {
  if (!view.focused) return overview();
  const { spot, part } = view.focused;
  return focusPose(part, spot.anchor, view.dims, view.aspect, view.zoom);
}

// Smooth move: a new camera, interpolated from the current one.
function moveTo(pose, ms = MOVE_MS) {
  const next = CreateCam('DEFAULT_SCRIPTED_CAMERA', false);
  place(next, view.vehicle, pose);
  SetCamActiveWithInterp(next, view.cam, ms, 1, 1);
  destroyLater(view.cam, ms);
  view.cam = next;
}

// The camera cannot be moved by hand during the scan.
const usable = () => view !== null && view.tour === null && DoesEntityExist(view.vehicle);

export const viewActive = () => view !== null;

/**
 * Starts the view on the whole car. With `stops` (part ids), it is the 3D scan: the camera arrives on
 * the whole car, goes close to each part in turn, then comes back. Returns the scan's length in
 * milliseconds (0 without a scan).
 */
export function startView(vehicle, parts, notes, stops = null) {
  if (view) stopView(true);
  const dims = readDims(vehicle);
  const cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', false);
  view = {
    vehicle,
    dims,
    parts: new Map(parts.map((part) => [part.id, part])),
    spots: readSpots(vehicle, dims, parts, notes),
    aspect: GetAspectRatio(false),
    cam,
    yaw: DEFAULT_YAW,
    zoom: 1,
    lift: 0,
    focused: null,
    xray: false,
    tour: stops ? { start: GetGameTimer(), stops, step: -1 } : null,
    last: '',
  };
  place(cam, vehicle, overview());
  SetCamActive(cam, true);
  RenderScriptCams(true, true, TOUR.enter, true, true);
  return stops ? tourDuration(stops.length) : 0;
}

export function stopView(instant = false) {
  if (!view) return;
  const { cam, vehicle, xray } = view;
  view = null;
  if (xray && DoesEntityExist(vehicle)) ResetEntityAlpha(vehicle);
  RenderScriptCams(false, !instant, instant ? 0 : LEAVE_MS, true, true);
  if (instant) DestroyCam(cam, false);
  else destroyLater(cam, LEAVE_MS);
}

/** Replaces the pinned notes shown on the car, after one was added or deleted. */
export function setNotes(notes) {
  if (!view) return;
  for (const [id, spot] of view.spots) if (spot.note) view.spots.delete(id);
  for (const spot of noteSpots(notes)) view.spots.set(spot.id, spot);
  view.last = '';
}

/** Where a new note goes when pinned on a spot: just above it, in the vehicle's local space. */
export function noteAnchor(spotId) {
  const spot = view?.spots.get(spotId);
  return spot ? { ...spot.anchor, z: spot.anchor.z + NOTE_RAISE } : null;
}

/** Moves onto a spot (or the first spot of a part), or back to the whole car when `id` is null. */
export function focusSpot(id, partsById) {
  if (!usable()) return;
  const spot = id ? (view.spots.get(id) ?? [...view.spots.values()].find((candidate) => candidate.partId === id)) : null;
  view.focused = spot ? { spot, part: partsById.get(spot.partId) } : null;
  moveTo(currentPose());
}

/** Turns around the car and raises or lowers the camera. From a spot, goes back to the whole car. */
export function orbitView(yawDegrees, liftMeters) {
  if (!usable()) return;
  view.yaw = (view.yaw + yawDegrees) % 360;
  view.lift = clamp(view.lift + liftMeters, LIFT);
  if (view.focused) {
    view.focused = null;
    moveTo(overview());
  } else {
    place(view.cam, view.vehicle, overview());
  }
}

/** Zooms in (factor below 1) or out, on the whole car or on the spot in view. */
export function zoomView(factor) {
  if (!usable()) return;
  view.zoom = clamp(view.zoom * factor, ZOOM);
  place(view.cam, view.vehicle, currentPose());
}

/** See-through bodywork, for the mechanic only, so the markers behind the car stay visible. */
export function setXray(enabled) {
  if (!usable()) return;
  view.xray = enabled;
  if (enabled) SetEntityAlpha(view.vehicle, XRAY_ALPHA, false);
  else ResetEntityAlpha(view.vehicle);
  view.last = '';
}

// The scan: after the arrival, one move and one pause per part, then back to the whole car.
function advanceTour() {
  const { start, stops } = view.tour;
  const elapsed = GetGameTimer() - start - TOUR.enter;
  const step = Math.min(stops.length, Math.floor(elapsed / (TOUR.move + TOUR.hold)));
  if (elapsed >= 0 && step > view.tour.step) {
    view.tour.step = step;
    const spot = step < stops.length ? view.spots.get(stops[step]) : null;
    if (spot) {
      moveTo(focusPose(view.parts.get(stops[step]), spot.anchor, view.dims, view.aspect, view.zoom), TOUR.move);
    } else if (step === stops.length) {
      moveTo(overview(), TOUR.back);
    }
  }
  if (GetGameTimer() - start >= tourDuration(stops.length)) view.tour = null;
}

/** Every frame while the view is on: the spots' screen positions (0–1), or null if nothing moved. */
export function projectMarkers() {
  if (!view || !DoesEntityExist(view.vehicle)) return null;
  HideHudAndRadarThisFrame();

  if (view.tour) advanceTour();

  const [camX, camY, camZ] = GetFinalRenderedCamCoord();
  const [x, y, z] = GetOffsetFromEntityGivenWorldCoords(view.vehicle, camX, camY, camZ);
  const camera = { x, y, z };

  const markers = [];
  for (const spot of view.spots.values()) {
    const [worldX, worldY, worldZ] = toWorld(view.vehicle, spot.anchor);
    const [onScreen, screenX, screenY] = GetScreenCoordFromWorldCoord(worldX, worldY, worldZ);
    if (!onScreen) continue;
    markers.push({
      id: spot.id,
      partId: spot.partId,
      label: spot.label,
      dent: spot.dent ?? null,
      note: spot.note ?? null,
      x: round(screenX),
      y: round(screenY),
      front: view.xray || facesCamera(spot.anchor, camera, view.dims),
    });
  }

  const key = JSON.stringify(markers);
  if (key === view.last) return null;
  view.last = key;
  return markers;
}
