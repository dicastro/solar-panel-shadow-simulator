import * as THREE from 'three';
import { SerializedMesh } from '../types/simulation';
import { ThreeUtils } from '../utils/ThreeUtils';

/**
 * A batch of serialised meshes together with all their transferable buffers,
 * ready to be passed to `postMessage` for zero-copy transfer to a worker.
 */
export interface MeshBatch {
  readonly meshes: SerializedMesh[];
  readonly transferables: ArrayBuffer[];
}

/**
 * Collects shadow-casting meshes from a Three.js scene and provides a factory
 * method that produces independent typed-array copies of their serialised
 * geometry on each call.
 *
 * An optional `filter` predicate allows callers to exclude specific meshes.
 * The default (no filter) collects all castShadow meshes, preserving the
 * original behaviour.
 *
 * The `build` method must be called once per worker, not once per simulation
 * run. Typed array buffers are detached after a zero-copy `postMessage`
 * transfer — calling `build` again produces fresh copies from the still-intact
 * live Three.js objects on the main thread.
 *
 * Peak memory usage is approximately 2× the geometry size: one copy in the
 * live scene and one copy in transit to each worker (freed once transferred).
 */
export const MeshFactory = {
  /**
   * Traverses the scene once to collect references to qualifying meshes.
   * Returns a `build` function that produces a fresh `MeshBatch` on each call.
   *
   * @param filter Optional predicate. Return `true` to include the mesh.
   *               When omitted, all castShadow meshes are included.
   */
  fromScene: (
    scene: THREE.Scene,
    filter?: (mesh: THREE.Mesh) => boolean,
  ): { build: () => MeshBatch } => {
    const liveMeshes: THREE.Mesh[] = [];
    scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (!obj.castShadow) return;
      if (!(obj.geometry instanceof THREE.BufferGeometry)) return;
      if (filter && !filter(obj)) return;

      liveMeshes.push(obj);
    });

    return {
      build: (): MeshBatch => {
        const meshes: SerializedMesh[] = [];
        const transferables: ArrayBuffer[] = [];

        for (const obj of liveMeshes) {
          const result = ThreeUtils.serializeMesh(obj);
          if (!result) continue;
          meshes.push(result.mesh);
          transferables.push(...result.transferables);
        }

        return { meshes, transferables };
      },
    };
  },
};