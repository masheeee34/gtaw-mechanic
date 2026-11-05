// Scripted camera of the inspection menu: shows the real car, turns around it, moves onto one part,
// and projects each part's marker on the screen for the NUI.

import { FOV, facesCamera, focusPose, overviewPose, partAnchor } from './view.js';

const ENTER_MS = 800;
const MOVE_MS = 700;
const LEAVE_MS = 500;
const DEFAULT_YAW = -40;

/** @type {{ vehicle: number, dims: any, anchors: Map<string, any>, aspect: number, cam: number, yaw: number, focused: boolean, last: string } | null} */
let view = null;

const toWorld = (vehicle, point) => GetOffsetFromEntityInWorldCoords(vehicle, point.x, point.y, point.z);
const round = (value) => Math.round(value * 10000) / 10000;

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

// Smooth move: a new camera, interpolated from the current one.
function moveTo(pose) {
  const next = CreateCam('DEFAULT_SCRIPTED_CAMERA', false);
  place(next, view.vehicle, pose);
  SetCamActiveWithInterp(next, view.cam, MOVE_MS, 1, 1);
  destroyLater(view.cam, MOVE_MS);
  view.cam = next;
}

export const viewActive = () => view !== null;

export function startView(vehicle, parts) {
  if (view) stopView(true);
  const dims = readDims(vehicle);
  const anchors = new Map(parts.map((part) => [part.id, partAnchor(part, dims, (bone) => bonePosition(vehicle, bone))]));
  const aspect = GetAspectRatio(false);
  const cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', false);
  view = { vehicle, dims, anchors, aspect, cam, yaw: DEFAULT_YAW, focused: false, last: '' };
  place(cam, vehicle, overviewPose(dims, DEFAULT_YAW, aspect));
  SetCamActive(cam, true);
  RenderScriptCams(true, true, ENTER_MS, true, true);
}

export function stopView(instant = false) {
  if (!view) return;
  const { cam } = view;
  view = null;
  RenderScriptCams(false, !instant, instant ? 0 : LEAVE_MS, true, true);
  if (instant) DestroyCam(cam, false);
  else destroyLater(cam, LEAVE_MS);
}

/** Moves onto a part, or back to the whole car when `part` is missing. */
export function focusPart(part) {
  if (!view || !DoesEntityExist(view.vehicle)) return;
  const anchor = part ? view.anchors.get(part.id) : null;
  view.focused = Boolean(anchor);
  moveTo(anchor ? focusPose(part, anchor, view.dims, view.aspect) : overviewPose(view.dims, view.yaw, view.aspect));
}

/** Turns around the car. From a part, goes back to the whole car first. */
export function rotateView(degrees) {
  if (!view || !DoesEntityExist(view.vehicle)) return;
  view.yaw = (view.yaw + degrees) % 360;
  const pose = overviewPose(view.dims, view.yaw, view.aspect);
  if (view.focused) {
    view.focused = false;
    moveTo(pose);
  } else {
    place(view.cam, view.vehicle, pose);
  }
}

/** Every frame while the view is on: the markers' screen positions (0–1), or null if nothing moved. */
export function projectMarkers() {
  if (!view || !DoesEntityExist(view.vehicle)) return null;
  HideHudAndRadarThisFrame();
  const [camX, camY, camZ] = GetFinalRenderedCamCoord();
  const [x, y, z] = GetOffsetFromEntityGivenWorldCoords(view.vehicle, camX, camY, camZ);
  const camera = { x, y, z };

  const markers = [];
  for (const [id, anchor] of view.anchors) {
    const [worldX, worldY, worldZ] = toWorld(view.vehicle, anchor);
    const [onScreen, screenX, screenY] = GetScreenCoordFromWorldCoord(worldX, worldY, worldZ);
    if (onScreen) markers.push({ id, x: round(screenX), y: round(screenY), front: facesCamera(anchor, camera, view.dims) });
  }

  const key = JSON.stringify(markers);
  if (key === view.last) return null;
  view.last = key;
  return markers;
}
