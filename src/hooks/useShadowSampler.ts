import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { SunState } from '../types';
import { SolarPanel } from '../types/installation';
import { ThreeConverter } from '../utils/ThreeConverter';

export type ShadowMap = Map<string, boolean>;

// Scratch objects reused across every computeShadows call to avoid GC pressure.
// Never read from these outside the function that writes to them.
const _worldPos = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _localPos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _matrix = new THREE.Matrix4();

/**
 * Returns a stable `computeShadows` function that, given a scene and a sun
 * state, casts rays for all sample points and returns a ShadowMap.
 *
 * Performance notes:
 *
 * - **BVH acceleration** must be set up separately via `useBVH`. After patching
 *   THREE.Mesh.prototype.raycast, every intersectObjects call uses the BVH
 *   automatically if a bounds tree exists on the geometry.
 *
 * - **`raycaster.firstHitOnly = true`** stops BVH traversal after the first
 *   hit, saving work when we only care whether something is between the sample
 *   point and the sun (not how many things are).
 *
 * - **Shadow mesh cache**: the list of shadow-casting meshes is built once via
 *   `scene.traverse` and stored in a ref. It is only invalidated when
 *   `rebuildKey` changes (same trigger as `useBVH`). Without this, every
 *   raycasting pass would traverse the entire scene graph, which is O(nodes)
 *   overhead repeated thousands of times per frame during simulation.
 *
 * - **Scratch THREE objects** (Vector3, Matrix4, Quaternion) are allocated once
 *   at module scope and reused for every ray, avoiding GC pressure.
 *
 * @param panels     All panels in the active setup.
 * @param rebuildKey Changes when the scene topology changes (setup or site
 *                   switch). Must match the key passed to `useBVH`.
 */
export function useShadowSampler(panels: readonly SolarPanel[], rebuildKey: string) {
  const raycaster = useRef(new THREE.Raycaster());

  // Cache of shadow-casting meshes. Populated lazily on the first
  // computeShadows call after a rebuildKey change, then reused until the
  // key changes again.
  const meshCacheKey = useRef<string | null>(null);
  const castShadowMeshes = useRef<THREE.Mesh[]>([]);

  const computeShadows = useCallback((
    scene: THREE.Scene,
    sun: SunState,
  ): ShadowMap => {
    const result: ShadowMap = new Map();

    if (!sun.isDaylight) {
      panels.forEach(panel =>
        panel.samplePoints.forEach(sp => result.set(sp.id, false)),
      );
      return result;
    }

    // Rebuild the mesh cache only when the scene topology has changed.
    // rebuildKey is the same signal used by useBVH so they stay in sync.
    if (meshCacheKey.current !== rebuildKey) {
      castShadowMeshes.current = [];
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.castShadow) {
          castShadowMeshes.current.push(obj);
        }
      });
      meshCacheKey.current = rebuildKey;
    }

    const sunDir = ThreeConverter.toVector3(sun.direction);

    raycaster.current.set(_origin, sunDir);
    raycaster.current.firstHitOnly = true;

    panels.forEach(panel => {
      _quat.setFromEuler(ThreeConverter.toEuler(panel.worldRotation));
      _worldPos.set(panel.worldPosition.x, panel.worldPosition.y, panel.worldPosition.z);
      _matrix.compose(_worldPos, _quat, _scale);

      panel.samplePoints.forEach(sp => {
        _localPos.set(sp.localPosition.x, sp.localPosition.y, sp.localPosition.z);
        _localPos.applyMatrix4(_matrix);

        raycaster.current.ray.origin.copy(_localPos);
        raycaster.current.ray.direction.copy(sunDir);

        const hits = raycaster.current.intersectObjects(castShadowMeshes.current, false);
        const isShaded = hits.some(h => h.distance > 0.01);

        result.set(sp.id, isShaded);
      });
    });

    return result;
  }, [panels, rebuildKey]);

  return { computeShadows };
}