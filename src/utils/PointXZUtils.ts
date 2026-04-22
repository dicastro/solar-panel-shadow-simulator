import { PointXZ, PointXZAlignedResult } from "../types/geometry";

const getNormal = (pA: PointXZ, pB: PointXZ): PointXZ => {
  const dx = pB.x - pA.x;
  const dz = pB.z - pA.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  return { x: -dz / d, z: dx / d };
};

/**
 * Tolerance for collinearity and right-angle checks.
 * A dot product above this threshold is treated as collinear (≈180°).
 * A dot product below the negative of this threshold is treated as
 * perpendicular (≈90° or ≈270°).
 */
const COLLINEAR_THRESHOLD = 0.999;
const RIGHT_ANGLE_THRESHOLD = 0.01;

export const PointXZUtils = {
  /**
   * Analyses a vertex p against its two neighbours to determine:
   * - whether the three points are collinear (isStraight)
   * - whether the vertex is convex, i.e. the polygon turns left at this point
   *   when walked counter-clockwise (isConvex). Concave vertices (interior
   *   angle > 180°) have isConvex = false.
   * - the unit normals of the incoming and outgoing wall segments.
   *
   * Convexity is derived from the 2D cross product of the two edge directions
   * at the vertex. For a counter-clockwise polygon:
   *   cross > 0  →  left turn  →  convex  (interior angle < 180°)
   *   cross < 0  →  right turn →  concave (interior angle > 180°)
   *   cross = 0  →  collinear  →  isStraight
   */
  pointAlignedWithPreviousAndNext: (p: PointXZ, pPrev: PointXZ, pNext: PointXZ): PointXZAlignedResult => {
    const normalizedPrev = getNormal(pPrev, p);
    const normalizedNext = getNormal(p, pNext);
    const dot = normalizedPrev.x * normalizedNext.x + normalizedPrev.z * normalizedNext.z;

    const inDx = p.x - pPrev.x;
    const inDz = p.z - pPrev.z;
    const outDx = pNext.x - p.x;
    const outDz = pNext.z - p.z;
    const cross = inDx * outDz - inDz * outDx;

    return {
      isStraight: dot > COLLINEAR_THRESHOLD,
      isConvex: cross > 0,
      normalizedPrev,
      normalizedNext,
    };
  },

  /**
   * Returns true if the angle at vertex p (between the segments pPrev→p and
   * p→pNext) is a right angle (90° or 270°), within the tolerance defined by
   * RIGHT_ANGLE_THRESHOLD.
   *
   * A right angle produces a dot product of the two edge direction unit vectors
   * of exactly 0. Collinear vertices (dot ≈ 1) and non-right angles both
   * fail this check.
   */
  isRightAngle: (p: PointXZ, pPrev: PointXZ, pNext: PointXZ): boolean => {
    const inDx = p.x - pPrev.x;
    const inDz = p.z - pPrev.z;
    const inLen = Math.sqrt(inDx * inDx + inDz * inDz) || 1;

    const outDx = pNext.x - p.x;
    const outDz = pNext.z - p.z;
    const outLen = Math.sqrt(outDx * outDx + outDz * outDz) || 1;

    const dot = (inDx / inLen) * (outDx / outLen) + (inDz / inLen) * (outDz / outLen);
    return Math.abs(dot) < RIGHT_ANGLE_THRESHOLD;
  },

  getPreviousPoint: (to: number, fromPoints: PointXZ[]): PointXZ =>
    fromPoints[(to - 1 + fromPoints.length) % fromPoints.length],

  getNextPoint: (to: number, fromPoints: PointXZ[]): PointXZ =>
    fromPoints[(to + 1) % fromPoints.length],
};