import { useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type WheelEvent } from 'react';
import { StickyNote } from 'lucide-react';
import { formatDateTime } from '../lib/format';
import { HealthBar, StatusBadge } from './Controls';
import type { PartDiagnosis, PartMarker, PartStatus, StockEntry, VehicleNote } from '../types';

const DEGREES_PER_PIXEL = 0.35;
const LIFT_PER_PIXEL = 0.01;
const ZOOM_STEP = 1.1;

interface PartMarkersProps {
  parts: PartDiagnosis[];
  stock: StockEntry[];
  notes: VehicleNote[];
  markers: PartMarker[];
  focusedId: string | null;
  /** Advised repair step of each part (1 = first). */
  order: Map<string, number>;
  /** During the 3D scan: markers appear one by one and the car cannot be moved yet. */
  revealMs?: number;
  xray: boolean;
  onFocus: (id: string | null) => void;
  onOrbit: (yawDegrees: number, liftMeters: number) => void;
  onZoom: (factor: number) => void;
  onXrayChange: (enabled: boolean) => void;
  onRepair: (part: PartDiagnosis) => void;
  /** Pins a note above a spot; resolves to false when the client refused it. */
  onAddNote: (spotId: string, text: string) => Promise<boolean>;
  onDeleteNote: (id: number) => void;
}

const statusOf = (marker: PartMarker, part: PartDiagnosis): PartStatus =>
  marker.dent === 'heavy' ? 'critical' : marker.dent === 'light' ? 'worn' : part.status;

