import { PointXZ } from "../types/geometry";

export const PointXZConverter = {
  toXZArray: (p: PointXZ): [number, number] => [p.x, p.z],
  
  toXYZArray: (p: PointXZ, y?: number): [number, number, number] => [p.x, y ?? 0, p.z],
}