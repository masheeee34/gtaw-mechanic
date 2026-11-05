import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockSession } from '../lib/mock';
import { DiagnosticsView } from './DiagnosticsView';

function renderView(props: Partial<Parameters<typeof DiagnosticsView>[0]> = {}) {
  const onRepair = vi.fn();
  const onShowHealthyChange = vi.fn();
  render(
    <DiagnosticsView
      session={createMockSession()}
      query=""
      showHealthy
      onRepair={onRepair}
      onShowHealthyChange={onShowHealthyChange}
      {...props}
    />,
  );
  return { onRepair, onShowHealthyChange };
}

describe('DiagnosticsView', () => {
  it('groups the parts by category', () => {
    renderView();

    const wheels = screen.getByRole('region', { name: 'Roues' });
    expect(within(wheels).getAllByRole('button', { name: /^Voir Pneu/ })).toHaveLength(4);
    expect(screen.getByRole('region', { name: 'Mécanique' })).toHaveTextContent('Moteur');
  });

  it('starts a repair for a damaged part with enough stock', async () => {
    const { onRepair } = renderView();

    await userEvent.click(screen.getByRole('button', { name: 'Réparer Moteur' }));

    expect(onRepair).toHaveBeenCalledWith(expect.objectContaining({ id: 'engine', item: 'engine_parts' }));
  });

  it('offers no repair for a healthy part', () => {
    renderView();

    expect(screen.queryByRole('button', { name: 'Réparer Réservoir' })).not.toBeInTheDocument();
  });

  it('blocks the repair and says why when the garage lacks parts', () => {
    renderView();

    expect(screen.getByRole('button', { name: 'Réparer Tôlerie' })).toBeDisabled();
    expect(screen.getByText(/Nécessite 2× Panneaux de carrosserie \(1 en stock\)/)).toHaveClass('text-danger');
  });

  it('hides healthy parts when the toggle is off', () => {
    renderView({ showHealthy: false });

    expect(screen.queryByText('Réservoir')).not.toBeInTheDocument();
    expect(screen.getByText('Moteur')).toBeInTheDocument();
  });

  it('reports the toggle change', async () => {
    const { onShowHealthyChange } = renderView();

    await userEvent.click(screen.getByRole('switch', { name: 'Afficher les pièces en bon état' }));

    expect(onShowHealthyChange).toHaveBeenCalledWith(false);
  });

  it('filters parts with the search query, including by category and status', () => {
    renderView({ query: 'roues critique' });

    expect(screen.getAllByRole('button', { name: /^Réparer / }).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Réparer Pneu avant gauche',
      'Réparer Pneu arrière droit',
    ]);
  });

  it('says so when nothing matches the search', () => {
    renderView({ query: 'turbo' });

    expect(screen.getByText('Aucune pièce ne correspond à « turbo ».')).toBeInTheDocument();
  });
});
