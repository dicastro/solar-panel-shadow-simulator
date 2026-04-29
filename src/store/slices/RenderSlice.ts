import dayjs, { Dayjs } from 'dayjs';
import { PanelSetup, Site } from '../../types/installation';
import { Config } from '../../types/config';
import { SunState, InstantProductionResult } from '../../types/simulation';
import { PanelSetupFactory } from '../../factory/PanelSetupFactory';
import { SolarEngine } from '../../engine/SolarEngine';
import { TimeUtils } from '../../utils/TimeUtils';

const CURRENT_YEAR = dayjs().year();

/**
 * Constructs a dayjs object representing the given date/time components as
 * local time in the specified IANA timezone.
 *
 * This is the only correct way to build dates from user-facing inputs. Using
 * dayjs() or dayjs(string) without a timezone would interpret the components
 * in the browser's local timezone, which may differ from the installation's
 * timezone and cause the displayed time to diverge from what the user typed.
 *
 * month is 0-based (January = 0), matching dayjs convention.
 */
export const makeDateInTimezone = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Dayjs => {
  const iso = [
    `${year}-`,
    `${String(month + 1).padStart(2, '0')}-`,
    `${String(day).padStart(2, '0')}T`,
    `${String(hour).padStart(2, '0')}:`,
    `${String(minute).padStart(2, '0')}:00`,
  ].join('');
  return dayjs.tz(iso, timezone);
};

/**
 * Minimum interface the render slice needs to read from other slices via
 * get(). Using a structural interface avoids a circular dependency between
 * the slice files and the AppStore facade.
 */
interface CrossSliceRead {
  config: Config | null;
  site: Site | null;
  renderDensity: number;
  activeSetup: PanelSetup | null;
  date: Dayjs;
}

export interface RenderState {
  activeSetup: PanelSetup | null;
  activeSetupIndex: number | null;
  timezone: string;
  date: Dayjs;
  isPlaying: boolean;
  sun: SunState | null;
  /** Controls point sphere visibility in the 3D view only. */
  showPoints: boolean;
  /** Sample point density for the 3D view and instant production readout. */
  renderDensity: number;
  /** Shadow zone threshold for the 3D view and instant production readout. */
  renderThreshold: number;
  /** Result of the last instant production calculation for the current time step. */
  instantProductionResult: InstantProductionResult | null;
}

export interface RenderActions {
  /** Initialises the active setup, date, timezone, and sun from a loaded config. */
  initRender: (config: Config, site: Site, density: number) => void;
  setActiveSetupIndex: (index: number) => void;
  setTimezone: (timezone: string) => void;
  setDate: (date: Dayjs) => void;
  adjustDate: (amount: number, unit: dayjs.ManipulateType) => void;
  setIsPlaying: (playing: boolean) => void;
  tickHour: () => void;
  setShowPoints: (show: boolean) => void;
  setRenderDensity: (density: number) => void;
  setRenderThreshold: (threshold: number) => void;
  setInstantProductionResult: (result: InstantProductionResult) => void;
}

export type RenderSlice = RenderState & RenderActions;

const buildSun = (date: Dayjs, config: Config): SunState =>
  SolarEngine.calculateSunState(
    date.toDate(),
    config.site.location.latitude,
    config.site.location.longitude,
  );

const clampToCurrentYear = (date: Dayjs): Dayjs => {
  if (date.year() > CURRENT_YEAR) return date.year(CURRENT_YEAR).month(0).date(1);
  if (date.year() < CURRENT_YEAR) return date.year(CURRENT_YEAR).month(11).date(31);
  return date;
};

export const createRenderSlice = (
  set: (partial: Partial<RenderSlice>) => void,
  get: () => CrossSliceRead,
): RenderSlice => ({
  activeSetup: null,
  activeSetupIndex: null,
  timezone: TimeUtils.resolveInitialTimezone(),
  date: dayjs(),
  isPlaying: false,
  sun: null,
  showPoints: false,
  renderDensity: 4,
  renderThreshold: 1,
  instantProductionResult: null,

  initRender: (config, site, density) => {
    const timezone = config.site.timezone;
    const date = dayjs().tz(timezone).second(0);
    const setupConfig = config.setups[0];
    const activeSetup = setupConfig
      ? PanelSetupFactory.create(setupConfig, 0, site, density)
      : null;
    const sun = buildSun(date, config);
    set({ activeSetup, activeSetupIndex: 0, date, sun, timezone });
  },

  setActiveSetupIndex: (index) => {
    const { config, site, renderDensity } = get();
    if (!config || !site) return;
    const setupConfig = config.setups[index];
    if (!setupConfig) return;
    const activeSetup = PanelSetupFactory.create(setupConfig, index, site, renderDensity);
    set({ activeSetupIndex: index, activeSetup });
  },

  setTimezone: (timezone) => {
    const { date } = get();
    set({ timezone, date: date.tz(timezone) });
  },

  setDate: (date) => {
    const { config } = get();
    const sun = config ? buildSun(date, config) : null;
    set({ date, sun });
  },

  adjustDate: (amount, unit) => {
    const { date, config } = get();
    const next = clampToCurrentYear(date.add(amount, unit));
    const sun = config ? buildSun(next, config) : null;
    set({ date: next, isPlaying: false, sun });
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  tickHour: () => {
    const { date, config } = get();
    const next = clampToCurrentYear(date.add(1, 'hour'));
    const sun = config ? buildSun(next, config) : null;
    set({ date: next, sun });
  },

  setShowPoints: (showPoints) => set({ showPoints }),

  setRenderDensity: (renderDensity) => {
    const { activeSetup } = get();
    if (!activeSetup) return;
    const rebuilt = PanelSetupFactory.rebuildSamplePoints(activeSetup, renderDensity);
    set({ renderDensity, activeSetup: rebuilt });
  },

  setRenderThreshold: (renderThreshold) => set({ renderThreshold }),

  setInstantProductionResult: (instantProductionResult) => set({ instantProductionResult }),
});