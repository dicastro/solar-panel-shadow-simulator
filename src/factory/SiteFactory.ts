import { Site } from '../types/installation';
import { Config, RailingConfiguration } from '../types/config';
import { PointXZ } from '../types/geometry';
import { PointXZUtils } from '../utils/PointXZUtils';
import { PointXZFactory } from './PointXZFactory';
import { WallFactory } from './WallFactory';
import { WallIntersectionFactory } from './WallIntersectionFactory';

/**
 * Result of SiteFactory.create, bundling the Site geometry with any angle
 * validation warnings detected during construction.
 */
export interface SiteFactoryResult {
  readonly site: Site;
  /**
   * Indices of wall points (in config space, 0-based) where the angle between
   * adjacent wall segments is not 90°. Empty when all angles are valid.
   * Collinear points are not included — they are valid by design.
   */
  readonly angleWarnings: number[];
}

/**
 * Computes the longitudinal shortening for one end of a wall at a shared vertex.
 *
 * In Three.js coordinates (where Z is negated relative to config space), the
 * cross product used by pointAlignedWithPreviousAndNext returns isConvex = true
 * for vertices that are interior recesses in real-world terms. These are the
 * vertices where the wall body, displaced outward by thickness/2, would overlap
 * the intersection post volume. The wall must be shortened by exactly
 * wallThickness at that end to prevent the overlap.
 *
 * Collinear vertices (isStraight = true) have no intersection post and need
 * no adjustment. Exterior corner vertices (isConvex = false in Three.js space)
 * also need no adjustment — the displaced wall centre-lines meet the post
 * naturally at those corners.
 */
const computeAdjust = (isConvex: boolean, isStraight: boolean, wallThickness: number): number => {
  if (isStraight || !isConvex) return 0;
  return wallThickness;
};

export const SiteFactory = {
  create: (config: Config): SiteFactoryResult => {
    const { wallPoints, wallDefaults, railingDefaults, wallsSettings, azimuth } = config.site;
    const n = wallPoints.length;

    const centerX = wallPoints.reduce((s, p) => s + p[0], 0) / n;
    const centerZ = wallPoints.reduce((s, p) => s + p[1], 0) / n;

    const boundingRadius = Math.max(...wallPoints.map(p =>
      Math.sqrt((p[0] - centerX) ** 2 + (p[1] - centerZ) ** 2)
    ));

    // Config: +Z = North. Three.js: +Z = South. Negate Z when centering.
    const centeredPoints: PointXZ[] = wallPoints.map(p =>
      PointXZFactory.create(p[0] - centerX, -(p[1] - centerZ))
    );

    const resolveRailing = (wallIndex: number): RailingConfiguration => {
      const override = wallsSettings?.find(s => s.wall === wallIndex)?.override?.railing;
      return {
        active: override?.active ?? railingDefaults.active,
        heightOffset: override?.heightOffset ?? railingDefaults.heightOffset,
        shape: override?.shape ?? railingDefaults.shape,
        support: override?.support ?? railingDefaults.support,
        autoConnect: override?.autoConnect ?? railingDefaults.autoConnect ?? true,
      };
    };

    // Classify every vertex once. Results feed both angle validation and
    // wall/intersection geometry — avoiding two separate traversals.
    const angleWarnings: number[] = [];
    const vertexInfo = centeredPoints.map((p, i) => {
      const pPrev = PointXZUtils.getPreviousPoint(i, centeredPoints);
      const pNext = PointXZUtils.getNextPoint(i, centeredPoints);
      const info = PointXZUtils.pointAlignedWithPreviousAndNext(p, pPrev, pNext);

      if (!info.isStraight && !PointXZUtils.isRightAngle(p, pPrev, pNext)) {
        angleWarnings.push(i);
      }

      return info;
    });

    // Wall intersections — created only for non-collinear vertices.
    // The floor is a flat plane; collinear intermediate vertices carry no
    // geometric information for the floor outline and are omitted.
    const wallIntersections = centeredPoints
      .map((p, i) => {
        const { isStraight } = vertexInfo[i];
        if (isStraight) return null;

        const pPrev = PointXZUtils.getPreviousPoint(i, centeredPoints);
        const pNext = PointXZUtils.getNextPoint(i, centeredPoints);
        const override = wallsSettings?.find(o => o.wall === i);
        const h = override?.override?.height ?? wallDefaults.height;

        const prevWallIndex = (i - 1 + n) % n;
        const prevRailing = resolveRailing(prevWallIndex);
        const nextRailing = resolveRailing(i);

        return WallIntersectionFactory.create(
          i, p, pPrev, pNext, wallDefaults.thickness, h,
          prevRailing, nextRailing,
        );
      })
      .filter((wi): wi is NonNullable<typeof wi> => wi !== null);

    // Wall segments — each wall may be shortened at one or both ends when its
    // endpoint vertex requires a geometric adjustment. See computeAdjust.
    const walls = centeredPoints.map((p1, i) => {
      const p2 = PointXZUtils.getNextPoint(i, centeredPoints);
      const wallSettings = wallsSettings?.find(s => s.wall === i);

      const { isStraight: p1Straight, isConvex: p1Convex } = vertexInfo[i];
      const nextIndex = (i + 1) % n;
      const { isStraight: p2Straight, isConvex: p2Convex } = vertexInfo[nextIndex];

      const adjustStart = computeAdjust(p1Convex, p1Straight, wallDefaults.thickness);
      const adjustEnd = computeAdjust(p2Convex, p2Straight, wallDefaults.thickness);

      return WallFactory.create(
        i, p1, p2,
        wallDefaults, railingDefaults,
        wallSettings,
        adjustStart, adjustEnd,
      );
    });

    const site: Site = {
      location: config.site.location,
      azimuthRad: (azimuth * Math.PI) / 180,
      centerX,
      centerZ,
      boundingRadius,
      walls,
      wallIntersections,
    };

    return { site, angleWarnings };
  },
};
