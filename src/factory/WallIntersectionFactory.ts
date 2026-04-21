import { WallIntersection, RailingRailRenderData } from '../types/installation';
import { PointXZ } from '../types/geometry';
import { PointXZUtils } from '../utils/PointXZUtils';
import { RailingConfiguration, RailingShape } from '../types/config';

const WALL_INTERSECTION_COLOR = '#777';
const RAILING_COLOR = '#333';
const CYLINDER_SEGMENTS = 8;
const HALF_CYLINDER_SEGMENTS = 8;

/**
 * Computes the geometrically correct offset from a corner point to the centre
 * of the intersection post, for any interior angle.
 *
 * ## Previous implementation (sum-of-normals shortcut)
 *
 *   offset = (normalPrev + normalNext) * (thickness / 2)
 *
 * This gives |offset| = thickness/2 * |n1+n2| = thickness/2 * 2*cos(θ/2),
 * where θ is the angle between the two segments. For θ=90° this equals
 * thickness/2 * √2 = thickness * 0.707, which happens to be correct — but
 * only for 90°. For other angles it diverges.
 *
 * ## Correct implementation (bisector formula)
 *
 * The correct distance from the corner point to the post centre is:
 *
 *   d = thickness / (2 * sin(θ/2))
 *
 * where θ is the interior angle between the two wall segments.
 * The direction is the normalised bisector of the two adjacent normals.
 *
 * The dot product of one normal with the normalised bisector equals sin(θ/2),
 * which is what we divide by. We clamp the divisor to 0.1 to avoid division
 * by zero for very acute angles (< ~11°), which are not physically meaningful
 * for terrace walls.
 *
 * This formula works for any angle from nearly 0° to 180°.
 */
const computeCornerOffset = (
  normalizedPrev: PointXZ,
  normalizedNext: PointXZ,
  wallThickness: number,
): PointXZ => {
  // Bisector direction (not yet normalised)
  const bx = normalizedPrev.x + normalizedNext.x;
  const bz = normalizedPrev.z + normalizedNext.z;
  const bLen = Math.sqrt(bx * bx + bz * bz) || 1;

  // Normalised bisector
  const bisectorX = bx / bLen;
  const bisectorZ = bz / bLen;

  // sin(θ/2) = dot(normalNext, bisector_normalised)
  const sinHalfAngle = Math.max(
    normalizedNext.x * bisectorX + normalizedNext.z * bisectorZ,
    0.1, // clamp: prevents division by zero for very acute angles
  );

  const distance = (wallThickness / 2) / sinHalfAngle;

  return { x: bisectorX * distance, z: bisectorZ * distance };
};

/**
 * Builds the render data for the small railing segment that fills the gap
 * at a wall intersection corner (the "connect" piece).
 *
 * The segment length is the distance between the inner face of each adjacent
 * wall railing and the corner point, scaled by the post's corner offset.
 * For simplicity we use a fixed short length derived from the wall thickness
 * — this covers the gap for all common angles without requiring per-shape
 * geometry calculations at the intersection level.
 *
 * The orientation/rotation of the piece matches the bisector direction so it
 * naturally fills the corner regardless of angle.
 */
const buildRailingConnect = (
  shape: RailingShape,
  wallHeight: number,
  heightOffset: number,
  wallThickness: number,
  normalizedPrev: PointXZ,
  normalizedNext: PointXZ,
): RailingRailRenderData => {
  // The connect segment length is derived from the post size.
  // It needs to bridge the gap left at the inner corner of the intersection.
  const bisectAngleCos = normalizedPrev.x * normalizedNext.x + normalizedPrev.z * normalizedNext.z;
  // Gap length ≈ wallThickness * cos(angle/2) / 2, minimum wallThickness/2
  const connectLength = Math.max(wallThickness * Math.sqrt((1 + bisectAngleCos) / 2), wallThickness / 2);

  const localPosition: [number, number, number] = [0, wallHeight + heightOffset, 0];
  const cylinderRotation: [number, number, number] = [Math.PI / 2, 0, 0];
  const noRotation: [number, number, number] = [0, 0, 0];

  switch (shape.kind) {
    case 'square':
      return {
        kind: 'square',
        localPosition,
        localRotation: noRotation,
        args: [shape.width, shape.height, connectLength],
        color: RAILING_COLOR,
      };
    case 'cylinder':
      return {
        kind: 'cylinder',
        localPosition,
        localRotation: cylinderRotation,
        args: [shape.radius, shape.radius, connectLength, CYLINDER_SEGMENTS],
        color: RAILING_COLOR,
      };
    case 'half-cylinder': {
      const thetaStart = shape.orientation === 'up' ? 0 : Math.PI;
      return {
        kind: 'half-cylinder',
        localPosition,
        localRotation: cylinderRotation,
        args: [shape.radius, shape.radius, connectLength, HALF_CYLINDER_SEGMENTS, thetaStart, Math.PI],
        color: RAILING_COLOR,
      };
    }
  }
};

export const WallIntersectionFactory = {
  /**
   * @param prevRailing  Railing config of the wall ending at this intersection.
   * @param nextRailing  Railing config of the wall starting at this intersection.
   */
  create: (
    index: number,
    p: PointXZ,
    pPrev: PointXZ,
    pNext: PointXZ,
    wallThickness: number,
    height: number,
    prevRailing: RailingConfiguration | null,
    nextRailing: RailingConfiguration | null,
  ): WallIntersection => {
    const { isStraight, normalizedPrev, normalizedNext } =
      PointXZUtils.pointAlignedWithPreviousAndNext(p, pPrev, pNext);

    const offset = isStraight
      ? {
        x: normalizedNext.x * (wallThickness / 2),
        z: normalizedNext.z * (wallThickness / 2),
      }
      : computeCornerOffset(normalizedPrev, normalizedNext, wallThickness);

    // ── Railing connect ───────────────────────────────────────────────────

    let railingConnect: RailingRailRenderData | null = null;

    // Both adjacent railings must be active and have autoConnect enabled.
    const prevActive = prevRailing?.active ?? false;
    const nextActive = nextRailing?.active ?? false;
    const prevConnect = prevRailing?.autoConnect ?? true;
    const nextConnect = nextRailing?.autoConnect ?? true;

    if (!isStraight && prevActive && nextActive && prevConnect && nextConnect) {
      // Use the shape from the wall that ends here (prevRailing) as the
      // reference. If both walls have the same shape (the common case) this
      // is exact. If they differ, one side will have a small visual mismatch
      // at the corner — acceptable for the typical use case.
      const shape = prevRailing!.shape ?? { kind: 'cylinder' as const, radius: 0.025 };
      const heightOffset = prevRailing!.heightOffset;

      railingConnect = buildRailingConnect(
        shape, height, heightOffset, wallThickness, normalizedPrev, normalizedNext,
      );
    }

    return {
      index,
      position: p,
      height,
      thickness: wallThickness,
      worldPosition: {
        x: p.x + offset.x,
        y: height / 2,
        z: p.z + offset.z,
      },
      renderData: {
        boxArgs: [wallThickness, height, wallThickness],
        color: WALL_INTERSECTION_COLOR,
      },
      railingConnect,
    };
  },
};