import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Prompt, type PromptLine } from './Prompt';

const send = (lines: PromptLine[]) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { action: 'prompt', data: { lines } } }));
  });

describe('Prompt', () => {
  it('shows each line with its key, and hides on an empty list', () => {
    render(<Prompt />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    send([{ key: 'E', text: 'Prendre 1× Pneu' }, { text: 'Allez au stock.' }]);
    const prompt = screen.getByRole('status', { name: 'Action' });
    expect(prompt).toHaveTextContent('EPrendre 1× Pneu');
    expect(prompt.querySelectorAll('kbd')).toHaveLength(1);

    send([]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
