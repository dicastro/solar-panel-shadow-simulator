import { PointXZ } from './geometry';

export type ZonesDisposition = 'vertical' | 'horizontal';
export type RailingShape = 'square' | 'round';
export type PanelOrientation = 'portrait' | 'landscape';

export interface LocationConfiguration {
  readonly latitude: number;
  readonly longitude: number;
}

export interface WallConfiguration {
  readonly height: number;
  readonly thickness: number;
}

export interface RailingConfiguration {
  readonly active: boolean;
  readonly heightOffset: number;
  readonly thickness: number;
  readonly shape: RailingShape;
}

export interface RailingOverrideConfiguration {
  readonly active?: boolean;
  readonly heightOffset?: number;
  readonly thickness?: number;
  readonly shape?: RailingShape;
}

export interface WallOverrideConfiguration {
  readonly height?: number;
  readonly railing?: RailingOverrideConfiguration;
}

export interface WallSettingsConfiguration {
  readonly wall: number;
  readonly override?: WallOverrideConfiguration;
  readonly trimStart?: number;
  readonly trimEnd?: number;
}

export interface InstallationConfiguration {
  readonly location: LocationConfiguration;
  /**
   * Site azimuth in degrees. Reference: South = 0.
   * Positive values = rotated towards West.
   * Negative values = rotated towards East.
   */
  readonly azimuth: number;
  readonly timezone: string;
  /**
   * Wall corner points in site-local coordinates (metres).
   *
   * Coordinate system:
   *   +X → East,  +Z → North  (before site azimuth rotation)
   *
   * Walk the perimeter counter-clockwise when viewed from above, starting
   * from the South-West corner.  The segment index (used in wallsSettings)
   * is the index of the point that *starts* that segment, so segment 0 goes
   * from wallPoints[0] to wallPoints[1], and so on.
   *
   * Example walk order: SW → S → SE → E → NE → N → NW → W → (back to SW)
   */
  readonly wallPoints: [number, number][];
  readonly wallDefaults: WallConfiguration;
  readonly railingDefaults: RailingConfiguration;
  readonly wallsSettings?: WallSettingsConfiguration[];
}

export interface PanelDefinition {
  readonly width: number;
  readonly height: number;
  readonly peakPower: number;
  readonly zones: number;
  readonly zonesDisposition: ZonesDisposition;
  readonly hasOptimizer: boolean;
  readonly string: string;
}

export interface PanelArrayConfiguration {
  readonly position: [number, number];
  /**
   * Panel array azimuth in degrees. Reference: South = 0.
   * Positive values = panels facing West.
   * Negative values = panels facing East.
   * This is an absolute angle, independent of the site azimuth.
   */
  readonly azimuth: number;
  readonly elevation: number;
  readonly inclination: number;
  readonly rows: number;
  readonly columns: number;
  readonly spacing?: [number, number];
  readonly orientation?: PanelOrientation;
  readonly width?: number;
  readonly height?: number;
  readonly peakPower?: number;
  readonly zones?: number;
  readonly zonesDisposition?: ZonesDisposition;
  readonly hasOptimizer?: boolean;
  readonly string?: string;
}

export interface PanelArraySettings {
  readonly array: number;
  readonly panel: PointXZ;
  readonly hasOptimizer?: boolean;
  readonly string?: string;
}

export interface PanelSetupConfiguration {
  readonly id: string;
  readonly label: string;
  readonly panelDefaults: PanelDefinition;
  readonly arrays: PanelArrayConfiguration[];
  readonly arraysSettings?: PanelArraySettings[];
}

export interface Config {
  readonly site: InstallationConfiguration;
  readonly setups: PanelSetupConfiguration[];
}