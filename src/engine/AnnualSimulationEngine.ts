import { PanelAnnualData, SimulationSetupResult, SimulationRunResult, SimulationPanelData, IrradianceSource } from '../types/simulation';

export interface PanelAccumulator {
  energyKwh: number[][][];
  stepCountByBucket: number[][][];
  shadedStepsByBucket: number[][][];
  shadedZoneStepsByBucket: number[][][][];
}

export const AnnualSimulationEngine = {
  initAccumulator: (zones: number): PanelAccumulator => ({
    energyKwh: Array.from({ length: 12 }, () =>
      Array.from({ length: 31 }, () => new Array<number>(24).fill(0))),
    stepCountByBucket: Array.from({ length: 12 }, () =>
      Array.from({ length: 31 }, () => new Array<number>(24).fill(0))),
    shadedStepsByBucket: Array.from({ length: 12 }, () =>
      Array.from({ length: 31 }, () => new Array<number>(24).fill(0))),
    shadedZoneStepsByBucket: Array.from({ length: zones }, () =>
      Array.from({ length: 12 }, () =>
        Array.from({ length: 31 }, () => new Array<number>(24).fill(0)))),
  }),

  initAccumulators: (panels: SimulationPanelData[]): PanelAccumulator[] =>
    panels.map(p => AnnualSimulationEngine.initAccumulator(p.zones)),

  accumulateStep: (
    acc: PanelAccumulator,
    month: number,
    day: number,
    hour: number,
    powerKw: number,
    shadedZones: boolean[],
    hoursPerStep: number,
  ): void => {
    acc.energyKwh[month][day][hour] += powerKw * hoursPerStep;
    acc.stepCountByBucket[month][day][hour]++;
    if (shadedZones.some(Boolean)) {
      acc.shadedStepsByBucket[month][day][hour]++;
    }
    shadedZones.forEach((isShaded, zIdx) => {
      if (isShaded) acc.shadedZoneStepsByBucket[zIdx][month][day][hour]++;
    });
  },

  finalizePanel: (
    panel: SimulationPanelData,
    acc: PanelAccumulator,
  ): PanelAnnualData => {
    const shadeFraction: number[][][] = Array.from({ length: 12 }, () =>
      Array.from({ length: 31 }, () => new Array<number>(24).fill(0)));
    const zoneShadeFraction: number[][][][] = Array.from({ length: panel.zones }, () =>
      Array.from({ length: 12 }, () =>
        Array.from({ length: 31 }, () => new Array<number>(24).fill(0))));

    for (let m = 0; m < 12; m++) {
      for (let d = 0; d < 31; d++) {
        for (let h = 0; h < 24; h++) {
          const count = acc.stepCountByBucket[m][d][h];
          if (count > 0) {
            shadeFraction[m][d][h] = acc.shadedStepsByBucket[m][d][h] / count;
            for (let z = 0; z < panel.zones; z++) {
              zoneShadeFraction[z][m][d][h] =
                acc.shadedZoneStepsByBucket[z][m][d][h] / count;
            }
          }
        }
      }
    }

    return {
      panelId: panel.id,
      arrayIndex: panel.arrayIndex,
      row: panel.row,
      col: panel.col,
      energyKwh: acc.energyKwh,
      shadeFraction,
      zoneShadeFraction,
      orientation: panel.orientation,
      actualWidth: panel.actualWidth,
      actualHeight: panel.actualHeight,
      zones: panel.zones,
      zonesDisposition: panel.zonesDisposition,
      string: panel.string,
      stringColorIndex: panel.stringColorIndex,
      arrayConfigPosition: panel.arrayConfigPosition,
    };
  },

  /**
   * Builds a SimulationSetupResult from finalized panel data.
   * This is what each worker emits — it contains no cache keys or run metadata.
   */
  buildSetupResult: (
    setupId: string,
    setupLabel: string,
    panels: PanelAnnualData[],
  ): SimulationSetupResult => {
    const monthlyTotalKwh = new Array<number>(12).fill(0);
    panels.forEach(p => {
      p.energyKwh.forEach((days, m) => {
        days.forEach(hours => {
          hours.forEach(kwh => { monthlyTotalKwh[m] += kwh; });
        });
      });
    });
    const annualTotalKwh = monthlyTotalKwh.reduce((s, v) => s + v, 0);
    return { setupId, setupLabel, panels, monthlyTotalKwh, annualTotalKwh };
  },

  /**
   * Assembles the complete SimulationRunResult from all setup results.
   * Called on the main thread once all workers have completed.
   */
  buildRunResult: (
    cacheKey: string,
    simulationInputHash: string,
    year: number,
    intervalMinutes: number,
    irradianceSource: IrradianceSource,
    density: number,
    threshold: number,
    setups: SimulationSetupResult[],
  ): SimulationRunResult => ({
    cacheKey,
    simulationInputHash,
    computedAt: Date.now(),
    year,
    intervalMinutes,
    irradianceSource,
    density,
    threshold,
    setups,
  }),
};