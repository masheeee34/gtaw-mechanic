import { describe, expect, it } from 'vitest';
import { DENT_DEPTH, dentProbes, dentSpots, facesCamera, focusPose, overviewPose, partAnchor, partSpots } from '../src/view.js';

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

describe('partSpots', () => {
  const state = { windows: { total: 6, broken: [] }, doors: { total: 4, damaged: [] } };
  const bones = { window_lf: { x: -0.8, y: 0.3, z: 0.6 }, windscreen: { x: 0, y: 0.9, z: 0.8 }, door_pside_f: { x: 0.9, y: 0.9, z: 0.1 } };
  const locate = (bone) => bones[bone] ?? null;

  it('gives one spot to a part in good condition', () => {
    const spots = partSpots({ id: 'windows', type: 'windows' }, sedan, locate, state);
    expect(spots).toEqual([{ id: 'windows', partId: 'windows', label: null, anchor: bones.windscreen }]);
  });

  it('gives one spot per broken window, on its bone', () => {
    const spots = partSpots({ id: 'windows', type: 'windows' }, sedan, locate, { ...state, windows: { total: 6, broken: [0, 6] } });
    expect(spots.map((spot) => [spot.id, spot.label])).toEqual([
      ['windows', null],
      ['windows:0', 'Vitre avant gauche'],
      ['windows:6', 'Pare-brise'],
    ]);
  });

  it('puts a damaged door spot in the middle of the door, not on its hinge', () => {
    const [, door] = partSpots({ id: 'body', type: 'body' }, sedan, locate, { ...state, doors: { total: 4, damaged: [1] } });
    expect(door.label).toBe('Portière avant droite');
    expect(door.anchor.y).toBeLessThan(bones.door_pside_f.y);
  });

  it('keeps only the part spot when the model lacks the bones', () => {
    const spots = partSpots({ id: 'body', type: 'body' }, sedan, noBones, { ...state, doors: { total: 4, damaged: [2] } });
    expect(spots.map((spot) => spot.id)).toEqual(['body']);
  });
});

describe('dentSpots', () => {
  it('probes every side of the car and the roof', () => {
    const zones = dentProbes(sedan).map((probe) => probe.zone);
    expect(zones).toEqual(expect.arrayContaining(['avant', 'arrière', 'flanc gauche', 'flanc droit', 'toit']));
  });

  it('keeps only the dents deep enough, and tells light from heavy ones', () => {
    const depths = { avant: DENT_DEPTH.heavy, 'flanc droit': DENT_DEPTH.light, toit: DENT_DEPTH.light / 2 };
    const probes = dentProbes(sedan);
    const zoneAt = (point) => probes.find((probe) => JSON.stringify(probe.point) === JSON.stringify(point)).zone;
    const depthAt = (point) => depths[zoneAt(point)] ?? 0;

    const dents = dentSpots('body', sedan, depthAt);

    expect(dents.map((dent) => [dent.label, dent.dent, dent.partId])).toEqual([
      ['Choc avant', 'heavy', 'body'],
      ['Choc flanc droit', 'light', 'body'],
    ]);
  });
});

describe('camera zoom and lift', () => {
  it('moves the camera away when zooming out and up when lifting', () => {
    const base = overviewPose(sedan, 0, wide);
    const far = overviewPose(sedan, 0, wide, 1.4);
    const high = overviewPose(sedan, 0, wide, 1, 1);
    expect(far.camera.y).toBeGreaterThan(base.camera.y);
    expect(high.camera.z).toBeCloseTo(base.camera.z + 1);
  });
});
