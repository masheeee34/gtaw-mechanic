import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PartDiagnosis, PartMarker, StockEntry, VehicleNote } from '../types';
import { PartMarkers } from './PartMarkers';

const part = (id: string, type: string, label: string, health: number, needsRepair: boolean): PartDiagnosis => ({
  id,
  type,
  label,
  category: 'Roues',
  item: 'tire',
  quantity: 1,
  health,
  status: needsRepair ? 'critical' : 'good',
  detail: needsRepair ? 'Crevé' : 'Bon état',
  metrics: type === 'engine' ? [{ label: 'Température', value: '91 °C' }] : [],
  needsRepair,
});

const parts = [part('tire_fl', 'tire', 'Pneu avant gauche', 0, true), part('engine', 'engine', 'Moteur', 100, false), part('body', 'body', 'Tôlerie', 40, true)];
const spot = (id: string, partId: string | null, extra: Partial<PartMarker> = {}): PartMarker => ({
  id,
  partId,
  label: null,
  dent: null,
  note: null,
  x: 0.2,
  y: 0.6,
  front: true,
  ...extra,
});
const markers = [
  spot('tire_fl', 'tire_fl'),
  spot('engine', 'engine', { x: 0.3, y: 0.4, front: false }),
  spot('body', 'body', { x: 0.25 }),
  spot('body:1', 'body', { label: 'Portière avant droite' }),
  spot('dent:1', 'body', { label: 'Choc avant', dent: 'heavy' }),
  spot('unknown', 'unknown'),
  spot('note:7', null, { note: 7, x: 0.4 }),
];
const notes: VehicleNote[] = [{ id: 7, text: 'Rayure déjà présente', author: 'Jamie Ortega', createdAt: '2026-11-02T19:40:00Z' }];
const tires: StockEntry[] = [{ itemId: 'tire', label: 'Pneu', description: '', quantity: 2 }];

function setup(options: { stock?: StockEntry[]; focusedId?: string | null; revealMs?: number } = {}) {
  const handlers = {
    onFocus: vi.fn(),
    onOrbit: vi.fn(),
    onZoom: vi.fn(),
    onXrayChange: vi.fn(),
    onRepair: vi.fn(),
    onAddNote: vi.fn(async () => true),
    onDeleteNote: vi.fn(),
  };
  render(
    <PartMarkers
      parts={parts}
      stock={options.stock ?? tires}
      notes={notes}
      markers={markers}
      focusedId={options.focusedId ?? null}
      order={new Map([['tire_fl', 1], ['body', 2]])}
      revealMs={options.revealMs}
      xray={false}
      {...handlers}
    />,
  );
  return handlers;
}

describe('PartMarkers', () => {
  it('shows one marker per part, a dot only for a part in good condition or behind the car', () => {
    setup();

    const tire = screen.getByRole('button', { name: 'Pneu avant gauche : 0 %' });
    expect(tire.parentElement).toHaveStyle({ left: '20%', top: '60%' });
    expect(tire.parentElement).not.toHaveClass('compact');
    expect(screen.getByRole('button', { name: 'Moteur : 100 %' }).parentElement).toHaveClass('behind', 'compact');
    // Tire, engine, bodywork and the note: no window, door or dent until the part is selected.
    expect(document.querySelectorAll('.marker')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Portière avant droite (Tôlerie)' })).not.toBeInTheDocument();
  });

  it('shows the advised step on each part to repair', () => {
    setup();

    expect(screen.getByRole('button', { name: 'Pneu avant gauche : 0 %' })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'Tôlerie : 40 %' })).toHaveTextContent('2');
  });

  it('shows the doors and dents of the selected part, the dents in the colour of their depth', () => {
    setup({ focusedId: 'body' });

    expect(screen.getByRole('button', { name: 'Portière avant droite (Tôlerie)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choc avant (Tôlerie)' }).parentElement).toHaveClass('dent', 'critical');
    expect(screen.getByRole('button', { name: 'Pneu avant gauche : 0 %' }).parentElement).toHaveClass('compact');
  });

  it('moves the camera onto a spot when its marker is clicked', async () => {
    const { onFocus } = setup({ focusedId: 'body' });

    await userEvent.click(screen.getByRole('button', { name: 'Portière avant droite (Tôlerie)' }));

    expect(onFocus).toHaveBeenCalledWith('body:1');
  });

  it('shows the focused spot with its part, readings and repair', async () => {
    const { onRepair, onFocus } = setup({ focusedId: 'tire_fl' });

    expect(screen.getByRole('group', { name: 'Détail : Pneu avant gauche' })).toHaveTextContent('Nécessite 1× Pneu · 2 en stock');
    await userEvent.click(screen.getByRole('button', { name: 'Lancer la réparation' }));
    expect(onRepair).toHaveBeenCalledWith(parts[0]);

    await userEvent.click(screen.getByRole('button', { name: "Vue d'ensemble" }));
    expect(onFocus).toHaveBeenCalledWith(null);
  });

  it('shows the readings of the engine', () => {
    setup({ focusedId: 'engine' });

    expect(screen.getByRole('group', { name: 'Détail : Moteur' })).toHaveTextContent('Température91 °C');
  });

  it('cannot start a repair without stock', () => {
    setup({ stock: [], focusedId: 'tire_fl' });

    expect(screen.getByRole('button', { name: 'Lancer la réparation' })).toBeDisabled();
  });

  it('zooms with the wheel and toggles the see-through bodywork', async () => {
    const { onZoom, onXrayChange } = setup();

    fireEvent.wheel(screen.getByRole('button', { name: 'Transparence' }).closest('.vehicle-view')!, { deltaY: -100 });
    expect(onZoom).toHaveBeenCalledWith(expect.any(Number));
    expect(onZoom.mock.calls[0][0]).toBeLessThan(1);

    // A small trackpad delta zooms less than a mouse wheel notch.
    fireEvent.wheel(screen.getByRole('button', { name: 'Transparence' }).closest('.vehicle-view')!, { deltaY: -10 });
    expect(1 - onZoom.mock.calls[1][0]).toBeLessThan(1 - onZoom.mock.calls[0][0]);

    await userEvent.click(screen.getByRole('button', { name: 'Transparence' }));
    expect(onXrayChange).toHaveBeenCalledWith(true);
  });

  it('locks the markers and controls during the 3D scan', () => {
    setup({ revealMs: 2000 });

    expect(screen.getByRole('button', { name: 'Pneu avant gauche : 0 %' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Transparence' })).not.toBeInTheDocument();
  });

  it('shows a pinned note and deletes it', async () => {
    const { onDeleteNote } = setup({ focusedId: 'note:7' });

    expect(screen.getByRole('group', { name: 'Note épinglée' })).toHaveTextContent('Rayure déjà présente');
    expect(screen.getByRole('group', { name: 'Note épinglée' })).toHaveTextContent('Par Jamie Ortega');
    await userEvent.click(screen.getByRole('button', { name: 'Effacer la note' }));
    expect(onDeleteNote).toHaveBeenCalledWith(7);
  });

  it('pins a note on the focused spot', async () => {
    const { onAddNote } = setup({ focusedId: 'body:1' });

    await userEvent.click(screen.getByRole('button', { name: 'Épingler une note' }));
    expect(screen.getByRole('button', { name: 'Épingler' })).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Texte de la note' }), '  Portière à repeindre  ');
    await userEvent.click(screen.getByRole('button', { name: 'Épingler' }));

    expect(onAddNote).toHaveBeenCalledWith('body:1', 'Portière à repeindre');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
