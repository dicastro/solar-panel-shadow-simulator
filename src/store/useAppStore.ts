import { create } from 'zustand';
import dayjs, { Dayjs } from 'dayjs';
import { Config, PanelSetup, Site, SimulationResult, SunState } from '../types';
import { AngleWarning } from '../types/geometry';
import {
  IrradianceSource,
  SetupSimulationProgress,
} from '../types/simulation';
import { SiteFactory } from '../factory/SiteFactory';
import { PanelSetupFactory } from '../factory/PanelSetupFactory';
import { SolarEngine } from '../engine/SolarEngine';
import { TimeUtils } from '../utils/TimeUtils';

const CURRENT_YEAR = dayjs().year();

/**
 * How many past years are offered in the simulation year selector,
 * in addition to the current year. Change this constant to expose more
 * or fewer historical years without touching any other code.
 */
const PAST_YEARS_AVAILABLE = 5;

/** All years available for simulation: current year down to PAST_YEARS_AVAILABLE ago. */
export const availableSimulationYears = (): number[] =>
  Array.from({ length: PAST_YEARS_AVAILABLE + 1 }, (_, i) => CURRENT_YEAR - i);

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
  simulationInterval: SimulationInterval;

  // Instant production result (current 3D view time step)
  simulationResult: SimulationResult | null;

  // ── Annual simulation ─────────────────────────────────────────────────────

  /** Year used for the annual simulation. Defaults to the current year. */
  simulationYear: number;

  irradianceSource: IrradianceSource;

  /** Whether a simulation run is currently in progress. */
  isRunning: boolean;

  /**
   * Live progress for each setup currently being processed by a worker.
   * Setups waiting in the queue are not present here — they are counted by
   * `pendingSetups` instead.
   */
  activeProgress: Map<string, SetupSimulationProgress>;

  /**
   * Number of setups waiting in the worker queue (spawned but not yet
   * assigned to a worker because all worker slots are busy).
   */
  pendingSetups: number;

  /**
   * Annual results keyed by setupId. Each entry carries the setup label
   * (for display) and the computed annual total in kWh.
   * Populated as each setup completes, whether from cache or a fresh run.
   */
  annualResults: Map<string, { label: string; annualTotalKwh: number }>;

  angleWarnings: readonly AngleWarning[];

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
  setSimulationInterval: (interval: SimulationInterval) => void;
  setSimulationResult: (result: SimulationResult) => void;
  setSimulationYear: (year: number) => void;
  setIrradianceSource: (source: IrradianceSource) => void;

  // Annual simulation lifecycle
  startSimulation: () => void;
  stopSimulation: () => void;
  updateProgress: (progress: SetupSimulationProgress) => void;
  markSetupComplete: (setupId: string) => void;
  setSetupResult: (setupId: string, label: string, annualTotalKwh: number) => void;
  setPendingSetups: (count: number) => void;
  simulationComplete: () => void;
}

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

export const useAppStore = create<AppState>((set, get) => ({
  config: null,
  site: null,
  activeSetup: null,
  activeSetupIndex: null,
  timezone: TimeUtils.resolveInitialTimezone(),
  date: dayjs(),
  isPlaying: false,
  sun: null,
  showPoints: false,
  density: 4,
  threshold: 1,
  simulationInterval: 60,
  simulationResult: null,
  simulationYear: CURRENT_YEAR,
  irradianceSource: 'geometric',
  isRunning: false,
  activeProgress: new Map(),
  pendingSetups: 0,
  annualResults: new Map(),
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

  setSimulationInterval: (simulationInterval) => set({ simulationInterval }),

  setSimulationResult: (simulationResult) => set({ simulationResult }),

  setSimulationYear: (simulationYear) => set({ simulationYear }),

  setIrradianceSource: (irradianceSource) => set({ irradianceSource }),

  startSimulation: () =>
    set({ isRunning: true, activeProgress: new Map(), pendingSetups: 0, annualResults: new Map<string, { label: string; annualTotalKwh: number }>() }),

  stopSimulation: () =>
    set({ isRunning: false, activeProgress: new Map(), pendingSetups: 0 }),

  updateProgress: (progress) =>
    set(state => ({
      activeProgress: new Map(state.activeProgress).set(progress.setupId, progress),
    })),

  markSetupComplete: (setupId) =>
    set(state => {
      const next = new Map(state.activeProgress);
      next.delete(setupId);
      return { activeProgress: next };
    }),

  setSetupResult: (setupId, label, annualTotalKwh) =>
    set(state => ({
      annualResults: new Map(state.annualResults).set(setupId, { label, annualTotalKwh }),
    })),

  setPendingSetups: (pendingSetups) => set({ pendingSetups }),

  simulationComplete: () => set({ isRunning: false }),
}));