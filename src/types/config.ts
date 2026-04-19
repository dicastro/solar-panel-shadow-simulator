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
   * Site azimut in degrees. Reference: South = 0.
   * Positive values = rotated towards West.
   * Negative values = rotated towards East.
   * Tip: use a compass app pointing South and read the deviation from 180°,
   * then subtract 180° to get this value (or use a solar azimut app directly).
   */
  readonly azimut: number;
  readonly timezone: string;
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
   * Panel array azimut in degrees. Reference: South = 0.
   * Positive values = panels facing West.
   * Negative values = panels facing East.
   * Independent from site azimut — this is absolute, not relative to the site.
   */
  readonly azimut: number;
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