// The 3D view: the real car, filmed by the client's camera, with a marker on each spot (a part, a
// broken window, a damaged door, a dent). The client projects the spots and sends their positions.
export function PartMarkers(props: PartMarkersProps) {
  const { parts, stock, notes, markers, focusedId, order, revealMs, xray, onFocus, onOrbit, onZoom, onXrayChange, onRepair, onAddNote, onDeleteNote } = props;
  const partsById = new Map(parts.map((part) => [part.id, part]));
  const notesById = new Map(notes.map((note) => [note.id, note]));
  // The part being looked at: its windows, doors and dents show; the other parts shrink to a dot.
  const openPartId = markers.find((marker) => marker.id === focusedId)?.partId ?? null;
  const shown = markers.filter(
    (marker) => marker.note !== null || marker.id === marker.partId || (openPartId !== null && marker.partId === openPartId),
  );
  const revealing = revealMs !== undefined;
  const numbered = new Set<string>();

  // Dragging the empty space turns around the car (left/right) and raises the camera (up/down);
  // a plain click there goes back to the whole car.
  const onMouseDown = (event: ReactMouseEvent) => {
    if (revealing || event.button !== 0 || event.target !== event.currentTarget) return;
    let last = { x: event.clientX, y: event.clientY };
    let pending = { x: 0, y: 0 };
    let moved = false;
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (pending.x !== 0 || pending.y !== 0) onOrbit(pending.x * DEGREES_PER_PIXEL, pending.y * LIFT_PER_PIXEL);
      pending = { x: 0, y: 0 };
    };
    const move = (moveEvent: MouseEvent) => {
      pending = { x: pending.x + moveEvent.clientX - last.x, y: pending.y + moveEvent.clientY - last.y };
      last = { x: moveEvent.clientX, y: moveEvent.clientY };
      moved = true;
      if (!frame) frame = window.requestAnimationFrame(flush);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (frame) window.cancelAnimationFrame(frame);
      flush();
      if (!moved && focusedId) onFocus(null);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onWheel = (event: WheelEvent) => {
    if (!revealing) onZoom(event.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
  };

  return (
    <div className={`vehicle-view${revealing ? ' revealing' : ''}`} onMouseDown={onMouseDown} onWheel={onWheel}>
      {shown.map((marker, index) => {
        const focused = marker.id === focusedId;
        const style: CSSProperties = { left: `${marker.x * 100}%`, top: `${marker.y * 100}%` };
        if (revealing) style.animationDelay = `${(index / Math.max(shown.length, 1)) * revealMs * 0.8}ms`;

        if (marker.note !== null) {
          const note = notesById.get(marker.note);
          if (!note) return null;
          return (
            <div key={marker.id} className={`marker note${focused ? ' focused' : ''}${marker.front ? '' : ' behind'}`} style={style}>
              <button
                type="button"
                className="marker-pin"
                aria-label={`Note : ${note.text}`}
                aria-pressed={focused}
                disabled={revealing}
                onClick={() => onFocus(focused ? null : marker.id)}
              >
                <span className="marker-dot">
                  <StickyNote size={11} strokeWidth={2.5} />
                </span>
              </button>
              {focused && <NoteCard note={note} onDelete={onDeleteNote} />}
            </div>
          );
        }

        const part = marker.partId ? partsById.get(marker.partId) : undefined;
        if (!part) return null;
        const status = statusOf(marker, part);
        // A dot only (name on hover) for a part in good condition, a part on the far side of the car,
        // or another part than the one being looked at.
        const compact = !focused && (!marker.front || (openPartId === null ? !part.needsRepair : marker.partId !== openPartId));
        // The advised step shows once per part, on its first spot.
        const step = order.get(part.id);
        const showStep = step !== undefined && !compact && !marker.dent && !numbered.has(part.id);
        if (showStep) numbered.add(part.id);

        return (
          <div
            key={marker.id}
            className={`marker ${status}${marker.dent ? ' dent' : ''}${compact ? ' compact' : ''}${focused ? ' focused' : ''}${marker.front ? '' : ' behind'}`}
            style={style}
          >
            <button
              type="button"
              className="marker-pin"
              aria-label={marker.label ? `${marker.label} (${part.label})` : `${part.label} : ${part.health} %`}
              aria-pressed={focused}
              disabled={revealing}
              onClick={() => onFocus(focused ? null : marker.id)}
            >
              <span className="marker-dot">{showStep && <span className="marker-step">{step}</span>}</span>
              <span className="marker-text">
                {marker.label ?? part.label}
                {!marker.label && <span className="marker-health">{part.health}%</span>}
              </span>
            </button>
            {focused && (
              <PartCard
                part={part}
                spot={marker}
                stock={stock.find((entry) => entry.itemId === part.item)}
                onRepair={onRepair}
                onAddNote={(text) => onAddNote(marker.id, text)}
              />
            )}
          </div>
        );
      })}

      {!revealing && (
        <div className="vehicle-view-hint">
          {focusedId && (
            <button type="button" className="button button-ghost" onClick={() => onFocus(null)}>
              Vue d'ensemble
            </button>
          )}
          <button
            type="button"
            className={`button button-ghost${xray ? ' active' : ''}`}
            aria-pressed={xray}
            onClick={() => onXrayChange(!xray)}
          >
            Transparence
          </button>
          <span>
            <kbd>Clic</kbd> sur un point · <kbd>Glisser</kbd> pour tourner · <kbd>Molette</kbd> pour zoomer
          </span>
        </div>
      )}
    </div>
  );
}

interface PartCardProps {
  part: PartDiagnosis;
  spot: PartMarker;
  stock?: StockEntry;
  onRepair: (part: PartDiagnosis) => void;
  onAddNote: (text: string) => Promise<boolean>;
}

function PartCard({ part, spot, stock, onRepair, onAddNote }: PartCardProps) {
  const available = stock?.quantity ?? 0;
  const enoughStock = available >= part.quantity;

  return (
    <div className="marker-card" role="group" aria-label={`Détail : ${spot.label ?? part.label}`}>
      <div className="marker-card-head">
        <strong>{spot.label ?? part.label}</strong>
        <StatusBadge status={part.status} />
      </div>
      {spot.label && (
        <p className="marker-card-detail">
          {spot.dent ? `Choc ${spot.dent === 'heavy' ? 'important' : 'léger'} · ` : ''}
          Pièce : {part.label}
        </p>
      )}
      <HealthBar health={part.health} status={part.status} />
      <p className="marker-card-detail">{part.detail}</p>
      {part.metrics.length > 0 && <Metrics part={part} />}
      {part.needsRepair && (
        <>
          <p className={enoughStock ? 'marker-card-need' : 'marker-card-need text-danger'}>
            Nécessite {part.quantity}× {stock?.label ?? part.item} · {available} en stock
          </p>
          <button type="button" className="button button-primary" disabled={!enoughStock} onClick={() => onRepair(part)}>
            Lancer la réparation
          </button>
        </>
      )}
      <NoteForm onSubmit={onAddNote} />
    </div>
  );
}

// A note pinned here stays at the same spot for the next mechanic (kept per plate by the server).
function NoteForm({ onSubmit }: { onSubmit: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState<string | null>(null);

  if (text === null) {
    return (
      <button type="button" className="button button-ghost" onClick={() => setText('')}>
        Épingler une note
      </button>
    );
  }

  const submit = async () => {
    if (text.trim() && (await onSubmit(text.trim()))) setText(null);
  };

  return (
    <div className="note-form">
      <textarea
        aria-label="Texte de la note"
        maxLength={200}
        rows={2}
        value={text}
        autoFocus
        placeholder="Ex. rayure déjà présente au dépôt"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setText(null);
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <div className="note-form-actions">
        <button type="button" className="button button-ghost" onClick={() => setText(null)}>
          Annuler
        </button>
        <button type="button" className="button button-primary" disabled={!text.trim()} onClick={() => void submit()}>
          Épingler
        </button>
      </div>
    </div>
  );
}

function NoteCard({ note, onDelete }: { note: VehicleNote; onDelete: (id: number) => void }) {
  return (
    <div className="marker-card" role="group" aria-label="Note épinglée">
      <p className="note-text">{note.text}</p>
      <p className="marker-card-detail">
        Par {note.author} · {formatDateTime(note.createdAt)}
      </p>
      <button type="button" className="button button-ghost" onClick={() => onDelete(note.id)}>
        Effacer la note
      </button>
    </div>
  );
}

/** The raw readings of a part (engine temperature, oil, fuel…), as the game gives them. */
export function Metrics({ part }: { part: PartDiagnosis }) {
  return (
    <dl className="metrics">
      {part.metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
        </div>
      ))}
    </dl>
  );
}
