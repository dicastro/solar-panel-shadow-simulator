/**
 * File extension for solar simulator backup files.
 * Centralised here so renaming the extension requires a single change.
 */
export const BACKUP_FILE_EXTENSION = '.solarsim';

/**
 * MIME type associated with backup files.
 * Browsers use this when suggesting a file type in the save dialog.
 */
export const BACKUP_MIME_TYPE = 'application/octet-stream';

/**
 * Current backup schema version. Increment this whenever a breaking change
 * is introduced to the BackupFile structure, and add a corresponding entry
 * to the migrations map in BackupImporter.
 */
export const CURRENT_BACKUP_VERSION = 1;

/**
 * Encodes a latitude or longitude value into a filename-safe string.
 *
 * Sign encoding:  positive → 'p', negative → 'n'
 * Decimal point:  '.' → 'd'
 *
 * Examples:
 *   40.6252  → 'p40d6252'
 *   -4.0141  → 'n4d0141'
 *
 * The result is human-readable: p(ositive) / n(egative) prefix, d(ot) separator.
 */
export const encodeCoordForFilename = (value: number): string => {
  const sign = value >= 0 ? 'p' : 'n';
  return sign + Math.abs(value).toFixed(4).replace('.', 'd');
};

/**
 * Builds the suggested filename for a backup file.
 *
 * Pattern: solarsim-{lat}-{lon}-{YYYYMMDD}{HHMMSS}{BACKUP_FILE_EXTENSION}
 * Example: solarsim-p40d6252-n4d0141-20260513143022.solarsim
 */
export const buildBackupFilename = (lat: number, lon: number): string => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
  return `solarsim-${encodeCoordForFilename(lat)}-${encodeCoordForFilename(lon)}-${datePart}${timePart}${BACKUP_FILE_EXTENSION}`;
};