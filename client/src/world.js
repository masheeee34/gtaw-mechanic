// Per-frame world feedback: objective markers, /ame text and key presses. Prompts are drawn by the NUI.

// E and Backspace. Not X: GTAW opens its interaction wheel with X.
export const Control = Object.freeze({ INTERACT: 38, CANCEL: 194 });

const ACCENT = [245, 165, 36];

export function pressed(control) {
  return IsControlJustReleased(0, control);
}

/** Ground height under a point, falling back to the point itself (e.g. inside an interior). */
export function groundZ([x, y, z]) {
  const [found, ground] = GetGroundZFor_3dCoord(x, y, z + 1.0, false);
  return found ? ground : z - 1.0;
}

/** A bobbing chevron above the target and a ring on the ground, in the GTAW accent colour. */
export function drawObjective(position, ground) {
  const [x, y] = position;
  const [r, g, b] = ACCENT;
  DrawMarker(2, x, y, ground + 1.4, 0, 0, 0, 180.0, 0, 0, 0.3, 0.3, 0.3, r, g, b, 210, true, true, 2, false, null, null, false);
  DrawMarker(25, x, y, ground + 0.02, 0, 0, 0, 0, 0, 0, 0.9, 0.9, 0.9, r, g, b, 140, false, false, 2, false, null, null, false);
}

/** Text floating at a world position, in GTA World's /ame style (light purple, outlined). */
export function drawText3d(x, y, z, text) {
  SetDrawOrigin(x, y, z, 0);
  SetTextFont(0);
  SetTextScale(0.0, 0.32);
  SetTextColour(194, 162, 218, 255);
  SetTextOutline();
  SetTextCentre(true);
  BeginTextCommandDisplayText('STRING');
  AddTextComponentSubstringPlayerName(text);
  EndTextCommandDisplayText(0.0, 0.0);
  ClearDrawOrigin();
}
