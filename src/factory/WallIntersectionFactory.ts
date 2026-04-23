import { WallIntersection, RailingRailRenderData } from '../types/installation';
import { PointXZ } from '../types/geometry';
import { RailingConfiguration, RailingShape } from '../types/config';
import { PointXZUtils } from '../utils/PointXZUtils';

const WALL_INTERSECTION_COLOR = '#777';
const RAILING_COLOR = '#333';
const CYLINDER_SEGMENTS = 8;
const HALF_CYLINDER_SEGMENTS = 8;

/**
 * Computes the world-space offset from the floor vertex to the centre of the
 * intersection post for a right-angle corner.
 *
 * Walls are displaced thickness/2 outward (away from the floor) along their
 * perpendicular normal. At a 90° corner the post must sit at the intersection
 * of the two displaced wall centre-lines. For perpendicular walls this point
 * is exactly thickness/2 away from the floor vertex along each of the two
 * wall directions, i.e. the post centre is at:
 *
 *   offset = (normalPrev + normalNext) * thickness/2
 *
 * where normalPrev and normalNext are the unit outward normals of the incoming
 * and outgoing wall segments respectively (see computeLeftHandNormal).
 *
 * For exterior corners the normals point away from the floor and the post
 * sits outside. For interior recesses the normals point inward toward the
 * recess and the post sits inside it — still correctly bordering the floor
 * without occupying it.
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
 * Builds the small railing segment that bridges the gap at a wall corner.
 *
 * At a 90° corner the gap between the ends of the two adjacent railing rails
 * is a square of side ≈ wallThickness. The connect piece spans this gap along
 * the bisector direction. Its length equals wallThickness for a right-angle
 * corner.
 *
 * For CylinderGeometry the constructor signature is:
 *   (radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength)
 * Half-cylinder uses openEnded=true and thetaLength=π. thetaStart selects which half:
 *   orientation 'up'   → thetaStart = 0   (flat face pointing down)
 *   orientation 'down' → thetaStart = π   (flat face pointing up)
 */
const buildRailingConnect = (
  shape: RailingShape,
  wallHeight: number,
  heightOffset: number,
  wallThickness: number,
): RailingRailRenderData => {
  const localPosition: [number, number, number] = [0, wallHeight + heightOffset, 0];
  const cylinderRotation: [number, number, number] = [Math.PI / 2, 0, 0];
  const noRotation: [number, number, number] = [0, 0, 0];
  const connectLength = wallThickness;

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
   * Creates a wall intersection post for a non-collinear vertex.
   *
   * This factory must only be called for vertices that are not collinear
   * (isStraight = false). Collinear vertices do not produce intersection posts
   * and should be filtered out in SiteFactory before reaching here.
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
      const shape = prevRailing!.shape ?? { kind: 'cylinder' as const, radius: 0.025 };
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
