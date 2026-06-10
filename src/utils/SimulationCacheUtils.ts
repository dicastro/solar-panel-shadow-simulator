import { SimulationCacheKey, IrradianceSource } from '../types/simulation';
import { Config } from '../types/config';
import { HashUtils } from './HashUtils';

/**
 * Builds the cache key object from the five UI simulation parameters.
 * The resulting hash determines which IDB slot the run occupies — two runs
 * with identical parameters overwrite each other regardless of configuration.
 */
export const SimulationCacheUtils = {
  buildCacheKey: (
    year: number,
    intervalMinutes: number,
    irradianceSource: IrradianceSource,
    density: number,
    threshold: number,
  ): SimulationCacheKey => ({
    year,
    intervalMinutes,
    irradianceSource,
    density,
    threshold,
  }),

  /**
   * Returns the IDB record key for a given set of simulation parameters.
   * This is the hash of the five UI parameters only — configuration geometry
   * is not part of the key.
   */
  hashCacheKey: (key: SimulationCacheKey): string =>
    HashUtils.fnv1a(JSON.stringify(key)),

  /**
   * Computes a hash of all configuration fields that affect simulation output.
   * Fields excluded because they have no effect on the calculated result:
   *   - site.timezone   (UI display only)
   *   - site.floorColor (visual rendering only)
   *
   * This hash is stored in SimulationRunResult.simulationInputHash and
   * compared against the current configuration to detect stale results.
   */
  buildSimulationInputHash: (config: Config): string => {
    const relevant = {
      site: {
        location: config.site.location,
        azimuth: config.site.azimuth,
        groundAlbedo: config.site.groundAlbedo,
        inverterEfficiency: config.site.inverterEfficiency,
        wiringLoss: config.site.wiringLoss,
        wallPoints: config.site.wallPoints,
        wallDefaults: config.site.wallDefaults,
        railingDefaults: config.site.railingDefaults,
        wallsSettings: config.site.wallsSettings,
      },
      setups: config.setups,
    };
    return HashUtils.fnv1a(JSON.stringify(relevant));
  },
};

/**
 * Computes the FNV-1a hash of the panel geometry fields that affect simulation
 * output: world positions, rotations, zones, peak power, string assignment,
 * and optimizer flag. Used internally to build the setup geometry hash that
 * is part of the simulation cache key.
 *
 * Kept as a standalone export so callers that only need the geometry hash
 * can obtain it without constructing a full cache key.
 */
export const buildSetupHash = (setup: import('../types/installation').PanelSetup): string => {
  const relevant = setup.panelArrays.flatMap(pa =>
    pa.panels.map(p => ({
      id: p.id,
      wx: p.worldPosition.x,
      wy: p.worldPosition.y,
      wz: p.worldPosition.z,
      rx: p.worldRotation.x,
      ry: p.worldRotation.y,
      rz: p.worldRotation.z,
      zones: p.zones,
      peakPower: p.peakPower,
      string: p.string,
      hasOptimizer: p.hasOptimizer,
    })),
  );
  return HashUtils.fnv1a(JSON.stringify(relevant));
};