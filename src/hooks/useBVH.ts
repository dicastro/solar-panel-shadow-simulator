import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Patch THREE.BufferGeometry and THREE.Mesh once globally.
// This must run before any mesh geometry is created.
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/**
 * Builds a BVH over every shadow-casting mesh in the current Three.js scene.
 *
 * Must be called from inside a <Canvas> tree so that `useThree` works.
 * The BVH is rebuilt whenever `rebuildKey` changes (e.g. when the active
 * setup or site changes) and disposed on unmount.
 *
 * Why BVH?
 * --------
 * Without it, `raycaster.intersectObjects` does a brute-force AABB + triangle
 * test for every mesh.  With BVH, the geometry is pre-organised into a
 * Bounding Volume Hierarchy so each ray only tests O(log n) triangles instead
 * of O(n).  For a scene with hundreds of wall/panel faces this is a substantial
 * speedup, especially when casting thousands of rays per frame during
 * simulation.
 */
export function useBVH(rebuildKey: string) {
  const { scene } = useThree();

  useEffect(() => {
    const meshes: THREE.Mesh[] = [];

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (!obj.castShadow) return;
      if (!(obj.geometry instanceof THREE.BufferGeometry)) return;

      obj.geometry.computeBoundsTree();
      meshes.push(obj);
    });

    return () => {
      meshes.forEach(m => m.geometry.disposeBoundsTree?.());
    };
  }, [scene, rebuildKey]);
}