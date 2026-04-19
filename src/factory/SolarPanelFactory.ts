import { SolarPanel } from '../types/installation';
import { PanelArrayConfiguration, PanelDefinition } from '../types/config';
import { SamplePointFactory, computeZoneLayouts } from './SamplePointFactory';

/**
 * Pre-computed origin of the panel array group in world space.
 * Calculated once in SolarPanelArrayFactory and passed to each panel.
 */
export interface ArrayOrigin {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radInclination: number;
  readonly radAzimuth: number;
}

export const SolarPanelFactory = {
  create: (
    arrayIndex: number,
    row: number,
    col: number,
    arrayConfig: PanelArrayConfiguration,
    defaults: PanelDefinition,
    density: number,
    /** Pre-computed by SolarPanelArrayFactory */
    origin: ArrayOrigin,
  ): SolarPanel => {
    const orientation = arrayConfig.orientation ?? 'portrait';
    const spacing = arrayConfig.spacing ?? [0.02, 0.02];
    const baseW = arrayConfig.width ?? defaults.width;
    const baseH = arrayConfig.height ?? defaults.height;
    const zones = arrayConfig.zones ?? defaults.zones;
    const zonesDisp = arrayConfig.zonesDisposition ?? defaults.zonesDisposition;
    const hasOptimizer = arrayConfig.hasOptimizer ?? defaults.hasOptimizer;
    const string = arrayConfig.string ?? defaults.string;
    const peakPower = arrayConfig.peakPower ?? defaults.peakPower;

    const pWidth = orientation === 'portrait' ? baseW : baseH;
    const pHeight = orientation === 'portrait' ? baseH : baseW;

    const cols = arrayConfig.columns;
    const rows = arrayConfig.rows;

    // Local offset of this panel inside the group (flat, pre-rotation)
    const localX = (col - (cols - 1) / 2) * (pWidth + spacing[0]);
    const localZ = (row - (rows - 1) / 2) * (pHeight + spacing[1]);

    // The array group is rotated by radInclination around the X axis.
    // localZ therefore contributes to both world Y and world Z.
    const worldX = origin.x + localX;
    const worldY = origin.y - localZ * Math.sin(origin.radInclination);
    const worldZ = origin.z + localZ * Math.cos(origin.radInclination);

    const id = `a${arrayIndex}-r${row}-c${col}`;

    const actualW = orientation === 'portrait' ? baseW : baseH;
    const actualH = orientation === 'portrait' ? baseH : baseW;

    const samplePoints = SamplePointFactory.createForPanel(
      id, actualW, actualH, zones, zonesDisp, density,
    );

    const zoneLayouts = computeZoneLayouts(actualW, actualH, zones, zonesDisp);

    return {
      id,
      arrayIndex,
      row,
      col,
      hasOptimizer,
      string,
      peakPower,
      zones,
      zonesDisposition: zonesDisp,
      orientation,
      worldPosition: { x: worldX, y: worldY, z: worldZ },
      worldRotation: { x: origin.radInclination, y: -origin.radAzimuth, z: 0 },
      samplePoints,
      renderData: {
        actualWidth: actualW,
        actualHeight: actualH,
        frameColor: hasOptimizer ? '#2ecc71' : '#121e36',
        emissiveColor: hasOptimizer ? '#0a2a16' : '#050a15',
        zones: zoneLayouts,
      },
    };
  },
};