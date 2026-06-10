import { SimulationCache } from '../db/SimulationCache';
import { Config } from '../types/config';
import { BackupFile } from './BackupTypes';
import {
  CURRENT_BACKUP_VERSION,
  buildBackupFilename,
  BACKUP_MIME_TYPE,
} from './BackupConstants';

/**
 * Compresses a UTF-8 string using the browser's native CompressionStream API
 * (gzip). Falls back to uncompressed bytes when the API is unavailable.
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
 * Exports a backup containing the current config and all stored simulation
 * results. Each SimulationRunResult already contains all setups — no
 * per-setup filtering is needed.
 *
 * Open-Meteo irradiance data is not included: it is immutable historical data
 * that will be re-fetched automatically on the next simulation run.
 */
export const BackupExporter = {
  export: async (config: Config): Promise<void> => {
    const simulationResults = await SimulationCache.getAllResults();

    const backup: BackupFile = {
      version: CURRENT_BACKUP_VERSION,
      exportedAt: Date.now(),
      config,
      simulationResults,
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