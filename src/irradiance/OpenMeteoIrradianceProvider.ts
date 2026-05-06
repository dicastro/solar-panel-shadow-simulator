import { IrradianceProvider } from './IrradianceProvider';
import { IrradianceCache } from '../db/IrradianceCache';

const SOURCE_KEY = 'open-meteo';

/**
 * Fetches hourly Direct Normal Irradiance (DNI, W/m²) from the Open-Meteo
 * Historical Weather API for a given location and full calendar year.
 *
 * A single request to `archive-api.open-meteo.com/v1/archive` retrieves
 * all 8760 (or 8784 on a leap year) hourly values. The archive covers data
 * from 1940 up to approximately 5 days before today.
 *
 * Only past years (before the current calendar year) are supported. The
 * archive does not cover the current year in full, so callers are expected
 * to restrict the year selector to past years when this provider is active.
 */
async function fetchFromOpenMeteo(
  lat: number,
  lon: number,
  year: number,
): Promise<Float32Array | null> {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const totalHours = isLeap ? 8784 : 8760;
  const result = new Float32Array(totalHours);

  const url =
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lon}` +
    `&start_date=${year}-01-01&end_date=${year}-12-31` +
    `&hourly=direct_normal_irradiance` +
    `&timezone=UTC`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`OpenMeteoIrradianceProvider: HTTP ${res.status} for year ${year}`);
      return null;
    }

    const json = await res.json() as {
      hourly: { time: string[]; direct_normal_irradiance: (number | null)[] };
    };

    const yearStart = Date.UTC(year, 0, 1, 0, 0, 0);
    const times = json.hourly.time;
    const values = json.hourly.direct_normal_irradiance;

    for (let i = 0; i < times.length; i++) {
      const ms = new Date(times[i] + 'Z').getTime();
      const hourIdx = Math.floor((ms - yearStart) / 3_600_000);
      if (hourIdx >= 0 && hourIdx < totalHours) {
        result[hourIdx] = Math.max(0, values[i] ?? 0);
      }
    }

    return result;

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
  async getHourlyDNI(lat: number, lon: number, year: number): Promise<Float32Array | null> {
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