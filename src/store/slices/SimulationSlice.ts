import dayjs from 'dayjs';
import { SimulationResult, IrradianceSource, SetupSimulationProgress } from '../../types/simulation';

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

export interface SimulationState {
  // Instant production result (current 3D view time step)
  simulationResult: SimulationResult | null;

  // Annual simulation parameters — independent of render controls
  simulationDensity: number;
  simulationThreshold: number;
  simulationInterval: SimulationInterval;
  simulationYear: number;
  irradianceSource: IrradianceSource;

  // Annual simulation lifecycle
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
}

export interface SimulationActions {
  setSimulationResult: (result: SimulationResult) => void;
  setSimulationDensity: (density: number) => void;
  setSimulationThreshold: (threshold: number) => void;
  setSimulationInterval: (interval: SimulationInterval) => void;
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

export type SimulationSlice = SimulationState & SimulationActions;

export const createSimulationSlice = (
  set: (
    nextStateOrUpdater:
      | Partial<SimulationSlice>
      | ((state: SimulationSlice) => Partial<SimulationSlice>)
  ) => void,
): SimulationSlice => ({
  simulationResult: null,
  simulationDensity: 4,
  simulationThreshold: 1,
  simulationInterval: 60,
  simulationYear: CURRENT_YEAR,
  irradianceSource: 'geometric',
  isRunning: false,
  activeProgress: new Map(),
  pendingSetups: 0,
  annualResults: new Map(),

  setSimulationResult: (simulationResult) => set({ simulationResult }),

  setSimulationDensity: (simulationDensity) => set({ simulationDensity }),

  setSimulationThreshold: (simulationThreshold) => set({ simulationThreshold }),

  setSimulationInterval: (simulationInterval) => set({ simulationInterval }),

  setSimulationYear: (simulationYear) => set({ simulationYear }),

  setIrradianceSource: (irradianceSource) => set({ irradianceSource }),

  startSimulation: () =>
    set({
      isRunning: true,
      activeProgress: new Map(),
      pendingSetups: 0,
      annualResults: new Map<string, { label: string; annualTotalKwh: number }>(),
    }),

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
});