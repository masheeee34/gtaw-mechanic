import type { ReactNode } from 'react';
import { Activity, CircleCheck, CircleExclamationPoint, Clock, Package, Search, Wrench, X } from 'lucide-react';
import { HealthBar, StatusBadge } from './Controls';
import type { Condition, VehicleInfo } from '../types';

export type View = 'diagnostics' | 'stock' | 'history';

export interface Toast {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

const NAVIGATION = [
  { id: 'diagnostics', label: 'Diagnostic', icon: Activity },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'history', label: 'Historique', icon: Clock },
] as const;

interface WindowProps {
  vehicle: VehicleInfo;
  condition: Condition;
  view: View;
  counts: Partial<Record<View, number>>;
  query: string;
  toast: Toast | null;
  children: ReactNode;
  onViewChange: (view: View) => void;
  onQueryChange: (query: string) => void;
  onClose: () => void;
}

// Side panel docked on the right: the rest of the screen shows the real car (3D view).
export function Window({ vehicle, condition, view, counts, query, toast, children, onViewChange, onQueryChange, onClose }: WindowProps) {
  return (
    <div className="window" role="dialog" aria-label="Mécanicien">
      <header className="window-header">
        <div className="window-title">
          <Wrench size={15} strokeWidth={2.5} />
          Mécanicien
        </div>
        <button type="button" className="icon-button" aria-label="Fermer" onClick={onClose}>
          <X size={18} />
        </button>
      </header>

      <div className="vehicle-summary">
        <div className="vehicle-model">{vehicle.model}</div>
        <div className="vehicle-meta">
          Plaque {vehicle.plate} · {vehicle.garageLabel}
        </div>
        <div className="vehicle-condition">
          <HealthBar health={condition.health} status={condition.status} />
          <StatusBadge status={condition.status} />
        </div>
      </div>

      <nav className="tabs">
        {NAVIGATION.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`tab${view === id ? ' active' : ''}`}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => onViewChange(id)}
          >
            <Icon size={15} />
            {label}
            {!!counts[id] && <span className="tab-count">{counts[id]}</span>}
          </button>
        ))}
      </nav>

      <label className="search">
        <Search size={15} />
        <input
          type="search"
          value={query}
          placeholder="Rechercher une pièce, un article…"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <main className="content">{children}</main>

      {toast && (
        <div key={toast.id} className={`toast ${toast.kind}`} role="status">
          {toast.kind === 'success' ? <CircleCheck size={17} /> : <CircleExclamationPoint size={17} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
