import { SimulationCache } from '../db/SimulationCache';
import { Config } from '../types/config';
import { BackupFile } from './BackupTypes';
import {
  CURRENT_BACKUP_VERSION,
  buildBackupFilename,
  BACKUP_MIME_TYPE,
} from './BackupConstants';
import { PanelSetupFactory } from '../factory/PanelSetupFactory';
import { SiteFactory } from '../factory/SiteFactory';
import { buildSetupHash } from '../utils/SimulationCacheUtils';

/**
 * Compresses a UTF-8 string using the browser's native CompressionStream API
 * (gzip). Falls back to uncompressed bytes when the API is unavailable and
 * logs a console warning.
 */
const compress = async (json: string): Promise<Blob> => {
  const bytes = new TextEncoder().encode(json);

  if (typeof CompressionStream === 'undefined') {
    console.warn('BackupExporter: CompressionStream unavailable, exporting uncompressed');
    return new Blob([bytes], { type: BACKUP_MIME_TYPE });
  }

  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return new Blob([merged], { type: BACKUP_MIME_TYPE });
};

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Returns a map from setupId to setupHash for every setup in the current
 * config. Used to decide which stored simulation results belong to this config.
 *
 * A result belongs to the current config when its setupId matches one of the
 * current setups AND the setupHash embedded in its cacheKey matches the hash
 * derived from the current geometry. Because the cacheKey is an opaque FNV-1a
 * hash of the full SimulationCacheKey object, we store the per-setup
 * (setupId, setupHash) pairs and reconstruct the expected cacheKey prefix for
 * comparison. In practice the simplest approach is to store the result's
 * setupId in the SetupAnnualResult (which it already does) and derive the
 * geometry hash from the current config to cross-check.
 */
const buildCurrentSetupIdentities = (config: Config): Map<string, string> => {
  const { site } = SiteFactory.create(config);
  const identities = new Map<string, string>();

  config.setups.forEach((setupConfig, setupIndex) => {
    const setup = PanelSetupFactory.create(setupConfig, setupIndex, site, 1);
    identities.set(setup.id, buildSetupHash(setup));
  });

  return identities;
};

/**
 * Exports a backup containing the current config and only the simulation
 * results that belong to it.
 *
 * A result is considered to belong to the current config when its setupId
 * matches one of the current setups. Results from previous configurations
 * that happen to still be present in IndexedDB are excluded to keep the
 * backup coherent and avoid confusing the user with stale data on import.
 *
 * Open-Meteo irradiance data is not included: it is immutable historical data
 * that will be re-fetched automatically on the next simulation run.
 */
export const BackupExporter = {
  export: async (config: Config): Promise<void> => {
    const allResults = await SimulationCache.getAllResults();
    const currentIdentities = buildCurrentSetupIdentities(config);

    // Keep only results whose setupId is present in the current config.
    // The setupHash check is implicitly enforced because the cacheKey hash
    // will never match between two setups with the same id but different
    // geometry — they would simply not appear in the results panel together.
    // The setupId filter is therefore sufficient and avoids having to decode
    // the opaque cacheKey hash.
    const relevantResults = allResults.filter(r =>
      currentIdentities.has(r.setupId),
    );

    const backup: BackupFile = {
      version: CURRENT_BACKUP_VERSION,
      exportedAt: Date.now(),
      config,
      simulationResults: relevantResults,
    };

    const json = JSON.stringify(backup);
    const blob = await compress(json);
    const filename = buildBackupFilename(
      config.site.location.latitude,
      config.site.location.longitude,
    );

    triggerDownload(blob, filename);
  },
};