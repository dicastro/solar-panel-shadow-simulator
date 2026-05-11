/**
 * Hourly weather data for one full calendar year, indexed by UTC hour-of-year
 * (0 = 1 Jan 00:00 UTC, last index = 31 Dec 23:00 UTC).
 *
 * On a non-leap year the arrays have 8760 entries; on a leap year, 8784.
 * Night-time hours have DNI = DHI = 0. Temperature is always populated when
 * available (providers that do not supply temperature leave the array null).
 *
 * All irradiance values are in W/m². Temperature is in °C.
 */
export interface HourlyWeatherData {
  /** Direct Normal Irradiance (W/m²): beam radiation on a surface perpendicular to the sun. */
  readonly dni: Float32Array;
  /** Diffuse Horizontal Irradiance (W/m²): scattered sky radiation on a horizontal surface. */
  readonly dhi: Float32Array;
  /**
   * Ambient temperature at 2 m height (°C).
   * Null when the provider does not supply temperature data — in that case the
   * simulation uses a fixed 20°C reference, matching Standard Test Conditions.
   */
  readonly temperature: Float32Array | null;
}

/**
 * Strategy interface for irradiance data providers.
 *
 * Each provider supplies hourly weather data for a full calendar year at a
 * given location. The data is used to compute Plane-of-Array (POA) irradiance
 * at each simulation time step, replacing the purely geometric clear-sky model.
 *
 * Returning `null` signals that no external data is available and the
 * simulation should fall back to the geometric model (clear-sky, no weather
 * correction, no temperature correction).
 *
 * The worker is completely unaware of which provider was used. The main thread
 * resolves the data before constructing the worker payload, and the worker
 * applies the corrections transparently when the data is present.
 */
export interface IrradianceProvider {
  /**
   * Returns hourly weather data for the full requested year, or null when
   * unavailable (network error, unsupported year, etc.).
   */
  getHourlyWeatherData(lat: number, lon: number, year: number): Promise<HourlyWeatherData | null>;
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