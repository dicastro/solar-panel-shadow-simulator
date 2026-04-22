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
 * The correct distance from the corner point to the post centre is:
 *   d = wallThickness / (2 * sin(θ/2))
 *
 * where θ is the interior angle between the two wall segments.
 * The direction is the normalised bisector of the two adjacent normals.
 *
 * The dot product of one normal with the normalised bisector equals sin(θ/2),
 * which is what we divide by. We clamp the divisor to 0.1 to avoid division
 * by zero for very acute angles (< ~11°), which are not physically meaningful
 * for terrace walls.
 */
const computeCornerOffset = (
  normalizedPrev: PointXZ,
  normalizedNext: PointXZ,
  wallThickness: number,
): PointXZ => {
  const bx = normalizedPrev.x + normalizedNext.x;
  const bz = normalizedPrev.z + normalizedNext.z;
  const bLen = Math.sqrt(bx * bx + bz * bz) || 1;

  const bisectorX = bx / bLen;
  const bisectorZ = bz / bLen;

  const sinHalfAngle = Math.max(
    normalizedNext.x * bisectorX + normalizedNext.z * bisectorZ,
    0.1,
  );

  const distance = (wallThickness / 2) / sinHalfAngle;

  return { x: bisectorX * distance, z: bisectorZ * distance };
};

/**
 * Builds the render data for the small railing segment that fills the gap
 * at a wall intersection corner (the "connect" piece).
 */
const buildRailingConnect = (
  shape: RailingShape,
  wallHeight: number,
  heightOffset: number,
  wallThickness: number,
  normalizedPrev: PointXZ,
  normalizedNext: PointXZ,
): RailingRailRenderData => {
  const bisectAngleCos = normalizedPrev.x * normalizedNext.x + normalizedPrev.z * normalizedNext.z;
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
        args: [shape.radius, shape.radius, connectLength, HALF_CYLINDER_SEGMENTS, 1, true, thetaStart, Math.PI],
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
    const { isStraight, isConvex, normalizedPrev, normalizedNext } =
      PointXZUtils.pointAlignedWithPreviousAndNext(p, pPrev, pNext);

    // Posts are only rendered at convex vertices (exterior corners).
    // Collinear vertices and concave (interior) corners do not get posts —
    // at collinear points the post would overlap the walls, and at concave
    // corners the post offset would point outside the terrace perimeter.
    const isRendered = !isStraight && !isConvex;

    const offset = isStraight
      ? { x: normalizedNext.x * (wallThickness / 2), z: normalizedNext.z * (wallThickness / 2) }
      : computeCornerOffset(normalizedPrev, normalizedNext, wallThickness);

    let railingConnect: RailingRailRenderData | null = null;

    if (isRendered) {
      const prevActive = prevRailing?.active ?? false;
      const nextActive = nextRailing?.active ?? false;
      const prevConnect = prevRailing?.autoConnect ?? true;
      const nextConnect = nextRailing?.autoConnect ?? true;

      if (prevActive && nextActive && prevConnect && nextConnect) {
        const shape = prevRailing!.shape ?? { kind: 'cylinder' as const, radius: 0.025 };
        const heightOffset = prevRailing!.heightOffset;
        railingConnect = buildRailingConnect(
          shape, height, heightOffset, wallThickness, normalizedPrev, normalizedNext,
        );
      }
    }

    return {
      index,
      position: p,
      height,
      thickness: wallThickness,
      isRendered,
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