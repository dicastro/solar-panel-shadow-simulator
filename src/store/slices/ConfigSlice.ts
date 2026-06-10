import { Config } from '../../types/config';
import { Site } from '../../types/installation';
import { FunctionalValidationIssue, runAllValidators } from '../../validation';
import { SiteFactory } from '../../factory/SiteFactory';

export interface ConfigState {
  config: Config | null;
  site: Site | null;
  validationIssues: readonly FunctionalValidationIssue[];
  /**
   * Hash of all simulation-relevant configuration fields for the currently
   * active config (everything except site.timezone and site.floorColor).
   * Computed in AppStore.loadConfig and stored here so any consumer can
   * compare it against SimulationRunResult.simulationInputHash to detect
   * stale results without recalculating.
   */
  currentSimulationInputHash: string;
}

export interface ConfigActions {
  loadConfig: (config: Config) => void;
}

export type ConfigSlice = ConfigState & ConfigActions;

export const createConfigSlice = (
  set: (partial: Partial<ConfigSlice>) => void,
): ConfigSlice => ({
  config: null,
  site: null,
  validationIssues: [],
  currentSimulationInputHash: '',

  loadConfig: (config) => {
    const site = SiteFactory.create(config);
    const validationIssues = runAllValidators(config);
    // currentSimulationInputHash is computed in AppStore.loadConfig where
    // SimulationCacheUtils is available. The slice sets it to empty here so
    // the shape is always consistent; AppStore immediately overwrites it.
    set({ config, site, validationIssues, currentSimulationInputHash: '' });
  },
});