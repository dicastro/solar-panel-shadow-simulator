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
 * World-space positions and normals are pre-computed on the main thread
 * to avoid repeating matrix multiplications inside the worker at every time step.
 */
export interface SimulationPanelData {
  readonly id: string;
  readonly arrayIndex: number;
  readonly row: number;
  readonly col: number;
  readonly peakPower: number;
  readonly zones: number;
  readonly hasOptimizer: boolean;
  readonly string: string;
  /** Panel normal in world space, pre-computed from worldRotation. */
  readonly worldNormal: Vector3;
  /** Sample points already in world space. */
  readonly samplePoints: SimulationSamplePoint[];
}

/**
 * All data the worker needs to run a full annual simulation for one setup.
 * Transferred once per worker launch; large typed arrays are zero-copy transferred.
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