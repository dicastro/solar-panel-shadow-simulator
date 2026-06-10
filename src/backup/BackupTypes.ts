import { Config } from '../types/config';
import { SimulationRunResult } from '../types/simulation';

/**
 * The serialised structure stored inside a backup file.
 *
 * `version` is incremented on any breaking change to this structure.
 * The importer rejects files whose version does not exactly match
 * CURRENT_BACKUP_VERSION — no migration is attempted.
 *
 * Open-Meteo irradiance data is intentionally excluded: it covers immutable
 * historical years and will be re-fetched automatically on the next simulation
 * run if absent from the local cache.
 */
export interface BackupFile {
  /** Schema version. Must exactly match CURRENT_BACKUP_VERSION on import. */
  readonly version: number;
  /** Unix timestamp (ms) when this backup was created. */
  readonly exportedAt: number;
  /** Full site and setup configuration. */
  readonly config: Config;
  /** All cached simulation results at the time of export. */
  readonly simulationResults: SimulationRunResult[];
}