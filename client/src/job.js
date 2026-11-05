// A repair job, from "Réparer" in the menu to the installed part. Pure state: main.js drives it
// and does the world side (markers, props, animations, server calls).
//
//   fetch    walk to the garage rack and take the part
//   install  carry the part to the right spot on the vehicle
//   working  the mini-game is running
//   remount  tires only: the old wheel is off, the new one has to be put on and tightened
//
// A tire takes two mini-games: loosen the nuts (the car is jacked up and the wheel comes off), then
// put the new wheel on and tighten them.

export const Stage = Object.freeze({ FETCH: 'fetch', INSTALL: 'install', WORKING: 'working', REMOUNT: 'remount' });

const TRANSITIONS = {
  partTaken: { from: Stage.FETCH, to: () => Stage.INSTALL },
  installStarted: { from: Stage.INSTALL, to: () => Stage.WORKING },
  wheelRemoved: { from: Stage.WORKING, to: () => Stage.REMOUNT },
  remountStarted: { from: Stage.REMOUNT, to: () => Stage.WORKING },
  minigameFailed: { from: Stage.WORKING, to: (job) => (job.wheelOff ? Stage.REMOUNT : Stage.INSTALL) },
};

export function startJob(part) {
  return { partId: part.id, stage: Stage.FETCH, holdingPart: false, wheelOff: false };
}

/** Moves the job forward. An event that does not fit the current stage leaves it unchanged. */
export function advance(job, event) {
  const transition = TRANSITIONS[event];
  if (!transition) throw new Error(`Unknown job event "${event}".`);
  if (job.stage !== transition.from) return job;
  return {
    ...job,
    stage: transition.to(job),
    holdingPart: job.holdingPart || event === 'partTaken',
    wheelOff: job.wheelOff || event === 'wheelRemoved',
  };
}

/** The tire mini-game first loosens the nuts, then, once the wheel is off, tightens them. */
export const nutsMode = (job) => (job.wheelOff ? 'tighten' : 'loosen');

/**
 * Share of full health a repaired part gets back, from the mini-game quality (0 to 1): a careful job
 * restores it completely, a rushed one leaves it at 85 %. Parts that are only whole or broken (tires,
 * windows) ignore it.
 */
export function repairLevel(quality) {
  const value = Number.isFinite(quality) ? Math.min(1, Math.max(0, quality)) : 1;
  return 0.85 + 0.15 * value;
}

/** Below this quality the work is rushed, and the /ame says so. */
export const RUSHED_BELOW = 0.6;

// Keys shown in the prompt: E interacts (control 38), Backspace gives up (control 194).
export const Key = { INTERACT: 'E', CANCEL: 'Retour arrière' };

const giveUp = { key: Key.CANCEL, text: 'Abandonner' };

/**
 * What the mechanic should do now: where to go, and the prompt lines (NUI) far from it and next to it.
 * @returns {{ target: 'rack' | 'part' | null, far: { key?: string, text: string }[], near: { key?: string, text: string }[] }}
 */
export function objective(job, part, item) {
  const parts = `${part.quantity}× ${item.label}`;
  switch (job.stage) {
    case Stage.FETCH:
      return {
        target: 'rack',
        far: [{ text: `Allez chercher ${parts} au stock du garage.` }, giveUp],
        near: [{ key: Key.INTERACT, text: `Prendre ${parts}` }, giveUp],
      };
    case Stage.INSTALL:
      return {
        target: 'part',
        far: [{ text: `Apportez la pièce : ${part.label}.` }, giveUp],
        near: [{ key: Key.INTERACT, text: part.type === 'tire' ? `Lever la voiture et démonter : ${part.label}` : `Installer : ${part.label}` }, giveUp],
      };
    case Stage.REMOUNT:
      return {
        target: 'part',
        far: [{ text: 'Retournez à la roue pour poser la roue neuve.' }, giveUp],
        near: [{ key: Key.INTERACT, text: 'Poser la roue neuve' }, giveUp],
      };
    default:
      return { target: null, far: [], near: [] };
  }
}
