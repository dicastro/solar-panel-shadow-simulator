import { WallIntersection, RailingRailRenderData } from '../types/installation';
import { PointXZ } from '../types/geometry';
import { RailingConfiguration, RailingShape } from '../types/config';
import { PointXZUtils } from '../utils/PointXZUtils';
import { RailingUtils } from '../utils/RailingUtils';

const WALL_INTERSECTION_COLOR = '#777';

const DEFAULT_RAILING_SHAPE: RailingShape = { kind: 'cylinder', radius: 0.025 };

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

/**
 * Builds the small railing connect piece that bridges the gap at a wall corner.
 *
 * At a 90° corner the gap between the ends of the two adjacent railing rails
 * is a square of side ≈ wallThickness. The connect piece spans this gap;
 * its length equals wallThickness for a right-angle corner.
 */
const buildRailingConnect = (
  shape: RailingShape,
  wallHeight: number,
  heightOffset: number,
  wallThickness: number,
): RailingRailRenderData =>
  RailingUtils.buildRailRenderData(shape, wallHeight, heightOffset, wallThickness);

export const WallIntersectionFactory = {
  /**
   * Creates a wall intersection post for a non-collinear vertex.
   *
   * Only call this for vertices where isStraight = false. Collinear vertices
   * do not produce intersection posts and are filtered out in SiteFactory.
   *
   * The railingConnect piece is built only when both adjacent walls have active
   * railings with autoConnect enabled. It uses the shape of the incoming wall's
   * railing. See README for the autoConnect behaviour.
   *
   * @param prevRailing  Effective railing config of the wall ending at this vertex.
   * @param nextRailing  Effective railing config of the wall starting at this vertex.
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
    const normalPrev = PointXZUtils.computeLeftHandNormal(pPrev, p);
    const normalNext = PointXZUtils.computeLeftHandNormal(p, pNext);

    const offset = computeCornerOffset(normalPrev, normalNext, wallThickness);

    let railingConnect: RailingRailRenderData | null = null;

    const prevActive = prevRailing?.active ?? false;
    const nextActive = nextRailing?.active ?? false;
    const prevConnect = prevRailing?.autoConnect ?? true;
    const nextConnect = nextRailing?.autoConnect ?? true;

    if (prevActive && nextActive && prevConnect && nextConnect) {
      const shape = prevRailing!.shape ?? DEFAULT_RAILING_SHAPE;
      const heightOffset = prevRailing!.heightOffset;
      railingConnect = buildRailingConnect(shape, height, heightOffset, wallThickness);
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