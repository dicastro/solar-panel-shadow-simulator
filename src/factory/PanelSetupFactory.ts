import { PanelSetup, SolarPanel, SolarPanelArray } from '../types/installation';
import { Site } from '../types/installation';
import { PanelSetupConfiguration } from '../types/config';
import { SolarPanelArrayFactory } from './SolarPanelArrayFactory';
import { SamplePointFactory } from './SamplePointFactory';
import { StringColourAllocator } from './StringColourAllocator';

const deriveSetupId = (label: string, index: number): string => {
  const normalised = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `${normalised}-${index}`;
};

export const PanelSetupFactory = {
  /**
   * Builds a complete PanelSetup from configuration.
   *
   * A StringColourAllocator is created once per setup so string colour
   * indices are consistent within the setup and independent of other setups.
   * Panel-level overrides are passed down to SolarPanelArrayFactory so every
   * panel is built with its definitive configuration in a single pass —
   * no post-construction correction is needed.
   */
  create: (
    setupConfig: PanelSetupConfiguration,
    setupIndex: number,
    site: Site,
    density: number,
  ): PanelSetup => {
    const allocator = new StringColourAllocator();

    const panelArrays = setupConfig.arrays.map((arrayConfig, arrayIndex) => {
      const arrayOverrides = (setupConfig.arraysSettings ?? []).filter(
        o => o.array === arrayIndex,
      );
      return SolarPanelArrayFactory.create(
        arrayIndex,
        arrayConfig,
        setupConfig.panelDefaults,
        arrayOverrides,
        density,
        site.centerX,
        site.centerZ,
        site.swCornerX,
        site.swCornerZ,
        site.azimuthRad,
        allocator,
      );
    });

    return {
      id: deriveSetupId(setupConfig.label, setupIndex),
      label: setupConfig.label,
      panelArrays,
    };
  },

  rebuildSamplePoints: (
    existing: PanelSetup,
    density: number,
  ): PanelSetup => {
    const panelArrays: SolarPanelArray[] = existing.panelArrays.map(pa => ({
      ...pa,
      panels: pa.panels.map((panel): SolarPanel => ({
        ...panel,
        samplePoints: SamplePointFactory.createForPanel(
          panel.id,
          panel.renderData.actualWidth,
          panel.renderData.actualHeight,
          panel.zones,
          panel.zonesDisposition,
          density,
        ),
      })),
    }));

    return {
      id: existing.id,
      label: existing.label,
      panelArrays,
    };
  },
};