import { describe, expect, it } from 'vitest';
import { facesCamera, focusPose, overviewPose, partAnchor } from '../src/view.js';

// Rough bounding box of a sedan: 2 m wide, 4.6 m long, 1.5 m high.
const sedan = { min: { x: -1.0, y: -2.3, z: -0.5 }, max: { x: 1.0, y: 2.3, z: 1.0 } };
const noBones = () => null;
const tire = (wheel) => ({ id: `tire_${wheel}`, type: 'tire', wheel, item: 'tire', label: 'Pneu' });
const wide = 16 / 9;
const outside = (point) => Math.abs(point.x) > sedan.max.x || Math.abs(point.y) > sedan.max.y;

describe('partAnchor', () => {
  it('uses the bone when the model has it', () => {
    const anchor = partAnchor(tire(0), sedan, (bone) => (bone === 'wheel_lf' ? { x: -0.8, y: 1.4, z: -0.2 } : null));
    expect(anchor).toEqual({ x: -0.8, y: 1.4, z: -0.2 });
  });

  it('falls back to the right corner of the car for each wheel', () => {
    const frontLeft = partAnchor(tire(0), sedan, noBones);
    const rearRight = partAnchor(tire(5), sedan, noBones);
    expect(frontLeft.x).toBeLessThan(0);
    expect(frontLeft.y).toBeGreaterThan(0);
    expect(rearRight.x).toBeGreaterThan(0);
    expect(rearRight.y).toBeLessThan(0);
  });

  it('puts the engine at the front without an engine bone', () => {
    expect(partAnchor({ type: 'engine' }, sedan, noBones).y).toBeGreaterThan(0);
  });
});

describe('camera poses', () => {
  it('sees the whole car from outside it, from the requested side', () => {
    const front = overviewPose(sedan, 0, wide);
    const right = overviewPose(sedan, 90, wide);
    expect(front.camera.y).toBeGreaterThan(sedan.max.y);
    expect(right.camera.x).toBeGreaterThan(sedan.max.x);
    expect(front.camera.z).toBeGreaterThan(sedan.max.z);
  });

  it('aims to the right of the car so it shows left of the menu, more on wider screens', () => {
    // Looking at the car from the front (towards -y), the viewer's right is -x.
    const standard = overviewPose(sedan, 0, wide).target.x;
    expect(standard).toBeLessThan(0);
    expect(overviewPose(sedan, 0, 21 / 9).target.x).toBeLessThan(standard);
  });

  it('moves onto a part from outside the car, on its side', () => {
    const anchor = { x: -0.8, y: 1.4, z: -0.2 };
    const { camera } = focusPose(tire(0), anchor, sedan, wide);
    expect(outside(camera)).toBe(true);
    expect(camera.x).toBeLessThan(0);
    expect(camera.y).toBeGreaterThan(0);
  });

  it('dims markers on the far side of the car', () => {
    const leftWheel = { x: -0.8, y: 1.4, z: 0 };
    expect(facesCamera(leftWheel, overviewPose(sedan, -90, wide).camera, sedan)).toBe(true);
    expect(facesCamera(leftWheel, overviewPose(sedan, 90, wide).camera, sedan)).toBe(false);
  });
});
