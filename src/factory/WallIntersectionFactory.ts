import { WallIntersection } from "../types/installation";
import { PointXZ } from "../types/geometry";
import { PointXZUtils } from "../utils/PointXZUtils";

const WALL_INTERSECTION_COLOR = '#777';

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

      const offset = isStraight
        ? { // Scenario: point in the middle of line - only offset in the common normal
          x: normalizedNext.x * (wallThickness / 2),
          z: normalizedNext.z * (wallThickness / 2)
        }
        : { // Scenario: corner -> sum both normal
          x: (normalizedPrev.x + normalizedNext.x) * (wallThickness / 2),
          z: (normalizedPrev.z + normalizedNext.z) * (wallThickness / 2)
        };

      return {
          index: index,
          position: p,
          height: height,
          thickness: wallThickness,
          worldPosition: {
            x: p.x + offset.x,
            y: height / 2,
            z: p.z + offset.z
          },
          renderData: {
            boxArgs: [wallThickness, height, wallThickness],
            color: WALL_INTERSECTION_COLOR,
          }
      }
    }
};