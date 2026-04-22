import { create } from 'zustand';
import dayjs, { Dayjs } from 'dayjs';
import { Config, PanelSetup, Site, SimulationResult, SunState } from '../types';
import { SiteFactory } from '../factory/SiteFactory';
import { PanelSetupFactory } from '../factory/PanelSetupFactory';
import { calculateSunState } from '../solarEngine';
import { resolveInitialTimezone } from '../utils/TimezoneUtils';

const CURRENT_YEAR = dayjs().year();

/** Time interval (in minutes) used when stepping through the year simulation. */
export type SimulationInterval = 15 | 30 | 60;

interface AppState {
  // Config & derived static models
  config: Config | null;
  site: Site | null;
  activeSetup: PanelSetup | null;
  activeSetupIndex: number | null;

  // Time
  timezone: string;
  date: Dayjs;
  isPlaying: boolean;

  // Sun (derived from time + location, kept here for global access)
  sun: SunState | null;

  // UI / Simulation settings
  showPoints: boolean;
  density: number;
  threshold: number;
  isRunning: boolean;
  simulationInterval: SimulationInterval;
  simulationResult: SimulationResult | null;

  /**
   * Indices of wall points (in config space) where the angle between adjacent
   * wall segments is not 90°. Populated by loadConfig. Empty when all angles
   * are valid. Used to display a warning in the UI.
   */
  angleWarnings: number[];

  // Actions
  loadConfig: (config: Config) => void;
  setActiveSetupIndex: (index: number) => void;
  setTimezone: (timezone: string) => void;
  setDate: (date: Dayjs) => void;
  adjustDate: (amount: number, unit: dayjs.ManipulateType) => void;
  setIsPlaying: (playing: boolean) => void;
  tickHour: () => void;
  setShowPoints: (show: boolean) => void;
  setDensity: (density: number) => void;
  setThreshold: (threshold: number) => void;
  setIsRunning: (running: boolean) => void;
  setSimulationInterval: (interval: SimulationInterval) => void;
  setSimulationResult: (result: SimulationResult) => void;
}

/**
 * Constructs a dayjs object that represents the given date/time components
 * interpreted as local time in the specified IANA timezone.
 *
 * This is the only correct way to build dates from user-facing inputs in this
 * application. Using dayjs() or dayjs(string) without a timezone would
 * interpret the components in the browser's local timezone, which may differ
 * from the installation's timezone and would cause the displayed time to
 * diverge from what the user typed.
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

const buildActiveSetup = (
  config: Config,
  site: Site,
  index: number,
  density: number,
): PanelSetup | null => {
  const setupConfig = config.setups[index];
  if (!setupConfig) return null;
  return PanelSetupFactory.create(setupConfig, index, site, density);
};

const rebuildSamplePoints = (
  activeSetup: PanelSetup,
  newDensity: number,
): PanelSetup => PanelSetupFactory.rebuildSamplePoints(activeSetup, newDensity);

const buildSun = (date: Dayjs, config: Config): SunState =>
  calculateSunState(
    date.toDate(),
    config.site.location.latitude,
    config.site.location.longitude,
  );

const clampToCurrentYear = (date: Dayjs): Dayjs => {
  if (date.year() > CURRENT_YEAR) return date.year(CURRENT_YEAR).month(0).date(1);
  if (date.year() < CURRENT_YEAR) return date.year(CURRENT_YEAR).month(11).date(31);
  return date;
};

export const useAppStore = create<AppState>((set, get) => ({
  config: null,
  site: null,
  activeSetup: null,
  activeSetupIndex: null,
  timezone: resolveInitialTimezone(),
  date: dayjs(),
  isPlaying: false,
  sun: null,
  showPoints: false,
  density: 4,
  threshold: 1,
  isRunning: false,
  simulationInterval: 60,
  simulationResult: null,
  angleWarnings: [],

  loadConfig: (config) => {
    const { site, angleWarnings } = SiteFactory.create(config);
    const date = dayjs().tz(config.site.timezone).second(0);
    const activeSetup = buildActiveSetup(config, site, 0, get().density);
    const sun = buildSun(date, config);
    set({ config, site, activeSetupIndex: 0, activeSetup, date, sun, angleWarnings });
  },

  setActiveSetupIndex: (index) => {
    const { config, site, density } = get();
    if (!config || !site) return;
    const activeSetup = buildActiveSetup(config, site, index, density);
    set({ activeSetupIndex: index, activeSetup });
  },

  /**
   * Changes the display timezone while preserving the current UTC instant.
   *
   * The solar calculations always use date.toDate() (a UTC instant), so
   * changing timezone never affects them. The date and time fields in the UI
   * update to show the same instant in the new timezone, which is the
   * expected behaviour: the user is choosing how to read the clock, not
   * shifting the simulation to a different moment in time.
   */
  setTimezone: (timezone) => {
    const { date } = get();
    const newDate = date.tz(timezone);
    set({ timezone, date: newDate });
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

  setDensity: (density) => {
    const { activeSetup } = get();
    if (!activeSetup) return;
    const rebuiltActiveSetup = rebuildSamplePoints(activeSetup, density);
    set({ density, activeSetup: rebuiltActiveSetup });
  },

  setThreshold: (threshold) => set({ threshold }),

  setIsRunning: (isRunning) => set({ isRunning }),

  setSimulationInterval: (simulationInterval) => set({ simulationInterval }),

  setSimulationResult: (simulationResult) => set({ simulationResult }),
}));