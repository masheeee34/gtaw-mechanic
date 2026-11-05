import { useState } from 'react';
import { useNuiMessage } from '../lib/nui';

export interface PromptLine {
  /** Key to press, shown as a keycap. Lines without one are plain instructions. */
  key?: string;
  text: string;
}

// GTAW-style interaction prompt ("[E] Inspecter le véhicule"), shown with or without the menu.
// The client sends the lines when they change, and an empty list to hide it.
export function Prompt() {
  const [lines, setLines] = useState<PromptLine[]>([]);
  useNuiMessage<{ lines?: PromptLine[] }>('prompt', (data) => setLines(data?.lines ?? []));

  if (lines.length === 0) return null;

  return (
    <div className="prompt" role="status" aria-label="Action">
      {lines.map((line) => (
        <div key={`${line.key ?? ''}${line.text}`} className={line.key ? 'prompt-line' : 'prompt-line plain'}>
          {line.key && <kbd className="prompt-key">{line.key}</kbd>}
          <span>{line.text}</span>
        </div>
      ))}
    </div>
  );
}
