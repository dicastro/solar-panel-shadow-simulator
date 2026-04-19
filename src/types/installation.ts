import { Euler3, PointXZ, Vector3 } from './geometry';
import {
  LocationConfiguration,
  PanelOrientation,
  RailingShape,
  ZonesDisposition,
} from './config';

// ── Render data shapes ──────────────────────────────────────────────────────

export interface WallIntersectionRenderData {
  readonly boxArgs: [number, number, number];
  readonly color: string;
}

export interface WallRenderData {
  readonly meshLocalPosition: [number, number, number];
  readonly boxArgs: [number, number, number];
  readonly color: string;
}

export interface RailingRenderData {
  readonly localPosition: [number, number, number];
  readonly localRotation: [number, number, number];
  // cylinder: [radiusTop, radiusBottom, height, segments] - box: [w, h, d]
  readonly boxArgs: [number, number, number] | [number, number, number, number];
  readonly color: string;
}

export interface PanelRenderData {
  readonly actualWidth: number;
  readonly actualHeight: number;
  readonly frameColor: string;
  readonly emissiveColor: string;
}

// ── Domain models ───────────────────────────────────────────────────────────

export interface WallRailing {
  readonly shape: RailingShape;
  readonly thickness: number;
  readonly renderData: RailingRenderData;
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
  readonly trimStart: number;
  readonly trimEnd: number;
  readonly worldPosition: Vector3;
  readonly worldRotation: Euler3;
  readonly railing: WallRailing | null;
  readonly renderData: WallRenderData;
}

export interface SamplePoint {
  readonly id: string; // "a0-p1-2-z0-r1-c2" (array-panel-zone-row-column)
  readonly zoneIndex: number; // to which diode zone belongs to
  readonly localPosition: Vector3; // relative position to the panel
}

export interface SolarPanel {
  readonly id: string; // "a0-r1-c2" (array-row-column)
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
 * Represents the physical, immutable space where panels are installed.
 * Walls, railings and intersections belong here.
 * The site azimut (in radians) is applied as a rotation to the site group in the scene.
 */
export interface Site {
  readonly location: LocationConfiguration;
  readonly azimutRad: number;
  readonly timezone: string;
  readonly centerX: number;
  readonly centerZ: number;
  readonly walls: readonly Wall[];
  readonly wallIntersections: readonly WallIntersection[];
}

/**
 * A specific panel layout for a given site.
 * Multiple setups can exist for the same site.
 * Recalculated when active setup or density changes.
 */
export interface PanelSetup {
  readonly id: string;
  readonly label: string;
  readonly panelArrays: readonly SolarPanelArray[];
}