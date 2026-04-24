import { WallIntersection } from '../types/installation';
import { PointXZ } from '../types/geometry';
import { PointXZUtils } from '../utils/PointXZUtils';

const WALL_INTERSECTION_COLOR = '#777';

/**
 * Computes the world-space offset from the floor vertex to the centre of the
 * intersection post.
 *
 * At a 90° corner, walls are displaced thickness/2 outward along their
 * perpendicular normal. The post centre sits at the intersection of the two
 * displaced wall centre-lines, which for perpendicular walls equals
 * `(normalPrev + normalNext) × thickness/2`. See README for the derivation.
 */
const computeCornerOffset = (
  normalPrev: PointXZ,
  normalNext: PointXZ,
  wallThickness: number,
): PointXZ => ({
  x: (normalPrev.x + normalNext.x) * (wallThickness / 2),
  z: (normalPrev.z + normalNext.z) * (wallThickness / 2),
});

export const WallIntersectionFactory = {
  /**
   * Creates a wall intersection post for a non-collinear vertex.
   *
   * Only call this for vertices where isStraight = false. Collinear vertices
   * do not produce intersection posts and are filtered out in SiteFactory.
   */
  create: (
    index: number,
    p: PointXZ,
    pPrev: PointXZ,
    pNext: PointXZ,
    wallThickness: number,
    height: number,
  ): WallIntersection => {
    const normalPrev = PointXZUtils.computeLeftHandNormal(pPrev, p);
    const normalNext = PointXZUtils.computeLeftHandNormal(p, pNext);

    const offset = computeCornerOffset(normalPrev, normalNext, wallThickness);

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
    };
  },
};