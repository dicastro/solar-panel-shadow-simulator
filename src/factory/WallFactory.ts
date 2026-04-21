import { Wall, WallRailing, RailingRailRenderData, RailingSupportRenderData } from '../types/installation';
import { PointXZ } from '../types/geometry';
import { RailingConfiguration, WallConfiguration, WallSettingsConfiguration, RailingShape, RailingSupportShape } from '../types/config';

const WALL_COLOR = '#777';
const RAILING_COLOR = '#333';
const SUPPORT_COLOR = '#444';

const CYLINDER_SEGMENTS = 8;
const HALF_CYLINDER_SEGMENTS = 8;

interface RailingSupportConfiguration {
  readonly shape: RailingSupportShape;
  readonly count: number;
  readonly includeAtStart: boolean;
  readonly includeAtEnd: boolean;
}

// ── Rail render data builders ────────────────────────────────────────────────

/**
 * Builds the render data for a railing rail of any shape.
 *
 * `length` is the extent of the rail along the wall direction (Z local axis
 * of the wall group). The localPosition Y is the wall height plus the
 * heightOffset so the rail sits on top of the wall.
 *
 * Half-cylinder thetaStart/thetaLength:
 *   orientation 'up'   → flat face down  → thetaStart = 0,   thetaLength = π
 *   orientation 'down' → flat face up    → thetaStart = π,   thetaLength = π
 * The cylinder is oriented along Z (rotated 90° around X), so the CylinderGeometry
 * height axis aligns with the wall direction.
 */
const buildRailRenderData = (
  shape: RailingShape,
  wallHeight: number,
  heightOffset: number,
  length: number,
): RailingRailRenderData => {
  const localPosition: [number, number, number] = [0, wallHeight + heightOffset, 0];
  // Cylinder/half-cylinder need X rotation to align the height axis with Z (wall direction)
  const cylinderRotation: [number, number, number] = [Math.PI / 2, 0, 0];
  const noRotation: [number, number, number] = [0, 0, 0];

  switch (shape.kind) {
    case 'square':
      return {
        kind: 'square',
        localPosition,
        localRotation: noRotation,
        args: [shape.width, shape.height, length],
        color: RAILING_COLOR,
      };

    case 'cylinder':
      return {
        kind: 'cylinder',
        localPosition,
        localRotation: cylinderRotation,
        args: [shape.radius, shape.radius, length, CYLINDER_SEGMENTS],
        color: RAILING_COLOR,
      };

    case 'half-cylinder': {
      const thetaStart = shape.orientation === 'up' ? 0 : Math.PI;
      const thetaLength = Math.PI;
      return {
        kind: 'half-cylinder',
        localPosition,
        localRotation: cylinderRotation,
        args: [shape.radius, shape.radius, length, HALF_CYLINDER_SEGMENTS, thetaStart, thetaLength],
        color: RAILING_COLOR,
      };
    }
  }
};

// ── Support (baluster) render data builder ───────────────────────────────────

/**
 * Computes the local positions of all balusters along a wall and builds their
 * render data.
 *
 * Coordinate convention: localPosition is relative to the wall group origin.
 *   X = 0 (centred on wall width)
 *   Y = wallHeight + heightOffset / 2  (mid-height of the baluster)
 *   Z = position along wall length (−length/2 … +length/2)
 *
 * Distribution:
 *   - If includeAtStart && includeAtEnd: positions at −length/2, intermediate
 *     points, and +length/2.
 *   - Otherwise, the `count` intermediates are distributed evenly in (−L/2, L/2).
 */
const buildSupportRenderData = (
  support: RailingSupportConfiguration,
  wallHeight: number,
  heightOffset: number,
  wallLength: number,
): RailingSupportRenderData[] => {
  const supportHeight = heightOffset; // from wall top to rail centre
  const midY = wallHeight + supportHeight / 2;

  const positions: number[] = [];

  if (support.includeAtStart) positions.push(-wallLength / 2);
  if (support.includeAtEnd) positions.push(wallLength / 2);

  // Distribute `count` intermediate supports uniformly between endpoints.
  // If count = 3, they go at 1/4, 1/2, 3/4 of the wall length.
  const steps = support.count + 1;
  for (let i = 1; i < steps; i++) {
    positions.push(-wallLength / 2 + (wallLength * i) / steps);
  }

  return positions.map(z => {
    const localPosition: [number, number, number] = [0, midY, z];
    switch (support.shape.kind) {
      case 'square':
        return {
          kind: 'square' as const,
          localPosition,
          args: [support.shape.width, supportHeight, support.shape.depth] as [number, number, number],
          color: SUPPORT_COLOR,
        };
      case 'cylinder':
        return {
          kind: 'cylinder' as const,
          localPosition,
          args: [support.shape.radius, support.shape.radius, supportHeight, CYLINDER_SEGMENTS] as [number, number, number, number],
          color: SUPPORT_COLOR,
        };
    }
  });
};

