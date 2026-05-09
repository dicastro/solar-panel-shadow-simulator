import { SolarPanelArray } from '../types/installation';
import { PanelArrayConfiguration, PanelDefinition } from '../types/config';
import { SolarPanelFactory, ArrayOrigin } from './SolarPanelFactory';

/**
 * Computes the world-space origin of the panel array group.
 *
 * The origin is the **South-West corner** of the array's base footprint at
 * `elevation` height. "South-West" is relative to the array's own azimuth:
 * the corner that is both southernmost (bottom of the slope) and westernmost
 * (opposite the column-increase direction).
 *
 * ## Three.js rotation-y matrix
 *
 * Three.js `rotation-y = θ` applies the standard right-hand Y-rotation matrix:
 *
 *   Ry(θ):  x' =  cos(θ)·x + sin(θ)·z
 *           z' = −sin(θ)·x + cos(θ)·z
 *
 * Note the positive sign on sin(θ) in the x' row.
 *
 * ## Site axis directions in world space
 *
 * After the site group applies `rotation-y = siteAzimuthRad`, the site's
 * local axes map to world space as follows:
 *
 *   site local +X (East in config):
 *     (1,0,0) → x' = cos(az),   z' = −sin(az)   →  eastDir  = ( cos az,  0, −sin az )
 *
 *   site local −Z (North in config, because config +Z = North → centred Three.js −Z):
 *     (0,0,−1) → x' = −sin(az), z' = −cos(az)   →  northDir = (−sin az,  0, −cos az )
 *
 * ## SW corner of the site in world space
 *
 * The SW corner in centred Three.js coordinates (before site rotation):
 *   swCentred.x = swCornerX − centerX
 *   swCentred.z = −(swCornerZ − centerZ)   ← Z flip: config North → Three.js −Z
 *
 * After site rotation-y = siteAzimuthRad (Ry matrix above):
 *   swWorld.x =  cos(siteAz)·swCentred.x + sin(siteAz)·swCentred.z
 *   swWorld.z = −sin(siteAz)·swCentred.x + cos(siteAz)·swCentred.z
 *
 * ## Array position offset in world space
 *
 * The config position [configX, configZ] is the distance from the site SW
 * corner to the array SW corner, measured in the site's rotated frame:
 *   +configX = East along the rotated site  (along site eastDir)
 *   +configZ = North along the rotated site (along site northDir)
 *
 * Converting to world space:
 *   offsetWorld.x =  cos(siteAz)·configX − sin(siteAz)·configZ
 *   offsetWorld.z = −sin(siteAz)·configX − cos(siteAz)·configZ
 *
 * ## Final origin
 *
 *   originX = swWorld.x + offsetWorld.x
 *   originY = elevation   (South/bottom edge of panels sits at this height)
 *   originZ = swWorld.z + offsetWorld.z
 */
const computeArrayOrigin = (
  arrayConfig: PanelArrayConfiguration,
  _defaults: PanelDefinition,
  centerX: number,
  centerZ: number,
  swCornerX: number,
  swCornerZ: number,
  siteAzimuthRad: number,
): ArrayOrigin => {
  const radInclination = (arrayConfig.inclination * Math.PI) / 180;
  const radAzimuth = (arrayConfig.azimuth * Math.PI) / 180;

  // SW corner of the site in centred Three.js coordinates (before site rotation).
  // Config +Z = North becomes Three.js −Z.
  const swCentredX = swCornerX - centerX;
  const swCentredZ = -(swCornerZ - centerZ);

  const cosSite = Math.cos(siteAzimuthRad);
  const sinSite = Math.sin(siteAzimuthRad);

  // SW corner of the site in world space after site rotation-y = siteAzimuthRad.
  // Three.js Ry(θ): x' = cos·x + sin·z,  z' = −sin·x + cos·z
  const swWorldX = cosSite * swCentredX + sinSite * swCentredZ;
  const swWorldZ = -sinSite * swCentredX + cosSite * swCentredZ;

  // Array position offset from the site SW corner, in the site's rotated frame:
  //   +configX = East along rotated site,  +configZ = North along rotated site.
  // Using site eastDir = (cos az, 0, −sin az) and northDir = (−sin az, 0, −cos az):
  const configX = arrayConfig.position[0];
  const configZ = arrayConfig.position[1];

  const offsetWorldX = cosSite * configX - sinSite * configZ;
  const offsetWorldZ = -sinSite * configX - cosSite * configZ;

  return {
    x: swWorldX + offsetWorldX,
    y: arrayConfig.elevation,
    z: swWorldZ + offsetWorldZ,
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
    swCornerX: number,
    swCornerZ: number,
    siteAzimuthRad: number,
  ): SolarPanelArray => {
    const origin = computeArrayOrigin(
      arrayConfig, defaults,
      centerX, centerZ,
      swCornerX, swCornerZ,
      siteAzimuthRad,
    );
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