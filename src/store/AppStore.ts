import { create } from 'zustand';
import { Config } from '../types/config';
import { ConfigSlice, createConfigSlice } from './slices/ConfigSlice';
import { RenderSlice, createRenderSlice } from './slices/RenderSlice';
import { SimulationSlice, createSimulationSlice } from './slices/SimulationSlice';
import { SettingsSlice, createSettingsSlice } from './slices/SettingsSlice';
import { SiteFactory } from '../factory/SiteFactory';
import { SimulationCacheUtils } from '../utils/SimulationCacheUtils';
import { runAllValidators } from '../validation';

type AppStore = ConfigSlice & RenderSlice & SimulationSlice & SettingsSlice;

export const useAppStore = create<AppStore>((set, get) => {
  const typedSet = set as (
    partialOrUpdater:
      | Partial<AppStore>
      | ((partial: AppStore) => Partial<AppStore>)
  ) => void;

  const typedGet = get as () => AppStore;

  const configSlice = createConfigSlice(typedSet);
  const renderSlice = createRenderSlice(typedSet, typedGet);
  const simulationSlice = createSimulationSlice(typedSet);
  const settingsSlice = createSettingsSlice(typedSet);

  return {
    ...configSlice,
    ...renderSlice,
    ...simulationSlice,
    ...settingsSlice,

    loadConfig: (config: Config) => {
      const site = SiteFactory.create(config);
      const validationIssues = runAllValidators(config);
      const currentSimulationInputHash = SimulationCacheUtils.buildSimulationInputHash(config);
      typedSet({ config, site, validationIssues, currentSimulationInputHash });
      renderSlice.initRender(config, site, typedGet().renderDensity);
    },
  };
});

export { makeDateInTimezone } from './slices/RenderSlice';
export { availableSimulationYears, availableIntervals } from './slices/SimulationSlice';
export type { SimulationInterval } from './slices/SimulationSlice';