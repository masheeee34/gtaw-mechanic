import { EmptyState, Row, Section } from '../components/Section';
import { matchesQuery } from '../lib/search';
import type { SessionData } from '../types';

export const LOW_STOCK = 2;

export function StockView({ session, query }: { session: SessionData; query: string }) {
  const entries = session.stock.filter((entry) => matchesQuery([entry.label, entry.description, entry.itemId], query));

  return (
    <Section title={`Inventaire des pièces · ${session.vehicle.garageLabel}`}>
      {entries.length === 0 && <EmptyState>{`Aucun article ne correspond à « ${query} ».`}</EmptyState>}
      {entries.map((entry) => (
        <Row key={entry.itemId} label={entry.label} description={entry.description}>
          {entry.quantity === 0 && <span className="badge critical">Épuisé</span>}
          {entry.quantity > 0 && entry.quantity <= LOW_STOCK && <span className="badge worn">Faible</span>}
          <span className="quantity">{entry.quantity}</span>
        </Row>
      ))}
    </Section>
  );
}
