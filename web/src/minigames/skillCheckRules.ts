// Pure rules of the skill check: a needle sweeps a bar and the player stops it inside a target zone.
// Positions are normalized: 0 is the left edge of the bar, 1 the right edge.

export interface Zone {
  start: number;
  end: number;
}

export interface RoundSettings {
  zoneSize: number;
  speed: number;
}

const EDGE_MARGIN = 0.12;
const MIN_ZONE_SIZE = 0.06;
const ZONE_SHRINK_PER_ROUND = 0.12;
const SPEED_GAIN_PER_ROUND = 0.15;

/** Each round is a bit harder than the previous one: smaller zone, faster needle. */
export function roundSettings(base: RoundSettings, round: number): RoundSettings {
  return {
    zoneSize: Math.max(MIN_ZONE_SIZE, base.zoneSize * (1 - ZONE_SHRINK_PER_ROUND * round)),
    speed: base.speed * (1 + SPEED_GAIN_PER_ROUND * round),
  };
}

/** Random zone that never touches the edges, where the needle turns around and is easiest to stop. */
export function createZone(size: number, random: () => number = Math.random): Zone {
  const clamped = Math.min(Math.max(size, MIN_ZONE_SIZE), 1 - 2 * EDGE_MARGIN);
  const start = EDGE_MARGIN + random() * (1 - 2 * EDGE_MARGIN - clamped);
  return { start, end: start + clamped };
}

/** Needle position after `elapsedMs`, bouncing between both edges. `speed` is in sweeps per second. */
export function needlePosition(elapsedMs: number, speed: number): number {
  const phase = ((elapsedMs / 1000) * speed) % 2;
  return phase <= 1 ? phase : 2 - phase;
}

export function isHit(position: number, zone: Zone): boolean {
  return position >= zone.start && position <= zone.end;
}
