const PART_TYPES = ['engine', 'fuel_tank', 'body', 'windows', 'tire'];
const MINIGAME_TYPES = ['skillcheck', 'lugnuts', 'wireconnect', 'pressuregauge'];

/**
 * Parses config.json and fails fast with a readable message, instead of breaking later in a tick.
 * The server validates the same file on its side (MechanicConfig.Parse).
 * @param {string | null | undefined} raw
 */
export function parseConfig(raw) {
  if (!raw) throw new Error('config.json est introuvable ou vide.');
  const config = JSON.parse(raw);
  const fail = (message) => {
    throw new Error(`config.json invalide : ${message}`);
  };

  if (!Array.isArray(config.garages) || config.garages.length === 0) fail('il faut au moins un garage.');
  for (const garage of config.garages) {
    const validCenter = Array.isArray(garage.center) && garage.center.length === 3;
    if (!garage.id || !validCenter || !(garage.radius > 0)) {
      fail(`le garage « ${garage.id ?? '?'} » doit avoir un id, un centre [x, y, z] et un rayon positif.`);
    }
    if (garage.rack !== undefined && !(Array.isArray(garage.rack) && garage.rack.length === 3)) {
      fail(`le stock du garage « ${garage.id} » doit être une position [x, y, z].`);
    }
  }

  for (const [id, item] of Object.entries(config.items ?? {})) {
    if (item.carry !== undefined && typeof item.carry?.model !== 'string') {
      fail(`l'objet porté de l'article « ${id} » doit avoir un modèle.`);
    }
  }

  if (config.diagnostic !== undefined && !(config.diagnostic.duration > 0)) {
    fail('diagnostic.duration doit être positif.');
  }

  if (!config.thresholds || !(config.thresholds.good > config.thresholds.worn)) {
    fail('thresholds.good doit être supérieur à thresholds.worn.');
  }

  if (!Array.isArray(config.parts) || config.parts.length === 0) fail('il faut au moins une pièce.');
  const ids = new Set();
  for (const part of config.parts) {
    if (ids.has(part.id)) fail(`la pièce « ${part.id} » est en double.`);
    ids.add(part.id);
    if (!PART_TYPES.includes(part.type)) fail(`la pièce « ${part.id} » a un type inconnu « ${part.type} ».`);
    if (part.type === 'tire' && !Number.isInteger(part.wheel)) fail(`le pneu « ${part.id} » doit avoir un index de roue.`);
    if (!config.items?.[part.item]) fail(`la pièce « ${part.id} » utilise l'article inconnu « ${part.item} ».`);
    if (!(part.quantity > 0)) fail(`la pièce « ${part.id} » doit avoir une quantité positive.`);
    if (!MINIGAME_TYPES.includes(part.minigame?.type)) fail(`la pièce « ${part.id} » n'a pas de mini-jeu valide.`);
    const { animation } = part;
    if (!animation?.scenario && !(animation?.dict && animation?.name)) {
      fail(`la pièce « ${part.id} » doit avoir une animation (scenario, ou dict et name).`);
    }
  }

  return config;
}
