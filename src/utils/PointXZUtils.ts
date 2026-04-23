import { PointXZ, PointXZAlignedResult } from "../types/geometry";

/**
 * 2D geometry utilities for points in the XZ plane (Three.js scene coordinates:
 * +X = East, +Z = South). All points are assumed to be part of a polygon walked
 * counter-clockwise when viewed from above.
 *
 * See README for the mathematical background, worked examples, and ASCII diagrams.
 */

const COLLINEAR_THRESHOLD = 0.999;
const RIGHT_ANGLE_THRESHOLD = 0.001;

export const PointXZUtils = {
  /**
   * Returns the unit outward normal of the directed segment from pA to pB.
   *
   * "Outward" means to the left of the direction of travel, which points away
   * from the floor interior for a CCW-walked polygon perimeter.
   *
   * Formula: direction d = (dx, dz) / |d|, left-perpendicular = (-dz, dx) / |d|.
   * Returns (0, 0) for a zero-length segment.
   */
  computeLeftHandNormal: (pA: PointXZ, pB: PointXZ): PointXZ => {
    const dx = pB.x - pA.x;
    const dz = pB.z - pA.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    return { x: -dz / d, z: dx / d };
  },

  /**
   * Classifies the vertex p against its two neighbours pPrev and pNext.
   *
   * - isStraight: the three points are collinear (dot product of the two outward
   *   normals ≈ +1).
   * - isConvex: the cross product of the incoming and outgoing edge directions is
   *   positive. Due to the Three.js Z inversion relative to config space, this
   *   corresponds to an interior recess in real-world terms. See README.
   * - normalizedPrev / normalizedNext: unit outward normals of the two adjacent
   *   segments, used by callers to compute post offsets.
   */
  pointAlignedWithPreviousAndNext: (p: PointXZ, pPrev: PointXZ, pNext: PointXZ): PointXZAlignedResult => {
    const normalizedPrev = PointXZUtils.computeLeftHandNormal(pPrev, p);
    const normalizedNext = PointXZUtils.computeLeftHandNormal(p, pNext);
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
   * Returns true when the angle at p (between pPrev→p and p→pNext) is a right
   * angle (90° or 270°), within the tolerance defined by RIGHT_ANGLE_THRESHOLD.
   *
   * A right angle produces a dot product of the two edge direction unit vectors
   * of exactly 0 (cos 90° = 0).
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