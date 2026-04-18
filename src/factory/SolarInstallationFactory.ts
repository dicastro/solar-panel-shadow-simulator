import { Config, SolarInstallation } from "../types";
import { PointXZUtils } from "../utils/PointXZUtils";
import { PointXZFactory } from "./PointXZFactory";
import { WallFactory } from "./WallFactory";
import { WallIntersectionFactory } from "./WallIntersectionFactory";

export const SolarInstallationFactory = {
  create: (config: Config): SolarInstallation => {
    const { wallPoints, wallDefaults, railingDefaults, wallsSettings } = config.installation;

    const centerX = wallPoints.reduce((sum, p) => sum + p[0], 0) / wallPoints.length;
    const centerZ = wallPoints.reduce((sum, p) => sum + p[1], 0) / wallPoints.length;

    const centeredPoints = wallPoints.map(p => PointXZFactory.createCentered(p[0], p[1], centerX, centerZ));

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