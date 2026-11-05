// Where the mechanic stands to work on a part, in the vehicle's local space (x: right, y: forward).
// Pure, so the geometry is tested without the game; animation.js converts it to world coordinates.

const FRONT_GAP = 0.75;
const SIDE_GAP = 0.8;

/**
 * @param {string} type part type from config.json
 * @param {{ min: { x: number, y: number }, max: { x: number, y: number } }} dimensions model bounding box
 * @param {{ x: number, y: number } | null} bone local position of the part's bone, when the model has it
 * @returns {{ stand: { x: number, y: number }, face: { x: number, y: number } }}
 */
export function approachPoint(type, dimensions, bone) {
  const { min, max } = dimensions;

  switch (type) {
    case 'engine':
    case 'windows':
      return { stand: { x: 0, y: max.y + FRONT_GAP }, face: { x: 0, y: max.y - 0.5 } };

    case 'tire':
    case 'fuel_tank':
      if (bone) {
        const side = bone.x < 0 ? -1 : 1;
        return { stand: { x: bone.x + side * SIDE_GAP, y: bone.y }, face: { x: bone.x, y: bone.y } };
      }
      return { stand: { x: min.x - SIDE_GAP, y: min.y * 0.5 }, face: { x: min.x, y: min.y * 0.5 } };

    case 'body':
    default:
      return { stand: { x: min.x - SIDE_GAP, y: 0 }, face: { x: 0, y: 0 } };
  }
}
