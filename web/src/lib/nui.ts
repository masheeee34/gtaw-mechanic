import { useEffect, useRef } from 'react';
import type { NuiResponse } from '../types';

declare global {
  interface Window {
    GetParentResourceName?: () => string;
  }
}

/** True when the page runs in a regular browser (Vite dev server) instead of the game's CEF. */
export const isEnvBrowser = (): boolean => typeof window.GetParentResourceName !== 'function';

export async function fetchNui<T>(event: string, data: unknown = {}): Promise<T> {
  if (import.meta.env.DEV && isEnvBrowser()) {
    const { mockNui } = await import('./mock');
    return (await mockNui(event, data)) as T;
  }

  const response = await fetch(`https://${window.GetParentResourceName!()}/${event}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data),
  });
  return (await response.json()) as T;
}

/** Same as fetchNui, but never throws: transport errors become a regular failed response. */
export async function requestNui<T>(event: string, data?: unknown): Promise<NuiResponse<T>> {
  try {
    return await fetchNui<NuiResponse<T>>(event, data);
  } catch {
    return { ok: false, error: 'nui_error', message: 'Une erreur est survenue, réessayez.' };
  }
}

/** Subscribes to `{ action, data }` messages sent by the client with SendNuiMessage. */
export function useNuiMessage<T>(action: string, handler: (data: T) => void): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const listener = (event: MessageEvent<{ action?: string; data?: T }>) => {
      if (event.data?.action === action) handlerRef.current(event.data.data as T);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [action]);
}
