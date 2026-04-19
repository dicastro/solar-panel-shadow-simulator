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

/**
 * Invisible scene node that:
 *  1. Maintains the BVH (rebuilt when site/setup changes).
 *  2. Casts shadow rays on every "dirty" frame and updates the shadow map.
 *  3. Feeds the production result up via `onProductionUpdate`.
 *
 * Children receive the latest ShadowMap as a render prop so they can colour
 * sample points without needing their own raycasting.
 */
export function ShadowedScene({
  site, activeSetup, sun, showPoints, density, threshold,
  onProductionUpdate, children,
}: Props) {
  const { scene } = useThree();

  // Rebuild the BVH whenever the structural geometry changes.
  const rebuildKey = `${site.centerX}-${site.centerZ}-${activeSetup.id}`;
  useBVH(rebuildKey);

  const allPanels = activeSetup.panelArrays.flatMap(pa => pa.panels);
  const { computeShadows } = useShadowSampler(allPanels);

  const [shadowMap, setShadowMap] = useState<ShadowMap>(new Map());

  // A single dirty flag avoids recasting every frame when nothing has changed.
  const needsUpdate = useRef(false);

  // Keep refs in sync so the useFrame callback always sees the latest values
  // without closing over stale props.
  const sunRef = useRef(sun);
  const densityRef = useRef(density);
  const thresholdRef = useRef(threshold);
  const onUpdateRef = useRef(onProductionUpdate);

  sunRef.current = sun;
  densityRef.current = density;
  thresholdRef.current = threshold;
  onUpdateRef.current = onProductionUpdate;

  // Mark dirty whenever any input that affects shadow computation changes.
  useEffect(() => {
    needsUpdate.current = true;
  }, [sun, activeSetup, showPoints, density, threshold]);

  useFrame(() => {
    if (!needsUpdate.current) return;
    needsUpdate.current = false;

    // Always read from refs so we get the values current at render time,
    // not the values captured when this closure was created.
    const currentSun = sunRef.current;
    const newMap = computeShadows(scene, currentSun);
    const result = calculateInstantProduction(
      allPanels, currentSun, newMap, densityRef.current, thresholdRef.current,
    );

    setShadowMap(newMap);
    onUpdateRef.current(result);
  });

  return <>{children(shadowMap)}</>;
}