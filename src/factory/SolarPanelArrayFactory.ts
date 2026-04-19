import { SolarPanelArray } from '../types/installation';
import { PanelArrayConfiguration, PanelDefinition } from '../types/config';
import { SolarPanelFactory } from './SolarPanelFactory';

export const SolarPanelArrayFactory = {
  create: (
    arrayIndex: number,
    arrayConfig: PanelArrayConfiguration,
    defaults: PanelDefinition,
    density: number,
    centerX: number,
    centerZ: number,
  ): SolarPanelArray => {
    const panels = [];

    for (let row = 0; row < arrayConfig.rows; row++) {
      for (let col = 0; col < arrayConfig.columns; col++) {
        panels.push(SolarPanelFactory.create(arrayIndex, row, col, arrayConfig, defaults, density, centerX, centerZ));
      }
    }

    return { index: arrayIndex, panels };
  },
};