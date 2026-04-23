import { Site } from '../types/installation';
import { Config, RailingConfiguration } from '../types/config';
import { PointXZ, AngleWarning } from '../types/geometry';
import { PointXZUtils } from '../utils/PointXZUtils';
import { PointXZFactory } from './PointXZFactory';
import { WallFactory } from './WallFactory';
import { WallIntersectionFactory } from './WallIntersectionFactory';

/**
 * Result of SiteFactory.create, bundling the Site geometry with any angle
 * validation warnings detected during construction.
 * See README for the rationale behind returning a result object instead
 * of writing to external state.
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
 * Computes the longitudinal shortening for one end of a wall at a shared vertex.
 * See README for a detailed explanation of when and why this adjustment is applied.
 */
const computeAdjust = (isConvex: boolean, isStraight: boolean, wallThickness: number): number => {
  if (isStraight || !isConvex) return 0;
  return wallThickness;
};

export const SiteFactory = {
  /**
   * Builds the complete Site geometry from a raw configuration.
   * Classifies every wall vertex once, reusing the classification for both
   * angle validation and geometry construction to avoid two traversals.
   * See README for the config-space / Three.js-space mapping applied here.
   */
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
    // wall/intersection geometry, avoiding two separate traversals.
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

    // Wall intersections — created only for non-collinear vertices.
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