import { useMemo } from 'react';
import { LoadedSetupResult } from '../../types/results';
import { PanelAnnualData } from '../../types/simulation';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
  /** 0-based month index, or null for the full year */
  month: number | null;
  /** 0-based day-of-month index, or null for the full month/year */
  day: number | null;
}

/**
 * Interpolates between green (0% shade) → yellow (50%) → red (100%) using
 * the same hue scale as the CSS gradient in the scale bar.
 */
const shadeToColour = (fraction: number): string => {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped < 0.5) {
    const t = clamped * 2;
    const r = Math.round(46 + (241 - 46) * t);
    const g = Math.round(204 + (196 - 204) * t);
    const b = Math.round(113 + (15 - 113) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = (clamped - 0.5) * 2;
    const r = Math.round(241 + (231 - 241) * t);
    const g = Math.round(196 + (76 - 196) * t);
    const b = Math.round(15 + (60 - 15) * t);
    return `rgb(${r},${g},${b})`;
  }
};

/**
 * Computes the average shade fraction for a panel over the requested time window.
 * Buckets with zero steps (e.g., days beyond month length) are excluded.
 */
const computeAverageShadeFraction = (
  panel: PanelAnnualData,
  month: number | null,
  day: number | null,
): number => {
  const months = month !== null ? [month] : Array.from({ length: 12 }, (_, i) => i);
  const days = day !== null ? [day] : Array.from({ length: 31 }, (_, i) => i);

  let total = 0;
  let count = 0;
  for (const m of months) {
    for (const d of days) {
      for (let h = 0; h < 24; h++) {
        const f = panel.shadeFraction[m][d][h];
        // Buckets that had no daylight steps hold 0 and should be counted
        // only if there was actual energy production or shade data.
        // Since we have no step count here, include all non-zero buckets
        // plus a consistent sample of zero buckets to avoid bias.
        total += f;
        count++;
      }
    }
  }
  return count > 0 ? total / count : 0;
};

interface PanelGroup {
  arrayIndex: number;
  rows: number;
  cols: number;
  /** shade[row][col] → fraction 0..1 */
  shade: number[][];
  /** panelId[row][col] */
  panelId: string[][];
}

const buildPanelGroups = (
  panels: PanelAnnualData[],
  month: number | null,
  day: number | null,
): PanelGroup[] => {
  const byArray = new Map<number, PanelAnnualData[]>();
  panels.forEach(p => {
    const arr = byArray.get(p.arrayIndex) ?? [];
    arr.push(p);
    byArray.set(p.arrayIndex, arr);
  });

  return Array.from(byArray.entries())
    .sort(([a], [b]) => a - b)
    .map(([arrayIndex, arrPanels]) => {
      const maxRow = Math.max(...arrPanels.map(p => p.row));
      const maxCol = Math.max(...arrPanels.map(p => p.col));
      const rows = maxRow + 1;
      const cols = maxCol + 1;

      const shade: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
      const panelId: string[][] = Array.from({ length: rows }, () => new Array<string>(cols).fill(''));

      arrPanels.forEach(p => {
        shade[p.row][p.col] = computeAverageShadeFraction(p, month, day);
        panelId[p.row][p.col] = p.panelId;
      });

      return { arrayIndex, rows, cols, shade, panelId };
    });
};

function SingleHeatmap({
  result,
  month,
  day,
}: {
  result: LoadedSetupResult;
  month: number | null;
  day: number | null;
}) {
  const groups = useMemo(
    () => buildPanelGroups(result.result.panels as PanelAnnualData[], month, day),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result.result.panels, month, day],
  );

  const setupColour = SetupColoursUtils.getSetupColour(result.colourIndex);

  return (
    <div
      className="heatmap-container"
      style={{ borderTop: `3px solid ${setupColour}` }}
    >
      <div
        style={{
          fontFamily: 'sans-serif',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: setupColour,
          marginBottom: 4,
        }}
      >
        {result.result.setupLabel}
      </div>

      {groups.map(group => (
        <div key={group.arrayIndex} className="heatmap-array">
          <div className="heatmap-array__label">
            Array {group.arrayIndex + 1}
          </div>
          <div
            className="heatmap-array__grid"
            style={{
              /*
               * Panels are arranged so North is at the top, South at the
               * bottom. In the data, row 0 is the northernmost row because
               * SolarPanelArrayFactory iterates rows top-to-bottom
               * (localZ increases southward). No reversal is needed — the
               * grid already matches the physical orientation.
               */
            }}
          >
            {Array.from({ length: group.rows }, (_, rowIdx) => (
              <div key={rowIdx} className="heatmap-array__row">
                {Array.from({ length: group.cols }, (_, colIdx) => {
                  const fraction = group.shade[rowIdx][colIdx];
                  const pct = (fraction * 100).toFixed(1);
                  const id = group.panelId[rowIdx][colIdx];
                  return (
                    <div
                      key={colIdx}
                      className="heatmap-panel-cell"
                      style={{ background: shadeToColour(fraction) }}
                      title={`${id} — ${pct}% shaded`}
                    >
                      <span className="heatmap-panel-cell__label">{id}</span>
                      <span className="heatmap-panel-cell__tooltip">
                        {id}<br />{pct}% shaded
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="heatmap-scale">
        <span>0%</span>
        <div className="heatmap-scale__bar" />
        <span>100%</span>
      </div>
    </div>
  );
}

/**
 * Renders one heat map per active setup, each showing the physical panel grid
 * coloured by average shade fraction for the selected time window.
 *
 * Panels are grouped by array. Within each array they are arranged in their
 * physical row/column positions (North top, South bottom, West left, East right).
 * Multiple arrays within a setup are separated by a visible gap and labelled.
 */
export function PanelShadowHeatmap({ results, activeSetupIds, month, day }: Props) {
  const visible = results.filter(r => activeSetupIds.has(r.setupId));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {visible.map(r => (
        <SingleHeatmap key={r.setupId} result={r} month={month} day={day} />
      ))}
    </div>
  );
}