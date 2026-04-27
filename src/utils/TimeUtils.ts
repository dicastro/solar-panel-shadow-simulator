/**
 * Infers candidate IANA timezone identifiers for a given GPS coordinate.
 *
 * ## Why not geo-tz?
 *
 * `geo-tz` is the most accurate library for timezone-from-coordinates lookup,
 * but it reads geographic boundary data from disk at runtime and is explicitly
 * documented as not intended for browser use. Its data directory (~10 MB of
 * GeoJSON) cannot be bundled by Vite for a static GitHub Pages deployment.
 *
 * ## Approach used here
 *
 * We use two browser-native APIs that require no dependencies:
 *
 * 1. `Intl.supportedValuesOf('timeZone')` — returns the full list of IANA
 *    timezone identifiers supported by the browser's Intl implementation
 *    (typically the full IANA database, 500–600 entries). Available natively
 *    in TypeScript when `lib` includes ES2022 or later.
 *
 * 2. The candidate selection strategy:
 *    a. Primary: check the browser's own detected timezone via
 *       `Intl.DateTimeFormat().resolvedOptions().timeZone`. For the common
 *       case where the user is physically at the installation site, this will
 *       be correct and requires no further selection.
 *    b. Fallback: present the full sorted list of IANA identifiers so the
 *       user can pick manually. This handles the case where the user is
 *       configuring a remote site in a different timezone.
 *
 * ## Accuracy trade-off
 *
 * This approach cannot do geographic boundary lookup — it cannot tell you
 * "these coordinates are in Europe/Madrid" without external data. What it
 * does is: surface the browser's detected timezone as the most likely
 * candidate, and offer the full IANA list as fallback. For a tool where the
 * user is the one who placed the GPS coordinates, this is sufficient: they
 * know what timezone their installation is in.
 *
 * If a future version needs exact geographic lookup (e.g. to handle boundary
 * ambiguity automatically), the correct approach is a lightweight fetch to a
 * free API such as the TimezoneDB or OpenStreetMap Nominatim, which avoids
 * bundling the geographic data client-side.
 */


export interface TimeStep {
  readonly date: Date;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
}

export const TimeUtils = {
  /** All IANA timezone identifiers supported by this browser, sorted. */
  getAllTimezones: (): string[] => {
    try {
      return [...Intl.supportedValuesOf('timeZone')].sort();
    } catch {
      return ['UTC'];
    }
  },

  /** The browser's currently detected local timezone. */
  getBrowserTimezone: (): string => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  },

  /**
   * Returns the best initial timezone to use given a config value and the
   * browser's detected timezone.
   *
   * Priority:
   *  1. `configTimezone` — if the config already has an explicit value, honour it.
   *     This preserves backwards compatibility and respects a user who has
   *     already confirmed their timezone preference.
   *  2. Browser timezone — best guess for a first-time user who is likely
   *     configuring an installation in their own location.
   */
  resolveInitialTimezone: (configTimezone?: string): string => {
    return configTimezone ?? TimeUtils.getBrowserTimezone();
  },

  /**
   * Generates every simulation time step for a given year at the specified
   * interval. Each step carries a UTC Date plus the decomposed UTC month,
   * day-of-month (0-based), and hour-of-day for direct use as accumulator
   * bucket indices.
   *
   * All timestamps are UTC so that the simulation is independent of the
   * browser's local timezone and produces consistent results across environments.
   */
  *timeSteps(year: number, intervalMinutes: number): Generator<TimeStep> {
    const msPerStep = intervalMinutes * 60 * 1000;
    const start = Date.UTC(year, 0, 1, 0, 0, 0);
    const end = Date.UTC(year + 1, 0, 1, 0, 0, 0);

    for (let ms = start; ms < end; ms += msPerStep) {
      const d = new Date(ms);
      yield {
        date: d,
        month: d.getUTCMonth(),
        day: d.getUTCDate() - 1,
        hour: d.getUTCHours(),
      };
    }
  },

  /**
   * Returns the total number of time steps for a full year at the given interval.
   * Equivalent to iterating `timeSteps` and counting, but computed directly.
   */
  totalTimeSteps: (year: number, intervalMinutes: number): number => {
    const msPerStep = intervalMinutes * 60 * 1000;
    return Math.floor((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / msPerStep);
  },

  /**
   * Formats a remaining-seconds estimate into a human-readable string.
   * Displays minutes and seconds below one hour, hours and minutes above.
   */
  formatEta: (seconds: number): string => {
    const s = Math.round(seconds);
    if (s < 3600) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `~${m}m ${sec}s`;
    }
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `~${h}h ${m}m`;
  }
}