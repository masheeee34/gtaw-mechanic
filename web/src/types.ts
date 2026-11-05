// Shapes exchanged with the game client (client/src/main.js).

export type PartStatus = 'good' | 'worn' | 'critical';

export interface Condition {
  health: number;
  status: PartStatus;
}

export interface PartDiagnosis {
  id: string;
  label: string;
  category: string;
  item: string;
  quantity: number;
  health: number;
  status: PartStatus;
  detail: string;
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

export interface SessionData {
  vehicle: VehicleInfo;
  condition: Condition;
  parts: PartDiagnosis[];
  stock: StockEntry[];
  history: HistoryEntry[];
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

/** Where a part's marker shows on screen (0–1), projected by the client from the real car. */
export interface PartMarker {
  id: string;
  x: number;
  y: number;
  /** False when the part is on the far side of the car. */
  front: boolean;
}

export interface ScanData {
  duration: number;
  steps: string[];
}

/** `show` (failures only) says whether the menu comes back, or the job goes on in the world. */
export type NuiResponse<T> = { ok: true; data: T } | { ok: false; error: string; message: string; show?: boolean };
