// Turns raw vehicle readings into per-part diagnoses. Pure: the natives are read in vehicle.js.

/**
 * @typedef {{ index: number, burst: boolean, onRim: boolean }} WheelState
 * @typedef {{
 *   engineHealth: number,
 *   engineTemperature?: number,
 *   oilLevel?: number,
 *   fuelLevel?: number,
 *   bodyHealth: number,
 *   tankHealth: number,
 *   wheels: WheelState[],
 *   windows: { total: number, broken: number[] },
 *   doors: { total: number, damaged: number[] },
 * }} VehicleState
 * @typedef {{ good: number, worn: number }} Thresholds
 */

/** GTA health values go from 1000 (new) down to 0 or below (broken). */
const percent = (value) => Math.round(Math.min(Math.max(value, 0), 1000) / 10);
const ratio = (intact, total) => (total === 0 ? 100 : Math.round((100 * intact) / total));
const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;
const decimal = (value) => value.toFixed(1).replace('.', ',');

/** Raw readings shown in a part's detail card; a reading the game does not give is left out. */
function metrics(readings) {
  return readings.filter(([, value]) => Number.isFinite(value)).map(([label, value, format]) => ({ label, value: format(value) }));
}

/** @returns {'good' | 'worn' | 'critical'} */
export function statusFor(health, thresholds) {
  if (health >= thresholds.good) return 'good';
  if (health >= thresholds.worn) return 'worn';
  return 'critical';
}

// Each inspector returns { health, detail, metrics? }, or null when the vehicle does not have that part.
const INSPECTORS = {
  engine(state) {
    const health = percent(state.engineHealth);
    const readings = metrics([
      ['État', state.engineHealth, (value) => `${Math.round(Math.max(value, 0))} / 1000`],
      ['Température', state.engineTemperature, (value) => `${Math.round(value)} °C`],
      ['Huile', state.oilLevel, (value) => `${decimal(value)} L`],
    ]);
    if (state.engineHealth <= 0) return { health, detail: 'Moteur hors service, le véhicule roule à peine.', metrics: readings };
    if (health < 40) return { health, detail: 'Dégâts importants, le moteur doit être révisé.', metrics: readings };
    const detail = health < 100 ? 'Usure détectée sur les composants du moteur.' : 'Fonctionne parfaitement.';
    return { health, detail, metrics: readings };
  },

  fuel_tank(state) {
    const health = percent(state.tankHealth);
    const readings = metrics([
      ['État', state.tankHealth, (value) => `${Math.round(Math.max(value, 0))} / 1000`],
      ['Carburant', state.fuelLevel, (value) => `${decimal(value)} L`],
    ]);
    return { health, detail: health < 100 ? 'Réservoir endommagé, risque de fuite.' : 'Aucune fuite détectée.', metrics: readings };
  },

  body(state) {
    const { total, damaged } = state.doors;
    const health = Math.min(percent(state.bodyHealth), ratio(total - damaged.length, total));
    if (health === 100) return { health, detail: 'Aucun dégât visible.' };
    const doors = damaged.length > 0 ? ` · ${plural(damaged.length, 'portière endommagée', 'portières endommagées')}` : '';
    return { health, detail: `Bosses et rayures${doors}.` };
  },

  windows(state) {
    const { total, broken } = state.windows;
    if (total === 0) return null;
    const health = ratio(total - broken.length, total);
    const detail =
      broken.length > 0 ? `${plural(broken.length, 'vitre cassée', 'vitres cassées')} sur ${total}.` : 'Toutes les vitres sont intactes.';
    return { health, detail };
  },

  tire(state, part) {
    const wheel = state.wheels.find((candidate) => candidate.index === part.wheel);
    if (!wheel) return null;
    if (!wheel.burst) return { health: 100, detail: 'Bon état.' };
    return { health: 0, detail: wheel.onRim ? 'Détruit, roule sur la jante.' : 'Crevé.' };
  },
};

/**
 * @param {VehicleState} state
 * @param {Array<{ id: string, type: string, label: string, category: string, item: string, quantity: number, wheel?: number }>} parts
 * @param {Thresholds} thresholds
 */
export function diagnose(state, parts, thresholds) {
  return parts.flatMap((part) => {
    const result = INSPECTORS[part.type](state, part);
    if (!result) return [];
    return [
      {
        id: part.id,
        type: part.type,
        label: part.label,
        category: part.category,
        item: part.item,
        quantity: part.quantity,
        health: result.health,
        status: statusFor(result.health, thresholds),
        detail: result.detail,
        metrics: result.metrics ?? [],
        needsRepair: result.health < 100,
      },
    ];
  });
}

/** Overall condition: the average health of every inspected part. */
export function summarize(diagnoses, thresholds) {
  if (diagnoses.length === 0) return { health: 100, status: 'good' };
  const health = Math.round(diagnoses.reduce((sum, part) => sum + part.health, 0) / diagnoses.length);
  return { health, status: statusFor(health, thresholds) };
}
