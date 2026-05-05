import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadedSetupResult } from '../../types/results';
import { PanelAnnualData } from '../../types/simulation';
import { ZonesDisposition } from '../../types/config';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
  /** 0-based month index, or null for the full year */
  month: number | null;
  /** 0-based day-of-month index, or null for the full month/year */
  day: number | null;
}

/** Maximum size in pixels for a single panel cell (longer axis). */
const MAX_PANEL_PX = 88;

/**
 * Interpolates between green (0% shade) → yellow (50%) → red (100%).
 */
const shadeToColour = (fraction: number): string => {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped < 0.5) {
    const t = clamped * 2;
    return `rgb(${Math.round(46 + 195 * t)},${Math.round(204 - 8 * t)},${Math.round(113 - 98 * t)})`;
  } else {
    const t = (clamped - 0.5) * 2;
    return `rgb(${Math.round(241 - 10 * t)},${Math.round(196 - 120 * t)},${Math.round(15 + 45 * t)})`;
  }
};

/**
 * Computes the average shade fraction for one zone over the selected time window.
 */
const zoneAvgShade = (
  zoneShadeFraction: number[][][][],
  zIdx: number,
  month: number | null,
  day: number | null,
): number => {
  const months = month !== null ? [month] : Array.from({ length: 12 }, (_, i) => i);
  const days = day !== null ? [day] : Array.from({ length: 31 }, (_, i) => i);
  let total = 0, count = 0;
  for (const m of months) {
    for (const d of days) {
      for (let h = 0; h < 24; h++) {
        total += zoneShadeFraction[zIdx][m][d][h];
        count++;
      }
    }
  }
  return count > 0 ? total / count : 0;
};

/**
 * Returns CSS layout (top/left/width/height as percentage strings) for each
 * zone within a panel cell, matching the physical zone disposition.
 */
const zoneCssLayouts = (
  zones: number,
  disposition: ZonesDisposition,
): { top: string; left: string; width: string; height: string }[] =>
  Array.from({ length: zones }, (_, i) => {
    const pct = 100 / zones;
    return disposition === 'horizontal'
      ? { top: `${i * pct}%`, left: '0%', width: '100%', height: `${pct}%` }
      : { top: '0%', left: `${i * pct}%`, width: `${pct}%`, height: '100%' };
  });

interface PanelGroup {
  arrayIndex: number;
  rows: number;
  cols: number;
  grid: (PanelAnnualData | null)[][];
}

const buildGroups = (panels: PanelAnnualData[]): PanelGroup[] => {
  const byArray = new Map<number, PanelAnnualData[]>();
  panels.forEach(p => {
    const arr = byArray.get(p.arrayIndex) ?? [];
    arr.push(p);
    byArray.set(p.arrayIndex, arr);
  });

  return Array.from(byArray.entries())
    .sort(([a], [b]) => a - b)
    .map(([arrayIndex, arrPanels]) => {
      const rows = Math.max(...arrPanels.map(p => p.row)) + 1;
      const cols = Math.max(...arrPanels.map(p => p.col)) + 1;
      const grid: (PanelAnnualData | null)[][] = Array.from(
        { length: rows }, () => new Array<PanelAnnualData | null>(cols).fill(null),
      );
      arrPanels.forEach(p => { grid[p.row][p.col] = p; });
      return { arrayIndex, rows, cols, grid };
    });
};

function PanelCell({ panel, month, day }: {
  panel: PanelAnnualData;
  month: number | null;
  day: number | null;
}) {
  // Derive cell pixel size from actual panel proportions, capped at MAX_PANEL_PX.
  const { actualWidth: w, actualHeight: h } = panel;
  const scale = MAX_PANEL_PX / Math.max(w, h);
  const cellW = Math.round(w * scale);
  const cellH = Math.round(h * scale);

  const layouts = zoneCssLayouts(panel.zones, panel.zonesDisposition);

  return (
    <div
      style={{ width: cellW, height: cellH, position: 'relative', borderRadius: 2,
        overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(0,0,0,0.18)' }}
      title={panel.panelId}
    >
      {layouts.map((layout, zIdx) => {
        const fraction = zoneAvgShade(panel.zoneShadeFraction, zIdx, month, day);
        const pct = (fraction * 100).toFixed(1);
        const zoneId = `${panel.panelId}-z${zIdx}`;
        return (
          <div
            key={zIdx}
            style={{
              position: 'absolute', top: layout.top, left: layout.left,
              width: layout.width, height: layout.height,
              background: shadeToColour(fraction), boxSizing: 'border-box',
              borderBottom: panel.zones > 1 && panel.zonesDisposition === 'horizontal' && zIdx < panel.zones - 1
                ? '0.5px solid rgba(0,0,0,0.12)' : undefined,
              borderRight: panel.zones > 1 && panel.zonesDisposition === 'vertical' && zIdx < panel.zones - 1
                ? '0.5px solid rgba(0,0,0,0.12)' : undefined,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}
            title={`${zoneId} — ${pct}% shaded`}
          >
            <span style={{
              fontSize: '0.38rem', fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.92)', textShadow: '0 0 2px rgba(0,0,0,0.8)',
              lineHeight: 1, userSelect: 'none', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'clip', padding: '0 1px',
            }}>
              {zoneId}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SingleHeatmap({ result, month, day }: {
  result: LoadedSetupResult;
  month: number | null;
  day: number | null;
}) {
  const { t } = useTranslation();
  const groups = useMemo(
    () => buildGroups(result.result.panels as PanelAnnualData[]),
    [result.result.panels],
  );
  const setupColour = SetupColoursUtils.getSetupColour(result.colourIndex);

  return (
    <div className="heatmap-container" style={{ borderTop: `3px solid ${setupColour}` }}>
      <div style={{ fontFamily: 'sans-serif', fontSize: '0.75rem', fontWeight: 700,
        color: setupColour, marginBottom: 4, maxWidth: '144px', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${result.result.setupLabel}`}>
        {result.result.setupLabel}
      </div>

      {groups.map(group => (
        <div key={group.arrayIndex} className="heatmap-array">
          <div className="heatmap-array__label">
            {t('resultsPanel.array')} {group.arrayIndex}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Array.from({ length: group.rows }, (_, rowIdx) => (
              <div key={rowIdx} style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: group.cols }, (_, colIdx) => {
                  const panel = group.grid[rowIdx][colIdx];
                  return panel
                    ? <PanelCell key={colIdx} panel={panel} month={month} day={day} />
                    : <div key={colIdx} style={{ width: MAX_PANEL_PX, height: MAX_PANEL_PX }} />;
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
 * Renders one heat map per active setup. Each panel cell reflects the physical
 * panel proportions (portrait vs landscape, capped at MAX_PANEL_PX). Each zone
 * within the panel is a distinct coloured sub-cell using `zoneShadeFraction`
 * data from the simulation result. Arrays are labelled with their 0-based index.
 */
export function PanelShadowHeatmap({ results, activeSetupIds, month, day }: Props) {
  const visible = results.filter(r => activeSetupIds.has(r.setupId));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
      {visible.map(r => (
        <SingleHeatmap key={r.setupId} result={r} month={month} day={day} />
      ))}
    </div>
  );
}