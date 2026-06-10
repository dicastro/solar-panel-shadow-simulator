import { BackupFile } from './BackupTypes';
import { CURRENT_BACKUP_VERSION } from './BackupConstants';
import { Config } from '../types/config';
import { SimulationRunResult } from '../types/simulation';

const isGzip = (bytes: Uint8Array): boolean =>
  bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

const decompress = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'This backup is compressed (gzip) but your browser does not support ' +
      'DecompressionStream. Please use a modern browser.',
    );
  }

  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
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

  return new TextDecoder().decode(merged);
};

export interface ImportResult {
  readonly config: Config;
  readonly simulationResults: SimulationRunResult[];
}

/**
 * Reads, decompresses (when gzip-compressed), parses, and validates a backup
 * file selected by the user.
 *
 * Version policy: the backup version must exactly match CURRENT_BACKUP_VERSION.
 * Both older and newer versions are rejected — older versions may lack required
 * fields introduced in later schemas, newer versions may contain structure this
 * app does not understand. When CURRENT_BACKUP_VERSION is incremented and a
 * migration path is needed, add explicit migration logic before relaxing the
 * exact-match check.
 */
export const BackupImporter = {
  parse: async (file: File): Promise<ImportResult> => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer) as Uint8Array<ArrayBuffer>;

    let json: string;
    if (isGzip(bytes)) {
      json = await decompress(bytes);
    } else {
      json = new TextDecoder().decode(bytes);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new Error('The backup file contains invalid JSON and cannot be read.');
    }

    if (typeof raw !== 'object' || raw === null) {
      throw new Error('The backup file has an unexpected structure.');
    }

    const obj = raw as Record<string, unknown>;

    if (typeof obj.version !== 'number') {
      throw new Error('The backup file is missing a version field.');
    }

    if (obj.version !== CURRENT_BACKUP_VERSION) {
      throw new Error(
        `This backup was created with an incompatible version of the app ` +
        `(backup version ${obj.version}, app expects version ${CURRENT_BACKUP_VERSION}). ` +
        `Backups can only be imported into the same app version that created them.`,
      );
    }

    const typed = obj as unknown as BackupFile;

    if (
      typeof typed.config !== 'object' ||
      typed.config === null ||
      !Array.isArray(typed.simulationResults)
    ) {
      throw new Error(
        'The backup file is missing required fields (config or simulationResults).',
      );
    }

    return {
      config: typed.config,
      simulationResults: typed.simulationResults,
    };
  },
};