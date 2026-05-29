import { create } from 'zustand';
import { Config } from '../types/config';
import { ConfigSlice, createConfigSlice } from './slices/ConfigSlice';
import { RenderSlice, createRenderSlice } from './slices/RenderSlice';
import { SimulationSlice, createSimulationSlice } from './slices/SimulationSlice';
import { SettingsSlice, createSettingsSlice } from './slices/SettingsSlice';
import { SiteFactory } from '../factory/SiteFactory';

/**
 * Unified application store composed from four domain slices:
 *
 *  - ConfigSlice      — raw configuration and derived site geometry.
 *  - RenderSlice      — everything that drives the 3D interactive view.
 *  - SimulationSlice  — annual simulation parameters and lifecycle state.
 *  - SettingsSlice    — UI state for the settings sidebar.
 *
 * Cross-slice coordination:
 * `loadConfig` is overridden at the facade level to sequence both ConfigSlice
 * and RenderSlice operations atomically, so no component ever observes a state
 * where `site` is set but `activeSetup` is not.
 */
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
      const { site, angleWarnings } = SiteFactory.create(config);
      typedSet({ config, site, angleWarnings });
      renderSlice.initRender(config, site, typedGet().renderDensity);
    },
  };
});

export { makeDateInTimezone } from './slices/RenderSlice';
export { availableSimulationYears, availableIntervals } from './slices/SimulationSlice';
export type { SimulationInterval } from './slices/SimulationSlice';