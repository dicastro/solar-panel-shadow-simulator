import { PanelAnnualData, SetupAnnualResult, SimulationPanelData, IrradianceSource } from '../types/simulation';

/**
 * Internal mutable accumulator for a single panel's annual data.
 * Counts raw shaded steps and total steps per time bucket so that shade
 * fractions can be computed once at finalisation rather than maintained
 * as running averages (which would accumulate floating-point error).
 */
export interface PanelAccumulator {
  energyKwh: number[][][];
  stepCountByBucket: number[][][];
  shadedStepsByBucket: number[][][];
  shadedZoneStepsByBucket: number[][][][];
}

export const AnnualSimulationEngine = {
  /**
   * Allocates a zeroed accumulator for a single panel.
   * Shape: [month(0–11)][dayOfMonth(0–30)][hourOfDay(0–23)].
   * Days beyond the actual month length remain 0 throughout.
   */
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

  /**
   * Allocates one zeroed accumulator per panel, indexed in the same order as
   * the `panels` array.
   */
  initAccumulators: (panels: SimulationPanelData[]): PanelAccumulator[] =>
    panels.map(p => AnnualSimulationEngine.initAccumulator(p.zones)),

  /**
   * Records one time step's contribution into the accumulator for a single panel.
   *
   * @param acc         The panel's mutable accumulator (modified in place).
   * @param month       UTC month index, 0–11.
   * @param day         UTC day-of-month index, 0–30.
   * @param hour        UTC hour-of-day index, 0–23.
   * @param powerKw     Net panel power for this step after string mismatch (kW).
   * @param shadedZones Boolean array, one entry per zone.
   * @param hoursPerStep Duration of one simulation interval in hours.
   */
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

  /**
   * Converts a panel's raw accumulator into the final `PanelAnnualData` shape.
   *
   * Shade fractions are computed here by dividing raw shaded-step counts by
   * total step counts, avoiding accumulated floating-point error from running
   * averages. Physical geometry fields are propagated from the input panel data
   * so the results panel can render heat maps with correct proportions and zone
   * layouts without needing access to the original config.
   */
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
    };
  },

  /**
   * Builds the complete `SetupAnnualResult` from finalized panel data.
   * Pre-rolls monthly totals across all panels for fast chart rendering.
   * Records density and threshold so the results panel can display and group
   * by these parameters without re-deriving them from the cache key hash.
   */
  buildSetupResult: (
    setupId: string,
    setupLabel: string,
    cacheKey: string,
    year: number,
    intervalMinutes: number,
    irradianceSource: IrradianceSource,
    density: number,
    threshold: number,
    panels: PanelAnnualData[],
  ): SetupAnnualResult => {
    const monthlyTotalKwh = new Array<number>(12).fill(0);

    panels.forEach(p => {
      p.energyKwh.forEach((days, m) => {
        days.forEach(hours => {
          hours.forEach(kwh => { monthlyTotalKwh[m] += kwh; });
        });
      });
    });

    const annualTotalKwh = monthlyTotalKwh.reduce((s, v) => s + v, 0);

    return {
      setupId,
      setupLabel,
      cacheKey,
      computedAt: Date.now(),
      year,
      intervalMinutes,
      irradianceSource,
      density,
      threshold,
      panels,
      monthlyTotalKwh,
      annualTotalKwh,
    };
  },
};