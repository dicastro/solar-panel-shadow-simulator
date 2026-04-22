import { Site, Wall } from '../types/installation';
import { Config, RailingConfiguration } from '../types/config';
import { PointXZ } from '../types/geometry';
import { PointXZUtils } from '../utils/PointXZUtils';
import { PointXZFactory } from './PointXZFactory';
import { WallFactory } from './WallFactory';
import { WallIntersectionFactory } from './WallIntersectionFactory';

/**
 * Computes the trim distance for one end of a wall segment at a shared vertex.
 *
 * "Trim" is the amount by which a wall is shortened (positive) or extended
 * (negative) at a given end so that it meets the adjacent wall cleanly without
 * overlap or gap.
 *
 * ## Derivation
 *
 * At the shared vertex, the two wall segments have an interior angle θ between
 * their centre-lines. The wall bodies have finite thickness t. Each wall must
 * be adjusted by:
 *
 *   trim = (t / 2) / tan(θ / 2)
 *
 * where θ is the angle between the two wall directions at the vertex
 * (dot product of their unit direction vectors).
 *
 * - Convex vertex (θ < 180°, exterior corner): tan(θ/2) > 0 → positive trim
 *   (shorten the wall so it does not overlap the intersection post).
 * - Concave vertex (θ > 180°, interior corner): tan(θ/2) < 0 → negative trim
 *   (extend the wall beyond the vertex to fill the interior corner gap).
 * - Collinear (θ = 180°): tan(90°) → ∞, trim → 0 (no adjustment needed).
 *
 * ## Parameters
 *
 * @param p       The shared vertex being trimmed toward.
 * @param pAway   The far end of the wall being trimmed (defines wall direction).
 * @param pOther  The far end of the adjacent wall at p (defines adjacent direction).
 */
const computeAutoTrim = (
  p: PointXZ,
  pAway: PointXZ,
  pOther: PointXZ,
  wallThickness: number,
  wallLength: number,
): number => {
  // Unit direction of this wall, pointing away from p
  const dx = pAway.x - p.x;
  const dz = pAway.z - p.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  const ux = dx / d;
  const uz = dz / d;

  // Unit direction of the adjacent wall, pointing away from p
  const ax = pOther.x - p.x;
  const az = pOther.z - p.z;
  const al = Math.sqrt(ax * ax + az * az) || 1;
  const vx = ax / al;
  const vz = az / al;

  // cos(θ) where θ is the angle between the two wall directions at p
  const cosTheta = ux * vx + uz * vz;

  // sin(θ/2) and cos(θ/2) from the half-angle identities
  const sinHalf = Math.sqrt(Math.max(0, (1 - cosTheta) / 2));
  const cosHalf = Math.sqrt(Math.max(0, (1 + cosTheta) / 2));

  // tan(θ/2) = sinHalf / cosHalf. When cosHalf ≈ 0 (θ ≈ 180°, collinear),
  // trim → 0, which is correct: parallel walls need no adjustment.
  // Clamp denominator to avoid division by zero.
  if (cosHalf < 0.01) return 0;

  // 2D cross product to determine the sign of the turn at p.
  // For a counter-clockwise polygon:
  //   cross > 0 → left turn  → convex  → positive trim (shorten)
  //   cross < 0 → right turn → concave → negative trim (extend)
  const cross = ux * vz - uz * vx;
  const sign = cross >= 0 ? 1 : -1;

  const trim = sign * (wallThickness / 2) * (sinHalf / cosHalf);

  // For convex corners, cap the trim at a quarter of the wall length to
  // prevent degenerate walls for very acute angles. For concave corners,
  // no cap: the extension is always geometrically necessary.
  return trim > 0 ? Math.min(trim, wallLength / 4) : trim;
};

export const SiteFactory = {
  create: (config: Config): Site => {
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

    // Auto-trim per wall end: [trimStart, trimEnd] in metres.
    // trimStart is applied at the p1 end; trimEnd at the p2 end.
    // Positive = shorten; negative = extend (for concave corners).
    const autoTrims: [number, number][] = centeredPoints.map((p1, i) => {
      const p0 = PointXZUtils.getPreviousPoint(i, centeredPoints);
      const p2 = PointXZUtils.getNextPoint(i, centeredPoints);
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;

      // trimStart: trim the p1 end toward the intersection with the previous wall.
      // pOther = p0 (the far end of the previous wall, which defines its direction).
      const trimStart = computeAutoTrim(p1, p2, p0, wallDefaults.thickness, len);

      // trimEnd: trim the p2 end toward the intersection with the next wall.
      // pOther = getNextPoint for the wall that starts at p2, i.e. p3.
      const p3 = PointXZUtils.getNextPoint((i + 1) % n, centeredPoints);
      const trimEnd = computeAutoTrim(p2, p1, p3, wallDefaults.thickness, len);

      //return [trimStart, trimEnd];
      return [0, 0];
    });

    // Wall intersections (corner posts)
    const wallIntersections = centeredPoints.map((p, i) => {
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
    });

    // Wall segments
    const walls = centeredPoints.map((p1, i) => {
      const p2 = PointXZUtils.getNextPoint(i, centeredPoints);
      const wallSettings = wallsSettings?.find(s => s.wall === i);
      const [autoTrimStart, autoTrimEnd] = autoTrims[i];

      return WallFactory.create(
        i, p1, p2,
        wallDefaults, railingDefaults,
        wallSettings,
        autoTrimStart, autoTrimEnd,
      );
    });

    return {
      location: config.site.location,
      azimuthRad: (azimuth * Math.PI) / 180,
      centerX,
      centerZ,
      boundingRadius,
      walls,
      wallIntersections,
    };
  },
};