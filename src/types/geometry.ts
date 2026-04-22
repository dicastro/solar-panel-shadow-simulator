export interface PointXZ {
  readonly x: number;
  readonly z: number;
}

/**
 * Result of analysing a vertex against its two neighbours.
 *
 * isStraight: the three points are collinear (angle ≈ 180°).
 * isConvex:   the interior angle is < 180° (the polygon turns left at this
 *             vertex when walked counter-clockwise). Wall intersection posts
 *             should only be rendered at convex vertices.
 * normalizedPrev / normalizedNext: unit normals of the incoming and outgoing
 *             wall segments, used to compute the post's corner offset.
 */
export interface PointXZAlignedResult {
  readonly isStraight: boolean;
  readonly isConvex: boolean;
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