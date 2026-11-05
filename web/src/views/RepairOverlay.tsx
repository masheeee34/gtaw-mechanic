import { useEffect } from 'react';
import { LoaderCircle, Wrench } from 'lucide-react';
import { LugNuts } from '../minigames/LugNuts';
import { PressureGauge } from '../minigames/PressureGauge';
import { SkillCheck } from '../minigames/SkillCheck';
import { WireConnect } from '../minigames/WireConnect';
import type { MinigameConfig, PartDiagnosis } from '../types';

export interface RepairState {
  part: PartDiagnosis;
  phase: 'playing' | 'saving';
  minigame: MinigameConfig;
}

interface RepairOverlayProps {
  repair: RepairState;
  onFinish: (success: boolean, cancelled?: boolean) => void;
}

export function RepairOverlay({ repair, onFinish }: RepairOverlayProps) {
  const { part, phase, minigame } = repair;
  const playing = phase === 'playing';

  // A button may still have focus from the menu, and Space would click it again.
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFinish(false, true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playing, onFinish]);

  return (
    <div className="repair-screen">
      <div className="repair-panel" role="dialog" aria-label={`Réparation : ${part.label}`}>
        <header className="repair-header">
          <Wrench size={15} strokeWidth={2.5} />
          Réparation
          <span className="repair-part">{part.label}</span>
        </header>

        <div className="repair-body">
          {playing && minigame.type === 'skillcheck' && <SkillCheck {...minigame} onComplete={onFinish} />}
          {playing && minigame.type === 'lugnuts' && <LugNuts {...minigame} onComplete={onFinish} />}
          {playing && minigame.type === 'wireconnect' && <WireConnect {...minigame} onComplete={onFinish} />}
          {playing && minigame.type === 'pressuregauge' && <PressureGauge {...minigame} onComplete={onFinish} />}
          {!playing && (
            <div className="status" role="status">
              <LoaderCircle size={18} />
              Installation de la nouvelle pièce…
            </div>
          )}
        </div>

        <footer className="repair-footer">
          {playing ? (
            <>
              <kbd>Échap</kbd> Abandonner
            </>
          ) : (
            'Veuillez patienter'
          )}
        </footer>
      </div>
    </div>
  );
}
