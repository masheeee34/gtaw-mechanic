import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Notifications } from './Notifications';

const notify = (kind: string, message: string) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { action: 'notify', data: { kind, message } } }));
  });

describe('Notifications', () => {
  afterEach(() => vi.useRealTimers());

  it('shows each notification with the script name and its kind', () => {
    render(<Notifications title="Mécanicien" />);

    notify('error', 'Pas assez de pièces en stock.');

    const notification = screen.getByRole('status');
    expect(notification).toHaveClass('notification', 'error');
    expect(notification).toHaveTextContent('Mécanicien');
    expect(notification).toHaveTextContent('Pas assez de pièces en stock.');
  });

  it('hides a notification after a few seconds', () => {
    vi.useFakeTimers();
    render(<Notifications title="Mécanicien" />);

    notify('success', 'Réparation terminée.');
    act(() => vi.advanceTimersByTime(5000));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps at most four on screen, dropping the oldest', () => {
    render(<Notifications title="Mécanicien" />);

    for (let i = 1; i <= 5; i++) notify('info', `Message ${i}`);

    const messages = screen.getAllByRole('status').map((element) => element.textContent);
    expect(messages).toHaveLength(4);
    expect(messages[0]).toContain('Message 2');
  });
});
