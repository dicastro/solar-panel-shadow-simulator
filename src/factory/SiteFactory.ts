import { Site } from '../types/installation';
import { Config } from '../types/config';
import { PointXZ, AngleWarning } from '../types/geometry';
import { PointXZUtils } from '../utils/PointXZUtils';
import { PointXZFactory } from './PointXZFactory';
import { WallFactory } from './WallFactory';
import { WallIntersectionFactory } from './WallIntersectionFactory';

/**
 * Result of SiteFactory.create, bundling the Site geometry with any angle
 * validation warnings detected during construction.
 *
 * Returning a result object rather than writing to external state keeps the
 * factory free of side effects — the caller decides what to do with each part.
 */
export interface SiteFactoryResult {
  readonly site: Site;
  /**
   * Each entry describes three consecutive config-space wall points where the
   * angle at the middle point is neither 90° nor 180°. Empty when all angles
   * are valid. Coordinates use the original config system (+X = East, +Z = North)
   * so they match the values the user typed in config.json.
   */
  readonly angleWarnings: readonly AngleWarning[];
}

/**
 * Returns the longitudinal shortening (in metres) to apply at one end of a
 * wall segment at a shared vertex.
 *
 * Shortening is only needed at interior recess vertices (`isConvex = true` in
 * Three.js coordinates, which corresponds to a 270° interior angle). At those
 * vertices the displaced wall bodies would overlap the intersection post volume,
 * so each wall end is shortened by exactly `wallThickness` to eliminate the
 * overlap. Exterior corners and collinear vertices require no adjustment.
 *
 * See the README for the full geometric derivation.
 */
const computeAdjust = (isConvex: boolean, isStraight: boolean, wallThickness: number): number => {
  if (isStraight || !isConvex) return 0;
  return wallThickness;
};

export const SiteFactory = {
  /**
   * Builds the complete Site geometry from a raw configuration.
   *
   * Every vertex is classified once with `pointAlignedWithPreviousAndNext`.
   * The resulting `vertexInfo` array is reused for both angle validation
   * (populating `angleWarnings`) and geometry construction (wall adjustments,
   * intersection posts), avoiding two separate traversals of the same data.
   *
   * Config coordinates use +Z = North. Three.js uses +Z = South, so Z is
   * negated when centering. See the README for more details.
   */
  create: (config: Config): SiteFactoryResult => {
    const { wallPoints, wallDefaults, railingDefaults, wallsSettings, azimuth } = config.site;
    const n = wallPoints.length;

    const centerX = wallPoints.reduce((s, p) => s + p[0], 0) / n;
    const centerZ = wallPoints.reduce((s, p) => s + p[1], 0) / n;

    const boundingRadius = Math.max(...wallPoints.map(p =>
      Math.sqrt((p[0] - centerX) ** 2 + (p[1] - centerZ) ** 2)
    ));

    const centeredPoints: PointXZ[] = wallPoints.map(p =>
      PointXZFactory.create(p[0] - centerX, -(p[1] - centerZ))
    );

    const angleWarnings: AngleWarning[] = [];
    const vertexInfo = centeredPoints.map((p, i) => {
      const pPrev = PointXZUtils.getPreviousPoint(i, centeredPoints);
      const pNext = PointXZUtils.getNextPoint(i, centeredPoints);
      const info = PointXZUtils.pointAlignedWithPreviousAndNext(p, pPrev, pNext);

      if (!info.isStraight && !PointXZUtils.isRightAngle(p, pPrev, pNext)) {
        const prevIdx = (i - 1 + n) % n;
        const nextIdx = (i + 1) % n;
        angleWarnings.push({
          pointPrev: wallPoints[prevIdx],
          point: wallPoints[i],
          pointNext: wallPoints[nextIdx],
        });
      }

      return info;
    });

    const wallIntersections = centeredPoints
      .map((p, i) => {
        const { isStraight } = vertexInfo[i];
        if (isStraight) return null;

        const pPrev = PointXZUtils.getPreviousPoint(i, centeredPoints);
        const pNext = PointXZUtils.getNextPoint(i, centeredPoints);
        const override = wallsSettings?.find(o => o.wall === i);
        const h = override?.override?.height ?? wallDefaults.height;

        return WallIntersectionFactory.create(
          i, p, pPrev, pNext, wallDefaults.thickness, h,
        );
      })
      .filter((wi): wi is NonNullable<typeof wi> => wi !== null);

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