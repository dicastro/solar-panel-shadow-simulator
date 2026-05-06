import { IrradianceProvider } from './IrradianceProvider';

/**
 * Geometric irradiance provider.
 *
 * Returns null to signal that no external weather data is available.
 * When the worker receives a null irradiance array it uses its own
 * clear-sky geometric model: basePower = peakPower × incidenceFactor,
 * without any cloud-cover or atmospheric correction.
 */
export class GeometricIrradianceProvider implements IrradianceProvider {
  getHourlyDNI(_lat: number, _lon: number, _year: number): Promise<Float32Array | null> {
    return Promise.resolve(null);
  }
}