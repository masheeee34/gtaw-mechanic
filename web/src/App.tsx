import { useCallback, useEffect, useRef, useState } from 'react';
import { PartMarkers } from './components/PartMarkers';
import { Window, type Toast, type View } from './components/Window';
import { fetchNui, isEnvBrowser, requestNui, useNuiMessage } from './lib/nui';
import type { MinigameRequest, PartDiagnosis, PartMarker, ScanData, SessionData, SessionUpdate } from './types';
import { DiagnosticsView } from './views/DiagnosticsView';
import { HistoryView } from './views/HistoryView';
import { RepairOverlay, type RepairState } from './views/RepairOverlay';
import { ScanOverlay } from './views/ScanOverlay';
import { StockView } from './views/StockView';

const TOAST_DURATION_MS = 4000;

// The game client drives the screens with messages:
//   scan → open (menu) → [Réparer] hidden while the mechanic fetches and carries the part
//   → minigame → back to the menu, or hidden again to retry → close
export function App() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [scan, setScan] = useState<ScanData | null>(null);
  const [hidden, setHidden] = useState(false);
  const [view, setView] = useState<View>('diagnostics');
  const [query, setQuery] = useState('');
  const [showHealthy, setShowHealthy] = useState(true);
  const [repair, setRepair] = useState<RepairState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [markers, setMarkers] = useState<PartMarker[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const open = useCallback((data: SessionData) => {
    setSession(data);
    setScan(null);
    setHidden(false);
    setView('diagnostics');
    setQuery('');
    setRepair(null);
    setToast(null);
    setMarkers([]);
    setFocusedId(null);
  }, []);

  const reset = useCallback(() => {
    setSession(null);
    setScan(null);
    setHidden(false);
    setRepair(null);
    setMarkers([]);
    setFocusedId(null);
  }, []);

  useNuiMessage<ScanData>('scan', setScan);
  useNuiMessage<SessionData>('open', open);
  useNuiMessage<Partial<SessionUpdate>>('update', (update) => setSession((current) => current && { ...current, ...update }));
  useNuiMessage('show', () => {
    setHidden(false);
    setFocusedId(null);
  });
  useNuiMessage<{ markers: PartMarker[] }>('markers', (data) => setMarkers(data.markers));
  useNuiMessage('close', reset);
  useNuiMessage<MinigameRequest>('minigame', ({ partId, minigame }) => {
    const part = sessionRef.current?.parts.find((candidate) => candidate.id === partId);
    if (part) setRepair({ part, phase: 'playing', minigame });
  });

  const close = useCallback(() => {
    reset();
    void fetchNui('close');
  }, [reset]);

  const notify = useCallback((kind: Toast['kind'], message: string) => {
    setToast({ id: Date.now(), kind, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // 3D view: the client moves its camera onto the part, or back to the whole car.
  const focus = useCallback((partId: string | null) => {
    setFocusedId(partId);
    void fetchNui('view:focus', { partId });
  }, []);

  const rotate = useCallback((degrees: number) => {
    setFocusedId(null);
    void fetchNui('view:rotate', { delta: degrees });
  }, []);

  const menuVisible = session !== null && !hidden && repair === null;

  useEffect(() => {
    if (!menuVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (focusedId) focus(null);
        else close();
      }
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowLeft') rotate(-20);
      if (event.key === 'ArrowRight') rotate(20);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuVisible, close, focus, rotate, focusedId]);

  // The menu steps aside: the mechanic now has to fetch the part and carry it to the car.
  const startRepair = useCallback(
    async (part: PartDiagnosis) => {
      const response = await requestNui('repair:start', { partId: part.id });
      if (!response.ok) {
        notify('error', response.message);
        return;
      }
      setHidden(true);
    },
    [notify],
  );

  const finishRepair = useCallback(
    async (success: boolean, cancelled = false) => {
      if (!repair) return;
      const { part } = repair;
      if (success) setRepair({ ...repair, phase: 'saving' });

      const response = await requestNui<SessionUpdate>('repair:finish', { partId: part.id, success, cancelled });
      setRepair(null);
      if (!response.ok) {
        notify('error', response.message);
        setHidden(response.show === false);
        return;
      }

      setSession((current) => current && { ...current, ...response.data });
      setHidden(false);
      setFocusedId(null);
      const item = response.data.stock.find((entry) => entry.itemId === part.item)?.label ?? part.item;
      notify('success', `Réparation terminée : ${part.label} (${part.quantity}× ${item}).`);
    },
    [repair, notify],
  );

  if (repair) return <RepairOverlay repair={repair} onFinish={finishRepair} />;
  if (scan && !session) return <ScanOverlay key={scan.steps.join()} {...scan} />;
  if (!session) return import.meta.env.DEV && isEnvBrowser() ? <DevLauncher onOpen={open} /> : null;
  if (hidden) return null;

  return (
    <div className="screen">
      <PartMarkers
        parts={session.parts}
        stock={session.stock}
        markers={markers}
        focusedId={focusedId}
        onFocus={focus}
        onRotate={rotate}
        onRepair={startRepair}
      />
      <Window
        vehicle={session.vehicle}
        condition={session.condition}
        view={view}
        counts={{
          diagnostics: session.parts.filter((part) => part.needsRepair).length,
          history: session.history.length,
        }}
        query={query}
        toast={toast}
        onViewChange={setView}
        onQueryChange={setQuery}
        onClose={close}
      >
        {view === 'diagnostics' && (
          <DiagnosticsView
            session={session}
            query={query}
            showHealthy={showHealthy}
            onShowHealthyChange={setShowHealthy}
            focusedId={focusedId}
            onRepair={startRepair}
            onLocate={focus}
          />
        )}
        {view === 'stock' && <StockView session={session} query={query} />}
        {view === 'history' && <HistoryView session={session} query={query} />}
      </Window>
    </div>
  );
}

let devAutoOpened = false;

// Browser dev server only: plays the diagnostic scan then opens the menu with fake data, on first
// load and again after a close. Goes through postMessage, the same path the game client uses.
function DevLauncher({ onOpen }: { onOpen: (data: SessionData) => void }) {
  const launch = useCallback(async () => {
    const { createMockSession, MOCK_SCAN } = await import('./lib/mock');
    const { MOCK_MARKERS } = await import('./lib/mock');
    window.postMessage({ action: 'scan', data: MOCK_SCAN }, '*');
    window.setTimeout(() => {
      onOpen(createMockSession());
      window.postMessage({ action: 'markers', data: { markers: MOCK_MARKERS } }, '*');
    }, MOCK_SCAN.duration);
  }, [onOpen]);

  useEffect(() => {
    if (devAutoOpened) return;
    devAutoOpened = true;
    void launch();
  }, [launch]);

  return (
    <button type="button" className="button button-primary dev-launcher" onClick={launch}>
      Ouvrir le menu mécanicien
    </button>
  );
}
