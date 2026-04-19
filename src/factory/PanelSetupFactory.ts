import { PanelSetup } from '../types/installation';
import { PanelSetupConfiguration } from '../types/config';
import { SolarPanelArrayFactory } from './SolarPanelArrayFactory';

export const PanelSetupFactory = {
  /**
   * Creates a PanelSetup from a configuration and a density value.
   * Must be called again when density changes or active setup changes.
   */
  create: (
    setupConfig: PanelSetupConfiguration,
    density: number,
    centerX: number,
    centerZ: number,
  ): PanelSetup => {
    const panelArrays = setupConfig.arrays.map((arrayConfig, index) =>
      SolarPanelArrayFactory.create(index, arrayConfig, setupConfig.panelDefaults, density, centerX, centerZ)
    );

    return {
      id: setupConfig.id,
      label: setupConfig.label,
      panelArrays,
    };
  },
};