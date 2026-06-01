import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadedSetupResult } from '../../types/results';
import { PanelAnnualData } from '../../types/simulation';
import { ZonesDisposition } from '../../types/config';
import { SetupColoursUtils } from '../../utils/SetupColoursUtils';
import { StringColoursUtils } from '../../utils/StringColorUtils';

interface Props {
  results: LoadedSetupResult[];
  activeSetupIds: Set<string>;
  /** 0-based month index, or null for the full year */
  month: number | null;
  /** 0-based day-of-month index, or null for the full month/year */
  day: number | null;
}

const MAX_PANEL_PX = 88;

const shadeToColour = (fraction: number): string => {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped < 0.5) {
    const t = clamped * 2;
    return `rgb(${Math.round(46 + 195 * t)},${Math.round(204 - 8 * t)},${Math.round(113 - 98 * t)})`;
  }
  const t = (clamped - 0.5) * 2;
  return `rgb(${Math.round(241 - 10 * t)},${Math.round(196 - 120 * t)},${Math.round(15 + 45 * t)})`;
};

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
  /** grid[row][col], row 0 = southernmost */
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
  const { actualWidth: w, actualHeight: h, stringColorIndex } = panel;
  const scale = MAX_PANEL_PX / Math.max(w, h);
  const cellW = Math.round(w * scale);
  const cellH = Math.round(h * scale);
  const layouts = zoneCssLayouts(panel.zones, panel.zonesDisposition);
  const stringColour = StringColoursUtils.getStringColour(stringColorIndex);

  return (
    <div
      style={{
        width: cellW, height: cellH, position: 'relative', borderRadius: 2,
        overflow: 'hidden', flexShrink: 0,
        border: `2px solid ${stringColour}`,
      }}
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
              borderBottom:
                panel.zones > 1 && panel.zonesDisposition === 'horizontal' && zIdx < panel.zones - 1
                  ? '0.5px solid rgba(0,0,0,0.12)' : undefined,
              borderRight:
                panel.zones > 1 && panel.zonesDisposition === 'vertical' && zIdx < panel.zones - 1
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

  // Derive unique strings in first-appearance order.
  const stringLegend = useMemo(() => {
    const seen = new Map<string, number>();
    for (const panel of result.result.panels) {
      if (!seen.has(panel.string)) {
        seen.set(panel.string, panel.stringColorIndex);
      }
    }
    return Array.from(seen.entries()).map(([string, colorIndex]) => ({ string, colorIndex }));
  }, [result.result.panels]);

  const reversedGroups = [...groups].reverse();

  return (
    <div className="heatmap-container" style={{ borderTop: `3px solid ${setupColour}` }}>
      <div style={{
        fontFamily: 'sans-serif', fontSize: '0.75rem', fontWeight: 700,
        color: setupColour, marginBottom: 4, maxWidth: '144px', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }} title={result.result.setupLabel}>
        {result.result.setupLabel}
      </div>

      {/* String legend */}
      <div className="heatmap-string-legend">
        {stringLegend.map(({ string, colorIndex }) => (
          <div key={string} className="heatmap-string-legend__item">
            <span
              className="heatmap-string-legend__swatch"
              style={{ background: StringColoursUtils.getStringColour(colorIndex) }}
            />
            <span className="heatmap-string-legend__label">{string}</span>
          </div>
        ))}
      </div>

      {reversedGroups.map(group => (
        <div key={group.arrayIndex} className="heatmap-array">
          <div className="heatmap-array__label">
            {t('resultsPanel.array')} {group.arrayIndex}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/*
             * Rows rendered in reverse: highest rowIdx at top (northernmost),
             * rowIdx 0 at bottom (southernmost), matching physical orientation.
             */}
            {Array.from({ length: group.rows }, (_, i) => group.rows - 1 - i).map(rowIdx => (
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
 * Renders one heat map per active setup.
 *
 * Array ordering: highest arrayIndex at top, array 0 at bottom.
 * Row ordering within each array: highest rowIdx at top (northernmost panels),
 * row 0 at bottom (southernmost panels), matching the physical installation.
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