// 3D inspection view, pure maths in the vehicle's local space (x right, y forward, z up): where each
// part's marker sits on the car, and where the camera stands to show the whole car or one part.

import { WHEEL_BONES } from './vehicle.js';

/** Vertical field of view of the inspection camera, in degrees. */
export const FOV = 50;

// The menu is a panel on the right of the screen (about a quarter of it), so the camera aims to the
// right of its subject to show it in the middle of the free part, a quarter of the half-width left of
// the screen centre. How far that is in the world depends on the screen's aspect ratio.
const SCREEN_SHIFT = 0.25;
const HALF_FOV_TAN = Math.tan((FOV * Math.PI) / 360);

// Bones that mark each part, best first. Bodywork has none: its marker goes on the driver's side.
const ANCHOR_BONES = {
  engine: ['engine', 'bonnet'],
  fuel_tank: ['petrolcap', 'petroltank'],
  windows: ['windscreen', 'windscreen_r'],
};

// How far and how high the camera stands from a part it moves onto.
const FOCUS = {
  engine: { distance: 2.4, height: 1.5 },
  fuel_tank: { distance: 1.9, height: 0.5 },
  body: { distance: 3.4, height: 0.9 },
  windows: { distance: 2.8, height: 0.9 },
  tire: { distance: 2.1, height: 0.5 },
};

const center = ({ min, max }) => ({ x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 });

/**
 * Local position of a part's marker.
 * @param {(bone: string) => ({ x: number, y: number, z: number } | null)} bonePosition local bone position, null if missing
 */
export function partAnchor(part, dims, bonePosition) {
  const bones = part.type === 'tire' ? [WHEEL_BONES[part.wheel]] : (ANCHOR_BONES[part.type] ?? []);
  for (const bone of bones) {
    const position = bone ? bonePosition(bone) : null;
    if (position) return position;
  }
  return fallbackAnchor(part, dims);
}

// Models without the bone: an estimate from the bounding box.
function fallbackAnchor(part, dims) {
  const { min, max } = dims;
  const middle = center(dims);
  switch (part.type) {
    case 'engine':
      return { x: middle.x, y: max.y * 0.65, z: max.z * 0.6 };
    case 'fuel_tank':
      return { x: max.x, y: min.y * 0.55, z: middle.z + 0.1 };
    case 'windows':
      return { x: middle.x, y: max.y * 0.25, z: max.z * 0.8 };
    case 'tire': {
      const front = part.wheel <= 1;
      const right = part.wheel % 2 === 1;
      return { x: (right ? max.x : min.x) * 0.85, y: (front ? max.y : min.y) * 0.62, z: min.z + 0.35 };
    }
    default:
      return { x: min.x, y: middle.y, z: middle.z };
  }
}

// Aims to the right of the target so the target shows in the free part of the screen, left of the menu.
function aimed(camera, target, aspect) {
  const dx = target.x - camera.x;
  const dy = target.y - camera.y;
  const length = Math.hypot(dx, dy) || 1;
  const shift = length * SCREEN_SHIFT * HALF_FOV_TAN * aspect;
  return { camera, target: { x: target.x + (dy / length) * shift, y: target.y - (dx / length) * shift, z: target.z } };
}

/** The whole car, seen from `yaw` degrees around it (0 = in front, 90 = its right side). */
export function overviewPose(dims, yaw, aspect) {
  const middle = center(dims);
  const length = dims.max.y - dims.min.y;
  const width = dims.max.x - dims.min.x;
  const height = dims.max.z - dims.min.z;
  const distance = Math.hypot(length, width) + 1.8;
  const angle = (yaw * Math.PI) / 180;
  const camera = {
    x: middle.x + Math.sin(angle) * distance,
    y: middle.y + Math.cos(angle) * distance,
    z: middle.z + height * 0.5 + 1.2,
  };
  return aimed(camera, middle, aspect);
}

/** Close on one part, from outside the car, on the side the part is on. */
export function focusPose(part, anchor, dims, aspect) {
  const middle = center(dims);
  const { distance, height } = FOCUS[part.type] ?? FOCUS.body;
  let dx = anchor.x - middle.x;
  let dy = anchor.y - middle.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) [dx, dy] = [0, 1];
  else [dx, dy] = [dx / length, dy / length];
  return aimed({ x: anchor.x + dx * distance, y: anchor.y + dy * distance, z: anchor.z + height }, anchor, aspect);
}

/** False when the marker is on the far side of the car: the NUI dims it. */
export function facesCamera(anchor, camera, dims) {
  const middle = center(dims);
  return (anchor.x - middle.x) * (camera.x - middle.x) + (anchor.y - middle.y) * (camera.y - middle.y) >= -0.3;
}
