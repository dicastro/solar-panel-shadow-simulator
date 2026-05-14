import { BackupFile } from './BackupTypes';
import { CURRENT_BACKUP_VERSION } from './BackupConstants';
import { Config } from '../types/config';
import { SetupAnnualResult } from '../types/simulation';

type Migration = (data: unknown) => unknown;

/**
 * Migration functions indexed by the version they transform FROM.
 * A migration at key N transforms a version-N file into version N+1.
 *
 * Version 1 is the initial schema — no migration is needed from it yet.
 * Add entries here whenever CURRENT_BACKUP_VERSION is incremented.
 */
const migrations: Record<number, Migration> = {};

/**
 * Applies all necessary migrations to bring a parsed backup object from its
 * stored version up to CURRENT_BACKUP_VERSION.
 */
const migrate = (data: BackupFile): BackupFile => {
  let current = data.version;
  let payload: unknown = data;
  while (current < CURRENT_BACKUP_VERSION) {
    const migration = migrations[current];
    if (!migration) break;
    payload = migration(payload);
    current++;
  }
  return payload as BackupFile;
};

/**
 * Returns true when the first two bytes match the gzip magic number (0x1f 0x8b).
 */
const isGzip = (bytes: Uint8Array): boolean =>
  bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

/**
 * Decompresses a gzip-compressed byte array using the browser's native
 * DecompressionStream API. Throws a descriptive error when the API is
 * unavailable.
 *
 * Accepts a Uint8Array backed by a plain ArrayBuffer (not SharedArrayBuffer)
 * as required by the Streams API writer.
 */
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
  readonly simulationResults: SetupAnnualResult[];
}

/**
 * Reads, decompresses (when gzip-compressed), parses, migrates, and validates
 * a backup file selected by the user.
 *
 * Returns the extracted config and simulation results so the caller can apply
 * them to the app store and IndexedDB independently.
 *
 * Throws a descriptive Error on any failure: corrupt file, unsupported future
 * version, or missing required fields.
 */
export const BackupImporter = {
  parse: async (file: File): Promise<ImportResult> => {
    const buffer = await file.arrayBuffer();
    // file.arrayBuffer() always returns a plain ArrayBuffer, never a
    // SharedArrayBuffer, so this cast is safe. The explicit type annotation
    // satisfies the DecompressionStream writer which requires ArrayBuffer.
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

    if (obj.version > CURRENT_BACKUP_VERSION) {
      throw new Error(
        `This backup was created with a newer version of the app ` +
        `(backup version ${obj.version}, app supports up to version ${CURRENT_BACKUP_VERSION}). ` +
        `Please update the app.`,
      );
    }

    const migrated = migrate(obj as unknown as BackupFile);

    if (
      typeof migrated.config !== 'object' ||
      migrated.config === null ||
      !Array.isArray(migrated.simulationResults)
    ) {
      throw new Error(
        'The backup file is missing required fields (config or simulationResults).',
      );
    }

    return {
      config: migrated.config,
      simulationResults: migrated.simulationResults,
    };
  },
};