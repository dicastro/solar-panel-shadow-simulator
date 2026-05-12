import { openDatabase } from './DbUtils';

const DB_NAME = 'solar-simulator-irradiance';
const DB_VERSION = 2;
const STORE_NAME = 'irradiance-cache';

/**
 * Lightweight metadata for one irradiance cache entry, used to populate the
 * cache management list in the settings sidebar.
 */
export interface IrradianceCacheEntryMeta {
  readonly key: string;
  readonly source: string;
  readonly lat: number;
  readonly lon: number;
  readonly year: number;
  readonly fetchedAt: number;
}

const openDb = (): Promise<IDBDatabase> =>
  openDatabase(DB_NAME, DB_VERSION, (db) => {
    if (db.objectStoreNames.contains(STORE_NAME)) {
      db.deleteObjectStore(STORE_NAME);
    }
    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
  });

/**
 * Parses the structured fields out of a storage key of the form
 * `{source}:{lat}:{lon}:{year}`.
 */
const parseKey = (key: string): Omit<IrradianceCacheEntryMeta, 'fetchedAt'> | null => {
  const parts = key.split(':');
  if (parts.length !== 4) return null;
  const [source, latStr, lonStr, yearStr] = parts;
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);
  const year = parseInt(yearStr, 10);
  if (isNaN(lat) || isNaN(lon) || isNaN(year)) return null;
  return { key, source, lat, lon, year };
};

/**
 * Read-only and delete operations on the irradiance cache, used exclusively
 * by the cache management UI in the settings sidebar.
 *
 * Kept separate from IrradianceCache (which handles get/set for the simulation
 * pipeline) so the provider module has no knowledge of the UI layer.
 */
export const IrradianceCacheManager = {
  /**
   * Returns metadata for every entry in the irradiance cache, sorted by
   * `fetchedAt` descending (most recent first).
   */
  listEntries: async (): Promise<IrradianceCacheEntryMeta[]> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = (event) => {
        const all = (event.target as IDBRequest<{ key: string; fetchedAt: number }[]>).result;
        const entries: IrradianceCacheEntryMeta[] = all
          .map((entry) => {
            const parsed = parseKey(entry.key);
            if (!parsed) return null;
            return { ...parsed, fetchedAt: entry.fetchedAt };
          })
          .filter((e): e is IrradianceCacheEntryMeta => e !== null)
          .sort((a, b) => b.fetchedAt - a.fetchedAt);
        resolve(entries);
      };
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  /**
   * Deletes the entry stored under `key`. Resolves silently if the key does
   * not exist.
   */
  deleteEntry: async (key: string): Promise<void> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  /**
   * Deletes every entry in the irradiance cache store.
   */
  clearAllEntries: async (): Promise<void> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },
};