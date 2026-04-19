import { SamplePoint } from '../types/installation';
import { ZonesDisposition } from '../types/config';

interface ZoneLayout {
  readonly zoneIndex: number;
  readonly posX: number;
  readonly posZ: number;
  readonly zWidth: number;
  readonly zHeight: number;
}

const computeZoneLayouts = (
  actualW: number,
  actualH: number,
  zones: number,
  zonesDisposition: ZonesDisposition,
): ZoneLayout[] => {
  const gap = 0.01;
  const isVert = zonesDisposition === 'vertical';

  return Array.from({ length: zones }, (_, i) => {
    const zWidth  = isVert ? (actualW / zones) - gap : actualW - gap;
    const zHeight = isVert ? actualH - gap : (actualH / zones) - gap;
    const offset  = (i - (zones - 1) / 2) * (isVert ? actualW / zones : actualH / zones);

    return {
      zoneIndex: i,
      posX: isVert ? offset : 0,
      posZ: isVert ? 0 : offset,
      zWidth,
      zHeight,
    };
  });
};

export const SamplePointFactory = {
  /**
   * Creates all sample points for a single panel.
   * Positions are local to the panel (relative to its center).
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
              x: layout.posX + ratioCol * layout.zWidth,
              y: 0.02,
              z: layout.posZ + ratioRow * layout.zHeight,
            },
          });
        }
      }
    }

    return points;
  },
};