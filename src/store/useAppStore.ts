import { create } from 'zustand';
import dayjs, { Dayjs } from 'dayjs';
import { Config, Site, PanelSetup, SunState, SimulationResult } from '../types';
import { SiteFactory } from '../factory/SiteFactory';
import { PanelSetupFactory } from '../factory/PanelSetupFactory';
import { calculateSunState } from '../solarEngine';

const CURRENT_YEAR = dayjs().year();

interface AppState {
  // Config & derived static models
  config: Config | null;
  site: Site | null;
  activeSetup: PanelSetup | null;
  activeSetupId: string | null;

  // Time
  date: Dayjs;
  isPlaying: boolean;

  // Derived from time (not state, but kept here for global access)
  sun: SunState | null;

  // UI / Simulation settings
  showPoints: boolean;
  density: number;
  threshold: number;
  isRunning: boolean;
  simulationResult: SimulationResult | null;

  // Actions
  loadConfig: (config: Config) => void;
  setActiveSetupId: (id: string) => void;
  setDate: (date: Dayjs) => void;
  adjustDate: (amount: number, unit: dayjs.ManipulateType) => void;
  setIsPlaying: (playing: boolean) => void;
  tickHour: () => void;
  setShowPoints: (show: boolean) => void;
  setDensity: (density: number) => void;
  setThreshold: (threshold: number) => void;
  setIsRunning: (running: boolean) => void;
  setSimulationResult: (result: SimulationResult) => void;
}

/** Recalculates PanelSetup when setup selection or density changes. */
const buildActiveSetup = (
  config: Config,
  site: Site,
  setupId: string,
  density: number,
): PanelSetup | null => {
  const setupConfig = config.setups.find(s => s.id === setupId);
  if (!setupConfig) return null;
  return PanelSetupFactory.create(setupConfig, density, site.centerX, site.centerZ);
};

/** Recalculates SunState from current date and site location. */
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
  // Initial state
  config: null,
  site: null,
  activeSetup: null,
  activeSetupId: null,
  date: dayjs(),
  isPlaying: false,
  sun: null,
  showPoints: false,
  density: 4,
  threshold: 1,
  isRunning: false,
  simulationResult: null,

  // Actions

  loadConfig: (config) => {
    const site = SiteFactory.create(config);
    const firstSetupId = config.setups[0].id;
    const date = dayjs().tz(config.site.timezone).second(0);
    const activeSetup = buildActiveSetup(config, site, firstSetupId, get().density);
    const sun = buildSun(date, config);

    set({ config, site, activeSetupId: firstSetupId, activeSetup, date, sun });
  },

  setActiveSetupId: (id) => {
    const { config, site, density } = get();
    if (!config || !site) return;
    const activeSetup = buildActiveSetup(config, site, id, density);
    set({ activeSetupId: id, activeSetup });
  },

  setDate: (date) => {
    const { config } = get();
    const sun = config ? buildSun(date, config) : null;
    set({ date, sun });
  },

  adjustDate: (amount, unit) => {
    const { date, config } = get();
    const next  = clampToCurrentYear(date.add(amount, unit));
    const sun   = config ? buildSun(next, config) : null;
    set({ date: next, isPlaying: false, sun });
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  tickHour: () => {
    const { date, config } = get();
    const next  = clampToCurrentYear(date.add(1, 'hour'));
    const sun   = config ? buildSun(next, config) : null;
    set({ date: next, sun });
  },

  setShowPoints: (showPoints) => set({ showPoints }),

  setDensity: (density) => {
    const { config, site, activeSetupId } = get();
    if (!config || !site || !activeSetupId) return;
    const activeSetup = buildActiveSetup(config, site, activeSetupId, density);
    set({ density, activeSetup });
  },

  setThreshold: (threshold) => set({ threshold }),

  setIsRunning: (isRunning) => set({ isRunning }),

  setSimulationResult: (simulationResult) => set({ simulationResult }),
}));