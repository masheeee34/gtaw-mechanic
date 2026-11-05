import type { PartDiagnosis } from '../types';

export interface RepairStep {
  step: number;
  part: PartDiagnosis;
  reason: string;
}

// Safety first: what can set the car on fire or stop it, then what makes it dangerous to drive,
// then comfort and looks. Critical parts always come before worn ones.
const PRIORITY: Record<string, { rank: number; reason: string }> = {
  fuel_tank: { rank: 0, reason: 'Une fuite de réservoir peut mettre le feu au véhicule.' },
  engine: { rank: 1, reason: 'Le moteur peut caler ou lâcher en roulant.' },
  tire: { rank: 2, reason: 'Un pneu crevé rend la conduite dangereuse.' },
  windows: { rank: 3, reason: "Les vitres protègent l'habitacle." },
  body: { rank: 4, reason: 'La carrosserie ne gêne pas la conduite : elle passe en dernier.' },
};

const UNKNOWN = { rank: 5, reason: 'À réparer.' };
const STATUS_RANK = { critical: 0, worn: 1, good: 2 } as const;

/** The parts to repair, in the order the tablet advises, with the reason. */
export function repairOrder(parts: PartDiagnosis[]): RepairStep[] {
  const priority = (part: PartDiagnosis) => PRIORITY[part.type] ?? UNKNOWN;
  return parts
    .filter((part) => part.needsRepair)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || priority(a).rank - priority(b).rank)
    .map((part, index) => ({ step: index + 1, part, reason: priority(part).reason }));
}
