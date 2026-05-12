/**
 * Opens an IndexedDB database, running the provided upgrade callback when the
 * database is created or its version number increases.
 *
 * Extracted from the duplicated inline openDb functions that previously existed
 * in SimulationCache and IrradianceCache. Both modules delegate here so the
 * Promise-wrapping boilerplate exists in exactly one place.
 */
export const openDatabase = (
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase, event: IDBVersionChangeEvent) => void,
): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onupgradeneeded = (event) => {
      onUpgrade((event.target as IDBOpenDBRequest).result, event);
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });