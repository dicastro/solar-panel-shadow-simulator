import { Config, SolarInstallation } from "../types";
import { PointXZUtils } from "../utils/PointXZUtils";
import { PointXZFactory } from "./PointXZFactory";
import { WallFactory } from "./WallFactory";
import { WallIntersectionFactory } from "./WallIntersectionFactory";

export const SolarInstallationFactory = {
  create: (config: Config): SolarInstallation => {
    const { wallPoints, wallDefaults, railingDefaults, wallSettings } = config.installation;

    const centerX = wallPoints.reduce((sum, p) => sum + p.x, 0) / wallPoints.length;
    const centerZ = wallPoints.reduce((sum, p) => sum + p.z, 0) / wallPoints.length;

    console.log(`Wall Points: ${JSON.stringify(wallPoints)}`);

    const centeredPoints = wallPoints.map(p => PointXZFactory.createCentered(p.x, p.z, centerX, centerZ));

    console.log(`Wall Points (centered): ${JSON.stringify(wallPoints)}`);

    const wallIntersections = centeredPoints.map((p, i) => {
      const pPrev = PointXZUtils.getPreviousPoint(i, centeredPoints);
      const pNext = PointXZUtils.getNextPoint(i, centeredPoints);
      const override = wallSettings?.find(o => o.wall === i);
      const h = override?.override?.height ?? wallDefaults.height;
      
      console.log(`Creating Wall Intersection for point: ${JSON.stringify(p)}`);

      return WallIntersectionFactory.create(i, p, pPrev, pNext, wallDefaults.thickness, h);
    });

    console.log(`Wall Intersections: ${JSON.stringify(wallIntersections)}`);

    const walls = centeredPoints.map((p1, i) => {
      const p2 = PointXZUtils.getNextPoint(i, centeredPoints);
      const override = wallSettings?.find(o => o.wall === i);

      return WallFactory.create(i, p1, p2, wallDefaults, railingDefaults, override);
    });

    console.log(`Walls: ${JSON.stringify(walls)}`);

    return {
      location: config.installation.location,
      azimut: config.installation.azimut,
      walls: walls,
      wallIntersections: wallIntersections,
      centerX: centerX,
      centerZ: centerZ,
      panels: config.panels
    }
  }
};