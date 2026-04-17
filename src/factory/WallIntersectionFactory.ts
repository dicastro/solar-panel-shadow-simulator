import { WallIntersection } from "../types";
import { PointXZ } from "../types/geometry";
import { PointXZUtils } from "../utils/PointXZUtils";

export const WallIntersectionFactory = {
    create: (
        index: number,
        p: PointXZ,
        pPrev: PointXZ,
        pNext: PointXZ,
        wallThickness: number,
        height: number
      ): WallIntersection => {
        const { isStraight, normalizedPrev, normalizedNext } = PointXZUtils.pointAlignedWithPreviousAndNext(p, pPrev, pNext);
    
        let offset;

        if (isStraight) {
          // case: point in the middle of line. Only offset in the common normal
          offset = {
            x: normalizedNext.x * (wallThickness / 2),
            z: normalizedNext.z * (wallThickness / 2)
          }
        } else {
          // case: corner. Sum both normal
          offset = {
            x: (normalizedPrev.x + normalizedNext.x) * (wallThickness / 2),
            z: (normalizedPrev.z + normalizedNext.z) * (wallThickness / 2)
          }
        }

        return {
            index: index,
            position: p,
            height: height,
            thickness: wallThickness,
            offset: offset
        }
      }
};