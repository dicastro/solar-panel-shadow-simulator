import { SolarPanelArray } from '../types/installation';
import { PanelArrayConfiguration, PanelDefinition, PanelArraySettings } from '../types/config';
import { SolarPanelFactory, ArrayOrigin } from './SolarPanelFactory';
import { PanelOverrideResolver } from './PanelOverrideResolver';
import { StringColourAllocator } from './StringColourAllocator';

const computeArrayOrigin = (
  arrayConfig: PanelArrayConfiguration,
  centerX: number,
  centerZ: number,
  swCornerX: number,
  swCornerZ: number,
  siteAzimuthRad: number,
): ArrayOrigin => {
  const radInclination = (arrayConfig.inclination * Math.PI) / 180;
  const radAzimuth = (arrayConfig.azimuth * Math.PI) / 180;

  const swCentredX = swCornerX - centerX;
  const swCentredZ = -(swCornerZ - centerZ);

  const cosSite = Math.cos(siteAzimuthRad);
  const sinSite = Math.sin(siteAzimuthRad);

  const swWorldX = cosSite * swCentredX + sinSite * swCentredZ;
  const swWorldZ = -sinSite * swCentredX + cosSite * swCentredZ;

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
  /**
   * Builds a panel array with fully resolved panel configurations.
   *
   * Panel-level overrides (arraysSettings filtered for this array) are
   * resolved here per panel via PanelOverrideResolver, so SolarPanelFactory
   * always receives definitive values and never needs a post-construction
   * correction pass.
   */
  create: (
    arrayIndex: number,
    arrayConfig: PanelArrayConfiguration,
    defaults: PanelDefinition,
    panelOverrides: PanelArraySettings[],
    density: number,
    centerX: number,
    centerZ: number,
    swCornerX: number,
    swCornerZ: number,
    siteAzimuthRad: number,
    allocator: StringColourAllocator,
  ): SolarPanelArray => {
    const origin = computeArrayOrigin(
      arrayConfig, centerX, centerZ, swCornerX, swCornerZ, siteAzimuthRad,
    );

    const panels = [];

    for (let row = 0; row < arrayConfig.rows; row++) {
      for (let col = 0; col < arrayConfig.columns; col++) {
        const panelOverride = panelOverrides.find(
          o => o.row === row && o.col === col,
        );
        const resolved = PanelOverrideResolver.resolve(
          defaults, arrayConfig, panelOverride,
        );
        panels.push(
          SolarPanelFactory.create(
            arrayIndex, row, col, resolved, density, origin, allocator,
          ),
        );
      }
    }

    return { index: arrayIndex, panels };
  },
};