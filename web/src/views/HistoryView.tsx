import { EmptyState, Row, Section } from '../components/Section';
import { formatDateTime } from '../lib/format';
import { matchesQuery } from '../lib/search';
import type { SessionData } from '../types';

export function HistoryView({ session, query }: { session: SessionData; query: string }) {
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
        </Row>
      ))}
    </Section>
  );
}
