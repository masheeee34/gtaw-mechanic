import { useEffect, useRef, useState } from 'react';
import { createPressureState, isInZone, tick, type PressureSettings } from './pressureGaugeRules';

const FEEDBACK_MS = 400;
const MAX_FRAME_SECONDS = 0.1;

// The dial is a 270° arc, from bottom left (-135°) to bottom right (+135°).
const CENTER = { x: 100, y: 110 };
const RADIUS = 80;
const START_DEG = -135;
const SWEEP_DEG = 270;

const toDegrees = (pressure: number) => START_DEG + pressure * SWEEP_DEG;

function pointAt(radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: CENTER.x + radius * Math.cos(radians), y: CENTER.y + radius * Math.sin(radians) };
}

function arc(from: number, to: number): string {
  const start = pointAt(RADIUS, from);
  const end = pointAt(RADIUS, to);
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${to - from > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

interface PressureGaugeProps extends PressureSettings {
  onComplete: (success: boolean) => void;
}

export function PressureGauge({ duration, decay, boost, minZone, maxZone, onComplete }: PressureGaugeProps) {
  const [state, setState] = useState(() => createPressureState({ duration, minZone, maxZone }));
  const pumped = useRef(false);
  const pump = () => {
    pumped.current = true;
  };
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // The gauge runs on its own animation loop; a pump (Space, E or a click) is applied on the next frame.
  useEffect(() => {
    const settings = { duration, decay, boost, minZone, maxZone };
    let current = createPressureState(settings);
    let last: number | null = null;
    let completion: number | undefined;
    let frame = requestAnimationFrame(function loop(now) {
      const seconds = last === null ? 0 : Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
      last = now;
      current = tick(current, seconds, settings, pumped.current);
      pumped.current = false;
      setState(current);

      if (current.outcome === 'playing') frame = requestAnimationFrame(loop);
      else completion = window.setTimeout(() => onCompleteRef.current(current.outcome === 'won'), FEEDBACK_MS);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(completion);
    };
  }, [duration, decay, boost, minZone, maxZone]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'KeyE') return;
      event.preventDefault();
      if (!event.repeat) pump();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const inZone = isInZone(state.pressure, { minZone, maxZone });
  const tooHigh = state.pressure > maxZone;
  const needle = toDegrees(state.pressure);
  const tip = pointAt(RADIUS - 10, needle);
  const baseLeft = pointAt(12, needle + 90);
  const baseRight = pointAt(12, needle - 90);
  const held = ((duration - state.holdLeft) / duration) * 100;

  return (
    <div className="minigame gauge-game" onPointerDown={pump}>
      <svg className="gauge" viewBox="0 0 200 200" role="img" aria-label={`Pression : ${Math.round(state.pressure * 100)} %`}>
        <path d={arc(START_DEG, START_DEG + SWEEP_DEG)} className="gauge-track" />
        <path d={arc(toDegrees(minZone), toDegrees(maxZone))} className="gauge-zone" />
        <path d={arc(toDegrees(maxZone), toDegrees(1))} className="gauge-danger" />
        <path
          d={arc(START_DEG, Math.max(START_DEG + 0.1, needle))}
          className={`gauge-fill${inZone ? ' ok' : tooHigh ? ' danger' : ''}`}
        />
        <polygon
          className="gauge-needle"
          points={`${tip.x},${tip.y} ${baseLeft.x},${baseLeft.y} ${baseRight.x},${baseRight.y}`}
        />
        <circle className="gauge-hub" cx={CENTER.x} cy={CENTER.y} r={8} />
        <text className="gauge-value" x={CENTER.x} y={CENTER.y + 32} textAnchor="middle">
          {Math.round(state.pressure * 100)} %
        </text>
      </svg>

      <div className="minigame-meta">
        <span className={inZone ? 'gauge-status-ok' : 'gauge-status-warn'}>
          {inZone ? 'Zone verte' : tooHigh ? 'Surpression !' : 'Pression trop basse'}
        </span>
        <span>Encore {state.holdLeft.toFixed(1).replace('.', ',')} s</span>
      </div>
      <div className="timer" role="progressbar" aria-label="Maintien" aria-valuenow={Math.round(held)}>
        <div className="timer-fill" style={{ width: `${held}%` }} />
      </div>
      <p className="minigame-hint">
        Gardez l'aiguille dans la zone verte : <kbd>Espace</kbd> ou <kbd>E</kbd> pour pomper
      </p>
    </div>
  );
}
