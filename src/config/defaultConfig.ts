import { Config } from '../types/config';

/**
 * Minimal built-in configuration used to initialise the application on first
 * launch, before the user has loaded or edited their own configuration.
 *
 * The installation is a simple rectangular terrace near the centre of Madrid
 * (approximate coordinates — not a real installation). It contains one panel
 * array of 2 rows × 1 column to give the user a working starting point they
 * can edit immediately in the Configuration section of the settings sidebar.
 */
export const DEFAULT_CONFIG: Config = {
  site: {
    location: {
      latitude: 40.4168,
      longitude: -3.7038,
    },
    azimuth: 0,
    timezone: 'Europe/Madrid',
    groundAlbedo: 0.20,
    inverterEfficiency: 0.97,
    wiringLoss: 0.02,
    wallPoints: [
      [0, 0],
      [4, 0],
      [4, 6],
      [0, 6],
    ],
    wallDefaults: {
      height: 0.72,
      thickness: 0.145,
    },
    railingDefaults: {
      active: true,
      heightOffset: 0.185,
      shape: {
        kind: 'cylinder',
        radius: 0.025,
      },
      support: {
        shape: {
          kind: 'cylinder',
          radius: 0.008,
        },
        count: 2,
        edgeDistance: 0.22,
      },
      extendAtStart: true,
      extendAtEnd: true,
      extensionGap: 0.04,
    },
  },
  setups: [
    {
      label: 'Default setup',
      panelDefaults: {
        width: 1,
        height: 2,
        peakPower: 415,
        zones: 2,
        zonesDisposition: 'horizontal',
        hasOptimizer: false,
        string: 'S1',
        temperatureCoefficient: -0.004,
        noct: 45,
      },
      arrays: [
        {
          position: [1.5, 1.5],
          azimuth: 0,
          elevation: 0.10,
          inclination: 15,
          rows: 2,
          columns: 1,
          spacing: [0.02, 0.02],
          orientation: 'portrait',
        },
      ],
    },
  ],
};