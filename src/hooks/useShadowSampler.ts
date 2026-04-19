import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { SunState } from '../types';
import { SolarPanel } from '../types/installation';
import { ThreeConverter } from '../utils/ThreeConverter';

export type ShadowMap = Map<string, boolean>;

/**
 * Returns a function that, given a scene and sun state,
 * casts rays for all sample points and returns a shadow map.
 * Uses the BVH-accelerated raycast patched into THREE.Mesh.
 */
export function useShadowSampler(panels: readonly SolarPanel[]) {
  const raycaster = useRef(new THREE.Raycaster());
  
  // Cache world positions of panels to avoid recomputing every frame
  const panelMatrices = useRef<Map<string, THREE.Matrix4>>(new Map());

  const computeShadows = useCallback((
    scene: THREE.Scene,
    sun: SunState,
  ): ShadowMap => {
    const result: ShadowMap = new Map();

    if (!sun.isDaylight) {
      // Night: all points unshaded (no production anyway)
      panels.forEach(panel =>
        panel.samplePoints.forEach(sp => result.set(sp.id, false))
      );
      return result;
    }

    const sunDir = ThreeConverter.toVector3(sun.direction);
    
    raycaster.current.set(new THREE.Vector3(), sunDir);
    raycaster.current.firstHitOnly = true; // BVH optimization: stop at first hit

    // Collect all shadow-casting meshes once
    const castShadowMeshes: THREE.Mesh[] = [];
    
    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.castShadow) {
        castShadowMeshes.push(obj);
      }
    });

    panels.forEach(panel => {
      // Build the world matrix for this panel once per call
      const panelWorldPos = ThreeConverter.toVector3(panel.worldPosition);
      const panelRotation = ThreeConverter.toEuler(panel.worldRotation);

      const panelMatrix = new THREE.Matrix4().compose(
        panelWorldPos,
        new THREE.Quaternion().setFromEuler(panelRotation),
        new THREE.Vector3(1, 1, 1),
      );

      panel.samplePoints.forEach(sp => {
        // Transform local point position to world position
        const localPos = ThreeConverter.toVector3(sp.localPosition);
        const worldPos = localPos.clone().applyMatrix4(panelMatrix);

        raycaster.current.ray.origin.copy(worldPos);

        const hits = raycaster.current.intersectObjects(castShadowMeshes, false);
        const isShaded = hits.some(h => h.distance > 0.01);

        result.set(sp.id, isShaded);
      });
    });

    return result;
  }, [panels]);

  return { computeShadows, panelMatrices };
}