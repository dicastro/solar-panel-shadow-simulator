import { HourlyWeatherData } from '../irradiance/IrradianceProvider';

const DB_NAME = 'solar-simulator-irradiance';
const DB_VERSION = 2;
const STORE_NAME = 'irradiance-cache';

/**
 * Persisted shape for one cache entry. Arrays are stored as plain number[]
 * because IndexedDB does not natively serialise Float32Array; the conversion
 * is done at read and write time.
 */
interface IrradianceCacheEntry {
  /** Storage key: `{source}:{lat4dp}:{lon4dp}:{year}` */
  readonly key: string;
  /** Unix timestamp (ms) when this entry was fetched. */
  readonly fetchedAt: number;
  /** Hourly DNI values (W/m²), one per UTC hour of the year. */
  readonly dni: number[];
  /** Hourly DHI values (W/m²), one per UTC hour of the year. */
  readonly dhi: number[];
  /**
   * Hourly ambient temperature (°C), one per UTC hour of the year.
   * Stored as an empty array when the provider did not supply temperature data.
   */
  readonly temperature: number[];
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Drop the old store on upgrade — the schema has changed (added dhi and
      // temperature columns). Existing DNI-only entries are invalid and must be
      // re-fetched anyway.
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'key' });
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
 * IndexedDB wrapper for hourly weather data fetched from external irradiance APIs.
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
  ): Promise<HourlyWeatherData | null> => {
    const db = await openDb();
    const key = buildKey(source, lat, lon, year);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = (event) => {
        const entry = (event.target as IDBRequest<IrradianceCacheEntry | undefined>).result;
        if (!entry) {
          resolve(null);
          return;
        }
        resolve({
          dni: new Float32Array(entry.dni),
          dhi: new Float32Array(entry.dhi),
          temperature: entry.temperature.length > 0
            ? new Float32Array(entry.temperature)
            : null,
        });
      };
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  },

  set: async (
    source: string,
    lat: number,
    lon: number,
    year: number,
    data: HourlyWeatherData,
  ): Promise<void> => {
    const db = await openDb();
    const key = buildKey(source, lat, lon, year);
    const entry: IrradianceCacheEntry = {
      key,
      fetchedAt: Date.now(),
      dni: Array.from(data.dni),
      dhi: Array.from(data.dhi),
      temperature: data.temperature ? Array.from(data.temperature) : [],
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