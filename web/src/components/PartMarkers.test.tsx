import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PartDiagnosis, PartMarker, StockEntry } from '../types';
import { PartMarkers } from './PartMarkers';

const part = (id: string, label: string, health: number, needsRepair: boolean): PartDiagnosis => ({
  id,
  label,
  category: 'Roues',
  item: 'tire',
  quantity: 1,
  health,
  status: needsRepair ? 'critical' : 'good',
  detail: needsRepair ? 'Crevé' : 'Bon état',
  needsRepair,
});

const parts = [part('tire_fl', 'Pneu avant gauche', 0, true), part('engine', 'Moteur', 100, false)];
const markers: PartMarker[] = [
  { id: 'tire_fl', x: 0.2, y: 0.6, front: true },
  { id: 'engine', x: 0.3, y: 0.4, front: false },
  { id: 'unknown', x: 0.5, y: 0.5, front: true },
];

function setup(stock: StockEntry[] = [{ itemId: 'tire', label: 'Pneu', description: '', quantity: 2 }], focusedId: string | null = null) {
  const props = { onFocus: vi.fn(), onRotate: vi.fn(), onRepair: vi.fn() };
  render(<PartMarkers parts={parts} stock={stock} markers={markers} focusedId={focusedId} {...props} />);
  return props;
}

describe('PartMarkers', () => {
  it('places a marker on each known part, dimmed when behind the car', () => {
    setup();

    const tire = screen.getByRole('button', { name: 'Pneu avant gauche : 0 %' });
    expect(tire.parentElement).toHaveStyle({ left: '20%', top: '60%' });
    expect(screen.getByRole('button', { name: 'Moteur : 100 %' }).parentElement).toHaveClass('behind');
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(2);
  });

  it('moves the camera onto a part when its marker is clicked', async () => {
    const { onFocus } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Pneu avant gauche : 0 %' }));

    expect(onFocus).toHaveBeenCalledWith('tire_fl');
  });

  it('shows the focused part and starts its repair', async () => {
    const { onRepair, onFocus } = setup(undefined, 'tire_fl');

    expect(screen.getByRole('group', { name: 'Détail : Pneu avant gauche' })).toHaveTextContent('Nécessite 1× Pneu · 2 en stock');
    await userEvent.click(screen.getByRole('button', { name: 'Lancer la réparation' }));
    expect(onRepair).toHaveBeenCalledWith(parts[0]);

    await userEvent.click(screen.getByRole('button', { name: "Vue d'ensemble" }));
    expect(onFocus).toHaveBeenCalledWith(null);
  });

  it('cannot start a repair without stock', () => {
    setup([], 'tire_fl');

    expect(screen.getByRole('button', { name: 'Lancer la réparation' })).toBeDisabled();
  });
});
