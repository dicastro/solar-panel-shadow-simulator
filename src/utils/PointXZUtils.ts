import { PointXZ, PointXZAlignedResult } from "../types/geometry";

const getNormal = (pA: PointXZ, pB: PointXZ): PointXZ => {
  const dx = pB.x - pA.x;
  const dz = pB.z - pA.z;
  
  const d = Math.sqrt(dx * dx + dz * dz) || 1;

  return { x: -dz / d, z: dx / d };
};

export const PointXZUtils = {
  pointAlignedWithPreviousAndNext: (p: PointXZ, pPrev: PointXZ, pNext: PointXZ): PointXZAlignedResult => {
    const normalizedPrev = getNormal(pPrev, p);
    const normalizedNext = getNormal(p, pNext);
    const dot = normalizedPrev.x * normalizedNext.x + normalizedPrev.z * normalizedNext.z;
    
    return  {
      isStraight: dot > 0.999,
      normalizedPrev: normalizedPrev,
      normalizedNext: normalizedNext
    }
  },
  getPreviousPoint: (to: number, fromPoints: PointXZ[]): PointXZ => fromPoints[(to - 1 + fromPoints.length) % fromPoints.length],
    
  getNextPoint: (to:number, fromPoints: PointXZ[]): PointXZ => fromPoints[(to - 1 + fromPoints.length) % fromPoints.length]
}