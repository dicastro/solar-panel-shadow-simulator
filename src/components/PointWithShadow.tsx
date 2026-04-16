import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Intersection } from 'three'
import * as THREE from 'three';

import { SunState } from '../types';

interface PointWithShadowProps {
  position: [number, number, number];
  sun: SunState;
  raycaster: THREE.Raycaster;
  onStatusChange: (isShaded: boolean) => void;
}

export function PointWithShadow({ position, sun, raycaster, onStatusChange }: PointWithShadowProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [isShaded, setIsShaded] = useState(false);
  const lastUpdate = useRef(0); // Para controlar el tiempo

  useFrame((state) => {
    if (!sun || !sun.isDaylight || !meshRef.current) return;

    // Solo calculamos si han pasado más de 100ms desde la última vez
    const now = state.clock.getElapsedTime();
    if (now - lastUpdate.current < 0.1) return; 
    lastUpdate.current = now;

    // 1. Obtener la posición global del punto
    const worldPosition = new THREE.Vector3();
    meshRef.current.getWorldPosition(worldPosition);

    // 2. Configurar rayo desde el punto hacia el sol
    raycaster.set(worldPosition, sun.direction);

    // 3. Detectar colisiones con objetos que proyectan sombra
    const intersects = raycaster.intersectObjects(state.scene.children, true);

    // Buscamos si hay algún objeto delante que NO sea un punto o el cristal del panel
    const hasObstacle = intersects.some((hit: Intersection) => 
      hit.object.castShadow && hit.distance > 0.01
    );

    if (hasObstacle !== isShaded) {
      setIsShaded(hasObstacle);
      onStatusChange(isShaded);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.01, 8, 8]} />
      <meshBasicMaterial color={!sun.isDaylight ? "#333" : (isShaded ? "#ff4444" : "#ccff00")} />
    </mesh>
  );
}