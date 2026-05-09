import * as THREE from 'three';
import { SolarPanel } from '../types/installation';
import { SimulationPanelData, SimulationSamplePoint } from '../types/simulation';
import { Vector3 } from '../types/geometry';
import { ThreeConverter } from './ThreeConverter';


export const SolarPanelConverter = {
  /**
   * Derives the panel's world-space normal from its world rotation.
   *
   * A flat panel (zero rotation) faces straight up (0, 1, 0). Inclination and
   * azimuth rotate this normal so it correctly represents the panel's facing
   * direction in world space.
   */
  toWorldNormal: (panel: SolarPanel): Vector3 => {
    const normal = new THREE.Vector3(0, 1, 0).applyEuler(
      ThreeConverter.toEuler(panel.worldRotation),
    );
    return { x: normal.x, y: normal.y, z: normal.z };
  },

  /**
   * Transforms all sample points of a panel from local space to world space.
   *
   * Sample points are defined relative to the panel's own centre. This function
   * applies the panel's world matrix (position × rotation) to each point,
   * producing positions directly usable as ray origins during simulation without
   * any further transformation inside the worker.
   *
   * Pre-computing world-space positions here avoids repeating the matrix
   * multiplication at every one of the ~8,760 annual time steps.
   */
  toWorldSpaceSamplePoints: (panel: SolarPanel): SimulationSamplePoint[] => {
    const quat = new THREE.Quaternion().setFromEuler(
      ThreeConverter.toEuler(panel.worldRotation),
    );
    const worldPos = ThreeConverter.toVector3(panel.worldPosition);
    const matrix = new THREE.Matrix4().compose(worldPos, quat, new THREE.Vector3(1, 1, 1));

    return panel.samplePoints.map(sp => {
      const local = new THREE.Vector3(
        sp.localPosition.x,
        sp.localPosition.y,
        sp.localPosition.z,
      ).applyMatrix4(matrix);
      return { id: sp.id, zoneIndex: sp.zoneIndex, x: local.x, y: local.y, z: local.z };
    });
  },

  /**
   * Converts a single `SolarPanel` into the `SimulationPanelData` shape required
   * by the annual simulation worker.
   *
   * World-space positions, normals, and sample points are pre-computed so the
   * worker only needs to perform raycasting and arithmetic during its inner loop.
   *
   * `worldPosition` and `worldRotation` are included so that the main thread can
   * reconstruct accurate panel frame meshes for BVH raycasting for each simulated
   * setup independently of which setup is currently rendered in the 3D view.
   *
   * Physical geometry fields (orientation, actualWidth, actualHeight, zones,
   * zonesDisposition) are included so the worker can propagate them into
   * PanelAnnualData for use by the results panel heat maps.
   */
  toSimulationPanelData: (panel: SolarPanel): SimulationPanelData => ({
    id: panel.id,
    arrayIndex: panel.arrayIndex,
    row: panel.row,
    col: panel.col,
    peakPower: panel.peakPower,
    zones: panel.zones,
    zonesDisposition: panel.zonesDisposition,
    orientation: panel.orientation,
    actualWidth: panel.renderData.actualWidth,
    actualHeight: panel.renderData.actualHeight,
    hasOptimizer: panel.hasOptimizer,
    string: panel.string,
    worldNormal: SolarPanelConverter.toWorldNormal(panel),
    worldPosition: panel.worldPosition,
    worldRotation: panel.worldRotation,
    samplePoints: SolarPanelConverter.toWorldSpaceSamplePoints(panel),
  }),

  /**
   * Converts an array of `SolarPanel` domain objects into `SimulationPanelData`
   * entries, preserving order.
   */
  toSimulationPanelDataArray: (panels: SolarPanel[]): SimulationPanelData[] =>
    panels.map(SolarPanelConverter.toSimulationPanelData),
};