import { IrradianceProvider, HourlyWeatherData } from './IrradianceProvider';
import { IrradianceCache } from '../db/IrradianceCache';

const SOURCE_KEY = 'open-meteo';

/**
 * Fetches hourly Direct Normal Irradiance (DNI), Diffuse Horizontal Irradiance
 * (DHI), and ambient temperature from the Open-Meteo Historical Weather API for
 * a given location and full calendar year.
 *
 * A single request retrieves all hourly values for the year. The archive covers
 * data from 1940 up to approximately 5 days before today, so only completed
 * past years are supported.
 *
 * Open-Meteo variable mapping:
 *   direct_normal_irradiance → DNI (W/m²)
 *   diffuse_radiation         → DHI (W/m²)
 *   temperature_2m            → ambient temperature (°C)
 */
async function fetchFromOpenMeteo(
  lat: number,
  lon: number,
  year: number,
): Promise<HourlyWeatherData | null> {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const totalHours = isLeap ? 8784 : 8760;

  const dni = new Float32Array(totalHours);
  const dhi = new Float32Array(totalHours);
  const temperature = new Float32Array(totalHours);

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${year}-01-01&end_date=${year}-12-31` +
    `&hourly=direct_normal_irradiance,diffuse_radiation,temperature_2m` +
    `&timezone=UTC`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`OpenMeteoIrradianceProvider: HTTP ${res.status} for year ${year}`);
      return null;
    }

    const json = await res.json() as {
      hourly: {
        time: string[];
        direct_normal_irradiance: (number | null)[];
        diffuse_radiation: (number | null)[];
        temperature_2m: (number | null)[];
      };
    };

    const yearStart = Date.UTC(year, 0, 1, 0, 0, 0);
    const times = json.hourly.time;
    const dniValues = json.hourly.direct_normal_irradiance;
    const dhiValues = json.hourly.diffuse_radiation;
    const tempValues = json.hourly.temperature_2m;

    for (let i = 0; i < times.length; i++) {
      const ms = new Date(times[i] + 'Z').getTime();
      const hourIdx = Math.floor((ms - yearStart) / 3_600_000);
      if (hourIdx >= 0 && hourIdx < totalHours) {
        dni[hourIdx] = Math.max(0, dniValues[i] ?? 0);
        dhi[hourIdx] = Math.max(0, dhiValues[i] ?? 0);
        // Temperature can be negative — do not clamp.
        temperature[hourIdx] = tempValues[i] ?? 20;
      }
    }

    return { dni, dhi, temperature };

  } catch (err) {
    console.warn('OpenMeteoIrradianceProvider: fetch failed', err);
    return null;
  }
}

/**
 * Irradiance provider backed by the Open-Meteo Historical Weather API.
 *
 * Supports past years only (before the current calendar year). The archive
 * endpoint covers each past year completely with immutable reanalysis data,
 * so results are cached permanently in IndexedDB — one entry per
 * (location, year) combination, never re-fetched.
 *
 * On fetch failure the method returns null, which causes the simulation
 * to fall back to the geometric clear-sky model with a console warning.
 */
export class OpenMeteoIrradianceProvider implements IrradianceProvider {
  async getHourlyWeatherData(lat: number, lon: number, year: number): Promise<HourlyWeatherData | null> {
    const cached = await IrradianceCache.get(SOURCE_KEY, lat, lon, year);
    if (cached) return cached;

    const data = await fetchFromOpenMeteo(lat, lon, year);
    if (data) {
      try {
        await IrradianceCache.set(SOURCE_KEY, lat, lon, year, data);
      } catch (err) {
        console.warn('OpenMeteoIrradianceProvider: failed to cache irradiance data', err);
      }
    }
    return data;
  }
}