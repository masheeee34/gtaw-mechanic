import { useEffect, useState } from 'react';
import { Activity, CircleCheck, LoaderCircle } from 'lucide-react';
import type { ScanData } from '../types';

/** Shown while the mechanic scans the vehicle with the tablet, before the diagnosis opens. */
export function ScanOverlay({ duration, steps }: ScanData) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const next = Math.min(1, (now - start) / duration);
      setProgress(next);
      if (next < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [duration]);

  const checked = Math.floor(progress * steps.length);

  return (
    <div className="repair-screen">
      <div className="repair-panel" role="dialog" aria-label="Diagnostic en cours">
        <header className="repair-header">
          <Activity size={15} strokeWidth={2.5} />
          Diagnostic en cours
          <span className="repair-part">{Math.round(progress * 100)}%</span>
        </header>
        <div className="scan-body">
          <div className="timer">
            <div className="timer-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <ul className="scan-steps">
            {steps.map((step, index) => (
              <li key={step} className={index < checked ? 'done' : index === checked ? 'current' : undefined}>
                {index < checked ? <CircleCheck size={14} /> : <LoaderCircle size={14} className={index === checked ? 'spin' : undefined} />}
                {step}
              </li>
            ))}
          </ul>
        </div>
        <footer className="repair-footer">Lecture des données du véhicule…</footer>
      </div>
    </div>
  );
}
