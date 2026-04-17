import { RailingConfiguration, Wall, WallConfiguration, WallSettingsConfiguration } from "../types";
import { PointXZ } from "../types/geometry";

export const WallFactory = {
    create: (
      index: number,
      p1: PointXZ,
      p2: PointXZ,
      wallDefaults: WallConfiguration,
      railingDefaults: RailingConfiguration,
      wallSettings?: WallSettingsConfiguration
    ): Wall => {
      const trimStart = wallSettings?.trimStart ?? 0;
      const trimEnd = wallSettings?.trimEnd ?? 0;

      const railingOverride = wallSettings?.override?.railing;
  
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const fullDist = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);
      const wallThickness = wallDefaults.thickness;
  
      const currentDist = fullDist - (trimStart * wallThickness) - (trimEnd * wallThickness);
      const offsetFromCenter = (trimStart * wallThickness / 2) - (trimEnd * wallThickness / 2);
      
      const ux = dx / fullDist;
      const uz = dz / fullDist;
      const nx = -uz;
      const nz = ux;

      return {
        index: index,
        p1: p1,
        p2: p2,
        height: wallSettings?.override?.height ?? wallDefaults.height,
        thickness: wallThickness,
        trimStart: trimStart,
        trimEnd: trimEnd,
        railing: {
          active: railingOverride?.active ?? railingDefaults.active,
          heightOffset: railingOverride?.heightOffset ?? railingDefaults.heightOffset,
          thickness: railingOverride?.thickness ?? railingDefaults.thickness,
          shape: railingOverride?.shape ?? railingDefaults.shape
        },
        geometryData: {
          posX: (p1.x + p2.x) / 2 + (nx * wallThickness / 2) + (ux * offsetFromCenter),
          posZ: (p1.z + p2.z) / 2 + (nz * wallThickness / 2) + (uz * offsetFromCenter),
          angle,
          currentDist,
          nx,
          nz
        }
      }
    }
};