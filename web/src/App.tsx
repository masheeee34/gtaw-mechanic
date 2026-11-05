import { useCallback, useEffect, useRef, useState } from 'react';
import { PartMarkers } from './components/PartMarkers';
import { Window, type Toast, type View } from './components/Window';
import { fetchNui, isEnvBrowser, requestNui, useNuiMessage } from './lib/nui';
import { repairOrder } from './lib/repairOrder';
import { qualityLevel } from './minigames/quality';
import type { MinigameRequest, PartDiagnosis, PartMarker, SessionData, SessionUpdate, VehicleNote } from './types';
import { DiagnosticsView } from './views/DiagnosticsView';
import { HistoryView } from './views/HistoryView';
import { RepairOverlay, type RepairState } from './views/RepairOverlay';
import { ScanOverlay } from './views/ScanOverlay';
import { StockView } from './views/StockView';

const TOAST_DURATION_MS = 4000;

// The game client drives the screens with messages:
//   open (3D scan, then the menu) → [Réparer] hidden while the mechanic fetches and carries the part
//   → minigame → back to the menu, or hidden again to retry → close
export function App() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [revealMs, setRevealMs] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);
  const [view, setView] = useState<View>('diagnostics');
  const [query, setQuery] = useState('');
  const [showHealthy, setShowHealthy] = useState(false);
  const [repair, setRepair] = useState<RepairState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [markers, setMarkers] = useState<PartMarker[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [xray, setXray] = useState(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const open = useCallback((data: SessionData) => {
    setSession(data);
    setRevealMs(data.scan ?? null);
    setXray(false);
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
    setRevealMs(null);
    setXray(false);
    setHidden(false);
    setRepair(null);
    setMarkers([]);
    setFocusedId(null);
  }, []);

  useNuiMessage<SessionData>('open', open);
  useNuiMessage<Partial<SessionUpdate>>('update', (update) => setSession((current) => current && { ...current, ...update }));
  useNuiMessage('show', () => {
    setHidden(false);
    setFocusedId(null);
    setXray(false);
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

  // The 3D scan ends on its own; the menu then slides in.
  useEffect(() => {
    if (revealMs === null) return;
    const timer = window.setTimeout(() => setRevealMs(null), revealMs);
    return () => window.clearTimeout(timer);
  }, [revealMs]);

  // 3D view: the client moves its camera onto a spot or a part, or back to the whole car.
  const focus = useCallback((id: string | null) => {
    setFocusedId(id);
    void fetchNui('view:focus', { id });
  }, []);

  const orbit = useCallback((yaw: number, lift: number) => {
    setFocusedId(null);
    void fetchNui('view:orbit', { yaw, lift });
  }, []);

  const zoom = useCallback((factor: number) => void fetchNui('view:zoom', { factor }), []);

  // Notes pinned on the car: the client asks the server, which answers with the vehicle's notes.
  const addNote = useCallback(
    async (spotId: string, text: string) => {
      const response = await requestNui<VehicleNote[]>('note:add', { spotId, text });
      if (!response.ok) {
        notify('error', response.message);
        return false;
      }
      setSession((current) => current && { ...current, notes: response.data });
      return true;
    },
    [notify],
  );

  const deleteNote = useCallback(
    async (id: number) => {
      const response = await requestNui<VehicleNote[]>('note:delete', { id });
      if (!response.ok) return notify('error', response.message);
      setFocusedId(null);
      setSession((current) => current && { ...current, notes: response.data });
    },
    [notify],
  );

  const changeXray = useCallback((enabled: boolean) => {
    setXray(enabled);
    void fetchNui('view:xray', { enabled });
  }, []);

  const menuVisible = session !== null && !hidden && repair === null;

  useEffect(() => {
    if (!menuVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (focusedId) focus(null);
        else close();
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowLeft') orbit(-20, 0);
      if (event.key === 'ArrowRight') orbit(20, 0);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuVisible, close, focus, orbit, focusedId]);

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
    async (success: boolean, cancelled: boolean, quality: number) => {
      if (!repair) return;
      const { part } = repair;
      if (success) setRepair({ ...repair, phase: 'saving' });

      const response = await requestNui<SessionUpdate | null>('repair:finish', { partId: part.id, success, cancelled, quality });
      setRepair(null);
      if (!response.ok) {
        notify('error', response.message);
        setHidden(response.show === false);
        return;
      }
      // A step of the job is done but not the repair (a tire's old wheel is off): back to the world.
      if (response.data === null) {
        setHidden(true);
        return;
      }

      setSession((current) => current && { ...current, ...response.data });
      setHidden(false);
      setFocusedId(null);
      setXray(false);
      const item = response.data.stock.find((entry) => entry.itemId === part.item)?.label ?? part.item;
      notify('success', `Réparation terminée : ${part.label} (${part.quantity}× ${item}), travail ${qualityLevel(quality)}.`);
    },
    [repair, notify],
  );

  if (repair) return <RepairOverlay repair={repair} onFinish={finishRepair} />;
  if (!session) return import.meta.env.DEV && isEnvBrowser() ? <DevLauncher onOpen={open} /> : null;
  if (hidden) return null;

  const order = new Map(repairOrder(session.parts).map(({ part, step }) => [part.id, step]));
  const focusedPartId = markers.find((marker) => marker.id === focusedId)?.partId ?? focusedId;
  const vehicleView = (
    <PartMarkers
      parts={session.parts}
      stock={session.stock}
      notes={session.notes}
      markers={markers}
      focusedId={focusedId}
      order={order}
      revealMs={revealMs ?? undefined}
      xray={xray}
      onFocus={focus}
      onOrbit={orbit}
      onZoom={zoom}
      onXrayChange={changeXray}
      onRepair={startRepair}
      onAddNote={addNote}
      onDeleteNote={deleteNote}
    />
  );

  if (revealMs !== null) {
    return (
      <div className="screen">
        {vehicleView}
        <ScanOverlay duration={revealMs} steps={session.parts.map((part) => part.label)} />
      </div>
    );
  }

  return (
    <div className="screen">
      {vehicleView}
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
            focusedPartId={focusedPartId}
            onRepair={startRepair}
            onLocate={focus}
          />
        )}
        {view === 'stock' && <StockView session={session} query={query} />}
        {view === 'history' && <HistoryView session={session} query={query} onLocate={focus} />}
      </Window>
    </div>
  );
}

let devAutoOpened = false;

// Browser dev server only: plays the diagnostic scan then opens the menu with fake data, on first
// load and again after a close. Goes through postMessage, the same path the game client uses.
function DevLauncher({ onOpen }: { onOpen: (data: SessionData) => void }) {
  const launch = useCallback(async () => {
    const { createMockSession, MOCK_MARKERS, MOCK_SCAN_MS } = await import('./lib/mock');
    onOpen({ ...createMockSession(), scan: MOCK_SCAN_MS });
    window.postMessage({ action: 'markers', data: { markers: MOCK_MARKERS } }, '*');
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
