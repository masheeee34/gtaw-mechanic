import type { PartStatus } from '../types';

interface ToggleProps {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export function Toggle({ checked, label, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      className="toggle"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}

export function HealthBar({ health, status }: { health: number; status: PartStatus }) {
  return (
    <div className="health" role="meter" aria-label="État" aria-valuemin={0} aria-valuemax={100} aria-valuenow={health}>
      <div className="health-track">
        <div className={`health-fill ${status}`} style={{ width: `${health}%` }} />
      </div>
      <span className="health-value">{health}%</span>
    </div>
  );
}

export const STATUS_LABELS: Record<PartStatus, string> = { good: 'Bon', worn: 'Usé', critical: 'Critique' };

export function StatusBadge({ status }: { status: PartStatus }) {
  return <span className={`badge ${status}`}>{STATUS_LABELS[status]}</span>;
}
