// How well a mini-game went, from 0 to 1. The client turns it into how well the part is repaired:
// a careful job restores it completely, a rushed one leaves it a little short of new.

/** Called by every mini-game when it ends. `quality` is 0 on a failure. */
export type MinigameComplete = (success: boolean, quality: number) => void;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Time left and mistakes count for half each. */
export function scoreRun({ timeLeft, timeLimit, mistakes, maxMistakes }: { timeLeft: number; timeLimit: number; mistakes: number; maxMistakes: number }): number {
  const speed = timeLimit > 0 ? clamp(timeLeft / timeLimit) : 1;
  const accuracy = clamp(1 - mistakes / (maxMistakes + 1));
  return (speed + accuracy) / 2;
}

export type QualityLevel = 'soigné' | 'correct' | 'bâclé';

export function qualityLevel(quality: number): QualityLevel {
  if (quality >= 0.85) return 'soigné';
  if (quality >= 0.6) return 'correct';
  return 'bâclé';
}
