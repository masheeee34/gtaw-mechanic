import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createMockSession } from './lib/mock';
import type { SessionData, SessionUpdate } from './types';

const TIRE_MINIGAME = { type: 'lugnuts', nuts: 5, timeLimit: 30, maxMistakes: 1 } as const;

// Plays the game client: answers the NUI callbacks the page sends with fetch().
function stubClient(responses: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string) => ({ json: async () => responses[url.split('/').pop() ?? ''] }));
  vi.stubGlobal('fetch', fetchMock);
  window.GetParentResourceName = () => 'gtaw-mechanic';
  return fetchMock;
}

// Plays the game client's messages to the page (SendNuiMessage).
function send(action: string, data?: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { action, data } }));
  });
}

const menu = () => screen.queryByRole('dialog', { name: 'Mécanicien' });

describe('App', () => {
  let session: SessionData;

  beforeEach(() => {
    session = createMockSession();
  });

  it('stays hidden until the client opens it', () => {
    stubClient({});
    render(<App />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('plays the 3D scan, then opens the menu', () => {
    vi.useFakeTimers();
    try {
      stubClient({});
      render(<App />);

      send('open', { ...session, scan: 3000 });
      expect(screen.getByRole('dialog', { name: 'Diagnostic en cours' })).toHaveTextContent('Tôlerie');
      expect(menu()).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(3000));
      expect(screen.queryByRole('dialog', { name: 'Diagnostic en cours' })).not.toBeInTheDocument();
      expect(menu()).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('goes back to the world after the first step of a tire change', async () => {
    stubClient({ 'repair:start': { ok: true, data: null }, 'repair:finish': { ok: true, data: null } });
    render(<App />);
    send('open', session);

    await userEvent.click(screen.getByRole('button', { name: 'Réparer Pneu avant gauche' }));
    await waitFor(() => expect(menu()).not.toBeInTheDocument());
    send('minigame', { partId: 'tire_fl', minigame: { ...TIRE_MINIGAME, mode: 'loosen' } });
    for (const index of [1, 3, 0, 2, 4]) await userEvent.click(screen.getAllByRole('button', { name: /^Écrou/ })[index]);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Réparation/ })).not.toBeInTheDocument());
    expect(menu()).not.toBeInTheDocument();
  });

  it('shows the advised repair order and moves the camera onto a part from it', async () => {
    const fetchMock = stubClient({ 'view:focus': { ok: true, data: null } });
    render(<App />);
    send('open', session);

    await userEvent.click(screen.getByRole('button', { name: /^À faire en premier/ }));

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/view:focus$/), expect.objectContaining({ body: expect.stringContaining('"id"') }));
  });

  it('runs a whole tire repair: menu steps aside, lug nut mini-game, then the updated diagnosis', async () => {
    const repaired: SessionUpdate = {
      condition: { health: 70, status: 'good' },
      parts: session.parts.map((part) =>
        part.id === 'tire_fl' ? { ...part, health: 100, status: 'good', detail: 'Bon état.', needsRepair: false } : part,
      ),
      stock: session.stock.map((entry) => (entry.itemId === 'tire' ? { ...entry, quantity: 6 } : entry)),
      history: session.history,
    };
    const fetchMock = stubClient({
      'repair:start': { ok: true, data: null },
      'repair:finish': { ok: true, data: repaired },
    });
    render(<App />);
    send('open', session);

    await userEvent.click(screen.getByRole('button', { name: 'Réparer Pneu avant gauche' }));
    // The mechanic is now fetching the tire and carrying it to the car: no menu in the way.
    await waitFor(() => expect(menu()).not.toBeInTheDocument());

    send('minigame', { partId: 'tire_fl', minigame: TIRE_MINIGAME });
    await screen.findByRole('dialog', { name: 'Réparation : Pneu avant gauche' });
    const nuts = await screen.findAllByRole('button', { name: /^Écrou/ });
    for (const index of [0, 2, 4, 1, 3]) await userEvent.click(nuts[index]);

    expect(await screen.findByText(/^Réparation terminée : Pneu avant gauche \(1× Pneu\), travail (soigné|correct|bâclé)\.$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réparer Pneu avant gauche' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gtaw-mechanic/repair:finish',
      expect.objectContaining({ body: expect.stringMatching(/^\{"partId":"tire_fl","success":true,"cancelled":false,"quality":[\d.]+\}$/) }),
    );
  });

  it('keeps the menu out of the way after a failed mini-game, so the mechanic retries at the car', async () => {
    stubClient({
      'repair:start': { ok: true, data: null },
      'repair:finish': { ok: false, error: 'minigame_failed', message: 'La réparation a échoué, réessayez.', show: false },
    });
    render(<App />);
    send('open', session);
    await userEvent.click(screen.getByRole('button', { name: 'Réparer Pneu avant gauche' }));

    send('minigame', { partId: 'tire_fl', minigame: TIRE_MINIGAME });
    const nuts = await screen.findAllByRole('button', { name: /^Écrou/ });
    for (const index of [0, 1, 1]) await userEvent.click(nuts[index]);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Réparation/ })).not.toBeInTheDocument());
    expect(menu()).not.toBeInTheDocument();

    send('show');
    expect(menu()).toBeInTheDocument();
  });

  it('shows the error from the client when a repair cannot start, and keeps the menu', async () => {
    stubClient({ 'repair:start': { ok: false, error: 'busy', message: 'Vous travaillez déjà sur ce véhicule.' } });
    render(<App />);
    send('open', session);

    await userEvent.click(screen.getByRole('button', { name: 'Réparer Moteur' }));

    expect(await screen.findByText('Vous travaillez déjà sur ce véhicule.')).toBeInTheDocument();
    expect(menu()).toBeInTheDocument();
  });

  it('applies stock updates sent while the menu is hidden', () => {
    stubClient({});
    render(<App />);
    send('open', session);

    send('update', { stock: session.stock.map((entry) => ({ ...entry, quantity: 0 })) });

    expect(screen.getByRole('button', { name: 'Réparer Moteur' })).toBeDisabled();
  });

  it('switches views from the sidebar and searches inside them', async () => {
    stubClient({});
    render(<App />);
    send('open', session);

    await userEvent.click(screen.getByRole('button', { name: /Stock/ }));
    await userEvent.type(screen.getByRole('searchbox'), 'vitrage');

    expect(screen.getByText('Kit vitrage')).toBeInTheDocument();
    expect(screen.queryByText('Pièces moteur')).not.toBeInTheDocument();
  });

  it('closes on Escape and tells the client', async () => {
    const fetchMock = stubClient({ close: { ok: true, data: null } });
    render(<App />);
    send('open', session);

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('https://gtaw-mechanic/close', expect.anything());
  });
});
