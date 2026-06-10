import { SimulationRunResult } from '../types/simulation';
import { SimulationRunSummary } from '../types/results';
import { openDatabase } from './DbUtils';

const DB_NAME = 'solar-simulator';
const DB_VERSION = 1;
const STORE_NAME = 'simulation-results';

const openDb = (): Promise<IDBDatabase> =>
  openDatabase(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
    }
  });

/**
 * IndexedDB wrapper for annual simulation results.
 *
 * Each record is a complete SimulationRunResult containing all setups.
 * The record key is the hash of the five UI simulation parameters (year,
 * interval, irradiance source, density, threshold). Re-running a simulation
 * with the same parameters overwrites the existing record regardless of
 * configuration changes — the simulationInputHash field in the record allows
 * the UI to detect when the stored result is stale relative to the current
 * configuration.
 */
export const SimulationCache = {
  /**
   * Returns true when at least one simulation result exists in the store.
   * Uses a single IDB count() operation — does not read any record data.
   */
  hasResults: async (): Promise<boolean> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = (event) => resolve((event.target as IDBRequest<number>).result > 0);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  /**
   * Persists a complete simulation run result. Overwrites any existing record
   * with the same cache key.
   */
  saveResult: async (result: SimulationRunResult): Promise<void> => {
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
   * Retrieves the full simulation run result for `cacheKey`, or null if absent.
   */
  getResult: async (cacheKey: string): Promise<SimulationRunResult | null> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(cacheKey);
      request.onsuccess = (event) =>
        resolve((event.target as IDBRequest<SimulationRunResult | undefined>).result ?? null);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  /**
   * Returns lightweight summaries for all stored runs, sorted by computedAt
   * descending (most recent first). Does not load per-panel data.
   */
  listResults: async (): Promise<SimulationRunSummary[]> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = (event) => {
        const all = (event.target as IDBRequest<SimulationRunResult[]>).result;
        const summaries: SimulationRunSummary[] = all
          .map(r => ({
            cacheKey: r.cacheKey,
            simulationInputHash: r.simulationInputHash,
            computedAt: r.computedAt,
            year: r.year,
            intervalMinutes: r.intervalMinutes,
            irradianceSource: r.irradianceSource,
            density: r.density,
            threshold: r.threshold,
            setups: r.setups.map(s => ({
              setupId: s.setupId,
              setupLabel: s.setupLabel,
              annualTotalKwh: s.annualTotalKwh,
            })),
          }))
          .sort((a, b) => b.computedAt - a.computedAt);
        resolve(summaries);
      };
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  /**
   * Returns all stored results in full. Used by the backup exporter.
   */
  getAllResults: async (): Promise<SimulationRunResult[]> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = (event) =>
        resolve((event.target as IDBRequest<SimulationRunResult[]>).result);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  /**
   * Replaces all stored results atomically. Used by the backup importer.
   */
  replaceAllResults: async (results: SimulationRunResult[]): Promise<void> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const clearReq = store.clear();
      clearReq.onerror = (event) => reject((event.target as IDBRequest).error);
      clearReq.onsuccess = () => {
        if (results.length === 0) { resolve(); return; }
        let pending = results.length;
        for (const result of results) {
          const putReq = store.put(result);
          putReq.onerror = (event) => reject((event.target as IDBRequest).error);
          putReq.onsuccess = () => { if (--pending === 0) resolve(); };
        }
      };
    });
  },

  /**
   * Deletes the record stored under `cacheKey`. Resolves silently if absent.
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
};