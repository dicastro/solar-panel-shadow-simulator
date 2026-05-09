import * as THREE from 'three';
import { computeBoundsTree } from 'three-mesh-bvh';
import { SimulationPanelData, SerializedMesh } from '../types/simulation';
import { ThreeConverter } from '../converter/ThreeConverter';
import { ThreeUtils } from '../utils/ThreeUtils';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;

/**
 * Result of serialising a batch of panel frame meshes for worker transfer.
 */
export interface PanelMeshBatch {
  readonly meshes: SerializedMesh[];
  readonly transferables: ArrayBuffer[];
}

/**
 * Builds and serialises Three.js panel frame meshes from SimulationPanelData,
 * without requiring the panels to be present in the live Three.js scene.
 *
 * The annual simulation worker must receive the panel geometry of the setup it
 * is simulating. Because the 3D viewport only ever renders the currently active
 * setup, MeshFactory.fromScene would provide the wrong panel geometry for any
 * other setup. This factory solves that by constructing panel frame meshes
 * directly from SimulationPanelData, which carries the world position and
 * rotation of every panel regardless of whether it is rendered.
 *
 * Each panel's frame geometry matches what SolarPanelComponent renders:
 *   BoxGeometry([actualWidth, 0.03, actualHeight])
 * with castShadow = true. The world matrix is composed from the panel's
 * worldPosition and worldRotation (Euler order 'YXZ'), replicating exactly what
 * Three.js produces for the same mesh inside a positioned and rotated group.
 *
 * A BVH is computed on each geometry immediately so the meshes are ready for
 * ThreeUtils.serializeMesh without a separate BVH build pass. Meshes and
 * geometries are disposed after serialisation — they are ephemeral objects
 * created solely for BVH construction and typed-array extraction.
 */
export const PanelMeshFactory = {
  buildFromPanelData: (panels: SimulationPanelData[]): PanelMeshBatch => {
    const allMeshes: SerializedMesh[] = [];
    const allTransferables: ArrayBuffer[] = [];

    for (const panel of panels) {
      const geometry = new THREE.BoxGeometry(panel.actualWidth, 0.03, panel.actualHeight);
      geometry.computeBoundsTree();

      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
      mesh.castShadow = true;
      mesh.matrixAutoUpdate = false;

      const position = ThreeConverter.toVector3(panel.worldPosition);
      const quaternion = new THREE.Quaternion().setFromEuler(
        ThreeConverter.toEuler(panel.worldRotation),
      );
      const scale = new THREE.Vector3(1, 1, 1);
      mesh.matrix.compose(position, quaternion, scale);
      mesh.matrixWorld.copy(mesh.matrix);

      const result = ThreeUtils.serializeMesh(mesh);
      if (result) {
        allMeshes.push(result.mesh);
        allTransferables.push(...result.transferables);
      }

      geometry.dispose();
    }

    return { meshes: allMeshes, transferables: allTransferables };
  },
};