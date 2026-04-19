import { SolarPanel } from '../types/installation';
import { PanelArrayConfiguration, PanelDefinition } from '../types/config';
import { SamplePointFactory } from './SamplePointFactory';

export const SolarPanelFactory = {
  create: (
    arrayIndex: number,
    row: number,
    col: number,
    arrayConfig: PanelArrayConfiguration,
    defaults: PanelDefinition,
    density: number,
    centerX: number,
    centerZ: number,
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

    const radInc = (arrayConfig.inclination * Math.PI) / 180;
    const radAzi = (arrayConfig.azimut * Math.PI) / 180;

    const cols = arrayConfig.columns;
    const rows = arrayConfig.rows;

    const totalArrayWidth = cols * pWidth + (cols - 1) * spacing[0];
    const totalArrayHeight = rows * pHeight + (rows - 1) * spacing[1];

    const yOffset = (Math.sin(radInc) * totalArrayHeight) / 2;
    const zVisualContr = (Math.cos(radInc) * totalArrayHeight) / 2;

    // Group origin (same logic as <SolarArray> group position in App.tsx)
    const groupX = (arrayConfig.position[0] - centerX) + totalArrayWidth / 2;
    const groupY = arrayConfig.elevation + yOffset;
    const groupZ = (arrayConfig.position[1] - centerZ) - zVisualContr;

    // Local offset of this panel inside the group
    const localX = (col - (cols - 1) / 2) * (pWidth + spacing[0]);
    const localZ = (row - (rows - 1) / 2) * (pHeight + spacing[1]);

    // localZ needs to be projected onto world Y and Z axes
    // because the array group is rotated by radInc around the X axis.
    // Without this, all panels share the same Y and just shift in Z.
    const worldX = groupX + localX;
    const worldY = groupY - localZ * Math.sin(radInc);
    const worldZ = groupZ + localZ * Math.cos(radInc);

    const id = `a${arrayIndex}-r${row}-c${col}`;

    const actualW = orientation === 'portrait' ? baseW : baseH;
    const actualH = orientation === 'portrait' ? baseH : baseW;

    const samplePoints = SamplePointFactory.createForPanel(id, actualW, actualH, zones, zonesDisp, density);

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
      worldRotation: { x: radInc, y: -radAzi, z: 0 },
      samplePoints,
      renderData: {
        actualWidth: actualW,
        actualHeight: actualH,
        frameColor: hasOptimizer ? '#2ecc71' : '#121e36',
        emissiveColor: hasOptimizer ? '#0a2a16' : '#050a15',
      },
    };
  },
};