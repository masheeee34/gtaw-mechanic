// A repair job, from "Réparer" in the menu to the installed part. Pure state: main.js drives it
// and does the world side (markers, props, animations, server calls).
//
//   fetch    walk to the garage rack and take the part
//   install  carry the part to the right spot on the vehicle
//   working  the mini-game is running

export const Stage = Object.freeze({ FETCH: 'fetch', INSTALL: 'install', WORKING: 'working' });

const TRANSITIONS = {
  partTaken: { from: Stage.FETCH, to: Stage.INSTALL },
  installStarted: { from: Stage.INSTALL, to: Stage.WORKING },
  minigameFailed: { from: Stage.WORKING, to: Stage.INSTALL },
};

export function startJob(part) {
  return { partId: part.id, stage: Stage.FETCH, holdingPart: false };
}

/** Moves the job forward. An event that does not fit the current stage leaves it unchanged. */
export function advance(job, event) {
  const transition = TRANSITIONS[event];
  if (!transition) throw new Error(`Unknown job event "${event}".`);
  if (job.stage !== transition.from) return job;
  return { ...job, stage: transition.to, holdingPart: job.holdingPart || event === 'partTaken' };
}

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
        near: [{ key: Key.INTERACT, text: `Installer : ${part.label}` }, giveUp],
      };
    default:
      return { target: null, far: [], near: [] };
  }
}
