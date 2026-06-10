import { Config } from '../types/config';
import { HashUtils } from './HashUtils';

/**
 * Computes a stable hash of the configuration fields that affect annual
 * simulation results. Fields that only affect the UI or visual rendering
 * are excluded so that changing them does not trigger the cache invalidation
 * warning dialog.
 *
 * Excluded fields (no effect on simulation output):
 *   - site.timezone   — used only to interpret the display clock
 *   - site.floorColor — purely visual, not used in raycasting or energy calc
 */
export const buildSimulationRelevantHash = (config: Config): string => {
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
};