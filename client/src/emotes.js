// /ame lines (GTA World's written roleplay): each action of the mechanic shows "* Name action" above
// their head for the players around. The server only relays an action and a part id; the French text
// is written here, so nobody can make another player display free text.

const WHEELS = { 0: 'avant gauche', 1: 'avant droite', 4: 'arrière gauche', 5: 'arrière droite' };

const SUBJECT = {
  engine: () => 'le moteur',
  fuel_tank: () => 'le réservoir',
  body: () => 'la carrosserie',
  windows: () => 'les vitres',
  tire: (part) => `la roue ${WHEELS[part.wheel] ?? ''}`.trim(),
};

const WORK = {
  engine: () => 'ouvre le capot et se penche sur le moteur, clé en main.',
  fuel_tank: () => "s'accroupit près du réservoir et rebranche les durites.",
  body: () => 'redresse la tôlerie à coups de maillet.',
  windows: () => 'met en place le nouveau vitrage.',
  tire: (part) => `s'accroupit et dévisse les écrous de ${SUBJECT.tire(part)}.`,
};

// What the mechanic picks up, by item id.
const CARRIED = {
  engine_parts: 'une caisse de pièces moteur',
  fuel_tank: 'un réservoir neuf',
  body_panel: 'un panneau de carrosserie',
  glass_kit: 'un kit vitrage',
  tire: 'un pneu neuf',
};

/** French text of an /ame action, without the name. Null for an unknown action or part. */
export function emoteText(action, part, items) {
  if (action === 'inspect') return 'sort sa tablette et lance un diagnostic sur le véhicule.';
  if (!part) return null;
  const subject = (SUBJECT[part.type] ?? (() => part.label.toLowerCase()))(part);

  switch (action) {
    case 'take':
      return `attrape ${CARRIED[part.item] ?? (items[part.item]?.label ?? part.item).toLowerCase()} sur l'étagère.`;
    case 'install':
      return (WORK[part.type] ?? (() => `se met au travail sur ${subject}.`))(part);
    case 'done':
      return `termine de réparer ${subject}.`;
    case 'failed':
      return `peine sur ${subject} et doit s'y reprendre.`;
    case 'abandon':
      return "repose la pièce sur l'étagère.";
    default:
      return null;
  }
}
