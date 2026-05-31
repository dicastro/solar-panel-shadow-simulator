import { Config } from '../../types/config';
import { Site } from '../../types/installation';
import { FunctionalValidationIssue, runAllValidators } from '../../validation';
import { SiteFactory } from '../../factory/SiteFactory';

export interface ConfigState {
  config: Config | null;
  site: Site | null;
  validationIssues: readonly FunctionalValidationIssue[];
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

  loadConfig: (config) => {
    const site = SiteFactory.create(config);
    const validationIssues = runAllValidators(config);
    set({ config, site, validationIssues });
  },
});