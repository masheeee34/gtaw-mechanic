import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { scoreRun, type MinigameComplete } from './quality';
import { MAX_MISTAKES, connectDestination, createWireConnect, selectSource } from './wireConnectRules';

const WIRE_COLORS = ['#ef5b5b', '#5b8cef', '#3ccf8e', '#f5a524', '#b05bef', '#5bcfef'];
const FEEDBACK_MS = 400;
const WRONG_FLASH_MS = 320;
const TICK_MS = 100;

interface WireConnectProps {
  wires: number;
  timeLimit: number;
  onComplete: MinigameComplete;
  random?: () => number;
}

// Each source wire has a colour; the same colours sit shuffled on the other side. Click a source, then
// its matching destination, before the time runs out.
export function WireConnect({ wires, timeLimit, onComplete, random = Math.random }: WireConnectProps) {
  const [state, setState] = useState(() => createWireConnect(wires, random));
  const [wrongSource, setWrongSource] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(timeLimit * 1000);
  const [finished, setFinished] = useState(false);
  const finishedRef = useRef(false);
  const completion = useRef<number | undefined>(undefined);

  const finish = useCallback(
    (success: boolean, quality = 0) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setFinished(true);
      completion.current = window.setTimeout(() => onComplete(success, quality), FEEDBACK_MS);
    },
    [onComplete],
  );

  useEffect(() => () => window.clearTimeout(completion.current), []);

  useEffect(() => {
    const deadline = performance.now() + timeLimit * 1000;
    const interval = window.setInterval(() => {
      if (finishedRef.current) return window.clearInterval(interval);
      const left = Math.max(0, deadline - performance.now());
      setRemainingMs(left);
      if (left === 0) finish(false);
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [timeLimit, finish]);

  useEffect(() => {
    if (wrongSource === null) return;
    const timer = window.setTimeout(() => setWrongSource(null), WRONG_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [wrongSource]);

  const pickSource = (source: number) => {
    if (!finished) setState(selectSource(state, source).state);
  };

  const pickDestination = (destination: number) => {
    if (finished || state.selected === null) return;
    const source = state.selected;
    const { state: next, outcome } = connectDestination(state, destination);
    setState(next);
    if (outcome === 'wrong' || outcome === 'failed') setWrongSource(source);
    if (outcome === 'failed') finish(false);
    if (outcome === 'done') {
      finish(true, scoreRun({ timeLeft: remainingMs / 1000, timeLimit, mistakes: next.mistakes, maxMistakes: MAX_MISTAKES - 1 }));
    }
  };

  // mapping[source] is the destination a source must reach, so this gives the source behind each destination.
  const sourceAt: number[] = [];
  for (const [source, destination] of state.mapping.entries()) sourceAt[destination] = source;

  const timerPct = (remainingMs / (timeLimit * 1000)) * 100;

  return (
    <div className="minigame">
      <div className="wc-columns" role="group" aria-label="Reconnexion des câbles">
                <div className="wc-col">
          {Array.from({ length: wires }, (_, src) => {
            const color = WIRE_COLORS[src];
            const isConnected = state.connected[src] !== null;
            const isSelected = state.selected === src;
            const isWrong = wrongSource === src;
            let cls = 'wc-wire wc-wire-src';
            if (isSelected) cls += ' selected';
            if (isConnected) cls += ' connected';
            if (isWrong) cls += ' wrong';
            return (
              <button
                type="button"
                key={src}
                className={cls}
                style={{ '--wire-color': color } as CSSProperties}
                aria-label={`Câble source ${src + 1}`}
                aria-pressed={isSelected}
                onClick={() => pickSource(src)}
                disabled={isConnected || finished}
              >
                <span className="wc-wire-dot" />
                <span className="wc-wire-label">{src + 1}</span>
              </button>
            );
          })}
        </div>

                <svg className="wc-lines" aria-hidden="true">
          {Array.from({ length: wires }, (_, src) => {
            const dest = state.connected[src];
            if (dest === null) return null;
            const color = WIRE_COLORS[src];
            const srcY = (src + 0.5) / wires;
            const dstY = (dest + 0.5) / wires;
            return (
              <line
                key={src}
                x1="0%"
                y1={`${srcY * 100}%`}
                x2="100%"
                y2={`${dstY * 100}%`}
                stroke={color}
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            );
          })}
        </svg>

                <div className="wc-col">
          {Array.from({ length: wires }, (_, dest) => {
            const color = WIRE_COLORS[sourceAt[dest]];
            const isConnected = state.connected.some((v) => v === dest);
            const cls = `wc-wire wc-wire-dest${isConnected ? ' connected' : ''}`;
            return (
              <button
                type="button"
                key={dest}
                className={cls}
                style={{ '--wire-color': color } as CSSProperties}
                aria-label={`Câble destination ${dest + 1}`}
                onClick={() => pickDestination(dest)}
                disabled={isConnected || state.selected === null || finished}
              >
                <span className="wc-wire-label">{dest + 1}</span>
                <span className="wc-wire-dot" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="minigame-meta">
        <span>Erreurs {state.mistakes}/{MAX_MISTAKES}</span>
        <span>{(remainingMs / 1000).toFixed(1).replace('.', ',')} s</span>
      </div>
      <div className="timer">
        <div className="timer-fill" style={{ width: `${timerPct}%` }} />
      </div>
      <p className="minigame-hint">
        Cliquez sur un câble, puis sur son câble de la même couleur en face
      </p>
    </div>
  );
}
