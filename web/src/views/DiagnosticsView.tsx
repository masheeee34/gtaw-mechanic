import { STATUS_LABELS, Toggle } from '../components/Controls';
import { Metrics } from '../components/PartMarkers';
import { EmptyState, Section } from '../components/Section';
import { repairOrder } from '../lib/repairOrder';
import { matchesQuery } from '../lib/search';
import type { PartDiagnosis, SessionData, StockEntry } from '../types';

interface DiagnosticsViewProps {
  session: SessionData;
  query: string;
  showHealthy: boolean;
  /** Part shown on the car right now (3D view). */
  focusedPartId?: string | null;
  onShowHealthyChange: (show: boolean) => void;
  onRepair: (part: PartDiagnosis) => void;
  /** Shows the part on the real car (3D view). */
  onLocate?: (partId: string) => void;
}

export function DiagnosticsView({ session, query, showHealthy, focusedPartId, onShowHealthyChange, onRepair, onLocate }: DiagnosticsViewProps) {
  const stockByItem = new Map(session.stock.map((entry) => [entry.itemId, entry]));
  const visible = session.parts.filter(
    (part) =>
      (showHealthy || part.needsRepair) &&
      matchesQuery([part.label, part.detail, part.category, STATUS_LABELS[part.status]], query),
  );

  // Keep the category order the client sent, which follows config.json.
  const categories = new Map<string, PartDiagnosis[]>();
  for (const part of visible) categories.set(part.category, [...(categories.get(part.category) ?? []), part]);

  // The advised order: the first repair with its reason, then a step number on each part to repair.
  const order = repairOrder(session.parts);
  const steps = new Map(order.map(({ part, step }) => [part.id, step]));
  const first = order[0];

  return (
    <>
      {first && !query && (
        <button type="button" className="advice" onClick={() => onLocate?.(first.part.id)}>
          <span className="advice-label">À faire en premier</span>
          <strong>{first.part.label}</strong>
          <span className="advice-reason">{first.reason}</span>
        </button>
      )}

      <div className="filter-row">
        Afficher les pièces en bon état
        <Toggle checked={showHealthy} label="Afficher les pièces en bon état" onChange={onShowHealthyChange} />
      </div>

      {[...categories].map(([category, parts]) => (
        <Section key={category} title={category}>
          {parts.map((part) => (
            <PartRow
              key={part.id}
              part={part}
              stock={stockByItem.get(part.item)}
              step={steps.get(part.id)}
              focused={part.id === focusedPartId}
              onRepair={onRepair}
              onLocate={onLocate}
            />
          ))}
        </Section>
      ))}

      {visible.length === 0 && (
        <EmptyState>{query ? `Aucune pièce ne correspond à « ${query} ».` : 'Toutes les pièces sont en bon état.'}</EmptyState>
      )}
    </>
  );
}

interface PartRowProps {
  part: PartDiagnosis;
  stock: StockEntry | undefined;
  /** Advised repair step, for a part to repair. */
  step?: number;
  focused: boolean;
  onRepair: (part: PartDiagnosis) => void;
  onLocate?: (partId: string) => void;
}

// Dot, name and health; the repair line only when the part needs one. Clicking it shows the part on the car.
function PartRow({ part, stock, step, focused, onRepair, onLocate }: PartRowProps) {
  const available = stock?.quantity ?? 0;
  const enoughStock = available >= part.quantity;

  return (
    <div className={`part-row ${part.status}${focused ? ' focused' : ''}`}>
      <button
        type="button"
        className="part-main"
        aria-label={`Voir ${part.label} sur le véhicule`}
        aria-pressed={focused}
        onClick={() => onLocate?.(part.id)}
      >
        {step ? <span className="part-step">{step}</span> : <span className="part-dot" />}
        <span className="part-name">{part.label}</span>
        <span className="part-health">{part.health}%</span>
      </button>
      <div className="part-bar">
        <div style={{ width: `${part.health}%` }} />
      </div>
      <p className="part-detail">{part.detail}</p>
      {focused && part.metrics.length > 0 && <Metrics part={part} />}
      {part.needsRepair && (
        <div className="part-repair">
          <span className={enoughStock ? undefined : 'text-danger'}>
            {`Nécessite ${part.quantity}× ${stock?.label ?? part.item} (${available} en stock)`}
          </span>
          <button
            type="button"
            className="button button-primary button-small"
            aria-label={`Réparer ${part.label}`}
            disabled={!enoughStock}
            onClick={() => onRepair(part)}
          >
            Réparer
          </button>
        </div>
      )}
    </div>
  );
}
