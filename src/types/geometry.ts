export interface PointXZ {
  readonly x: number;
  readonly z: number;
}

export interface OffsetXZ {
  readonly x: number;
  readonly z: number;
}

export interface PointXZAlignedResult {
  readonly isStraight: boolean;
  readonly normalizedPrev: PointXZ;
  readonly normalizedNext: PointXZ;
}