import { SamplePoint } from '../types/installation';
import { ZoneRenderData } from '../types/installation';
import { ZonesDisposition } from '../types/config';

/**
 * Naming convention for zonesDisposition:
 *
 *  'horizontal' → zones stack on top of each other (split along the Z axis).
 *                 Each zone is a horizontal band. This is how most residential
 *                 panels with bypass diodes are physically wired.
 *
 *  'vertical'   → zones sit side by side (split along the X axis).
 *                 Each zone is a vertical column.
 *
 * Previous code had this inverted — the fix is here so all consumers that use
 * ZoneRenderData get the correct geometry automatically.
 */

const GAP = 0.01;

/**
 * Pre-computes the render geometry for every diode zone of a panel.
 * Exported so SolarPanelFactory can embed these in PanelRenderData.
 */
export const computeZoneLayouts = (
  actualW: number,
  actualH: number,
  zones: number,
  zonesDisposition: ZonesDisposition,
): ZoneRenderData[] => {
  // 'horizontal' → split along Z (height axis) → isHoriz = true
  const isHoriz = zonesDisposition === 'horizontal';

  return Array.from({ length: zones }, (_, i) => {
    const width = isHoriz ? actualW - GAP : (actualW / zones) - GAP;
    const height = isHoriz ? (actualH / zones) - GAP : actualH - GAP;
    const offset = (i - (zones - 1) / 2) * (isHoriz ? actualH / zones : actualW / zones);

    return {
      zoneIndex: i,
      posX: isHoriz ? 0 : offset,
      posZ: isHoriz ? offset : 0,
      width,
      height,
    };
  });
};

export const SamplePointFactory = {
  /**
   * Creates all sample points for a single panel.
   * Positions are local to the panel (relative to its centre).
   */
  createForPanel: (
    panelId: string,
    actualW: number,
    actualH: number,
    zones: number,
    zonesDisposition: ZonesDisposition,
    density: number,
  ): SamplePoint[] => {
    const layouts = computeZoneLayouts(actualW, actualH, zones, zonesDisposition);
    const points: SamplePoint[] = [];

    for (const layout of layouts) {
      for (let row = 0; row < density; row++) {
        for (let col = 0; col < density; col++) {
          const ratioCol = density > 1 ? col / (density - 1) - 0.5 : 0;
          const ratioRow = density > 1 ? row / (density - 1) - 0.5 : 0;

          points.push({
            id: `${panelId}-z${layout.zoneIndex}-r${row}-c${col}`,
            zoneIndex: layout.zoneIndex,
            localPosition: {
              x: layout.posX + ratioCol * layout.width,
              y: 0.02,
              z: layout.posZ + ratioRow * layout.height,
            },
          });
        }
      }
    }

    return points;
  },
};