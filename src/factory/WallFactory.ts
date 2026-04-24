import { Wall, WallRailing, RailingSupportRenderData } from '../types/installation';
import { PointXZ } from '../types/geometry';
import {
  RailingConfiguration,
  WallConfiguration,
  WallSettingsConfiguration,
  RailingShape,
  RailingSupportShape,
} from '../types/config';
import { PointXZUtils } from '../utils/PointXZUtils';
import { RailingUtils } from '../utils/RailingUtils';

const WALL_COLOR = '#777';
const SUPPORT_COLOR = '#444';
const CYLINDER_SEGMENTS = 8;

const DEFAULT_RAILING_SHAPE: RailingShape = { kind: 'cylinder', radius: 0.025 };

interface ResolvedSupportConfiguration {
  readonly shape: RailingSupportShape;
  readonly count: number;
  readonly edgeDistance: number | undefined;
}

/**
 * Computes the Z positions (in wall-local space, origin at wall centre) of
 * every railing support along a wall of the given effective length.
 *
 * When `edgeDistance` is provided:
 *   - The two outermost supports are placed at `edgeDistance` from each wall
 *     end. If `count` is exactly 2, only those two supports are placed.
 *   - Additional supports (count > 2) are evenly distributed in the remaining
 *     space between the two outermost ones.
 *   - A minimum of 2 supports is required; values below 2 are silently clamped.
 *
 * When `edgeDistance` is omitted:
 *   - All `count` supports are distributed homogeneously along the full wall
 *     length using `count + 1` equal intervals (legacy behaviour).
 */
const computeSupportPositions = (
  count: number,
  edgeDistance: number | undefined,
  wallLength: number,
): number[] => {
  if (count <= 0) return [];

  if (edgeDistance === undefined) {
    // Homogeneous distribution — legacy behaviour.
    const steps = count + 1;
    return Array.from({ length: count }, (_, i) =>
      -wallLength / 2 + (wallLength * (i + 1)) / steps,
    );
  }

  // Edge-anchored distribution.
  const effectiveCount = Math.max(2, count);
  const startZ = -wallLength / 2 + edgeDistance;
  const endZ = wallLength / 2 - edgeDistance;

  if (effectiveCount === 2) return [startZ, endZ];

  const inner = effectiveCount - 2;
  const innerSpan = endZ - startZ;
  const positions: number[] = [startZ];
  for (let i = 1; i <= inner; i++) {
    positions.push(startZ + (innerSpan * i) / (inner + 1));
  }
  positions.push(endZ);
  return positions;
};

const buildSupportRenderData = (
  support: ResolvedSupportConfiguration,
  wallHeight: number,
  heightOffset: number,
  wallLength: number,
): RailingSupportRenderData[] => {
  const supportHeight = heightOffset;
  const midY = wallHeight + supportHeight / 2;

  const positions = computeSupportPositions(support.count, support.edgeDistance, wallLength);

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
   * The wall body is displaced outward (away from the floor) by `thickness/2`
   * along the left-hand normal of the p1→p2 direction. See the README for the
   * normal derivation and for how adjustStart/adjustEnd are determined.
   *
   * When railing extensions are configured (`extendAtStart` / `extendAtEnd`),
   * the rail is lengthened beyond the adjusted wall ends so it overlaps the
   * intersection post at that corner. Each extension has length
   * `wallThickness / 2 − extensionGap / 2`. The rail's local Z position is
   * shifted accordingly so the mesh stays centred within the wall group.
   *
   * Supports are always distributed along `currentDist` (the adjusted wall
   * length), never along the extended portion.
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

      const extendAtStart = railingOverride?.extendAtStart ?? railingDefaults.extendAtStart ?? false;
      const extendAtEnd = railingOverride?.extendAtEnd ?? railingDefaults.extendAtEnd ?? false;
      const extensionGap = railingOverride?.extensionGap ?? railingDefaults.extensionGap ?? 0;
      const extensionLength = wallThickness / 2 - extensionGap / 2;

      const startExt = extendAtStart ? extensionLength : 0;
      const endExt = extendAtEnd ? extensionLength : 0;
      const railLength = currentDist + startExt + endExt;

      // Shift the rail centre so extensions are symmetric about the new length.
      // Positive Z is toward p2 in the wall group's local space.
      const railZOffset = (endExt - startExt) / 2;

      const rail = RailingUtils.buildRailRenderData(shape, wallHeight, heightOffset, railLength, railZOffset);

      const supportCount = railingOverride?.support?.count ?? railingDefaults.support?.count ?? 0;
      const supportEdgeDistance = railingOverride?.support?.edgeDistance ?? railingDefaults.support?.edgeDistance;
      const supportShape = railingOverride?.support?.shape ?? railingDefaults.support?.shape;

      const supports: RailingSupportRenderData[] = supportShape
        ? buildSupportRenderData(
          {
            shape: supportShape,
            count: supportCount,
            edgeDistance: supportEdgeDistance,
          },
          wallHeight,
          heightOffset,
          currentDist,
        )
        : [];

      railing = { shape, rail, supports };
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