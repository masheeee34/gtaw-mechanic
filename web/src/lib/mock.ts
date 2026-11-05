// Browser-only stand-in for the game client, so the UI can be developed with `npm run dev:web`.
// Imported dynamically behind import.meta.env.DEV: none of this ends up in the production build.

import type { Condition, HistoryEntry, MinigameConfig, PartDiagnosis, PartMarker, PartStatus, SessionData, SessionUpdate } from '../types';

const MINIGAMES: Record<string, MinigameConfig> = {
  engine: { type: 'skillcheck', rounds: 3, zoneSize: 0.14, speed: 0.9 },
  fuel_tank: { type: 'wireconnect', wires: 4, timeLimit: 15 },
  body: { type: 'pressuregauge', duration: 8, decay: 0.12, boost: 0.14, minZone: 0.38, maxZone: 0.72 },
  windows: { type: 'skillcheck', rounds: 2, zoneSize: 0.2, speed: 0.7 },
  tire: { type: 'lugnuts', nuts: 5, timeLimit: 12, maxMistakes: 1 },
};

const statusFor = (health: number): PartStatus => (health >= 70 ? 'good' : health >= 35 ? 'worn' : 'critical');

function part(
  id: string,
  label: string,
  category: string,
  item: string,
  quantity: number,
  health: number,
  detail: string,
): PartDiagnosis {
  return { id, label, category, item, quantity, health, status: statusFor(health), detail, needsRepair: health < 100 };
}

function summarize(parts: PartDiagnosis[]): Condition {
  const health = Math.round(parts.reduce((sum, p) => sum + p.health, 0) / parts.length);
  return { health, status: statusFor(health) };
}

let session: SessionData | null = null;
let nextHistoryId = 100;

