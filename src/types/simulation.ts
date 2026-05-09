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
 *
 * - `geometric`: clear-sky model based purely on sun geometry (no weather
 *   correction). Always available, no network required.
 * - `open-meteo`: hourly Direct Normal Irradiance (DNI) from the Open-Meteo
 *   Historical Weather API. Free, no API key, CORS-compatible. Falls back to
 *   geometric if the fetch fails.
 */
export type IrradianceSource = 'geometric' | 'open-meteo';

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
  /** Calendar year simulated. Affects both time steps and irradiance data lookup. */
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
 *
 * Physical geometry fields (`orientation`, `actualWidth`, `actualHeight`,
 * `zones`, `zonesDisposition`) are carried here so the results panel can
 * render heat maps with correct proportions and zone layouts without
 * needing access to the original config.
 */
export interface PanelAnnualData {
  readonly panelId: string;
  readonly arrayIndex: number;
  readonly row: number;
  readonly col: number;
  readonly energyKwh: number[][][];
  readonly shadeFraction: number[][][];
  readonly zoneShadeFraction: number[][][][];
  /** Physical orientation of the panel as mounted. */
  readonly orientation: PanelOrientation;
  /** Rendered panel width in metres (accounts for orientation swap). */
  readonly actualWidth: number;
  /** Rendered panel height in metres (accounts for orientation swap). */
  readonly actualHeight: number;
  /** Number of bypass-diode zones. */
  readonly zones: number;
  /** How zones are split across the panel face. */
  readonly zonesDisposition: ZonesDisposition;
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
  /**
   * Sample point density used for this simulation run (NxN points per zone).
   * Stored alongside other parameters so the results panel can display and
   * group by this value without re-deriving it from the cache key hash.
   */
  readonly density: number;
  /**
   * Zone shadow threshold used for this simulation run.
   * Stored alongside other parameters so the results panel can display and
   * group by this value without re-deriving it from the cache key hash.
   */
  readonly threshold: number;
  readonly panels: readonly PanelAnnualData[];
  /** Monthly totals (kWh) across all panels, pre-rolled for chart performance. */
  readonly monthlyTotalKwh: readonly number[];
  readonly annualTotalKwh: number;
}

// ── Worker message protocol ───────────────────────────────────────────────────

/**
 * A single shadow-casting mesh serialised for transfer to a worker.
 * Contains all data the worker needs to reconstruct the geometry and its BVH
 * for raycasting, plus the world matrix to transform ray origins correctly.
 */
export interface SerializedMesh {
  /** Flat Float32Array of vertex positions (x,y,z triples). */
  readonly positions: Float32Array;
  /** Uint32Array of triangle indices. */
  readonly indices: Uint32Array;
  /**
   * Serialised MeshBVH produced by MeshBVH.serialize().
   * Contains typed arrays only — no Three.js class instances.
   */
  readonly serializedBvh: ReturnType<typeof import('three-mesh-bvh').MeshBVH['serialize']>;
  /** Column-major 4×4 world matrix as a Float32Array of 16 elements. */
  readonly worldMatrix: Float32Array;
}

/**
 * A sample point with its position already transformed to world space.
 * Used as the unit of raycasting input in the annual simulation.
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
 *
 * World-space positions, normals, and sample points are pre-computed on the
 * main thread to avoid repeating matrix multiplications inside the worker at
 * every time step.
 *
 * `worldPosition` and `worldRotation` are included so that the main thread can
 * build accurate panel meshes for BVH raycasting for each simulated setup
 * independently of which setup is currently rendered in the 3D view. Without
 * these fields, the worker payload would have to depend on the live scene,
 * which only ever contains the currently active setup's panels.
 *
 * Physical geometry fields are included so the worker can propagate them into
 * PanelAnnualData without needing access to the original config.
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
  /** Panel normal in world space, pre-computed from worldRotation. */
  readonly worldNormal: Vector3;
  /** Panel centre in world space. Used to build the panel mesh for raycasting. */
  readonly worldPosition: Vector3;
  /**
   * Panel rotation in world space (Euler, order 'YXZ').
   * Used to orient the panel mesh correctly for raycasting.
   */
  readonly worldRotation: Euler3;
  /** Sample points already in world space. */
  readonly samplePoints: SimulationSamplePoint[];
}

/**
 * All data the worker needs to run a full annual simulation for one setup.
 * Transferred once per worker launch; large typed arrays are zero-copy transferred.
 *
 * `irradianceData` is an optional Float32Array of hourly DNI values (W/m²)
 * with one entry per UTC hour of the simulated year. When present, the worker
 * multiplies `basePower` by `dni / 1000` at each time step (1000 W/m² = STC).
 * When absent, the worker uses the geometric clear-sky model unchanged.
 */
export interface WorkerSimulationPayload {
  readonly setupId: string;
  readonly setupLabel: string;
  readonly cacheKey: string;
  readonly year: number;
  readonly intervalMinutes: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly irradianceSource: IrradianceSource;
  readonly density: number;
  readonly threshold: number;
  /** All shadow-casting meshes in the scene (walls, railings, panels of this setup). */
  readonly meshes: SerializedMesh[];
  readonly panels: SimulationPanelData[];
  /**
   * Hourly DNI values (W/m²), one per UTC hour of the simulated year.
   * Null or absent means geometric clear-sky model (no weather correction).
   */
  readonly irradianceData: Float32Array | null;
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
  | { type: 'result'; result: SetupAnnualResult }
  | { type: 'error'; setupId: string; message: string };

// ── Annual simulation UI state ────────────────────────────────────────────────

/** Live progress state for a single setup being simulated in a worker. */
export interface SetupSimulationProgress {
  readonly setupId: string;
  readonly setupLabel: string;
  readonly completed: number;
  readonly total: number;
  /** Smoothed remaining seconds (EMA). null until 5% complete. */
  readonly smoothedRemainingSeconds: number | null;
  /** Wall-clock ms when this setup's worker started. */
  readonly startedAt: number;
  /** Most recent raw remaining estimate, used to compute the EMA. */
  readonly lastRawRemaining: number | null;
}