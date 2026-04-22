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

/**
 * Builds the render data for a railing rail of any shape.
 *
 * `length` is the extent of the rail along the wall direction (Z local axis
 * of the wall group). The localPosition Y is the wall height plus the
 * heightOffset so the rail sits on top of the wall.
 *
 * For CylinderGeometry the constructor signature is:
 *   (radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength)
 *
 * Half-cylinder uses openEnded=true and thetaLength=π so only half the
 * cylinder surface is drawn. thetaStart controls which half:
 *   orientation 'up'   → thetaStart = 0   (flat face pointing down)
 *   orientation 'down' → thetaStart = π   (flat face pointing up)
 * The cylinder is rotated 90° around X so its height axis aligns with Z (wall direction).
 */
const buildRailRenderData = (
  shape: RailingShape,
  wallHeight: number,
  heightOffset: number,
  length: number,
): RailingRailRenderData => {
  const localPosition: [number, number, number] = [0, wallHeight + heightOffset, 0];
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
      return {
        kind: 'half-cylinder',
        localPosition,
        localRotation: cylinderRotation,
        // heightSegments=1, openEnded=true, then thetaStart and thetaLength
        args: [shape.radius, shape.radius, length, HALF_CYLINDER_SEGMENTS, 1, true, thetaStart, Math.PI],
        color: RAILING_COLOR,
      };
    }
  }
};

const buildSupportRenderData = (
  support: RailingSupportConfiguration,
  wallHeight: number,
  heightOffset: number,
  wallLength: number,
): RailingSupportRenderData[] => {
  const supportHeight = heightOffset;
  const midY = wallHeight + supportHeight / 2;

  const positions: number[] = [];

  if (support.includeAtStart) positions.push(-wallLength / 2);
  if (support.includeAtEnd) positions.push(wallLength / 2);

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

const resolveShape = (shape?: RailingShape): RailingShape =>
  shape ?? { kind: 'cylinder', radius: 0.025 };

export const WallFactory = {
  create: (
    index: number,
    p1: PointXZ,
    p2: PointXZ,
    wallDefaults: WallConfiguration,
    railingDefaults: RailingConfiguration,
    wallSettings?: WallSettingsConfiguration,
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