import { SolarPanel } from '../types/installation';
import { PanelArrayConfiguration, PanelDefinition } from '../types/config';
import { SamplePointFactory, computeZoneLayouts } from './SamplePointFactory';

/**
 * Pre-computed origin of the panel array group in world space.
 *
 * `x`, `y`, `z` are the Three.js world-space coordinates of the **South-West
 * corner** of the array's base footprint at `elevation` height.
 *
 * "South-West" is relative to the array's own azimuth:
 *   - South = bottom of slope (the edge closest to the ground).
 *   - West  = opposite to the column-increase direction.
 *
 * `radAzimuth` follows the config convention: 0 = South, positive = East.
 */
export interface ArrayOrigin {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radInclination: number;
  /** Azimuth in radians: 0 = South, positive = East (same as site convention). */
  readonly radAzimuth: number;
}

export const SolarPanelFactory = {
  /**
   * Creates a single solar panel within a panel array.
   *
   * ## Panel indexing
   *
   *   row = 0  → southernmost row (bottom of slope, South edge of array).
   *   col = 0  → westernmost column (West edge of array).
   *   Rows increase northward (up the slope); columns increase eastward.
   *
   * ## Three.js rotation-y matrix
   *
   * Three.js `rotation-y = θ` applies Ry(θ):
   *
   *   x' =  cos(θ)·x + sin(θ)·z
   *   z' = −sin(θ)·x + cos(θ)·z
   *
   * ## Axis directions in Three.js world space
   *
   * With array azimuth `az` (radians, 0 = South, positive = East), the
   * array's three natural axes in Three.js world space are derived by
   * applying Ry(az) to the canonical unit vectors:
   *
   *   eastDir (col direction):   Ry(az) · (1, 0, 0)  = ( cos az,  0, −sin az )
   *   northDir (row direction):  Ry(az) · (0, 0, −1) = (−sin az,  0, −cos az )
   *   southDir (panel face):     Ry(az) · (0, 0, +1) = ( sin az,  0,  cos az )
   *
   * ## World position derivation
   *
   * Starting from the SW corner (origin) at elevation height:
   *
   *   localX   = col*(pWidth + sx) + pWidth/2      [East along array face]
   *   slopeLen = row*(pHeight + sy) + pHeight/2     [up the slope from South edge]
   *   horizNorth = slopeLen * cos(inclination)      [northward ground reach]
   *   heightGain = slopeLen * sin(inclination)      [vertical rise]
   *
   * Panel centre in world space:
   *   worldX = origin.x + cosAz*localX + (−sinAz)*horizNorth
   *   worldY = origin.y + heightGain
   *   worldZ = origin.z + (−sinAz)*localX + (−cosAz)*horizNorth
   *
   * ## World rotation
   *
   * Euler order 'YXZ':
   *   Y = +radAzimuth      (applied first; same sign as site rotation-y)
   *   X =  radInclination  (applied second, around the panel's own East-West axis)
   *
   * Using the same sign as the site group ensures a panel with the same azimuth
   * as the site faces the same direction as the site's South wall.
   * With 'YXZ' order, the X rotation always tilts around the panel's own
   * East-West axis regardless of azimuth, keeping panel edges parallel to the ground.
   *
   * ## temperatureCoefficient and noct resolution
   *
   * The array configuration can override the setup-level panelDefaults values.
   * Resolution order (highest to lowest priority):
   *   arrayConfig.temperatureCoefficient → defaults.temperatureCoefficient → undefined
   * Undefined values are resolved later in SolarPanelConverter using its own defaults,
   * keeping the domain model free of hard-coded fallback knowledge.
   */
  create: (
    arrayIndex: number,
    row: number,
    col: number,
    arrayConfig: PanelArrayConfiguration,
    defaults: PanelDefinition,
    density: number,
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
    const temperatureCoefficient = arrayConfig.temperatureCoefficient ?? defaults.temperatureCoefficient;
    const noct = arrayConfig.noct ?? defaults.noct;

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
      id, pWidth, pHeight, zones, zonesDisp, density,
    );

    const zoneLayouts = computeZoneLayouts(pWidth, pHeight, zones, zonesDisp);

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
      worldRotation: { x: origin.radInclination, y: origin.radAzimuth, z: 0, order: 'YXZ' },
      samplePoints,
      renderData: {
        actualWidth: pWidth,
        actualHeight: pHeight,
        frameColor: hasOptimizer ? '#2ecc71' : '#121e36',
        emissiveColor: hasOptimizer ? '#0a2a16' : '#050a15',
        zones: zoneLayouts,
      },
      temperatureCoefficient,
      noct,
    };
  },
};