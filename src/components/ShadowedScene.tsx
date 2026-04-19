import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Site, PanelSetup, SunState } from '../types';
import { ShadowMap, useShadowSampler } from '../hooks/useShadowSampler';
import { useBVH } from '../hooks/useBVH';
import { SimulationResult } from '../types/simulation';
import { calculateInstantProduction } from '../solarEngine';

interface Props {
  site: Site;
  activeSetup: PanelSetup;
  sun: SunState;
  showPoints: boolean;
  density: number;
  threshold: number;
  onProductionUpdate: (result: SimulationResult) => void;
  children: (shadowMap: ShadowMap) => React.ReactNode;
}

export function ShadowedScene({ site, activeSetup, sun, showPoints, density, threshold, onProductionUpdate, children }: Props) {
  const { scene } = useThree();
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  // Rebuild BVH when site or setup changes
  const rebuildKey = `${site.centerX}-${site.centerZ}-${activeSetup.id}`;
  useBVH(sceneRef, rebuildKey);

  const allPanels = activeSetup.panelArrays.flatMap(pa => pa.panels);
  const { computeShadows } = useShadowSampler(allPanels);

  const [shadowMap, setShadowMap] = useState<ShadowMap>(new Map());
  const needsUpdate = useRef(false);

  const sunRef = useRef(sun);
  const densityRef = useRef(density);
  const thresholdRef = useRef(threshold);
  const onUpdateRef = useRef(onProductionUpdate);

  sunRef.current = sun;
  densityRef.current = density;
  thresholdRef.current = threshold;
  onUpdateRef.current = onProductionUpdate;

  useEffect(() => {
    needsUpdate.current = true;
  }, [sun, activeSetup, showPoints, density, threshold])

  useFrame(() => {
    if (!needsUpdate.current) return;

    needsUpdate.current = false;

    const newMap = computeShadows(scene, sun);
    const result = calculateInstantProduction(allPanels, sunRef.current, newMap, densityRef.current, thresholdRef.current);

    setShadowMap(newMap);
    onUpdateRef.current(result);
  });

  return <>{children(shadowMap)}</>;
}