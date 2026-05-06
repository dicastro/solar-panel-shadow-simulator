import dayjs from 'dayjs';
import { IrradianceSource, SetupSimulationProgress } from '../../types/simulation';

const CURRENT_YEAR = dayjs().year();

/**
 * How many past years are offered in the simulation year selector,
 * in addition to the current year. Change this constant to expose more
 * or fewer historical years without touching any other code.
 */
const PAST_YEARS_AVAILABLE = 5;

/**
 * Returns the years available for simulation given the selected irradiance source.
 *
 * The geometric model works for any year including the current one.
 * Open-Meteo is backed by the historical archive endpoint, which only covers
 * completed past years — the current year is not yet available in full.
 * Offering the current year with Open-Meteo would leave all future hours at
 * 0 W/m², producing severely underestimated production figures.
 */
export const availableSimulationYears = (source: IrradianceSource = 'geometric'): number[] => {
  const oldestYear = CURRENT_YEAR - PAST_YEARS_AVAILABLE;
  if (source === 'open-meteo') {
    // Exclude the current year: archive only covers completed past years.
    return Array.from(
      { length: PAST_YEARS_AVAILABLE },
      (_, i) => CURRENT_YEAR - 1 - i,
    );
  }
  return Array.from(
    { length: PAST_YEARS_AVAILABLE + 1 },
    (_, i) => CURRENT_YEAR - i,
  ).filter(y => y >= oldestYear);
};

/**
 * Interval options available for a given irradiance source.
 *
 * Open-Meteo provides DNI at hourly resolution only. Using a sub-hourly
 * interval with Open-Meteo would repeat the same DNI value for every step
 * within the hour, which is technically correct but misleading — the user
 * would expect finer weather granularity. Restricting the selector to 60 min
 * when Open-Meteo is active avoids this confusion without losing accuracy.
 */
export const availableIntervals = (source: IrradianceSource): SimulationInterval[] => {
  if (source === 'open-meteo') return [60];
  return [15, 30, 60];
};

/** Time interval (in minutes) used when stepping through the year simulation. */
export type SimulationInterval = 15 | 30 | 60;

export interface SimulationState {
  simulationDensity: number;
  simulationThreshold: number;
  simulationInterval: SimulationInterval;
  simulationYear: number;
  irradianceSource: IrradianceSource;

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
   * Annual production results keyed by setupId. Each entry carries the setup
   * label (for display) and the computed annual total in kWh. Populated as
   * each setup completes, whether from cache or a fresh run.
   */
  annualProductionResults: Map<string, { label: string; annualTotalKwh: number }>;
}

export interface SimulationActions {
  setSimulationDensity: (density: number) => void;
  setSimulationThreshold: (threshold: number) => void;
  setSimulationInterval: (interval: SimulationInterval) => void;
  setSimulationYear: (year: number) => void;
  /**
   * Changes the irradiance source. If the currently selected interval or year
   * is not valid for the new source, both are reset to safe defaults:
   * interval → 60 min, year → the most recent available year for that source.
   */
  setIrradianceSource: (source: IrradianceSource) => void;

  startSimulation: () => void;
  stopSimulation: () => void;
  updateProgress: (progress: SetupSimulationProgress) => void;
  markSetupComplete: (setupId: string) => void;
  setSetupResult: (setupId: string, label: string, annualTotalKwh: number) => void;
  setPendingSetups: (count: number) => void;
  simulationComplete: () => void;
}

export type SimulationSlice = SimulationState & SimulationActions;

export const createSimulationSlice = (
  set: (
    partialOrUpdater:
      | Partial<SimulationSlice>
      | ((partial: SimulationSlice) => Partial<SimulationSlice>)
  ) => void,
): SimulationSlice => ({
  simulationDensity: 4,
  simulationThreshold: 1,
  simulationInterval: 60,
  simulationYear: CURRENT_YEAR,
  irradianceSource: 'geometric',
  isRunning: false,
  activeProgress: new Map(),
  pendingSetups: 0,
  annualProductionResults: new Map(),

  setSimulationDensity: (simulationDensity) => set({ simulationDensity }),

  setSimulationThreshold: (simulationThreshold) => set({ simulationThreshold }),

  setSimulationInterval: (simulationInterval) => set({ simulationInterval }),

  setSimulationYear: (simulationYear) => set({ simulationYear }),

  setIrradianceSource: (irradianceSource) =>
    set((state) => {
      const allowedIntervals = availableIntervals(irradianceSource);
      const interval = allowedIntervals.includes(state.simulationInterval)
        ? state.simulationInterval
        : 60;

      const allowedYears = availableSimulationYears(irradianceSource);
      const year = allowedYears.includes(state.simulationYear)
        ? state.simulationYear
        : allowedYears[0];

      return { irradianceSource, simulationInterval: interval, simulationYear: year };
    }),

  startSimulation: () =>
    set({
      isRunning: true,
      activeProgress: new Map(),
      pendingSetups: 0,
      annualProductionResults: new Map<string, { label: string; annualTotalKwh: number }>(),
    }),

  stopSimulation: () =>
    set({ isRunning: false, activeProgress: new Map(), pendingSetups: 0 }),

  updateProgress: (progress) =>
    set((state) => ({
      activeProgress: new Map(state.activeProgress).set(progress.setupId, progress),
    })),

  markSetupComplete: (setupId) =>
    set((state) => {
      const next = new Map(state.activeProgress);
      next.delete(setupId);
      return { activeProgress: next };
    }),

  setSetupResult: (setupId, label, annualTotalKwh) =>
    set((state) => ({
      annualProductionResults: new Map(state.annualProductionResults).set(setupId, { label, annualTotalKwh }),
    })),

  setPendingSetups: (pendingSetups) => set({ pendingSetups }),

  simulationComplete: () => set({ isRunning: false }),
});