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
 *    (typically the full IANA database, 500–600 entries).
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

/** All IANA timezone identifiers supported by this browser, sorted. */
export const getAllTimezones = (): string[] => {
  try {
    return [...(Intl as any).supportedValuesOf('timeZone')].sort();
  } catch {
    // Intl.supportedValuesOf is available in all modern browsers, but fall
    // back gracefully for very old environments.
    return ['UTC'];
  }
};

/** The browser's currently detected local timezone. */
export const getBrowserTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

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
export const resolveInitialTimezone = (configTimezone?: string): string =>
  configTimezone ?? getBrowserTimezone();