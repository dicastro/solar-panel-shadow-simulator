import { IrradianceProvider, HourlyWeatherData } from './IrradianceProvider';

/**
 * Geometric irradiance provider.
 *
 * Returns null to signal that no external weather data is available.
 * When the worker receives null it uses its own clear-sky geometric model:
 *   basePower = peakPower × incidenceFactor
 * without any cloud-cover, diffuse, albedo, or temperature correction.
 */
export class GeometricIrradianceProvider implements IrradianceProvider {
  getHourlyWeatherData(_lat: number, _lon: number, _year: number): Promise<HourlyWeatherData | null> {
    return Promise.resolve(null);
  }
}