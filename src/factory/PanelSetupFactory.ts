import { PanelSetup, SolarPanel, SolarPanelArray } from '../types/installation';
import { Site } from '../types/installation';
import { PanelSetupConfiguration } from '../types/config';
import { SolarPanelArrayFactory } from './SolarPanelArrayFactory';
import { SamplePointFactory } from './SamplePointFactory';

export const PanelSetupFactory = {
  /**
   * Creates a full PanelSetup from scratch: panel geometry, world positions,
   * render data, and sample points.
   *
   * Call this when the active setup changes or on initial load.
   * For density-only changes, use `rebuildSamplePoints` instead — it reuses
   * the existing panel geometry and only regenerates the sample point grids,
   * which is significantly cheaper.
   */
  create: (
    setupConfig: PanelSetupConfiguration,
    site: Site,
    density: number,
  ): PanelSetup => {
    const panelArrays = setupConfig.arrays.map((arrayConfig, index) =>
      SolarPanelArrayFactory.create(
        index,
        arrayConfig,
        setupConfig.panelDefaults,
        density,
        site.centerX,
        site.centerZ,
      ),
    );

    return {
      id: setupConfig.id,
      label: setupConfig.label,
      panelArrays,
    };
  },

  /**
   * Returns a new PanelSetup with regenerated sample points for a new density,
   * reusing all panel geometry (world positions, rotations, render data) from
   * the existing setup unchanged.
   *
   * Why this matters:
   *   Panel geometry (world position, rotation, zone layout, render data) is
   *   independent of sampling density. Rebuilding it unnecessarily on every
   *   density slider change wastes CPU and triggers React re-renders of the
   *   entire panel tree even though nothing visual has changed.
   *
   * When to use:
   *   Call this from the store's `setDensity` action instead of `create`.
   *   Call `create` only when the setup itself changes (different id) or on
   *   initial load.
   */
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