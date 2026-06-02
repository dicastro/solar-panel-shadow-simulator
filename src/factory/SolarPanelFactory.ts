import { SolarPanel } from '../types/installation';
import { SamplePointFactory, computeZoneLayouts } from './SamplePointFactory';
import { ResolvedPanelConfig } from './PanelOverrideResolver';
import { StringColourAllocator } from './StringColourAllocator';

export interface ArrayOrigin {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radInclination: number;
  readonly radAzimuth: number;
}

export const SolarPanelFactory = {
  /**
   * Creates a single solar panel with fully resolved configuration.
   *
   * All attribute overrides have already been resolved by PanelOverrideResolver
   * before reaching this factory. The string colour index is assigned here
   * via StringColourAllocator, which tracks first-appearance order across
   * all panels in the setup.
   */
  create: (
    arrayIndex: number,
    row: number,
    col: number,
    resolved: ResolvedPanelConfig,
    density: number,
    origin: ArrayOrigin,
    allocator: StringColourAllocator,
  ): SolarPanel => {
    const {
      string, hasOptimizer, width: baseW, height: baseH,
      peakPower, zones, zonesDisposition, orientation,
      spacing, temperatureCoefficient, noct,
    } = resolved;

    const pWidth = orientation === 'portrait' ? baseW : baseH;
    const pHeight = orientation === 'portrait' ? baseH : baseW;

    const localX = col * (pWidth + spacing[0]) + pWidth / 2;
    const slopeLen = row * (pHeight + spacing[1]) + pHeight / 2;

    const horizNorth = slopeLen * Math.cos(origin.radInclination);
    const heightGain = slopeLen * Math.sin(origin.radInclination);

    const cosAz = Math.cos(origin.radAzimuth);
    const sinAz = Math.sin(origin.radAzimuth);

    const worldX = origin.x + cosAz * localX - sinAz * horizNorth;
    const worldY = origin.y + heightGain;
    const worldZ = origin.z + -sinAz * localX - cosAz * horizNorth;

    const id = `a${arrayIndex}-r${row}-c${col}`;

    const samplePoints = SamplePointFactory.createForPanel(
      id, pWidth, pHeight, zones, zonesDisposition, density,
    );

    const zoneLayouts = computeZoneLayouts(pWidth, pHeight, zones, zonesDisposition);
    const stringColorIndex = allocator.getIndex(string);

    return {
      id,
      arrayIndex,
      row,
      col,
      hasOptimizer,
      string,
      peakPower,
      zones,
      zonesDisposition,
      orientation,
      worldPosition: { x: worldX, y: worldY, z: worldZ },
      worldRotation: { x: origin.radInclination, y: origin.radAzimuth, z: 0, order: 'YXZ' },
      samplePoints,
      renderData: {
        actualWidth: pWidth,
        actualHeight: pHeight,
        frameColor: hasOptimizer ? '#2ecc71' : '#121e36',
        emissiveColor: hasOptimizer ? '#0a2a16' : '#050a15',
        zones: zoneLayouts,
        stringColorIndex,
      },
      temperatureCoefficient,
      noct,
    };
  },
};