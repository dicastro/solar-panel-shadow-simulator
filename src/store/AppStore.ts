import { create } from 'zustand';
import { Config } from '../types/config';
import { ConfigSlice, createConfigSlice } from './slices/ConfigSlice';
import { RenderSlice, createRenderSlice } from './slices/RenderSlice';
import { SimulationSlice, createSimulationSlice } from './slices/SimulationSlice';
import { SiteFactory } from '../factory/SiteFactory';

/**
 * Unified application store composed from three domain slices:
 *
 *  - ConfigSlice  — raw configuration and derived site geometry (walls, intersections).
 *                   Loaded once on startup; never changes during a session.
 *
 *  - RenderSlice  — everything that drives the 3D interactive view: active setup,
 *                   date/time, timezone, playback, sun position, the sampling
 *                   parameters (renderDensity, renderThreshold, showPoints) and
 *                   the instant production result.
 *
 *  - SimulationSlice — annual simulation parameters and lifecycle state. Density and
 *                      threshold here are independent of the render controls and only
 *                      used when launching the worker-based annual simulation.
 *
 * The facade pattern means all consumers (components, hooks) import `useAppStore`
 * and select what they need via a selector, with no knowledge of which underlying
 * slice owns that piece of state.
 *
 * Cross-slice coordination:
 * `loadConfig` is the only action that must touch two slices (config + render).
 * It is overridden at the facade level to sequence both slice operations in a
 * single logical call, keeping each slice responsible only for its own state.
 */
type AppStore = ConfigSlice & RenderSlice & SimulationSlice;

export const useAppStore = create<AppStore>((set, get) => {
  // Zustand's set() accepts both Partial<T> and (state: T) => Partial<T>.
  // A single cast to the broader union satisfies all slice constructors,
  // whether they use direct partial updates or functional updaters.
  const typedSet = set as (
    partialOrUpdater:
      | Partial<AppStore>
      | ((partial: AppStore) => Partial<AppStore>)
  ) => void;

  const typedGet = get as () => AppStore;

  const configSlice = createConfigSlice(typedSet);
  const renderSlice = createRenderSlice(typedSet, typedGet);
  const simulationSlice = createSimulationSlice(typedSet);

  return {
    ...configSlice,
    ...renderSlice,
    ...simulationSlice,

    /**
     * Overrides the base `loadConfig` from ConfigSlice to also initialise the
     * render slice in the same logical call:
     *
     * 1. Parse the JSON and build site geometry via SiteFactory (same logic as
     *    ConfigSlice.loadConfig, inlined here to avoid two separate store commits).
     * 2. Initialise the active setup and sun state (RenderSlice.initRender).
     *
     * Both steps commit to the store together, so any component that reads both
     * `site` and `activeSetup` will never observe a state where one is set but
     * the other is not.
     */
    loadConfig: (config: Config) => {
      const { site, angleWarnings } = SiteFactory.create(config);
      typedSet({ config, site, angleWarnings });
      renderSlice.initRender(config, site, typedGet().renderDensity);
    },
  };
});

// Re-export helpers that consumers reference alongside useAppStore
export { makeDateInTimezone } from './slices/RenderSlice';
export { availableSimulationYears, availableIntervals } from './slices/SimulationSlice';
export type { SimulationInterval } from './slices/SimulationSlice';