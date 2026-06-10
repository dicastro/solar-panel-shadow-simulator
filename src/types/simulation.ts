import { Vector3, Euler3 } from './geometry';
import { PanelOrientation, ZonesDisposition } from './config';

export interface SunState {
  readonly altitude: number;
  readonly azimuth: number;
  readonly isDaylight: boolean;
  readonly direction: Vector3;
}

/**
 * Instantaneous production result for the current 3D view time step.
 * Produced by SolarEngine.calculateInstantProduction and consumed only
 * by RenderControls to display the instant power readout.
 */
export interface InstantProductionResult {
  readonly power: number; // kW
}

/**
 * Identifies the irradiance data source used for an annual simulation run.
 */
export type IrradianceSource = 'geometric' | 'open-meteo';

/**
 * The set of UI parameters that determine which cache entry a simulation
 * belongs to. Two runs with the same five parameters and the same
 * configuration overwrite each other; changing any parameter produces a
 * new independent entry that coexists with the previous one.
 *
 * Configuration geometry (panels, walls, site) is captured separately via
 * simulationInputHash inside SimulationRunResult and is used only for the
 * stale-result disclaimer — it does not affect which cache slot is used.
 */
export interface SimulationCacheKey {
  readonly year: number;
  readonly intervalMinutes: number;
  readonly irradianceSource: IrradianceSource;
  readonly density: number;
  readonly threshold: number;
}

/**
 * Per-panel annual energy and shade accumulation for one setup.
 *
 * `energyKwh` has shape [month(0–11)][dayOfMonth(0–30)][hourOfDay(0–23)].
 * Days beyond the actual month length are 0.
 *
 * `shadeFraction` has the same shape and stores the fraction of time steps in
 * each bucket where the panel was at least partially shaded.
 *
 * `zoneShadeFraction` adds a leading zone dimension:
 * [zone][month][dayOfMonth][hourOfDay].
 *
 * Physical geometry fields and `arrayConfigPosition` are carried here so the
 * results panel can render heat maps with correct proportions, zone layouts,
 * and relative array positioning without needing access to the original config.
 */
export interface PanelAnnualData {
  readonly panelId: string;
  readonly arrayIndex: number;
  readonly row: number;
  readonly col: number;
  readonly energyKwh: number[][][];
  readonly shadeFraction: number[][][];
  readonly zoneShadeFraction: number[][][][];
  readonly orientation: PanelOrientation;
  readonly actualWidth: number;
  readonly actualHeight: number;
  readonly zones: number;
  readonly zonesDisposition: ZonesDisposition;
  readonly string: string;
  readonly stringColorIndex: number;
  /**
   * Position of the panel's array in site-local config space (metres from SW
   * corner), taken from PanelArrayConfiguration.position. Used by the results
   * panel and PDF to reconstruct the relative spatial layout of arrays.
   */
  readonly arrayConfigPosition: [number, number];
}

/**
 * Results for one setup within a simulation run.
 * Does not carry cache keys or meta-parameters — those live in SimulationRunResult.
 */
export interface SimulationSetupResult {
  readonly setupId: string;
  readonly setupLabel: string;
  readonly panels: readonly PanelAnnualData[];
  /** Monthly totals (kWh) across all panels, pre-rolled for chart performance. */
  readonly monthlyTotalKwh: readonly number[];
  readonly annualTotalKwh: number;
}

/**
 * A complete simulation run — all setups computed with the same five UI
 * parameters against the same configuration.
 *
 * One SimulationRunResult maps to exactly one IndexedDB record. The record
 * is overwritten when the user re-runs with the same five parameters
 * regardless of whether the configuration has changed. The simulationInputHash
 * field allows the results panel to detect when the stored result was computed
 * against a different configuration than the one currently active.
 */
