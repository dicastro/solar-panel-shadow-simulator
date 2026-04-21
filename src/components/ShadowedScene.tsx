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
 *
 * NOTE: `showPoints` is intentionally excluded from the dirty-flag effect.
 * It only controls whether sample points are rendered visually in
 * SolarPanelComponent — it has no effect on shadow calculations. Including it
 * would trigger a full (expensive) raycasting pass every time the user toggles
 * point visibility, with no change in output.
 */
export function ShadowedScene({
  site, activeSetup, sun, density, threshold,
  onProductionUpdate, children,
}: Omit<Props, 'showPoints'> & { showPoints: boolean }) {
  const { scene } = useThree();

  const rebuildKey = `${site.centerX}-${site.centerZ}-${activeSetup.id}`;
  useBVH(rebuildKey);

  const allPanels = activeSetup.panelArrays.flatMap(pa => pa.panels);
  const { computeShadows } = useShadowSampler(allPanels, rebuildKey);

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

  // `showPoints` is deliberately absent: toggling point visibility must not
  // trigger shadow recomputation.
  useEffect(() => {
    needsUpdate.current = true;
  }, [sun, activeSetup, density, threshold]);

  useFrame(() => {
    if (!needsUpdate.current) return;
    needsUpdate.current = false;

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