// Shapes exchanged with the game client (client/src/main.js).

export type PartStatus = 'good' | 'worn' | 'critical';

export interface Condition {
  health: number;
  status: PartStatus;
}

/** A raw reading from the game, shown in a part's detail ("Température", "91 °C"). */
export interface PartMetric {
  label: string;
  value: string;
}

export interface PartDiagnosis {
  id: string;
  /** Part type from config.json: engine, fuel_tank, body, windows, tire. */
  type: string;
  label: string;
  category: string;
  item: string;
  quantity: number;
  health: number;
  status: PartStatus;
  detail: string;
  metrics: PartMetric[];
  needsRepair: boolean;
}

export interface VehicleInfo {
  model: string;
  plate: string;
  garageId: string;
  garageLabel: string;
}

export interface StockEntry {
  itemId: string;
  label: string;
  description: string;
  quantity: number;
}

export interface HistoryEntry {
  id: number;
  partId: string;
  partLabel: string;
  garageLabel: string;
  mechanicName: string;
  repairedAt: string;
}

/** A note a mechanic pinned on the car; it shows at the same spot to the next mechanic. */
export interface VehicleNote {
  id: number;
  text: string;
  author: string;
  createdAt: string;
}

export interface SessionData {
  /** Length of the 3D scan that opens the inspection, in milliseconds. */
  scan?: number;
  vehicle: VehicleInfo;
  condition: Condition;
  parts: PartDiagnosis[];
  stock: StockEntry[];
  history: HistoryEntry[];
  notes: VehicleNote[];
}

export type SessionUpdate = Pick<SessionData, 'condition' | 'parts' | 'stock' | 'history'>;

export interface SkillCheckConfig {
  type: 'skillcheck';
  rounds: number;
  zoneSize: number;
  speed: number;
}

export interface LugNutsConfig {
  type: 'lugnuts';
  nuts: number;
  timeLimit: number;
  maxMistakes: number;
  /** Tires: the nuts are loosened to take the old wheel off, then tightened on the new one. */
  mode?: 'loosen' | 'tighten';
}

export interface WireConnectConfig {
  type: 'wireconnect';
  /** 3 to 6. */
  wires: number;
  /** Seconds. */
  timeLimit: number;
}

export interface PressureGaugeConfig {
  type: 'pressuregauge';
  /** Seconds to hold the pressure in the green zone. */
  duration: number;
  /** Pressure lost per second (0–1). */
  decay: number;
  /** Pressure gained per pump (0–1). */
  boost: number;
  /** Green zone bounds (0–1). */
  minZone: number;
  maxZone: number;
}

export type MinigameConfig = SkillCheckConfig | LugNutsConfig | WireConnectConfig | PressureGaugeConfig;

/** Sent when the mechanic reaches the part in the world and presses E. */
export interface MinigameRequest {
  partId: string;
  minigame: MinigameConfig;
}

/**
 * A spot on the real car, projected on screen (0–1) by the client: a part, or one broken window,
 * damaged door or dent of a part.
 */
export interface PartMarker {
  id: string;
  partId: string | null;
  /** The window, door or dent; null for the part itself. */
  label: string | null;
  dent: 'light' | 'heavy' | null;
  /** Id of the pinned note shown at this spot; partId is then null. */
  note: number | null;
  x: number;
  y: number;
  /** False when the spot is on the far side of the car. */
  front: boolean;
}

export interface ScanData {
  duration: number;
  steps: string[];
}

/** `show` (failures only) says whether the menu comes back, or the job goes on in the world. */
export type NuiResponse<T> = { ok: true; data: T } | { ok: false; error: string; message: string; show?: boolean };
