import type { MouseEvent as ReactMouseEvent } from 'react';
import { HealthBar, StatusBadge } from './Controls';
import type { PartDiagnosis, PartMarker, StockEntry } from '../types';

const DEGREES_PER_PIXEL = 0.35;

interface PartMarkersProps {
  parts: PartDiagnosis[];
  stock: StockEntry[];
  markers: PartMarker[];
  focusedId: string | null;
  onFocus: (partId: string | null) => void;
  onRotate: (degrees: number) => void;
  onRepair: (part: PartDiagnosis) => void;
}

// The 3D view: the real car, filmed by the client's camera, with a marker on each part. The client
// projects every part to the screen and sends the positions (0–1) whenever the camera moves.
export function PartMarkers({ parts, stock, markers, focusedId, onFocus, onRotate, onRepair }: PartMarkersProps) {
  const partsById = new Map(parts.map((part) => [part.id, part]));

  // Dragging the empty space turns around the car; a plain click there goes back to the whole car.
  const onMouseDown = (event: ReactMouseEvent) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    let lastX = event.clientX;
    let pending = 0;
    let moved = false;
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (pending !== 0) onRotate(pending * DEGREES_PER_PIXEL);
      pending = 0;
    };
    const move = (moveEvent: MouseEvent) => {
      pending += moveEvent.clientX - lastX;
      lastX = moveEvent.clientX;
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

  return (
    <div className="vehicle-view" onMouseDown={onMouseDown}>
      {markers.map((marker) => {
        const part = partsById.get(marker.id);
        if (!part) return null;
        const focused = part.id === focusedId;
        return (
          <div
            key={part.id}
            className={`marker ${part.status}${focused ? ' focused' : ''}${marker.front ? '' : ' behind'}`}
            style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
          >
            <button
              type="button"
              className="marker-pin"
              aria-label={`${part.label} : ${part.health} %`}
              aria-pressed={focused}
              onClick={() => onFocus(focused ? null : part.id)}
            >
              <span className="marker-dot" />
              <span className="marker-text">
                {part.label}
                <span className="marker-health">{part.health}%</span>
              </span>
            </button>
            {focused && (
              <PartCard part={part} stock={stock.find((entry) => entry.itemId === part.item)} onRepair={onRepair} />
            )}
          </div>
        );
      })}

      <div className="vehicle-view-hint">
        {focusedId && (
          <button type="button" className="button button-ghost" onClick={() => onFocus(null)}>
            Vue d'ensemble
          </button>
        )}
        <span>
          <kbd>Clic</kbd> sur une pièce · <kbd>Glisser</kbd> ou <kbd>← →</kbd> pour tourner autour
        </span>
      </div>
    </div>
  );
}

function PartCard({ part, stock, onRepair }: { part: PartDiagnosis; stock?: StockEntry; onRepair: (part: PartDiagnosis) => void }) {
  const available = stock?.quantity ?? 0;
  const enoughStock = available >= part.quantity;

  return (
    <div className="marker-card" role="group" aria-label={`Détail : ${part.label}`}>
      <div className="marker-card-head">
        <strong>{part.label}</strong>
        <StatusBadge status={part.status} />
      </div>
      <HealthBar health={part.health} status={part.status} />
      <p className="marker-card-detail">{part.detail}</p>
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
    </div>
  );
}
