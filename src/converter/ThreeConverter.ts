import * as THREE from 'three';
import { Euler3, Vector3 } from '../types/geometry';

/**
 * Adapters between domain geometry types and THREE.js types.
 * Only import this from rendering/scene components, never from domain models or factories.
 */
export const ThreeConverter = {
  toVector3: (v: Vector3): THREE.Vector3 => new THREE.Vector3(v.x, v.y, v.z),

  toEuler: (e: Euler3): THREE.Euler => new THREE.Euler(e.x, e.y, e.z),
};