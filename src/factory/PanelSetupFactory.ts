import { PanelSetup, SolarPanel, SolarPanelArray } from '../types/installation';
import { Site } from '../types/installation';
import { PanelSetupConfiguration } from '../types/config';
import { SolarPanelArrayFactory } from './SolarPanelArrayFactory';
import { SamplePointFactory } from './SamplePointFactory';

/**
 * Derives a stable internal id from a setup's label and its position in the
 * config array. The label is normalised (lower-cased, diacritics stripped,
 * spaces replaced with hyphens) so the id is URL-safe and human-readable.
 * The index suffix guarantees uniqueness even when two setups share the same
 * normalised label.
 */
const deriveSetupId = (label: string, index: number): string => {
  const normalised = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `${normalised}-${index}`;
};

/**
 * Returns the frame and emissive colours for a panel cell based on whether
 * it has an optimizer. Extracted here so that overriding `hasOptimizer` via
 * `arraysSettings` also updates the visual colour without duplicating the
 * colour logic from SolarPanelFactory.
 */
const panelColours = (hasOptimizer: boolean) => ({
  frameColor: hasOptimizer ? '#2ecc71' : '#121e36',
  emissiveColor: hasOptimizer ? '#0a2a16' : '#050a15',
});

export const PanelSetupFactory = {
  /**
   * Creates a full PanelSetup from scratch: panel geometry, world positions,
   * render data, and sample points.
   *
   * After building all arrays, per-panel overrides from `arraysSettings` are
   * applied. Each override targets one panel by its `array`, `row`, and `col`
   * address and can change `hasOptimizer` and/or `string`. The frame colour is
   * updated to reflect the new optimizer state.
   *
   * Call this when the active setup changes or on initial load.
   * For density-only changes, use `rebuildSamplePoints` instead — it reuses
   * the existing panel geometry and only regenerates the sample point grids,
   * which is significantly cheaper.
   */
  create: (
    setupConfig: PanelSetupConfiguration,
    setupIndex: number,
    site: Site,
    density: number,
  ): PanelSetup => {
    const panelArrays = setupConfig.arrays.map((arrayConfig, index) =>
      SolarPanelArrayFactory.create(
        index,
        arrayConfig,
        setupConfig.panelDefaults,
        density,
        site.centerX,
        site.centerZ,
      ),
    );

    // Apply per-panel overrides from arraysSettings if present.
    const overrides = setupConfig.arraysSettings;
    const finalArrays: SolarPanelArray[] = overrides && overrides.length > 0
      ? panelArrays.map(pa => {
          const arrayOverrides = overrides.filter(o => o.array === pa.index);
          if (arrayOverrides.length === 0) return pa;

          const panels: SolarPanel[] = pa.panels.map(panel => {
            const override = arrayOverrides.find(
              o => o.row === panel.row && o.col === panel.col,
            );
            if (!override) return panel;

            const hasOptimizer = override.hasOptimizer ?? panel.hasOptimizer;
            const string = override.string ?? panel.string;
            const { frameColor, emissiveColor } = panelColours(hasOptimizer);

            return {
              ...panel,
              hasOptimizer,
              string,
              renderData: {
                ...panel.renderData,
                frameColor,
                emissiveColor,
              },
            };
          });

          return { ...pa, panels };
        })
      : panelArrays;

    return {
      id: deriveSetupId(setupConfig.label, setupIndex),
      label: setupConfig.label,
      panelArrays: finalArrays,
    };
  },

  /**
   * Returns a new PanelSetup with regenerated sample points for a new density,
   * reusing all panel geometry (world positions, rotations, render data) from
   * the existing setup unchanged.
   *
   * Panel geometry is independent of sampling density. Rebuilding it on every
   * density slider change wastes CPU and triggers React re-renders of the
   * entire panel tree even though nothing visual has changed.
   */
  rebuildSamplePoints: (
    existing: PanelSetup,
    density: number,
  ): PanelSetup => {
    const panelArrays: SolarPanelArray[] = existing.panelArrays.map(pa => ({
      ...pa,
      panels: pa.panels.map((panel): SolarPanel => ({
        ...panel,
        samplePoints: SamplePointFactory.createForPanel(
          panel.id,
          panel.renderData.actualWidth,
          panel.renderData.actualHeight,
          panel.zones,
          panel.zonesDisposition,
          density,
        ),
      })),
    }));

    return {
      id: existing.id,
      label: existing.label,
      panelArrays,
    };
  },
};