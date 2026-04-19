import { Wall, WallRailing } from '../types/installation';
import { PointXZ } from "../types/geometry";
import { RailingConfiguration, WallConfiguration, WallSettingsConfiguration } from "../types/config";

const WALL_COLOR = '#777';
const RAILING_COLOR = '#333';

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

      const wallHeight = wallSettings?.override?.height ?? wallDefaults.height;
      const railingOverride = wallSettings?.override?.railing;
      const wallThickness = wallDefaults.thickness;

      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const fullDist = Math.sqrt(dx * dx + dz * dz);
      const yAngle = Math.atan2(dx, dz);
      
      const currentDist = fullDist - (trimStart * wallThickness) - (trimEnd * wallThickness);
      const offsetFromCenter = (trimStart * wallThickness / 2) - (trimEnd * wallThickness / 2);
      
      const ux = dx / fullDist;
      const uz = dz / fullDist;
      const nx = -uz;
      const nz = ux;

      const groupX = (p1.x + p2.x) / 2 + (nx * wallThickness / 2) + (ux * offsetFromCenter);
      const groupZ = (p1.z + p2.z) / 2 + (nz * wallThickness / 2) + (uz * offsetFromCenter);

      const isRailingActive = railingOverride?.active ?? railingDefaults.active;
      let railing: WallRailing | null = null;

      if (isRailingActive) {
        const railingHeightOffset = railingOverride?.heightOffset ?? railingDefaults.heightOffset;
        const railingShape = railingOverride?.shape ?? railingDefaults.shape;
        const railingThickness = railingOverride?.thickness ?? railingDefaults.thickness;

        railing = {
          shape: railingShape,
          thickness: railingThickness,
          renderData: {
            localPosition: [0, wallHeight + railingHeightOffset, 0],
            localRotation: railingShape === 'round' ? [Math.PI / 2, 0, 0] : [0, 0, 0],
            boxArgs: railingShape === 'round'
              ? [railingThickness, railingThickness, currentDist, 8]
              : [railingThickness, railingThickness, currentDist],
            color: RAILING_COLOR
          },
        }
      }


      return {
        index,
        p1,
        p2,
        height: wallHeight,
        thickness: wallThickness,
        trimStart,
        trimEnd,
        worldPosition: { x: groupX, y: 0, z: groupZ },
        worldRotation: { x: 0, y: yAngle, z: 0 },
        railing,
        renderData: {
          meshLocalPosition: [0, wallHeight / 2, 0],
          boxArgs: [ wallThickness, wallHeight, currentDist],
          color: WALL_COLOR,
        },
      }
    }
};