/**
 * Strategy interface for irradiance data providers.
 *
 * Each provider is responsible for supplying an array of Direct Normal
 * Irradiance (DNI) values in W/m² for every hour of a given year, indexed
 * by UTC hour-of-year (0 = 1 Jan 00:00 UTC, 8759 = 31 Dec 23:00 UTC on a
 * non-leap year; 8784 entries on a leap year).
 *
 * Returning `null` signals that no external irradiance data is available
 * and the simulation should fall back to the geometric model (clear-sky,
 * no weather correction).
 *
 * The worker is completely unaware of which provider was used. The main
 * thread resolves the data before constructing the worker payload, and the
 * worker applies the multiplier transparently if the array is present.
 */
export interface IrradianceProvider {
  /**
   * Returns hourly DNI values (W/m²) for the full requested year, or null
   * when unavailable (network error, unsupported year, etc.).
   *
   * The returned array has one element per UTC hour of the year. Values are
   * non-negative. Night-time hours are 0.
   */
  getHourlyDNI(lat: number, lon: number, year: number): Promise<Float32Array | null>;
}

/**
 * Returns the concrete provider for the given irradiance source identifier.
 * Adding a new source means adding a new case here and a new module — the
 * simulation engine, worker, and store require no changes.
 */
export async function createIrradianceProvider(
  source: 'geometric' | 'open-meteo',
): Promise<IrradianceProvider> {
  switch (source) {
    case 'geometric': {
      const { GeometricIrradianceProvider } = await import('./GeometricIrradianceProvider');
      return new GeometricIrradianceProvider();
    }
    case 'open-meteo': {
      const { OpenMeteoIrradianceProvider } = await import('./OpenMeteoIrradianceProvider');
      return new OpenMeteoIrradianceProvider();
    }
  }
}