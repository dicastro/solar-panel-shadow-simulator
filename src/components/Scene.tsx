import { useMemo } from 'react';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Site, PanelSetup, SunState, SimulationResult } from '../types';
import { ShadowMap } from '../hooks/useShadowSampler';
import { ShadowedScene } from './ShadowedScene';
import { Compass } from './Compass';
import { Sun } from './Sun';
import { SolarPanelComponent } from './SolarPanelComponent';

interface SceneProps {
  site: Site;
  activeSetup: PanelSetup;
  sun: SunState;
  date: Date;
  showPoints: boolean;
  density: number;
  threshold: number;
  onProductionUpdate: (result: SimulationResult) => void;
}

/**
 * Root Three.js scene.  Composes static geometry (walls, floor, compass) with
 * the dynamic shadow-aware panel layer via ShadowedScene.
 *
 * The site group is rotated by `site.azimuthRad` so that the physical building
 * orientation matches the real-world compass bearing.  Panels are placed
 * outside this group because their azimuth is absolute (not relative to site).
 */
export function Scene({
  site, activeSetup, sun, date, showPoints, density, threshold, onProductionUpdate,
}: SceneProps) {
  const gridSize = site.boundingRadius * 3;

  // Build the floor shape once from wall intersection positions.
  const floorShape = useMemo(() => {
    const shape = new THREE.Shape();
    site.wallIntersections.forEach((wi, i) => {
      if (i === 0) shape.moveTo(wi.position.x, wi.position.z);
      else shape.lineTo(wi.position.x, wi.position.z);
    });
    return shape.closePath();
  }, [site.wallIntersections]);

  return (
    <>
      <OrbitControls
        zoomSpeed={0.2}
        minDistance={2}
        maxDistance={site.boundingRadius * 8}
      />
      <Grid
        infiniteGrid={false}
        cellSize={1}
        cellThickness={0.5}
        sectionSize={5}
        fadeDistance={gridSize * 2}
        cellColor="#444"
        sectionColor="#666"
      />
      <Compass />
      <Sun date={date} />

      {/* Site group: walls + floor, rotated to match real-world azimuth */}
      <group rotation-y={site.azimuthRad}>
        <mesh receiveShadow position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <extrudeGeometry args={[floorShape, { depth: 0.02, bevelEnabled: false }]} />
          <meshStandardMaterial color="#b45d16" side={THREE.DoubleSide} />
        </mesh>

        {site.wallIntersections.map((wi) => (
          <mesh
            key={`post-${wi.index}`}
            position={[wi.worldPosition.x, wi.worldPosition.y, wi.worldPosition.z]}
            castShadow
          >
            <boxGeometry args={wi.renderData.boxArgs} />
            <meshStandardMaterial color={wi.renderData.color} />
          </mesh>
        ))}

        {site.walls.map((wall) => (
          <group
            key={`wall-${wall.index}`}
            position={[wall.worldPosition.x, wall.worldPosition.y, wall.worldPosition.z]}
            rotation-y={wall.worldRotation.y}
          >
            <mesh position={wall.renderData.meshLocalPosition} castShadow>
              <boxGeometry args={wall.renderData.boxArgs} />
              <meshStandardMaterial color={wall.renderData.color} />
            </mesh>

            {wall.railing && (
              <mesh
                position={wall.railing.renderData.localPosition}
                rotation={wall.railing.renderData.localRotation}
                castShadow
              >
                {wall.railing.shape === 'round'
                  ? <cylinderGeometry args={wall.railing.renderData.boxArgs as [number, number, number, number]} />
                  : <boxGeometry args={wall.railing.renderData.boxArgs as [number, number, number]} />
                }
                <meshStandardMaterial color={wall.railing.renderData.color} />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* Panels — outside the site group because azimuth is absolute */}
      <ShadowedScene
        site={site}
        activeSetup={activeSetup}
        sun={sun}
        showPoints={showPoints}
        density={density}
        threshold={threshold}
        onProductionUpdate={onProductionUpdate}
      >
        {(shadowMap: ShadowMap) =>
          activeSetup.panelArrays.flatMap(pa =>
            pa.panels.map(panel => (
              <group
                key={panel.id}
                position={[panel.worldPosition.x, panel.worldPosition.y, panel.worldPosition.z]}
                rotation={[panel.worldRotation.x, panel.worldRotation.y, panel.worldRotation.z]}
              >
                <SolarPanelComponent
                  hasOptimizer={panel.hasOptimizer}
                  showPoints={showPoints}
                  renderData={panel.renderData}
                  samplePoints={panel.samplePoints}
                  shadowMap={shadowMap}
                />
              </group>
            ))
          )
        }
      </ShadowedScene>
    </>
  );
}