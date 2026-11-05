/** @typedef {number[]} Vec3 [x, y, z], as returned by GetEntityCoords */

/** @param {Vec3} a @param {Vec3} b */
export function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Ground distance, ignoring height: a marker is reached whether you stand on it or next to its pole. */
export function flatDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * The garage the position is in. When zones overlap, the closest center wins.
 * @param {Vec3} position
 * @param {Array<{ id: string, center: Vec3, radius: number }>} garages
 */
export function findGarage(position, garages) {
  let found = null;
  let closest = Infinity;
  for (const garage of garages) {
    const gap = distance(position, garage.center);
    if (gap <= garage.radius && gap < closest) {
      found = garage;
      closest = gap;
    }
  }
  return found;
}