// ── Default shape ────────────────────────────────────────────────────────────

/**
 * Returns the effective railing shape, applying a sensible default when none
 * is specified in the config.
 *
 * Backwards-compatible default: a cylinder with radius 0.025 (equivalent to
 * the old `shape: 'round'` with `thickness: 0.05`).
 */
const resolveShape = (shape?: RailingShape): RailingShape =>
  shape ?? { kind: 'cylinder', radius: 0.025 };

// ── WallFactory ───────────────────────────────────────────────────────────────

export const WallFactory = {
  create: (
    index: number,
    p1: PointXZ,
    p2: PointXZ,
    wallDefaults: WallConfiguration,
    railingDefaults: RailingConfiguration,
    wallSettings?: WallSettingsConfiguration,
    /**
     * Pre-calculated trim values from SiteFactory (based on intersection
     * geometry). These replace the deprecated manual trimStart/trimEnd from
     * the public config.
     */
    autoTrimStart = 0,
    autoTrimEnd = 0,
  ): Wall => {
    const trimStart = autoTrimStart;
    const trimEnd = autoTrimEnd;

    const wallHeight = wallSettings?.override?.height ?? wallDefaults.height;
    const wallThickness = wallDefaults.thickness;

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const fullDist = Math.sqrt(dx * dx + dz * dz);
    const yAngle = Math.atan2(dx, dz);

    const currentDist = fullDist - trimStart - trimEnd;
    const offsetFromCenter = (trimStart / 2) - (trimEnd / 2);

    const ux = dx / fullDist;
    const uz = dz / fullDist;
    const nx = -uz;
    const nz = ux;

    const groupX = (p1.x + p2.x) / 2 + (nx * wallThickness / 2) + (ux * offsetFromCenter);
    const groupZ = (p1.z + p2.z) / 2 + (nz * wallThickness / 2) + (uz * offsetFromCenter);

    // ── Railing ──────────────────────────────────────────────────────────────

    const railingOverride = wallSettings?.override?.railing;
    const isRailingActive = railingOverride?.active ?? railingDefaults.active;

    let railing: WallRailing | null = null;

    if (isRailingActive) {
      const heightOffset = railingOverride?.heightOffset ?? railingDefaults.heightOffset;
      const shape = resolveShape(railingOverride?.shape ?? railingDefaults.shape);
      const autoConnect = railingOverride?.autoConnect ?? railingDefaults.autoConnect ?? true;
      const supportCount = railingOverride?.support?.count ?? railingDefaults.support?.count ?? 0;
      const supportStart = railingOverride?.support?.includeAtStart ?? false;
      const supportEnd = railingOverride?.support?.includeAtEnd ?? false;
      const supportShape = railingOverride?.support?.shape ?? railingDefaults.support?.shape;
      
      const rail = buildRailRenderData(shape, wallHeight, heightOffset, currentDist);

      const supports: RailingSupportRenderData[] = supportShape
        ? buildSupportRenderData({
            shape: supportShape,
            count: supportCount,
            includeAtStart: supportStart,
            includeAtEnd: supportEnd
          }, wallHeight, heightOffset, currentDist)
        : [];

      railing = { shape, autoConnect, rail, supports };
    }

    return {
      index,
      p1,
      p2,
      height: wallHeight,
      thickness: wallThickness,
      trimStart,
      trimEnd,
      worldPosition: { x: groupX, y: 0, z: groupZ },
      worldRotation: { x: 0, y: yAngle, z: 0 },
      railing,
      renderData: {
        meshLocalPosition: [0, wallHeight / 2, 0],
        boxArgs: [wallThickness, wallHeight, currentDist],
        color: WALL_COLOR,
      },
    };
  },
};