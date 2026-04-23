import { Wall, WallRailing, RailingSupportRenderData } from '../types/installation';
import { PointXZ } from '../types/geometry';
import { RailingConfiguration, WallConfiguration, WallSettingsConfiguration, RailingShape, RailingSupportShape } from '../types/config';
import { PointXZUtils } from '../utils/PointXZUtils';
import { RailingUtils } from '../utils/RailingUtils';

const WALL_COLOR = '#777';
const SUPPORT_COLOR = '#444';
const CYLINDER_SEGMENTS = 8;

const DEFAULT_RAILING_SHAPE: RailingShape = { kind: 'cylinder', radius: 0.025 };

interface ResolvedSupportConfiguration {
  readonly shape: RailingSupportShape;
  readonly count: number;
  readonly includeAtStart: boolean;
  readonly includeAtEnd: boolean;
}

/**
 * Computes the positions and render data for every railing support (baluster)
 * along a wall segment of the given length.
 *
 * Supports are evenly distributed between the two ends. The `includeAtStart`
 * and `includeAtEnd` flags add extra supports flush with each end, independent
 * of the `count`. Support height equals `heightOffset` (the gap between the
 * wall top and the rail centre-line).
 */
const buildSupportRenderData = (
  support: ResolvedSupportConfiguration,
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

export const WallFactory = {
  /**
   * Builds a wall segment between two floor vertices, including its railing
   * and support render data.
   *
   * The wall body is displaced outward (away from the floor) by thickness/2
   * along the left-hand normal of the p1→p2 direction. See README for the normal
   * derivation and for how adjustStart/adjustEnd are determined.
   *
   * @param adjustStart  Shortening at the p1 end (metres, always ≥ 0).
   * @param adjustEnd    Shortening at the p2 end (metres, always ≥ 0).
   */
  create: (
    index: number,
    p1: PointXZ,
    p2: PointXZ,
    wallDefaults: WallConfiguration,
    railingDefaults: RailingConfiguration,
    wallSettings?: WallSettingsConfiguration,
    adjustStart = 0,
    adjustEnd = 0,
  ): Wall => {
    const wallHeight = wallSettings?.override?.height ?? wallDefaults.height;
    const wallThickness = wallDefaults.thickness;

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const fullDist = Math.sqrt(dx * dx + dz * dz);
    const yAngle = Math.atan2(dx, dz);

    const currentDist = fullDist - adjustStart - adjustEnd;

    // When adjustments at the two ends differ, the group centre shifts toward
    // the longer end by half the difference.
    const offsetFromCenter = (adjustStart / 2) - (adjustEnd / 2);

    const ux = dx / fullDist;
    const uz = dz / fullDist;

    const outwardNormal = PointXZUtils.computeLeftHandNormal(p1, p2);

    const groupX = (p1.x + p2.x) / 2 + (outwardNormal.x * wallThickness / 2) + (ux * offsetFromCenter);
    const groupZ = (p1.z + p2.z) / 2 + (outwardNormal.z * wallThickness / 2) + (uz * offsetFromCenter);

    const railingOverride = wallSettings?.override?.railing;
    const isRailingActive = railingOverride?.active ?? railingDefaults.active;

    let railing: WallRailing | null = null;

    if (isRailingActive) {
      const heightOffset = railingOverride?.heightOffset ?? railingDefaults.heightOffset;
      const shape = railingOverride?.shape ?? railingDefaults.shape ?? DEFAULT_RAILING_SHAPE;
      const autoConnect = railingOverride?.autoConnect ?? railingDefaults.autoConnect ?? true;
      const supportCount = railingOverride?.support?.count ?? railingDefaults.support?.count ?? 0;
      const supportStart = railingOverride?.support?.includeAtStart ?? false;
      const supportEnd = railingOverride?.support?.includeAtEnd ?? false;
      const supportShape = railingOverride?.support?.shape ?? railingDefaults.support?.shape;

      const rail = RailingUtils.buildRailRenderData(shape, wallHeight, heightOffset, currentDist);

      const supports: RailingSupportRenderData[] = supportShape
        ? buildSupportRenderData({
          shape: supportShape,
          count: supportCount,
          includeAtStart: supportStart,
          includeAtEnd: supportEnd,
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
      adjustStart,
      adjustEnd,
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