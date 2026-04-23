import { PointXZ, PointXZAlignedResult } from "../types/geometry";

/**
 * Utility functions for 2D geometry in the XZ plane.
 *
 * ─── Coordinate convention ───────────────────────────────────────────────────
 * All points here live in Three.js scene space:  +X = East,  +Z = South.
 * Wall perimeters are walked counter-clockwise (CCW) when viewed from above.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── Key concepts used throughout this file ──────────────────────────────────
 *
 * NORMAL TO A SEGMENT
 *   Given a directed segment from A to B with direction vector d = (dx, dz),
 *   its unit normal is a vector perpendicular to d and of length 1.
 *   There are always two perpendicular directions: left and right of d.
 *   For a CCW polygon, the outward normal (pointing away from the interior)
 *   is always to the LEFT of the direction of travel.
 *
 *   If d = (dx, dz) then the left-perpendicular (outward for CCW) is:
 *     n = (-dz, dx)   normalised by dividing by |d|
 *
 *   Example: a wall going East (dx=1, dz=0) has outward normal (0, -1),
 *   pointing North in Three.js space (−Z = North), i.e. away from the floor.
 *
 *   This is used to displace wall bodies and posts outward so they sit on
 *   the outside of the floor perimeter.
 *
 * DOT PRODUCT  (·)
 *   dot(a, b) = a.x*b.x + a.z*b.z
 *
 *   Geometrically: dot(a, b) = |a| * |b| * cos(θ)  where θ is the angle between them.
 *   For unit vectors: dot(a, b) = cos(θ).
 *
 *   Useful values:
 *     dot = +1  → vectors point in the same direction (θ = 0°)
 *     dot =  0  → vectors are perpendicular (θ = 90°)
 *     dot = -1  → vectors point in opposite directions (θ = 180°)
 *
 *   In this file the dot product of the two outward normals of adjacent wall
 *   segments tells us whether they are collinear: dot ≈ +1 means the two
 *   normals point in the same direction, so the segments are parallel (the
 *   vertex is a straight pass-through, not a corner).
 *
 * CROSS PRODUCT (×) in 2D
 *   cross(a, b) = a.x*b.z − a.z*b.x
 *
 *   The 2D cross product is the Z component of the 3D cross product, and its
 *   sign encodes the rotation direction from a to b:
 *     cross > 0  → b is to the LEFT of a  (counter-clockwise rotation)
 *     cross < 0  → b is to the RIGHT of a (clockwise rotation)
 *     cross = 0  → a and b are parallel (collinear)
 *
 *   For a CCW-walked polygon, the cross product of the incoming and outgoing
 *   edge directions at a vertex determines the turn type:
 *     cross > 0  → left turn  → convex vertex in CCW-polygon space
 *     cross < 0  → right turn → concave vertex in CCW-polygon space
 *
 *   IMPORTANT — Three.js Z inversion:
 *   Config space uses +Z = North (CCW walk). Three.js uses +Z = South, so
 *   negating Z flips the walk to CW in Three.js coordinates. This inverts
 *   the sign of every cross product, and therefore inverts the meaning of
 *   isConvex: a vertex with isConvex = true in this function corresponds to
 *   an interior recess (concave in real-world terms) when coordinates have
 *   been converted to Three.js space. Callers that use isConvex to drive
 *   geometry decisions must account for this inversion.
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
   * Unit outward normal of the directed segment from pA to pB.
   *
   * "Outward" means to the LEFT of the direction of travel, which is away from
   * the floor interior for a CCW-walked perimeter.
   *
   * The formula derives from rotating the unit direction vector 90° CCW:
   *   direction = (dx, dz) / |d|
   *   left-perpendicular = (-dz, dx) / |d|
   *
   * The result is always a unit vector (length 1). If pA === pB (zero-length
   * segment), returns (0, 0) — callers should avoid degenerate segments.
   *
   * Example: segment going East (dx=1, dz=0) → normal = (0, 1) pointing South
   * in Three.js space. For a wall on the south side of a CCW floor, South is
   * indeed outward (away from the floor).
   */
  computeLeftHandNormal: (pA: PointXZ, pB: PointXZ): PointXZ => {
    const dx = pB.x - pA.x;
    const dz = pB.z - pA.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    return { x: -dz / d, z: dx / d };
  },

  /**
   * Analyses a vertex p against its two neighbours to determine:
   * - whether the three points are collinear (isStraight)
   * - whether the cross product of the incoming and outgoing edges is positive
   *   (isConvex). See the module-level note on the Three.js Z inversion: in
   *   Three.js coordinates, isConvex = true corresponds to an interior recess
   *   (right turn in physical/real-world terms).
   * - the unit outward normals of the incoming and outgoing wall segments,
   *   used by callers to compute post corner offsets.
   *
   * The dot product of the two outward normals detects collinearity: if both
   * normals point in the same direction (dot ≈ 1) the two segments are
   * parallel and the vertex is a straight pass-through.
   *
   * The cross product of the incoming and outgoing edge direction vectors
   * determines the turn direction, which callers use to classify the vertex
   * as a geometry adjustment point or not.
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
   * Returns true if the angle at vertex p (between the segments pPrev→p and
   * p→pNext) is a right angle (90° or 270°), within the tolerance defined by
   * RIGHT_ANGLE_THRESHOLD.
   *
   * A right angle produces a dot product of the two edge direction unit vectors
   * of exactly 0. The dot product measures the cosine of the angle between the
   * two edge directions: cos(90°) = 0. Collinear vertices (dot ≈ 1) and
   * non-right angles both fail this check.
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
