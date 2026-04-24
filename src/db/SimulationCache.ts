import { SetupAnnualResult } from '../types/simulation';

const DB_NAME = 'solar-simulator';
const DB_VERSION = 1;
const STORE_NAME = 'simulation-results';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });


/**
 * IndexedDB wrapper for annual simulation results.
 *
 * Each result is stored under its `cacheKey` hash (see `hashCacheKey`).
 * The database has a single object store. All public functions open the
 * database on demand — there is no persistent connection to manage.
 *
 * Storage failures (quota exceeded, private browsing restrictions) are caught
 * and reported as a rejected Promise rather than silently ignored. Callers
 * that only want best-effort caching can catch and discard the error.
 */
export const SimulationCache = {
  /**
   * Persists a simulation result. The `cacheKey` field on the result is used as
   * the record key. Overwrites any existing record with the same key.
   */
  saveResult: async (result: SetupAnnualResult): Promise<void> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(result);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  /**
   * Retrieves the result stored under `cacheKey`, or `null` if none exists.
   */
  getResult: async (cacheKey: string): Promise<SetupAnnualResult | null> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(cacheKey);
      request.onsuccess = (event) => resolve((event.target as IDBRequest<SetupAnnualResult | undefined>).result ?? null);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  /**
   * Returns lightweight metadata for all stored results, sorted by `computedAt`
   * descending. Useful for rendering a cache management UI without loading full
   * result payloads.
   */
  listResults: async (): Promise<Pick<SetupAnnualResult, 'cacheKey' | 'setupId' | 'setupLabel' | 'computedAt' | 'year' | 'intervalMinutes' | 'irradianceSource' | 'annualTotalKwh'>[]> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = (event) => {
        const all = (event.target as IDBRequest<SetupAnnualResult[]>).result;
        const summaries = all
          .map(({ cacheKey, setupId, setupLabel, computedAt, year, intervalMinutes, irradianceSource, annualTotalKwh }) => ({
            cacheKey, setupId, setupLabel, computedAt, year, intervalMinutes, irradianceSource, annualTotalKwh,
          }))
          .sort((a, b) => b.computedAt - a.computedAt);
        resolve(summaries);
      };
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  /**
   * Deletes the result stored under `cacheKey`. Resolves silently if the key
   * does not exist.
   */
  deleteResult: async (cacheKey: string): Promise<void> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(cacheKey);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  /**
   * Deletes every record in the store.
   */
  clearAllResults: async (): Promise<void> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },
}