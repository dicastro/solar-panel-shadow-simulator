import * as THREE from 'three';
import { OffsetXZ, PointXZ } from './types/geometry';

export type ZonesDisposition = 'vertical' | 'horizontal';

export type RailingShape = 'square' | 'round';

export interface PanelDefinition {
  width: number;
  height: number;
  peakPower: number;
  zones: number;
  zonesDisposition: ZonesDisposition;
  hasOptimizer: boolean;
  string: string;
}

export interface PanelArray {
  position: PointXZ;
  azimut: number;
  elevation: number;
  inclination: number;
  rows: number;
  columns: number;
  width?: number;
  height?: number;
  peakPower?: number;
  zones?: number;
  zonesDisposition?: ZonesDisposition;
  hasOptimizer?: boolean;
  string?: string;
}

export interface PanelArraySettings {
  array: number;
  panel: PointXZ;
  hasOptimizer?: boolean;
  string?: string;
}

export interface PanelsConfiguration {
  panelDefaults: PanelDefinition;
  arrays: PanelArray[];
  arraysSettings?: PanelArraySettings[];
}

export interface WallConfiguration {
  height: number;
  thickness: number;
}

export interface RailingConfiguration {
  active: boolean;
  heightOffset: number;
  thickness: number;
  shape: RailingShape;
}

export interface RailingOverrideConfiguration {
  active?: boolean;
  heightOffset?: number;
  thickness?: number;
  shape?: RailingShape;
}

export interface InstallationLocationConfiguration {
  latitude: number;
  longitude: number;
}

export interface WallOverrideConfiguration {
  height?: number;
  railing?: RailingOverrideConfiguration;
}

export interface WallSettingsConfiguration {
  wall: number;
  override?: WallOverrideConfiguration;
  trimStart?: number;
  trimEnd?: number;
}

export interface InstallationConfiguration {
  location: InstallationLocationConfiguration;
  azimut: number;
  timezone: string;
  wallPoints: PointXZ[];
  wallDefaults: WallConfiguration,
  railingDefaults: RailingConfiguration;
  wallSettings?: WallSettingsConfiguration[];
}

export interface Config {
  installation: InstallationConfiguration,
  panels: PanelsConfiguration;
}

export interface WallGeometryData {
  posX: number;
  posZ: number;
  angle: number;
  currentDist: number;
  nx: number;
  nz: number;
}

export interface SunState {
    altitude: number;
    azimuth: number;
    isDaylight: boolean;
    direction: THREE.Vector3;
}

export interface SimulationResult {
    instantPower: number; // kW
    panels: {
        id: string;
        power: number;
        isShaded: boolean;
    }[];
}

export interface WallIntersection {
  readonly index: number;
  readonly position: PointXZ;
  readonly height: number;
  readonly thickness: number;
  readonly offset: OffsetXZ;
}

export interface Wall {
  readonly index: number;
  readonly p1: PointXZ;
  readonly p2: PointXZ;
  readonly height: number;
  readonly thickness: number;
  readonly trimStart: number;
  readonly trimEnd: number;
  readonly railing: RailingConfiguration;
  readonly geometryData: WallGeometryData;
}

export interface SolarInstallation {
  readonly location: InstallationLocationConfiguration;
  readonly azimut: number;
  readonly walls: readonly Wall[];
  readonly wallIntersections: readonly WallIntersection[];
  readonly centerX: number;
  readonly centerZ: number;
  readonly panels: PanelsConfiguration;
}