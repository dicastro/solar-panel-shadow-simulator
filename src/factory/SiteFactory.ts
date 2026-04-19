import { Site } from '../types/installation';
import { Config } from '../types/config';
import { PointXZUtils } from '../utils/PointXZUtils';
import { PointXZFactory } from './PointXZFactory';
import { WallFactory } from './WallFactory';
import { WallIntersectionFactory } from './WallIntersectionFactory';

export const SiteFactory = {
  create: (config: Config): Site => {
    const { wallPoints, wallDefaults, railingDefaults, wallsSettings, azimuth } = config.site;

    const centerX = wallPoints.reduce((sum, p) => sum + p[0], 0) / wallPoints.length;
    const centerZ = wallPoints.reduce((sum, p) => sum + p[1], 0) / wallPoints.length;

    // Bounding radius: max distance from center to any wall point
    const boundingRadius = Math.max(...wallPoints.map(p =>
      Math.sqrt(Math.pow(p[0] - centerX, 2) + Math.pow(p[1] - centerZ, 2))
    ));

    // Config uses +Z = North.  Three.js uses +Z = South, so we negate Z when
    // centering. The resulting centeredPoints are in Three.js space and can be
    // passed directly to wall / intersection factories.
    const centeredPoints = wallPoints.map(p =>
      PointXZFactory.create(p[0] - centerX, -(p[1] - centerZ))
    );

    const wallIntersections = centeredPoints.map((p, i) => {
      const pPrev = PointXZUtils.getPreviousPoint(i, centeredPoints);
      const pNext = PointXZUtils.getNextPoint(i, centeredPoints);
      const override = wallsSettings?.find(o => o.wall === i);
      const h = override?.override?.height ?? wallDefaults.height;

      return WallIntersectionFactory.create(i, p, pPrev, pNext, wallDefaults.thickness, h);
    });

    const walls = centeredPoints.map((p1, i) => {
      const p2 = PointXZUtils.getNextPoint(i, centeredPoints);
      const wallSettings = wallsSettings?.find(s => s.wall === i);

      return WallFactory.create(i, p1, p2, wallDefaults, railingDefaults, wallSettings);
    });

    // South = 0, positive = West.  SunCalc uses the same convention so no
    // additional transformation is needed beyond degrees → radians.
    const azimuthRad = (azimuth * Math.PI) / 180;

    return {
      location: config.site.location,
      azimuthRad,
      timezone: config.site.timezone,
      centerX,
      centerZ,
      boundingRadius,
      walls,
      wallIntersections,
    };
  },
};