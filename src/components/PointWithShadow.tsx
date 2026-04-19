import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Intersection } from 'three'
import * as THREE from 'three';
import { SunState } from '../types';
import { ThreeConverter } from '../utils/ThreeConverter';

interface PointWithShadowProps {
  position: [number, number, number];
  sun: SunState;
  raycaster: THREE.Raycaster;
  onStatusChange: (isShaded: boolean) => void;
}

export function PointWithShadow({ position, sun, raycaster, onStatusChange }: PointWithShadowProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [isShaded, setIsShaded] = useState(false);
  const lastUpdate = useRef(0); // To control time

  useFrame((state) => {
    if (!sun || !sun.isDaylight || !meshRef.current) return;

    // Only do the calculation if more than 100ms have been elapsed from last time
    const now = state.clock.getElapsedTime();
    if (now - lastUpdate.current < 0.1) return; 
    lastUpdate.current = now;

    // Get world position
    const worldPosition = new THREE.Vector3();
    meshRef.current.getWorldPosition(worldPosition);

    // Set ray from world position to the sun
    raycaster.set(worldPosition, ThreeConverter.toVector3(sun.direction));

    // Detect collisions with objects that cast shadow
    const intersects = raycaster.intersectObjects(state.scene.children, true);

    // Look for an object in front of that is NOT the point itself or the solar panel glass
    const hasObstacle = intersects.some((hit: Intersection) => 
      hit.object.castShadow && hit.distance > 0.01
    );

    if (hasObstacle !== isShaded) {
      setIsShaded(hasObstacle);
      onStatusChange(hasObstacle);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.01, 8, 8]} />
      <meshBasicMaterial color={!sun.isDaylight ? "#333" : (isShaded ? "#ff4444" : "#ccff00")} />
    </mesh>
  );
}