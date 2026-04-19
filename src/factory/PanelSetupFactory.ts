import { PanelSetup } from '../types/installation';
import { Site } from '../types/installation';
import { PanelSetupConfiguration } from '../types/config';
import { SolarPanelArrayFactory } from './SolarPanelArrayFactory';

export const PanelSetupFactory = {
  /**
   * Creates a PanelSetup from a configuration, a Site and a density value.
   *
   * Must be called again whenever density or the active setup changes.
   * The Site provides centerX and centerZ so callers don't have to pass
   * the raw floats separately.
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
};