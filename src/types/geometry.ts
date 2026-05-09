export interface PointXZ {
  readonly x: number;
  readonly z: number;
}

/**
 * Result of analysing a vertex against its two neighbours.
 * See README for the mathematical background.
 */
export interface PointXZAlignedResult {
  readonly isStraight: boolean;
  readonly isConvex: boolean;
  readonly normalizedPrev: PointXZ;
  readonly normalizedNext: PointXZ;
}

/**
 * Three consecutive config-space wall points that form a non-right angle.
 * Coordinates are in the original config coordinate system (+X = East, +Z = North),
 * making them directly readable as the values the user typed in config.json.
 */
export interface AngleWarning {
  readonly pointPrev: readonly [number, number];
  readonly point: readonly [number, number];
  readonly pointNext: readonly [number, number];
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
 * Generic 3D rotation in Euler angles (radians).
 *
 * The `order` field maps directly to Three.js Euler order strings.
 * When omitted, consumers default to Three.js 'XYZ'.
 *
 * Panel rotations use 'YXZ': azimuth (Y) is applied before inclination (X)
 * so that the inclination axis is always the panel's own East-West axis
 * rather than the global X axis, keeping panel edges parallel to the ground
 * regardless of azimuth.
 */
export interface Euler3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly order?: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY';
}