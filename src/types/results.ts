import { SetupAnnualResult } from './simulation';

/**
 * Lightweight metadata for one setup within a simulation run group.
 * Loaded from the IndexedDB summary list — does not include per-panel data.
 */
export interface SimulationGroupSetup {
  readonly cacheKey: string;
  readonly setupId: string;
  readonly setupLabel: string;
  readonly annualTotalKwh: number;
  /** Index within the group, used to assign a stable colour. */
  readonly colourIndex: number;
}

/**
 * A logical simulation run: all setups that share the same parameters
 * (year, interval, irradiance source, density, threshold).
 * One group corresponds to one option in the run selector dropdown.
 */
export interface SimulationGroup {
  /** Stable key derived from shared parameters — used as React key and selector value. */
  readonly groupKey: string;
  readonly year: number;
  readonly intervalMinutes: number;
  readonly irradianceSource: string;
  readonly density: number;
  readonly threshold: number;
  readonly computedAt: number;
  readonly setups: SimulationGroupSetup[];
}

/**
 * Full result data for one setup, loaded lazily from IndexedDB when charts
 * require per-panel detail (shade fractions, zone data).
 */
export interface LoadedSetupResult {
  readonly setupId: string;
  readonly result: SetupAnnualResult;
  readonly colourIndex: number;
}