import { Site } from '../types/installation';
import { Config, RailingConfiguration } from '../types/config';
import { PointXZ } from '../types/geometry';
import { PointXZUtils } from '../utils/PointXZUtils';
import { PointXZFactory } from './PointXZFactory';
import { WallFactory } from './WallFactory';
import { WallIntersectionFactory } from './WallIntersectionFactory';

/**
 * Computes the auto-trim distance for one end of a wall segment.
 *
 * When two walls meet at a corner, each wall must be shortened so it does not
 * overlap with the intersection post. The correct shortening is:
 *
 *   trim = wallThickness / (2 * tan(θ/2))
 *
 * where θ is the interior angle between the two wall segments at that corner.
 *
 * For a 90° corner this is wallThickness/2 * 1 = wallThickness/2.
 * For obtuse angles (> 90°) the trim is smaller.
 * For acute angles (< 90°) the trim is larger.
 *
 * We clamp to [0, wallLength/4] to avoid degenerate walls for very acute angles.
 *
 * ## Relation to the old manual trimStart/trimEnd
 *
 * Previously, users had to specify trimStart/trimEnd in wallsSettings as
 * multiples of wallThickness (e.g. trimEnd: 0.5 meant shorten by half a
 * thickness). This was error-prone and required knowledge of the geometry.
 * The automatic calculation replaces these with the exact value for any angle.
 *
 * The deprecated trimStart/trimEnd fields in WallSettingsConfiguration are
 * kept for backwards compatibility but are ignored when this auto-calculation
 * is in effect.
 */
const computeAutoTrim = (
  p: PointXZ,
  pAdj: PointXZ,   // the other point of this wall at the end being trimmed
  pOther: PointXZ, // the far point of the adjacent wall
  wallThickness: number,
  wallLength: number,
): number => {
  // Normal of this wall end, pointing outward
  const dx = pAdj.x - p.x;
  const dz = pAdj.z - p.z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  const nx = -dz / d;
  const nz = dx / d;

  // Direction of the adjacent wall leaving this corner
  const ax = pOther.x - p.x;
  const az = pOther.z - p.z;
  const al = Math.sqrt(ax * ax + az * az) || 1;
  const ux = ax / al;
  const uz = az / al;

  // cos(θ/2) where θ = angle between the two wall directions
  // dot(normal_this, unit_adjacent) = sin(angle_between_walls / 2)
  // We need tan(θ/2) = sin(θ/2) / cos(θ/2)
  const sinHalfTheta = Math.abs(nx * ux + nz * uz);
  const cosHalfTheta = Math.sqrt(Math.max(0, 1 - sinHalfTheta * sinHalfTheta));
  const tanHalfTheta = cosHalfTheta > 0.01 ? sinHalfTheta / cosHalfTheta : sinHalfTheta / 0.01;

  const trim = (wallThickness / 2) * tanHalfTheta;

  // Clamp: never trim more than a quarter of the wall length to avoid collapsing short walls
  return Math.min(trim, wallLength / 4);
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

    // ── Resolve railing config per wall ──────────────────────────────────────
    // We need the effective railing config for each wall to pass to both
    // WallIntersectionFactory (for the connect piece) and WallFactory.
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

    // ── Auto-trim per wall end ────────────────────────────────────────────────
    // autoTrims[i] = [trimStart_i, trimEnd_i] in metres (not thickness multiples)
    const autoTrims: [number, number][] = centeredPoints.map((p1, i) => {
      const p0 = PointXZUtils.getPreviousPoint(i, centeredPoints); // end of previous wall
      const p2 = PointXZUtils.getNextPoint(i, centeredPoints);     // start of next wall
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;

      const trimStart = computeAutoTrim(p1, p2, p0, wallDefaults.thickness, len);
      const trimEnd = computeAutoTrim(p2, p1, PointXZUtils.getNextPoint((i + 1) % n, centeredPoints), wallDefaults.thickness, len);

      return [trimStart, trimEnd];
    });

    // ── Wall intersections ────────────────────────────────────────────────────
    const wallIntersections = centeredPoints.map((p, i) => {
      const pPrev = PointXZUtils.getPreviousPoint(i, centeredPoints);
      const pNext = PointXZUtils.getNextPoint(i, centeredPoints);
      const override = wallsSettings?.find(o => o.wall === i);
      const h = override?.override?.height ?? wallDefaults.height;

      // The wall ending at intersection i is wall (i-1+n)%n
      const prevWallIndex = (i - 1 + n) % n;
      const prevRailing = resolveRailing(prevWallIndex);
      const nextRailing = resolveRailing(i);

      return WallIntersectionFactory.create(
        i, p, pPrev, pNext, wallDefaults.thickness, h,
        prevRailing, nextRailing,
      );
    });

    // ── Walls ─────────────────────────────────────────────────────────────────
    const walls = centeredPoints.map((p1, i) => {
      const p2 = PointXZUtils.getNextPoint(i, centeredPoints);
      const wallSettings = wallsSettings?.find(s => s.wall === i);
      const [autoTrimStart, autoTrimEnd] = autoTrims[i];
      const railing = resolveRailing(i);

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