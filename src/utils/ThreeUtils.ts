import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SerializedMesh } from '../types/simulation';

/**
 * One serialised mesh together with the ArrayBuffers that must be included
 * in the postMessage transfer list for zero-copy transfer to a worker.
 *
 * After transfer, the ArrayBuffers inside `mesh` are detached on the sending
 * side. Always produce a fresh `SerializedMeshWithTransferables` per worker
 * via `MeshFactory.build()`.
 */
export interface SerializedMeshWithTransferables {
  readonly mesh: SerializedMesh;
  readonly transferables: ArrayBuffer[];
}

export const ThreeUtils = {
  /**
   * Serialises a single shadow-casting Three.js mesh into plain typed arrays
   * that can be transferred to a worker.
   *
   * Each call produces independent copies of the geometry data (positions,
   * indices, BVH, world matrix). This is intentional: typed array buffers are
   * detached after a zero-copy `postMessage` transfer, so every worker must
   * receive its own copy.
   *
   * Returns `null` when the mesh has `castShadow` set but no BVH computed yet.
   * Callers should skip such meshes and log a warning.
   */
  serializeMesh: (obj: THREE.Mesh): SerializedMeshWithTransferables | null => {
    const geo = obj.geometry as THREE.BufferGeometry;
    const bvh = geo.boundsTree as MeshBVH | undefined;

    if (!bvh) {
      console.warn('ThreeUtils.serializeMesh: mesh has castShadow but no boundsTree — skipping', obj);
      return null;
    }

    const positions = (geo.attributes.position.array as Float32Array).slice();
    const rawIndex = geo.index?.array;
    const indices = rawIndex
      ? new Uint32Array(rawIndex)
      : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);

    const serializedBvh = MeshBVH.serialize(bvh);

    obj.updateWorldMatrix(true, false);
    const worldMatrix = new Float32Array(obj.matrixWorld.elements);

    const transferables: ArrayBuffer[] = [
      positions.buffer,
      indices.buffer,
      worldMatrix.buffer,
    ];

    const bvhData = serializedBvh as unknown as Record<string, unknown>;
    Object.values(bvhData).forEach(v => {
      if (ArrayBuffer.isView(v)) transferables.push(v.buffer as ArrayBuffer);
      else if (v instanceof ArrayBuffer) transferables.push(v);
    });

    return {
      mesh: { positions, indices, serializedBvh, worldMatrix },
      transferables,
    };
  },

  /**
   * Reconstructs a single Three.js Mesh from its serialised form.
   *
   * The resulting mesh has `matrixAutoUpdate` disabled and its `matrix` /
   * `matrixWorld` pre-set from the transferred world matrix, exactly as the
   * original mesh had it in the main-thread scene. The BVH is deserialised
   * onto the geometry so that `acceleratedRaycast` (which must be patched onto
   * `THREE.Mesh.prototype.raycast` before calling this) uses it automatically.
   */
  reconstructMesh: (sm: SerializedMesh): THREE.Mesh => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(sm.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(sm.indices, 1));
    geometry.boundsTree = MeshBVH.deserialize(sm.serializedBvh, geometry);

    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.matrixAutoUpdate = false;
    mesh.matrix.fromArray(Array.from(sm.worldMatrix));
    mesh.matrixWorld.copy(mesh.matrix);

    return mesh;
  },

  /**
   * Reconstructs an array of Three.js meshes from their serialised forms.
   * Delegates each item to `reconstructMesh`.
   */
  reconstructMeshes: (serializedMeshes: SerializedMesh[]): THREE.Mesh[] =>
    serializedMeshes.map(ThreeUtils.reconstructMesh),
}