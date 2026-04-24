import { Euler3, PointXZ, Vector3 } from './geometry';
import {
  LocationConfiguration,
  PanelOrientation,
  RailingShape,
  ZonesDisposition,
} from './config';

export interface WallIntersectionRenderData {
  readonly boxArgs: [number, number, number];
  readonly color: string;
}

export interface WallRenderData {
  readonly meshLocalPosition: [number, number, number];
  readonly boxArgs: [number, number, number];
  readonly color: string;
}

export type RailingRailRenderDataSquare = {
  readonly kind: 'square';
  readonly localPosition: [number, number, number];
  readonly localRotation: [number, number, number];
  readonly args: [number, number, number];
  readonly color: string;
};

export type RailingRailRenderDataCylinder = {
  readonly kind: 'cylinder';
  readonly localPosition: [number, number, number];
  readonly localRotation: [number, number, number];
  readonly args: [number, number, number, number];
  readonly color: string;
};

export type RailingRailRenderDataHalfCylinder = {
  readonly kind: 'half-cylinder';
  readonly localPosition: [number, number, number];
  readonly localRotation: [number, number, number];
  // CylinderGeometry: [radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength]
  readonly args: [number, number, number, number, number, boolean, number, number];
  readonly color: string;
};

export type RailingRailRenderData =
  | RailingRailRenderDataSquare
  | RailingRailRenderDataCylinder
  | RailingRailRenderDataHalfCylinder;

export type RailingSupportRenderDataSquare = {
  readonly kind: 'square';
  readonly localPosition: [number, number, number];
  readonly args: [number, number, number];
  readonly color: string;
};

export type RailingSupportRenderDataCylinder = {
  readonly kind: 'cylinder';
  readonly localPosition: [number, number, number];
  readonly args: [number, number, number, number];
  readonly color: string;
};

export type RailingSupportRenderData =
  | RailingSupportRenderDataSquare
  | RailingSupportRenderDataCylinder;

export interface ZoneRenderData {
  readonly zoneIndex: number;
  readonly posX: number;
  readonly posZ: number;
  readonly width: number;
  readonly height: number;
}

export interface PanelRenderData {
  readonly actualWidth: number;
  readonly actualHeight: number;
  readonly frameColor: string;
  readonly emissiveColor: string;
  readonly zones: readonly ZoneRenderData[];
}

export interface WallRailing {
  readonly shape: RailingShape;
  readonly rail: RailingRailRenderData;
  readonly supports: readonly RailingSupportRenderData[];
}

export interface WallIntersection {
  readonly index: number;
  readonly position: PointXZ;
  readonly height: number;
  readonly thickness: number;
  readonly worldPosition: Vector3;
  readonly renderData: WallIntersectionRenderData;
}

export interface Wall {
  readonly index: number;
  readonly p1: PointXZ;
  readonly p2: PointXZ;
  readonly height: number;
  readonly thickness: number;
  /**
   * Longitudinal adjustment applied at the p1 end (metres).
   * Positive = shorten. Applied only at concave vertices to prevent the
   * wall body from overlapping the intersection post volume.
   */
  readonly adjustStart: number;
  /**
   * Longitudinal adjustment applied at the p2 end (metres).
   * Positive = shorten. Applied only at concave vertices to prevent the
   * wall body from overlapping the intersection post volume.
   */
  readonly adjustEnd: number;
  readonly worldPosition: Vector3;
  readonly worldRotation: Euler3;
  readonly railing: WallRailing | null;
  readonly renderData: WallRenderData;
}

export interface SamplePoint {
  readonly id: string;
  readonly zoneIndex: number;
  readonly localPosition: Vector3;
}

export interface SolarPanel {
  readonly id: string;
  readonly arrayIndex: number;
  readonly row: number;
  readonly col: number;
  readonly hasOptimizer: boolean;
  readonly string: string;
  readonly peakPower: number;
  readonly zones: number;
  readonly zonesDisposition: ZonesDisposition;
  readonly orientation: PanelOrientation;
  readonly worldPosition: Vector3;
  readonly worldRotation: Euler3;
  readonly samplePoints: readonly SamplePoint[];
  readonly renderData: PanelRenderData;
}

export interface SolarPanelArray {
  readonly index: number;
  readonly panels: readonly SolarPanel[];
}

/**
 * Site geometry. Timezone is intentionally absent — it lives in the store
 * as UI state and never affects geometric calculations.
 */
export interface Site {
  readonly location: LocationConfiguration;
  readonly azimuthRad: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly boundingRadius: number;
  readonly walls: readonly Wall[];
  readonly wallIntersections: readonly WallIntersection[];
}

export interface PanelSetup {
  readonly id: string;
  readonly label: string;
  readonly panelArrays: readonly SolarPanelArray[];
}