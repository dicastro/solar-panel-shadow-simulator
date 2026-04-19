export interface PointXZ {
  readonly x: number;
  readonly z: number;
}

export interface PointXZAlignedResult {
  readonly isStraight: boolean;
  readonly normalizedPrev: PointXZ;
  readonly normalizedNext: PointXZ;
}

/**
 * Generic 3D vector, decoupled from any rendering library.
 * Use ThreeConverter to transform to THREE.Vector3 when needed.
 */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Generic 3D rotation in Euler angles (radians), implicit XYZ order.
 * Use ThreeConverter to transform to THREE.Euler when needed.
 */
export interface Euler3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}