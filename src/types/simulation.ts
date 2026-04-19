import { Vector3 } from './geometry';

export interface SunState {
  readonly altitude: number;
  readonly azimuth: number;
  readonly isDaylight: boolean;
  readonly direction: Vector3;
}

export interface SimulationResult {
  readonly instantPower: number; // kW
  readonly panels: {
    readonly id: string;
    readonly power: number;
    readonly isShaded: boolean;
  }[];
}