export interface SimulationRunResult {
  /** IDB record key — hash of the five UI parameters. */
  readonly cacheKey: string;
  /**
   * Hash of the configuration fields that affect simulation output
   * (everything except site.timezone and site.floorColor). Compared against
   * the hash of the current configuration to detect stale results and show
   * the outdated-results disclaimer in the results panel.
   */
  readonly simulationInputHash: string;
  /** Unix timestamp (ms) when this result was computed. */
  readonly computedAt: number;
  readonly year: number;
  readonly intervalMinutes: number;
  readonly irradianceSource: IrradianceSource;
  readonly density: number;
  readonly threshold: number;
  readonly setups: readonly SimulationSetupResult[];
}

// ── Worker message protocol ───────────────────────────────────────────────────

/**
 * A single shadow-casting mesh serialised for transfer to a worker.
 */
export interface SerializedMesh {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly serializedBvh: ReturnType<typeof import('three-mesh-bvh').MeshBVH['serialize']>;
  readonly worldMatrix: Float32Array;
}

/**
 * A sample point with its position already transformed to world space.
 */
export interface SimulationSamplePoint {
  readonly id: string;
  readonly zoneIndex: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Per-panel data required to run the annual simulation.
 */
export interface SimulationPanelData {
  readonly id: string;
  readonly arrayIndex: number;
  readonly row: number;
  readonly col: number;
  readonly peakPower: number;
  readonly zones: number;
  readonly zonesDisposition: ZonesDisposition;
  readonly orientation: PanelOrientation;
  readonly actualWidth: number;
  readonly actualHeight: number;
  readonly hasOptimizer: boolean;
  readonly string: string;
  readonly stringColorIndex: number;
  readonly worldNormal: Vector3;
  readonly worldPosition: Vector3;
  readonly worldRotation: Euler3;
  readonly samplePoints: SimulationSamplePoint[];
  readonly temperatureCoefficient: number;
  readonly noct: number;
  readonly arrayConfigPosition: [number, number];
}

/**
 * System-level loss parameters shared by all panels in a simulation run.
 */
export interface SystemLossParams {
  readonly inverterEfficiency: number;
  readonly wiringLoss: number;
  readonly groundAlbedo: number;
}

/**
 * All data the worker needs to run a full annual simulation for one setup.
 */
export interface WorkerSimulationPayload {
  readonly setupId: string;
  readonly setupLabel: string;
  readonly year: number;
  readonly intervalMinutes: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly irradianceSource: IrradianceSource;
  readonly density: number;
  readonly threshold: number;
  readonly meshes: SerializedMesh[];
  readonly panels: SimulationPanelData[];
  readonly panelInclinationRad: number;
  readonly systemLoss: SystemLossParams;
  readonly weatherData: {
    readonly dni: Float32Array;
    readonly dhi: Float32Array;
    readonly temperature: Float32Array | null;
  } | null;
}

// ── Messages: main thread → worker ───────────────────────────────────────────

export type WorkerIncomingMessage =
  | { type: 'ping' }
  | { type: 'run'; payload: WorkerSimulationPayload };

// ── Messages: worker → main thread ───────────────────────────────────────────

export interface WorkerDiagnostics {
  threeVersion: string;
  sunCalcAvailable: boolean;
  hardwareConcurrency: number;
  testRecommendations: {
    for1: number;
    for3: number;
    for8: number;
  };
}

export type WorkerOutgoingMessage =
  | { type: 'pong'; diagnostics: WorkerDiagnostics }
  | { type: 'progress'; setupId: string; completed: number; total: number }
  | { type: 'result'; result: SimulationSetupResult }
  | { type: 'error'; setupId: string; message: string };

// ── Annual simulation UI state ────────────────────────────────────────────────

export interface SetupSimulationProgress {
  readonly setupId: string;
  readonly setupLabel: string;
  readonly completed: number;
  readonly total: number;
  readonly smoothedRemainingSeconds: number | null;
  readonly startedAt: number;
  readonly lastRawRemaining: number | null;
}