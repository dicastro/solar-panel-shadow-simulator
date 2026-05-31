import dayjs from 'dayjs';
import { IrradianceSource, SetupSimulationProgress } from '../../types/simulation';
import { simulationStopFlag } from '../../hooks/useAnnualSimulation';

const CURRENT_YEAR = dayjs().year();
const PAST_YEARS_AVAILABLE = 5;

export const availableSimulationYears = (source: IrradianceSource = 'geometric'): number[] => {
  const oldestYear = CURRENT_YEAR - PAST_YEARS_AVAILABLE;
  if (source === 'open-meteo') {
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

export const availableIntervals = (source: IrradianceSource): SimulationInterval[] => {
  if (source === 'open-meteo') return [60];
  return [15, 30, 60];
};

export type SimulationInterval = 15 | 30 | 60;

export interface SimulationState {
  simulationDensity: number;
  simulationThreshold: number;
  simulationInterval: SimulationInterval;
  simulationYear: number;
  irradianceSource: IrradianceSource;
  isRunning: boolean;
  activeProgress: Map<string, SetupSimulationProgress>;
  pendingSetups: number;
  annualProductionResults: Map<string, { label: string; annualTotalKwh: number }>;
}

export interface SimulationActions {
  setSimulationDensity: (density: number) => void;
  setSimulationThreshold: (threshold: number) => void;
  setSimulationInterval: (interval: SimulationInterval) => void;
  setSimulationYear: (year: number) => void;
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

  stopSimulation: () => {
    simulationStopFlag.current = true;
    set({ isRunning: false, activeProgress: new Map(), pendingSetups: 0 });
  },

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