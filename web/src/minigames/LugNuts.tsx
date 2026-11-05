import { useCallback, useEffect, useRef, useState } from 'react';
import { createLugNuts, tighten } from './lugNutRules';
import { scoreRun, type MinigameComplete } from './quality';

const FEEDBACK_MS = 450;
const WRONG_FLASH_MS = 320;
const TICK_MS = 100;
const CENTER = 120;
const NUT_ORBIT = 52;
const TARGET_TORQUE = 120; // Nm, a typical wheel nut torque

interface LugNutsProps {
  nuts: number;
  timeLimit: number;
  maxMistakes: number;
  mode?: 'loosen' | 'tighten';
  onComplete: MinigameComplete;
}

export function LugNuts({ nuts, timeLimit, maxMistakes, mode = 'tighten', onComplete }: LugNutsProps) {
  const loosening = mode === 'loosen';
  const [state, setState] = useState(() => createLugNuts(nuts));
  const [wrongNut, setWrongNut] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(timeLimit * 1000);
  const finished = useRef(false);
  const completion = useRef<number | undefined>(undefined);

  const finish = useCallback(
    (success: boolean, quality = 0) => {
      if (finished.current) return;
      finished.current = true;
      completion.current = window.setTimeout(() => onComplete(success, quality), FEEDBACK_MS);
    },
    [onComplete],
  );

  useEffect(() => () => window.clearTimeout(completion.current), []);

  useEffect(() => {
    const deadline = performance.now() + timeLimit * 1000;
    const interval = window.setInterval(() => {
      if (finished.current) return window.clearInterval(interval);
      const left = Math.max(0, deadline - performance.now());
      setRemainingMs(left);
      if (left === 0) finish(false);
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [timeLimit, finish]);

  useEffect(() => {
    if (wrongNut === null) return;
    const timer = window.setTimeout(() => setWrongNut(null), WRONG_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [wrongNut]);

  const press = useCallback((nut: number) => {
    if (finished.current) return;
    const { state: next, outcome } = tighten(state, nut, maxMistakes);
    setState(next);

    if (outcome === 'wrong' || outcome === 'failed') {
      setWrongNut(nut);
    }

    if (outcome === 'failed') finish(false);
    if (outcome === 'done') {
      finish(true, scoreRun({ timeLeft: remainingMs / 1000, timeLimit, mistakes: next.mistakes, maxMistakes }));
    }
  }, [state, maxMistakes, finish, remainingMs, timeLimit]);

  // Number keys 1 to 9 tighten the matching nut.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const num = parseInt(event.key, 10);
      if (!isNaN(num) && num >= 1 && num <= nuts) {
        event.preventDefault();
        press(num - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nuts, press]);

  // Where each nut sits around the hub.
  const nutCoords = Array.from({ length: nuts }, (_, nut) => {
    const angle = (nut / nuts) * Math.PI * 2 - Math.PI / 2;
    return {
      x: CENTER + Math.cos(angle) * NUT_ORBIT,
      y: CENTER + Math.sin(angle) * NUT_ORBIT,
    };
  });

  const currentTorque = Math.round((state.tightened.length / nuts) * TARGET_TORQUE);

  return (
    <div className="minigame lugnuts-minigame">
      {/* Torque status */}
      <div className="torque-meter-bar">
        <div className="torque-info">
          <span className="torque-label">{loosening ? 'Desserrage' : 'Couple de serrage'}</span>
          <span className="torque-value">{currentTorque} / {TARGET_TORQUE} Nm</span>
        </div>
        <div className="torque-track">
          <div
            className="torque-fill"
            style={{ width: `${(currentTorque / TARGET_TORQUE) * 100}%` }}
          />
        </div>
      </div>

      {/* The wheel: tire, brake disc and caliper, rim, nuts */}
      <div className="wheel-stage">
        <svg className="wheel-cad" viewBox="0 0 240 240" role="group" aria-label="Roue">
          <defs>
            <radialGradient id="tire-grad" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="#14151c" />
              <stop offset="90%" stopColor="#0c0d12" />
              <stop offset="100%" stopColor="#050508" />
            </radialGradient>
            <radialGradient id="rim-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2e303d" />
              <stop offset="85%" stopColor="#1c1d24" />
              <stop offset="100%" stopColor="#121318" />
            </radialGradient>
            <radialGradient id="disc-grad" cx="50%" cy="50%" r="50%">
              <stop offset="40%" stopColor="#434654" />
              <stop offset="80%" stopColor="#2c2e39" />
              <stop offset="100%" stopColor="#1e1f26" />
            </radialGradient>
            <filter id="nut-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f5a524" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Tire */}
          <circle cx={CENTER} cy={CENTER} r={114} fill="url(#tire-grad)" stroke="#222430" strokeWidth="2" />
          <circle cx={CENTER} cy={CENTER} r={105} fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={CENTER} cy={CENTER} r={96} fill="none" stroke="#0a0b0e" strokeWidth="4" />

          {/* Brake disc */}
          <circle cx={CENTER} cy={CENTER} r={92} fill="url(#disc-grad)" stroke="#383b47" strokeWidth="1.5" />
          {/* Disc ventilation holes */}
          {Array.from({ length: 16 }, (_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            const rx1 = CENTER + Math.cos(angle) * 78;
            const ry1 = CENTER + Math.sin(angle) * 78;
            const rx2 = CENTER + Math.cos(angle + 0.1) * 66;
            const ry2 = CENTER + Math.sin(angle + 0.1) * 66;
            return (
              <g key={i}>
                <circle cx={rx1} cy={ry1} r={1.8} fill="#14151a" />
                <circle cx={rx2} cy={ry2} r={1.8} fill="#14151a" />
              </g>
            );
          })}

          {/* Brake caliper */}
          <path
            d="M 194,85 C 206,105 206,135 194,155 L 182,148 C 190,132 190,108 182,92 Z"
            fill="#b85d18"
            stroke="#e07e2a"
            strokeWidth="1.5"
          />

          {/* Rim */}
          <circle cx={CENTER} cy={CENTER} r={84} fill="url(#rim-grad)" stroke="#3e4152" strokeWidth="2" />
          <circle cx={CENTER} cy={CENTER} r={34} fill="#181920" stroke="#323440" strokeWidth="2" />

          {/* Rim spokes */}
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2;
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const x1 = CENTER + cos * 34;
            const y1 = CENTER + sin * 34;
            const x2 = CENTER + cos * 84;
            const y2 = CENTER + sin * 84;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255, 255, 255, 0.18)"
                strokeWidth="7"
                strokeLinecap="round"
              />
            );
          })}

          {/* Hub cap */}
          <circle cx={CENTER} cy={CENTER} r={20} fill="#111217" stroke="#484b5c" strokeWidth="1.5" />
          <polygon
            points={`${CENTER},${CENTER - 9} ${CENTER + 8},${CENTER - 4} ${CENTER + 8},${CENTER + 5} ${CENTER},${CENTER + 9} ${CENTER - 8},${CENTER + 5} ${CENTER - 8},${CENTER - 4}`}
            fill="#232530"
            stroke="#4d5063"
            strokeWidth="1"
          />

          {/* Star pattern: lines between the nuts already tightened */}
          {state.tightened.length > 1 && (
            <g className="star-lines">
              {state.tightened.slice(0, -1).map((nutA, idx) => {
                const nutB = state.tightened[idx + 1];
                const ptA = nutCoords[nutA];
                const ptB = nutCoords[nutB];
                return (
                  <line
                    key={idx}
                    x1={ptA.x}
                    y1={ptA.y}
                    x2={ptB.x}
                    y2={ptB.y}
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                    className="star-line-segment"
                  />
                );
              })}
            </g>
          )}

          {/* Nuts (hexagons), clickable */}
          {nutCoords.map(({ x, y }, nut) => {
            const order = state.tightened.indexOf(nut);
            const isTight = order !== -1;
            const isWrong = wrongNut === nut;

            // Hexagon around the nut centre.
            const R = 13;
            const hexPoints = Array.from({ length: 6 }, (_, i) => {
              const ang = (i / 6) * Math.PI * 2;
              return `${x + Math.cos(ang) * R},${y + Math.sin(ang) * R}`;
            }).join(' ');

            return (
              <g
                key={nut}
                className={`nut-node ${isTight ? 'tight' : ''} ${isWrong ? 'wrong' : ''}`}
                role="button"
                aria-label={`Écrou ${nut + 1}`}
                aria-pressed={isTight}
                onClick={() => press(nut)}
              >
                {/* Nut */}
                <polygon
                  points={hexPoints}
                  className="nut-hex"
                  filter={isTight ? 'url(#nut-glow)' : undefined}
                />
                {/* Stud */}
                <circle cx={x} cy={y} r={6} className="nut-core" />

                {/* Tightening order, or the key to press */}
                <text x={x} y={y + 0.5} className="nut-num-text">
                  {isTight ? order + 1 : nut + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Mistakes and timer */}
      <div className="minigame-meta">
        <span className="mistakes-counter">
          Erreurs {state.mistakes}/{maxMistakes}
        </span>
        <span className="time-remaining">{(remainingMs / 1000).toFixed(1).replace('.', ',')} s</span>
      </div>

      <div className="timer">
        <div
          className="timer-fill"
          style={{ width: `${(remainingMs / (timeLimit * 1000)) * 100}%` }}
        />
      </div>

      <p className="minigame-hint">
        {loosening ? 'Desserrez' : 'Serrez'} les écrous en étoile (<kbd>1</kbd> à <kbd>{nuts}</kbd> ou clic direct)
      </p>
    </div>
  );
}
