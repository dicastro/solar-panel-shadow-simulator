import { PanelSetup, SolarPanel, SolarPanelArray } from '../types/installation';
import { Site } from '../types/installation';
import { PanelSetupConfiguration } from '../types/config';
import { SolarPanelArrayFactory } from './SolarPanelArrayFactory';
import { SamplePointFactory } from './SamplePointFactory';

const deriveSetupId = (label: string, index: number): string => {
  const normalised = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `${normalised}-${index}`;
};

const panelColours = (hasOptimizer: boolean) => ({
  frameColor: hasOptimizer ? '#2ecc71' : '#121e36',
  emissiveColor: hasOptimizer ? '#0a2a16' : '#050a15',
});

/**
 * Assigns a stable colour index to each unique string identifier within a
 * setup, based on first-appearance order across all arrays in row-major
 * order (array 0 row 0 col 0 first). This order is deterministic and
 * independent of how many arrays or panels the setup contains.
 */
const buildStringColorMap = (panels: SolarPanel[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const panel of panels) {
    if (!map.has(panel.string)) {
      map.set(panel.string, map.size);
    }
  }
  return map;
};

export const PanelSetupFactory = {
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
        site.swCornerX,
        site.swCornerZ,
        site.azimuthRad,
      ),
    );

    // Apply per-panel overrides.
    const overrides = setupConfig.arraysSettings;
    const arraysAfterOverrides: SolarPanelArray[] = overrides && overrides.length > 0
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

    // Build the string colour map from the final panel list (after overrides),
    // so string reassignments via arraysSettings are reflected in the colours.
    const allPanels = arraysAfterOverrides.flatMap(pa => pa.panels);
    const stringColorMap = buildStringColorMap(allPanels);

    const finalArrays: SolarPanelArray[] = arraysAfterOverrides.map(pa => ({
      ...pa,
      panels: pa.panels.map(panel => ({
        ...panel,
        renderData: {
          ...panel.renderData,
          stringColorIndex: stringColorMap.get(panel.string) ?? 0,
        },
      })),
    }));

    return {
      id: deriveSetupId(setupConfig.label, setupIndex),
      label: setupConfig.label,
      panelArrays: finalArrays,
    };
  },

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