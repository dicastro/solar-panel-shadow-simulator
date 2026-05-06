const DB_NAME = 'solar-simulator-irradiance';
const DB_VERSION = 1;
const STORE_NAME = 'irradiance-cache';

interface IrradianceCacheEntry {
  /** Storage key: `{source}:{lat4dp}:{lon4dp}:{year}` */
  readonly key: string;
  /** Unix timestamp (ms) when this entry was fetched. */
  readonly fetchedAt: number;
  /** Hourly DNI values (W/m²), one per UTC hour of the year. */
  readonly dni: number[];
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });

/**
 * Returns the cache key for a given irradiance source, location, and year.
 *
 * Latitude and longitude are rounded to 4 decimal places so that
 * imperceptible coordinate differences (e.g. floating-point noise from
 * config parsing) do not create separate cache entries for the same
 * physical location.
 */
const buildKey = (source: string, lat: number, lon: number, year: number): string =>
  `${source}:${lat.toFixed(4)}:${lon.toFixed(4)}:${year}`;

/**
 * IndexedDB wrapper for hourly DNI data fetched from external irradiance APIs.
 *
 * Open-Meteo only provides data for completed past years via its historical
 * archive, so all cached entries are permanently valid — historical reanalysis
 * data is immutable. The cache has no TTL: a stored entry for any
 * (source, lat, lon, year) combination is always returned as-is.
 *
 * Writing always replaces any existing entry for the same key (`put` semantics),
 * so the store size is bounded by the number of distinct (source, location, year)
 * combinations the user has simulated.
 */
export const IrradianceCache = {
  get: async (
    source: string,
    lat: number,
    lon: number,
    year: number,
  ): Promise<Float32Array | null> => {
    const db = await openDb();
    const key = buildKey(source, lat, lon, year);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = (event) => {
        const entry = (event.target as IDBRequest<IrradianceCacheEntry | undefined>).result;
        resolve(entry ? new Float32Array(entry.dni) : null);
      };
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  set: async (
    source: string,
    lat: number,
    lon: number,
    year: number,
    dni: Float32Array,
  ): Promise<void> => {
    const db = await openDb();
    const key = buildKey(source, lat, lon, year);
    const entry: IrradianceCacheEntry = {
      key,
      fetchedAt: Date.now(),
      dni: Array.from(dni),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },
};