export function createMockSession(): SessionData {
  const parts = [
    part('engine', 'Moteur', 'Mécanique', 'engine_parts', 1, 32, 'Dégâts importants, le moteur doit être révisé.'),
    part('fuel_tank', 'Réservoir', 'Mécanique', 'fuel_tank', 1, 100, 'Aucune fuite détectée.'),
    part('body', 'Tôlerie', 'Carrosserie', 'body_panel', 2, 58, 'Bosses et rayures · 1 portière endommagée.'),
    part('windows', 'Vitres', 'Carrosserie', 'glass_kit', 1, 67, '2 vitres cassées sur 6.'),
    part('tire_fl', 'Pneu avant gauche', 'Roues', 'tire', 1, 0, 'Crevé.'),
    part('tire_fr', 'Pneu avant droit', 'Roues', 'tire', 1, 100, 'Bon état.'),
    part('tire_rl', 'Pneu arrière gauche', 'Roues', 'tire', 1, 100, 'Bon état.'),
    part('tire_rr', 'Pneu arrière droit', 'Roues', 'tire', 1, 0, 'Détruit, roule sur la jante.'),
  ];

  session = {
    vehicle: { model: 'Karin Sultan', plate: '46EEK572', garageId: 'burton', garageLabel: 'Los Santos Customs - Burton' },
    condition: summarize(parts),
    parts,
    stock: [
      { itemId: 'engine_parts', label: 'Pièces moteur', description: 'Pistons, joints et courroies pour une révision moteur.', quantity: 3 },
      { itemId: 'fuel_tank', label: 'Réservoir', description: 'Réservoir de carburant étanche, prêt à monter.', quantity: 2 },
      { itemId: 'body_panel', label: 'Panneaux de carrosserie', description: 'Panneaux et portières de remplacement pour la tôlerie.', quantity: 1 },
      { itemId: 'glass_kit', label: 'Kit vitrage', description: 'Pare-brise et vitres latérales.', quantity: 4 },
      { itemId: 'tire', label: 'Pneu', description: 'Pneu routier standard, jante comprise.', quantity: 7 },
    ],
    history: [
      { id: 2, partId: 'tire_rl', partLabel: 'Pneu arrière gauche', garageLabel: 'La Mesa Auto Repair', mechanicName: 'Jamie Ortega', repairedAt: '2026-11-02T19:42:00Z' },
      { id: 1, partId: 'engine', partLabel: 'Moteur', garageLabel: 'Los Santos Customs - Burton', mechanicName: 'Alex Moreau', repairedAt: '2026-10-28T14:05:00Z' },
    ],
  };
  return session;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockNui(event: string, data: unknown): Promise<unknown> {
  const payload = (data ?? {}) as { partId?: string; success?: boolean; cancelled?: boolean };
  await wait(event === 'repair:start' ? 900 : 300);

  if (event === 'repair:start') {
    if (!minigameFor(payload.partId)) return { ok: false, error: 'unknown_part', message: 'Requête invalide.' };
    reachPartLater(payload.partId!);
    return { ok: true, data: null };
  }

  if (event === 'repair:finish') return finishRepair(payload);
  return { ok: true, data: null };
}

// Where the client would project each part on a car filmed in 3/4 front-left (dev server only).
export const MOCK_MARKERS: PartMarker[] = [
  { id: 'engine', x: 0.29, y: 0.42, front: true },
  { id: 'windows', x: 0.36, y: 0.33, front: true },
  { id: 'body', x: 0.27, y: 0.55, front: true },
  { id: 'fuel_tank', x: 0.47, y: 0.47, front: false },
  { id: 'tire_fl', x: 0.17, y: 0.63, front: true },
  { id: 'tire_fr', x: 0.33, y: 0.68, front: true },
  { id: 'tire_rl', x: 0.43, y: 0.58, front: true },
  { id: 'tire_rr', x: 0.52, y: 0.6, front: false },
];

export const MOCK_SCAN = {
  duration: 2000,
  steps: ['Moteur', 'Réservoir', 'Tôlerie', 'Vitres', 'Pneu avant gauche', 'Pneu avant droit', 'Pneu arrière gauche', 'Pneu arrière droit'],
};

const minigameFor = (partId?: string) => MINIGAMES[partId?.startsWith('tire_') ? 'tire' : partId ?? ''];

// In game the mechanic now walks to the rack, carries the part and presses E at the car.
// Here that trip is skipped: the mini-game simply starts a moment later.
function reachPartLater(partId: string) {
  window.setTimeout(() => window.postMessage({ action: 'minigame', data: { partId, minigame: minigameFor(partId) } }, '*'), 1200);
}

function finishRepair({ partId, success, cancelled }: { partId?: string; success?: boolean; cancelled?: boolean }) {
  if (cancelled) return { ok: false, error: 'cancelled', message: 'Réparation abandonnée.', show: true };
  if (!success) {
    reachPartLater(partId!);
    return { ok: false, error: 'minigame_failed', message: 'La réparation a échoué, réessayez.', show: false };
  }

  const current = session ?? createMockSession();
  const repaired = current.parts.find((p) => p.id === partId);
  const stock = current.stock.find((s) => s.itemId === repaired?.item);
  if (!repaired || !stock) return { ok: false, error: 'unknown_part', message: 'Requête invalide.' };
  if (stock.quantity < repaired.quantity) {
    return { ok: false, error: 'out_of_stock', message: 'Pas assez de pièces en stock.' };
  }

  const parts = current.parts.map((p) =>
    p.id === repaired.id ? { ...p, health: 100, status: 'good' as const, detail: 'Tout juste réparé.', needsRepair: false } : p,
  );
  const entry: HistoryEntry = {
    id: nextHistoryId++,
    partId: repaired.id,
    partLabel: repaired.label,
    garageLabel: current.vehicle.garageLabel,
    mechanicName: 'Vous',
    repairedAt: new Date().toISOString(),
  };
  const update: SessionUpdate = {
    parts,
    condition: summarize(parts),
    stock: current.stock.map((s) => (s === stock ? { ...s, quantity: s.quantity - repaired.quantity } : s)),
    history: [entry, ...current.history],
  };
  session = { ...current, ...update };
  return { ok: true, data: update };
}
