import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LugNuts } from './LugNuts';
import { PressureGauge } from './PressureGauge';
import { SkillCheck } from './SkillCheck';
import { WireConnect } from './WireConnect';
import { buildMapping } from './wireConnectRules';

describe('LugNuts', () => {
  const nuts = () => screen.getAllByRole('button', { name: /^Écrou/ });

  it('succeeds when the nuts are tightened in a star pattern', async () => {
    const onComplete = vi.fn();
    render(<LugNuts nuts={5} timeLimit={30} maxMistakes={1} onComplete={onComplete} />);

    for (const index of [1, 3, 0, 2, 4]) await userEvent.click(nuts()[index]);

    expect(nuts()[3]).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(true, expect.any(Number)));
  });

  it('fails after too many wrong nuts', async () => {
    const onComplete = vi.fn();
    render(<LugNuts nuts={5} timeLimit={30} maxMistakes={1} onComplete={onComplete} />);

    for (const index of [0, 1, 1]) await userEvent.click(nuts()[index]);

    expect(screen.getByText('Erreurs 2/1')).toBeInTheDocument();
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(false, 0));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('LugNuts modes', () => {
  it('asks to loosen the nuts when taking the old wheel off', () => {
    render(<LugNuts nuts={5} timeLimit={30} maxMistakes={1} mode="loosen" onComplete={vi.fn()} />);

    expect(screen.getByText(/Desserrez les écrous en étoile/)).toBeInTheDocument();
  });
});

describe('SkillCheck', () => {
  it('fails when the player stops the needle outside the zone', async () => {
    const onComplete = vi.fn();
    // The needle starts at the left edge and the zone never touches the edges, so an immediate press misses.
    render(<SkillCheck rounds={3} zoneSize={0.15} speed={1} random={() => 1} onComplete={onComplete} />);

    fireEvent.keyDown(window, { code: 'Space' });

    expect(screen.getByTestId('skill-track')).toHaveClass('miss');
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(false, 0));
  });

  it('shows one marker per round', () => {
    render(<SkillCheck rounds={3} zoneSize={0.15} speed={1} onComplete={() => {}} />);

    expect(screen.getByLabelText('Manche 1 sur 3').children).toHaveLength(3);
  });
});

describe('WireConnect', () => {
  const random = () => 0;
  const mapping = buildMapping(3, random);
  const source = (index: number) => screen.getByRole('button', { name: `Câble source ${index + 1}` });
  const destination = (index: number) => screen.getByRole('button', { name: `Câble destination ${index + 1}` });

  it('succeeds when every wire reaches its matching side', async () => {
    const onComplete = vi.fn();
    render(<WireConnect wires={3} timeLimit={30} random={random} onComplete={onComplete} />);

    for (let index = 0; index < 3; index++) {
      await userEvent.click(source(index));
      await userEvent.click(destination(mapping[index]));
    }

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(true, expect.any(Number)));
  });

  it('fails after two wrong connections', async () => {
    const onComplete = vi.fn();
    render(<WireConnect wires={3} timeLimit={30} random={random} onComplete={onComplete} />);
    const wrong = (mapping[0] + 1) % 3;

    await userEvent.click(source(0));
    await userEvent.click(destination(wrong));
    expect(screen.getByText('Erreurs 1/2')).toBeInTheDocument();
    await userEvent.click(source(0));
    await userEvent.click(destination(wrong));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(false, 0));
  });
});

describe('PressureGauge', () => {
  it('succeeds once the pressure was held in the green zone', async () => {
    const onComplete = vi.fn();
    render(<PressureGauge duration={0.2} decay={0} boost={0.1} minZone={0.4} maxZone={0.7} onComplete={onComplete} />);

    expect(screen.getByText('Zone verte')).toBeInTheDocument();
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(true, expect.any(Number)), { timeout: 2000 });
  });

  it('bursts when the mechanic pumps too much', async () => {
    const onComplete = vi.fn();
    render(<PressureGauge duration={5} decay={0} boost={0.3} minZone={0.4} maxZone={0.7} onComplete={onComplete} />);

    await waitFor(() => {
      fireEvent.pointerDown(screen.getByRole('img'));
      expect(screen.getByText('Surpression !')).toBeInTheDocument();
    });
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(false, 0));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
