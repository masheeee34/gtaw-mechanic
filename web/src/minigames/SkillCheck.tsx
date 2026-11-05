import { useCallback, useEffect, useRef, useState } from 'react';
import { createZone, isHit, needlePosition, roundSettings } from './skillCheckRules';

const FEEDBACK_MS = 400;
const HIT_FLASH_MS = 220;

interface SkillCheckProps {
  rounds: number;
  zoneSize: number;
  speed: number;
  onComplete: (success: boolean) => void;
  random?: () => number;
}

export function SkillCheck({ rounds, zoneSize, speed, onComplete, random = Math.random }: SkillCheckProps) {
  const [round, setRound] = useState(0);
  const [zone, setZone] = useState(() => createZone(zoneSize, random));
  const [result, setResult] = useState<'hit' | 'miss' | null>(null);
  const [finished, setFinished] = useState(false);
  const needle = useRef<HTMLDivElement>(null);
  const position = useRef(0);
  const completion = useRef<number | undefined>(undefined);
  const { speed: roundSpeed } = roundSettings({ zoneSize, speed }, round);

  // The needle moves every frame, so it is positioned through a ref instead of React state.
  useEffect(() => {
    if (finished) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      position.current = needlePosition(now - start, roundSpeed);
      if (needle.current) needle.current.style.left = `${position.current * 100}%`;
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [round, roundSpeed, finished]);

  useEffect(() => () => window.clearTimeout(completion.current), []);

  useEffect(() => {
    if (result !== 'hit' || finished) return;
    const timer = window.setTimeout(() => setResult(null), HIT_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [result, finished]);

  const attempt = useCallback(() => {
    if (finished) return;
    const hit = isHit(position.current, zone);
    setResult(hit ? 'hit' : 'miss');

    if (!hit || round + 1 >= rounds) {
      setFinished(true);
      completion.current = window.setTimeout(() => onComplete(hit), FEEDBACK_MS);
      return;
    }

    const next = round + 1;
    setRound(next);
    setZone(createZone(roundSettings({ zoneSize, speed }, next).zoneSize, random));
  }, [finished, zone, round, rounds, zoneSize, speed, random, onComplete]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'KeyE') return;
      event.preventDefault();
      if (!event.repeat) attempt();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [attempt]);

  const completed = round + (finished && result === 'hit' ? 1 : 0);

  return (
    <div className="minigame">
      <div className="rounds" aria-label={`Manche ${Math.min(round + 1, rounds)} sur ${rounds}`}>
        {Array.from({ length: rounds }, (_, index) => (
          <span
            key={index}
            className={`round-dot${index < completed ? ' done' : index === round ? ' current' : ''}`}
          />
        ))}
      </div>
      <div className={`skill-track${result ? ` ${result}` : ''}`} data-testid="skill-track" onPointerDown={attempt}>
        <div
          className="skill-zone"
          style={{ left: `${zone.start * 100}%`, width: `${(zone.end - zone.start) * 100}%` }}
        />
        <div className="skill-needle" ref={needle} />
      </div>
      <p className="minigame-hint">
        Appuyez sur <kbd>Espace</kbd> quand l'aiguille est dans la zone
      </p>
    </div>
  );
}
