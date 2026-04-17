import { PointXZ } from "../types/geometry";

export const PointXZFactory = {
  create: (x: number, z: number): PointXZ => {
    if (isNaN(x) || isNaN(z)) {
      throw new Error(`PointXZFactory: Valores inválidos recibidos (x: ${x}, z: ${z})`);
    }

    return {
      x: x,
      z: z
    }
  },

  createCentered: (x: number, z: number, centerX: number, centerZ: number): PointXZ => PointXZFactory.create(x - centerX, z - centerZ),
}