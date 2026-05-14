import { Config } from '../types/config';
import { SetupAnnualResult } from '../types/simulation';

/**
 * The serialised structure stored inside a backup file.
 *
 * `version` is incremented on any breaking change to this structure.
 * The importer applies migrations sequentially to bring older files up to
 * the current version before consuming the data.
 *
 * Open-Meteo irradiance data is intentionally excluded: it covers immutable
 * historical years and will be re-fetched automatically on the next simulation
 * run if absent from the local cache.
 */
export interface BackupFile {
  /** Schema version. Starts at 1. */
  readonly version: number;
  /** Unix timestamp (ms) when this backup was created. */
  readonly exportedAt: number;
  /** Full site and setup configuration. */
  readonly config: Config;
  /** All cached simulation results at the time of export. */
  readonly simulationResults: SetupAnnualResult[];
}