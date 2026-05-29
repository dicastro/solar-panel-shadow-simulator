import { SimulationCacheKey, IrradianceSource } from '../types/simulation';
import { PanelSetup } from '../types/installation';
import { HashUtils } from './HashUtils';

/**
 * Produces a stable hash of the panel geometry fields that affect simulation
 * output: world positions, rotations, zones, peak power, string assignment,
 * and optimizer flag. Layout fields (renderData, samplePoints) are excluded
 * because they are derived from the same inputs and add no new information.
 *
 * Exported separately so callers that only need the geometry hash (e.g. the
 * backup exporter when filtering results by current config) can obtain it
 * without constructing a full SimulationCacheKey.
 */
export const buildSetupHash = (setup: PanelSetup): string => {
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

export const SimulationCacheUtils = {
  /**
   * Builds the full `SimulationCacheKey` for a given setup and simulation
   * parameter set. The key captures every input that affects the simulation
   * result — two runs with the same key are guaranteed to produce identical
   * output.
   */
  buildCacheKey: (
    setup: PanelSetup,
    density: number,
    threshold: number,
    intervalMinutes: number,
    latitude: number,
    longitude: number,
    year: number,
    irradianceSource: IrradianceSource,
  ): SimulationCacheKey => ({
    setupId: setup.id,
    setupHash: buildSetupHash(setup),
    density,
    threshold,
    intervalMinutes,
    latitude,
    longitude,
    year,
    irradianceSource,
  }),

  /**
   * Returns a compact, stable string that uniquely identifies a cache key.
   * Used as the IndexedDB record key.
   */
  hashCacheKey: (key: SimulationCacheKey): string =>
    HashUtils.fnv1a(JSON.stringify(key)),
};