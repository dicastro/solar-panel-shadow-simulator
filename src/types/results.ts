import { SimulationRunResult, SimulationSetupResult } from './simulation';

/**
 * Lightweight metadata for one setup within a simulation run.
 * Derived from SimulationRunResult.setups — does not include per-panel data.
 */
export interface SimulationGroupSetup {
  readonly setupId: string;
  readonly setupLabel: string;
  readonly annualTotalKwh: number;
  /** Index within the group, used to assign a stable colour. */
  readonly colourIndex: number;
}

/**
 * A simulation run as presented in the results panel UI.
 * Maps 1:1 to a SimulationRunResult stored in IndexedDB.
 */
export interface SimulationGroup {
  /** IDB cache key — also used as React key and selector value. */
  readonly cacheKey: string;
  readonly simulationInputHash: string;
  readonly year: number;
  readonly intervalMinutes: number;
  readonly irradianceSource: string;
  readonly density: number;
  readonly threshold: number;
  readonly computedAt: number;
  readonly setups: SimulationGroupSetup[];
}

/**
 * Full result data for one setup within a run, loaded lazily from IndexedDB
 * when charts require per-panel detail.
 */
export interface LoadedSetupResult {
  readonly setupId: string;
  readonly result: SimulationSetupResult;
  readonly colourIndex: number;
}

/**
 * Lightweight summary of a SimulationRunResult for list/selector rendering.
 * Produced by SimulationCache.listResults without loading per-panel data.
 */
export type SimulationRunSummary = Pick<SimulationRunResult,
  'cacheKey' | 'simulationInputHash' | 'computedAt' | 'year' |
  'intervalMinutes' | 'irradianceSource' | 'density' | 'threshold'
> & {
  readonly setups: readonly { readonly setupId: string; readonly setupLabel: string; readonly annualTotalKwh: number }[];
};