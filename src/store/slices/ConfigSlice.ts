import { Config } from '../../types/config';
import { Site } from '../../types/installation';
import { AngleWarning } from '../../types/geometry';
import { SiteFactory } from '../../factory/SiteFactory';

export interface ConfigState {
  config: Config | null;
  site: Site | null;
  angleWarnings: readonly AngleWarning[];
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
  angleWarnings: [],

  loadConfig: (config) => {
    const { site, angleWarnings } = SiteFactory.create(config);
    set({ config, site, angleWarnings });
  },
});