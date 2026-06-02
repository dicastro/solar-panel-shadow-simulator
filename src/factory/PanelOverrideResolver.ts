import {
  PanelDefinition,
  PanelArrayConfiguration,
  PanelArraySettings,
  ZonesDisposition,
  PanelOrientation,
} from '../types/config';

/**
 * The fully resolved configuration for a single panel, after applying
 * overrides from all three levels in priority order:
 *   panelOverride (arraysSettings) > arrayConfig > panelDefaults
 */
export interface ResolvedPanelConfig {
  readonly string: string;
  readonly hasOptimizer: boolean;
  readonly width: number;
  readonly height: number;
  readonly peakPower: number;
  readonly zones: number;
  readonly zonesDisposition: ZonesDisposition;
  readonly orientation: PanelOrientation;
  readonly spacing: [number, number];
  readonly temperatureCoefficient: number | undefined;
  readonly noct: number | undefined;
}

const DEFAULT_SPACING: [number, number] = [0.02, 0.02];
const DEFAULT_ORIENTATION: PanelOrientation = 'portrait';

/**
 * Resolves the definitive configuration for a single panel by applying
 * overrides in cascade: panel-level > array-level > setup defaults.
 *
 * This is the single source of truth for panel attribute resolution.
 * Both the panel factory chain and StringCountValidator use this function
 * to ensure consistent results.
 */
export const PanelOverrideResolver = {
  resolve: (
    panelDefaults: PanelDefinition,
    arrayConfig: PanelArrayConfiguration,
    panelOverride: PanelArraySettings | undefined,
  ): ResolvedPanelConfig => ({
    string:
      panelOverride?.string ??
      arrayConfig.string ??
      panelDefaults.string,
    hasOptimizer:
      panelOverride?.hasOptimizer ??
      arrayConfig.hasOptimizer ??
      panelDefaults.hasOptimizer,
    width: arrayConfig.width ?? panelDefaults.width,
    height: arrayConfig.height ?? panelDefaults.height,
    peakPower: arrayConfig.peakPower ?? panelDefaults.peakPower,
    zones: arrayConfig.zones ?? panelDefaults.zones,
    zonesDisposition:
      arrayConfig.zonesDisposition ?? panelDefaults.zonesDisposition,
    orientation: arrayConfig.orientation ?? DEFAULT_ORIENTATION,
    spacing: arrayConfig.spacing ?? DEFAULT_SPACING,
    temperatureCoefficient:
      arrayConfig.temperatureCoefficient ??
      panelDefaults.temperatureCoefficient,
    noct: arrayConfig.noct ?? panelDefaults.noct,
  }),
};