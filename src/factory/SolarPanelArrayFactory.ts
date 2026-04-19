import { SolarPanelArray } from '../types/installation';
import { PanelArrayConfiguration, PanelDefinition } from '../types/config';
import { SolarPanelFactory, ArrayOrigin } from './SolarPanelFactory';

/**
 * Computes the world-space origin of the panel array group.
 *
 * The origin is the centre-top of the array as rendered in Three.js before
 * individual panel offsets are applied. It accounts for:
 *  - site centre offset (centerX / centerZ)
 *  - array elevation
 *  - inclination-induced Y and Z offsets so the array bottom edge sits at
 *    `elevation` height and the pivot point is at the array's vertical centre
 *
 * Coordinate mapping (Three.js):
 *   +X → East,  +Y → Up,  +Z → South  (before site-azimuth rotation)
 *
 * Config positions use the same +X/+Z convention so we negate Z when going
 * from config space (Z positive = North) to Three.js space (Z positive = South):
 *   worldX =  configX − centerX
 *   worldZ = -(configZ − centerZ)   ← flip so North is −Z in Three.js
 */
const computeArrayOrigin = (
  arrayConfig: PanelArrayConfiguration,
  defaults: PanelDefinition,
  centerX: number,
  centerZ: number,
): ArrayOrigin => {
  const orientation = arrayConfig.orientation ?? 'portrait';
  const spacing     = arrayConfig.spacing     ?? [0.02, 0.02];
  const baseW       = arrayConfig.width       ?? defaults.width;
  const baseH       = arrayConfig.height      ?? defaults.height;

  const pWidth  = orientation === 'portrait' ? baseW : baseH;
  const pHeight = orientation === 'portrait' ? baseH : baseW;

  const cols = arrayConfig.columns;
  const rows = arrayConfig.rows;

  const radInclination = (arrayConfig.inclination * Math.PI) / 180;
  const radAzimuth     = (arrayConfig.azimuth     * Math.PI) / 180;

  const totalArrayWidth  = cols * pWidth  + (cols - 1) * spacing[0];
  const totalArrayHeight = rows * pHeight + (rows - 1) * spacing[1];

  // Vertical and depth offsets produced by the inclination of the array
  const yOffset         = (Math.sin(radInclination) * totalArrayHeight) / 2;
  const zVisualContraction = (Math.cos(radInclination) * totalArrayHeight) / 2;

  // Config uses +Z = North; Three.js uses +Z = South, so we negate configZ.
  const configX = arrayConfig.position[0];
  const configZ = arrayConfig.position[1];

  return {
    x: (configX - centerX) + totalArrayWidth / 2,
    y: arrayConfig.elevation + yOffset,
    z: -(configZ - centerZ) - zVisualContraction,   // ← North/South flip
    radInclination,
    radAzimuth,
  };
};

export const SolarPanelArrayFactory = {
  create: (
    arrayIndex: number,
    arrayConfig: PanelArrayConfiguration,
    defaults: PanelDefinition,
    density: number,
    centerX: number,
    centerZ: number,
  ): SolarPanelArray => {
    const origin = computeArrayOrigin(arrayConfig, defaults, centerX, centerZ);
    const panels = [];

    for (let row = 0; row < arrayConfig.rows; row++) {
      for (let col = 0; col < arrayConfig.columns; col++) {
        panels.push(
          SolarPanelFactory.create(
            arrayIndex, row, col, arrayConfig, defaults, density, origin,
          ),
        );
      }
    }

    return { index: arrayIndex, panels };
  },
};