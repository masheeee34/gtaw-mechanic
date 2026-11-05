import { Eye } from 'lucide-react';
import { EmptyState, Row, Section } from '../components/Section';
import { formatDateTime } from '../lib/format';
import { matchesQuery } from '../lib/search';
import type { SessionData } from '../types';

interface HistoryViewProps {
  session: SessionData;
  query: string;
  /** Shows where the repair was done, on the real car (3D view). */
  onLocate?: (partId: string) => void;
}

export function HistoryView({ session, query, onLocate }: HistoryViewProps) {
  const present = new Set(session.parts.map((part) => part.id));
  const entries = session.history.filter((entry) =>
    matchesQuery([entry.partLabel, entry.mechanicName, entry.garageLabel], query),
  );

  return (
    <Section title={`Historique des réparations · ${session.vehicle.plate}`}>
      {entries.length === 0 && (
        <EmptyState>
          {query ? `Aucune réparation ne correspond à « ${query} ».` : 'Aucune réparation enregistrée pour ce véhicule.'}
        </EmptyState>
      )}
      {entries.map((entry) => (
        <Row key={entry.id} label={entry.partLabel} description={`Par ${entry.mechanicName} · ${entry.garageLabel}`}>
          <span className="row-meta">{formatDateTime(entry.repairedAt)}</span>
          {onLocate && present.has(entry.partId) && (
            <button
              type="button"
              className="icon-button"
              aria-label={`Voir ${entry.partLabel} sur le véhicule`}
              title="Voir sur le véhicule"
              onClick={() => onLocate(entry.partId)}
            >
              <Eye size={17} />
            </button>
          )}
        </Row>
      ))}
    </Section>
  );
}
