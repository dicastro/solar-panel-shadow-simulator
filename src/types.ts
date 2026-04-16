import * as THREE from 'three';

export interface PanelDefinition {
    width: number;
    height: number;
    peakPower: number;
    zones: number;
    zonesDisposition: 'vertical' | 'horizontal';
    hasOptimizer: boolean;
    string: string;
}

export interface PanelArray {
  position: [number, number];
  azimut: number;
  elevation: number;
  inclination: number;
  rows: number;
  columns: number;
  width?: number;
  height?: number;
  peakPower?: number;
  zones?: number;
  zonesDisposition?: 'vertical' | 'horizontal';
  hasOptimizer?: boolean;
  string?: string;
}

export interface PanelArraySettings {
  array: number;
  panel: [number, number];
  hasOptimizer?: boolean;
  string?: string;
}

export interface PanelsConfiguration {
  panelDefaults: PanelDefinition;
  arrays: PanelArray[];
  arraysSettings?: PanelArraySettings[];
}

export interface Config {
  geometry: {
    latitude: number;
    longitude: number;
    timezone: string;
    points: [number, number][];
    wallDefaults: {
      height: number;
      thickness: number;
    },
    railingDefaults: {
      active: boolean;
      heightOffset: number;
      thickness: number;
      shape: 'square' | 'round';
    };
    segmentsSettings?: {
      segment: number;
      height?: number;
      trimStart?: number;
      trimEnd?: number;
      railing?: {
        active?: boolean;
        heightOffset?: number;
        thickness?: number;
        shape?: 'square' | 'round';
      };
    }[];
  },
  panels: PanelsConfiguration;
}

export interface SunState {
    altitude: number;
    azimuth: number;
    isDaylight: boolean;
    direction: THREE.Vector3;
}

export interface SimulationResult {
    instantPower: number; // kW
    panels: {
        id: string;
        power: number;
        isShaded: boolean;
    }[];
}