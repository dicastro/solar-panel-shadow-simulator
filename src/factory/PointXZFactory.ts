import { PointXZ } from "../types/geometry";

export const PointXZFactory = {
  create: (x: number, z: number): PointXZ => {
    if (isNaN(x) || isNaN(z)) {
      throw new Error(`PointXZFactory: Incorrect values received (x: ${x}, z: ${z})`);
    }

    return { x, z };
  },

  createCentered: (x: number, z: number, centerX: number, centerZ: number): PointXZ => PointXZFactory.create(x - centerX, z - centerZ),
}