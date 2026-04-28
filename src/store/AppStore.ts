import { create } from 'zustand';
import { Config } from '../types/config';
import { ConfigSlice, createConfigSlice } from './slices/ConfigSlice';
import { RenderSlice, createRenderSlice } from './slices/RenderSlice.ts';
import { SimulationSlice, createSimulationSlice } from './slices/SimulationSlice';
import { SiteFactory } from '../factory/SiteFactory';

/**
 * Unified application store composed from three domain slices:
 *
 *  - configSlice  — raw configuration and derived site geometry (walls, intersections).
 *                   Loaded once on startup; never changes during a session.
 *
 *  - renderSlice  — everything that drives the 3D interactive view: active setup,
 *                   date/time, timezone, playback, sun position, and the sampling
 *                   parameters (renderDensity, renderThreshold, showPoints) that affect
 *                   both point visualisation and instant production readout.
 *
 *  - simulationSlice — annual simulation parameters and lifecycle state. Density and
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
  // Cast to allow partial updates of the unified store from within each slice.
  // Zustand's set() accepts Partial<T> so this is safe — slices only write
  // keys they own and never overlap with each other.
  const typedSet = set as (partial: Partial<AppStore>) => void;
  const typedGet = get as () => AppStore;

  const configSlice = createConfigSlice(typedSet);
  const renderSlice = createRenderSlice(typedSet, typedGet);
  const simulationSlice = createSimulationSlice(typedSet);

  return {
    ...configSlice,
    ...renderSlice,
    ...simulationSlice,

    /**
     * Overrides the base `loadConfig` from configSlice to also initialise the
     * render slice in the same logical call:
     *
     * 1. Parse the JSON and build site geometry via SiteFactory (same logic as
     *    configSlice.loadConfig, inlined here to avoid calling the slice version
     *    and then calling initRender separately — two calls would produce two
     *    store updates where one is enough).
     * 2. Initialise the active setup and sun state (renderSlice.initRender).
     *
     * Both steps commit to the store together, so any component that reads both
     * `site` and `activeSetup` will never observe a state where site is set but
     * activeSetup is not (or vice-versa).
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
export { availableSimulationYears } from './slices/SimulationSlice';
export type { SimulationInterval } from './slices/SimulationSlice';