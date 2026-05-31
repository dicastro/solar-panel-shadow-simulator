import { Site } from '../types/installation';
import { Config } from '../types/config';
import { PointXZ } from '../types/geometry';
import { PointXZUtils } from '../utils/PointXZUtils';
import { PointXZFactory } from './PointXZFactory';
import { WallFactory } from './WallFactory';
import { WallIntersectionFactory } from './WallIntersectionFactory';

const DEFAULT_GROUND_ALBEDO = 0.20;
const DEFAULT_INVERTER_EFFICIENCY = 0.97;
const DEFAULT_WIRING_LOSS = 0.02;

const computeAdjust = (isConvex: boolean, isStraight: boolean, wallThickness: number): number => {
  if (isStraight || !isConvex) return 0;
  return wallThickness;
};

export const SiteFactory = {
  /**
   * Builds the complete Site geometry from a raw configuration.
   *
   * Azimuth convention: in config space, 0 = South, positive = East, negative = West.
   * azimuthRad is stored as the raw radian value (not negated). Scene.tsx applies
   * -site.azimuthRad as the Three.js rotation-y, because Three.js rotation-y positive
   * means anticlockwise from above (West), which is the opposite of the config convention.
   *
   * The South-West corner (minimum X and minimum Z across all wall points) is stored as
   * swCornerX / swCornerZ. Panel array positions are measured from this corner, matching
   * how an installer measures on-site from the most accessible terrace corner.
   *
   * Config coordinates use +Z = North. Three.js uses +Z = South, so Z is negated when
   * converting wall points to centred Three.js coordinates.
   *
   * System-level loss parameters (groundAlbedo, inverterEfficiency, wiringLoss) default
   * to industry-standard values when omitted from the configuration.
   */
  create: (config: Config): Site => {
    const { wallPoints, wallDefaults, railingDefaults, wallsSettings, azimuth } = config.site;
    const n = wallPoints.length;

    const centerX = wallPoints.reduce((s, p) => s + p[0], 0) / n;
    const centerZ = wallPoints.reduce((s, p) => s + p[1], 0) / n;

    const swCornerX = Math.min(...wallPoints.map(p => p[0]));
    const swCornerZ = Math.min(...wallPoints.map(p => p[1]));

    const boundingRadius = Math.max(...wallPoints.map(p =>
      Math.sqrt((p[0] - centerX) ** 2 + (p[1] - centerZ) ** 2)
    ));

    const centeredPoints: PointXZ[] = wallPoints.map(p =>
      PointXZFactory.create(p[0] - centerX, -(p[1] - centerZ))
    );

    const vertexInfo = centeredPoints.map((p, i) => {
      const pPrev = PointXZUtils.getPreviousPoint(i, centeredPoints);
      const pNext = PointXZUtils.getNextPoint(i, centeredPoints);
      return PointXZUtils.pointAlignedWithPreviousAndNext(p, pPrev, pNext);
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

    return {
      location: config.site.location,
      azimuthRad: (azimuth * Math.PI) / 180,
      centerX,
      centerZ,
      swCornerX,
      swCornerZ,
      boundingRadius,
      walls,
      wallIntersections,
      groundAlbedo: config.site.groundAlbedo ?? DEFAULT_GROUND_ALBEDO,
      inverterEfficiency: config.site.inverterEfficiency ?? DEFAULT_INVERTER_EFFICIENCY,
      wiringLoss: config.site.wiringLoss ?? DEFAULT_WIRING_LOSS,
    };
  },
};