import { PointXZ, PointXZAlignedResult } from "../types/geometry";

const getNormal = (pA: PointXZ, pB: PointXZ): PointXZ => {
  const dx = pB.x - pA.x;
  const dz = pB.z - pA.z;
  
  const d = Math.sqrt(dx * dx + dz * dz) || 1;

  return { x: -dz / d, z: dx / d };
};

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

    // Incoming edge direction (from pPrev to p)
    const inDx = p.x - pPrev.x;
    const inDz = p.z - pPrev.z;
    // Outgoing edge direction (from p to pNext)
    const outDx = pNext.x - p.x;
    const outDz = pNext.z - p.z;
    // 2D cross product: positive = left turn (convex for CCW polygon)
    const cross = inDx * outDz - inDz * outDx;

    return {
      isStraight: dot > 0.999,
      isConvex: cross > 0,
      normalizedPrev,
      normalizedNext,
    };
  },

  getPreviousPoint: (to: number, fromPoints: PointXZ[]): PointXZ => fromPoints[(to - 1 + fromPoints.length) % fromPoints.length],
    
  getNextPoint: (to:number, fromPoints: PointXZ[]): PointXZ => fromPoints[(to + 1) % fromPoints.length]
}