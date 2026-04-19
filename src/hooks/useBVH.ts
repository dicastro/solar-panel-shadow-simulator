import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Patch THREE.BufferGeometry and THREE.Mesh once globally
// This adds .computeBoundsTree() to BufferGeometry and BVH-accelerated raycast to Mesh
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/**
 * Builds and maintains a BVH over all shadow-casting meshes in the scene.
 * Returns a ref to the list of meshes with BVH attached.
 * Rebuild is triggered when the dependency value changes.
 */
export function useBVH(sceneRef: React.RefObject<THREE.Scene>, rebuildKey: string) {
  const bvhMeshes = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const meshes: THREE.Mesh[] = [];

    sceneRef.current.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (!obj.castShadow) return;
      if (!(obj.geometry instanceof THREE.BufferGeometry)) return;

      // Build BVH for this mesh geometry if not already built
      obj.geometry.computeBoundsTree();
      meshes.push(obj);
    });

    bvhMeshes.current = meshes;

    return () => {
      // Clean up BVH on unmount or rebuild
      meshes.forEach(m => m.geometry.disposeBoundsTree());
    };
  }, [rebuildKey]);

  return bvhMeshes;
}