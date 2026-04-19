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
 * - All THREE scratch objects are allocated once (module scope) and reused.
 * - BVH acceleration must be set up separately via `useBVH`.
 * - `raycaster.firstHitOnly = true` stops traversal after the first BVH hit.
 */
export function useShadowSampler(panels: readonly SolarPanel[]) {
  const raycaster = useRef(new THREE.Raycaster());

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

    const sunDir = ThreeConverter.toVector3(sun.direction);

    raycaster.current.set(_origin, sunDir); // origin will be overwritten per point
    raycaster.current.firstHitOnly = true;

    // Collect shadow-casting meshes once per call (scene topology is stable
    // between calls because BVH is rebuilt on setup/site change).
    const castShadowMeshes: THREE.Mesh[] = [];
    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.castShadow) {
        castShadowMeshes.push(obj);
      }
    });

    panels.forEach(panel => {
      // Build the panel's world matrix once per panel using scratch objects.
      _quat.setFromEuler(ThreeConverter.toEuler(panel.worldRotation));
      _worldPos.set(panel.worldPosition.x, panel.worldPosition.y, panel.worldPosition.z);
      _matrix.compose(_worldPos, _quat, _scale);

      panel.samplePoints.forEach(sp => {
        _localPos.set(sp.localPosition.x, sp.localPosition.y, sp.localPosition.z);
        _localPos.applyMatrix4(_matrix); // now in world space

        raycaster.current.ray.origin.copy(_localPos);
        raycaster.current.ray.direction.copy(sunDir);

        const hits = raycaster.current.intersectObjects(castShadowMeshes, false);
        const isShaded = hits.some(h => h.distance > 0.01);

        result.set(sp.id, isShaded);
      });
    });

    return result;
  }, [panels]);

  return { computeShadows };
}