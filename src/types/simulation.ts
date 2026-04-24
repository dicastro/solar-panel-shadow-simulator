import { Vector3 } from './geometry';

export interface SunState {
  readonly altitude: number;
  readonly azimuth: number;
  readonly isDaylight: boolean;
  readonly direction: Vector3;
}

export interface PanelSimulationResult {
  readonly id: string;
  readonly power: number;
  readonly isShaded: boolean;
}

export interface SimulationResult {
  readonly instantPower: number; // kW
  readonly panels: readonly PanelSimulationResult[];
}

export type IrradianceSource = 'geometric' | 'pvgis' | 'open-meteo';

/**
 * The set of inputs that fully determines a simulation result.
 * Two runs with identical cache keys are guaranteed to produce identical output.
 */
export interface SimulationCacheKey {
  readonly setupId: string;
  /** FNV-1a hash of panel geometry: positions, zones, peakPower, string, hasOptimizer. */
  readonly setupHash: string;
  readonly density: number;
  readonly threshold: number;
  readonly intervalMinutes: number;
  readonly latitude: number;
  readonly longitude: number;
  /** Calendar year simulated. Affects both time steps and PVGIS data lookup. */
  readonly year: number;
  readonly irradianceSource: IrradianceSource;
}

/**
 * Per-panel annual energy and shade accumulation.
 *
 * `energyKwh` has shape [month(0–11)][dayOfMonth(0–30)][hourOfDay(0–23)].
 * Days beyond the actual month length are 0.
 *
 * `shadeFraction` has the same shape and stores the fraction of time steps in
 * each bucket where the panel was at least partially shaded.
 *
 * `zoneShadeFraction` adds a leading zone dimension:
 * [zone][month][dayOfMonth][hourOfDay].
 */
export interface PanelAnnualData {
  readonly panelId: string;
  readonly arrayIndex: number;
  readonly row: number;
  readonly col: number;
  readonly energyKwh: number[][][];
  readonly shadeFraction: number[][][];
  readonly zoneShadeFraction: number[][][][];
}

export interface SetupAnnualResult {
  readonly setupId: string;
  readonly setupLabel: string;
  /** The hash key used to store and retrieve this result from IndexedDB. */
  readonly cacheKey: string;
  /** Unix timestamp (ms) when this result was computed. */
  readonly computedAt: number;
  readonly year: number;
  readonly intervalMinutes: number;
  readonly irradianceSource: IrradianceSource;
  readonly panels: readonly PanelAnnualData[];
  /** Monthly totals (kWh) across all panels, pre-rolled for chart performance. */
  readonly monthlyTotalKwh: readonly number[];
  readonly annualTotalKwh: number;
}