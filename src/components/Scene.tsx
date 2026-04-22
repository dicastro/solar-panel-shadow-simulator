import { useMemo } from 'react';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Site, PanelSetup, SunState, SimulationResult } from '../types';
import { RailingRailRenderData, RailingSupportRenderData } from '../types/installation';
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
 * Renders a single railing rail segment from its pre-computed render data.
 * Switches on the discriminated union kind so TypeScript ensures all shapes
 * are handled and no cast is needed.
 */
function RailingRail({ data }: { data: RailingRailRenderData }) {
  switch (data.kind) {
    case 'square':
      return (
        <mesh position={data.localPosition} rotation={data.localRotation} castShadow>
          <boxGeometry args={data.args} />
          <meshStandardMaterial color={data.color} />
        </mesh>
      );

    case 'cylinder':
      return (
        <mesh position={data.localPosition} rotation={data.localRotation} castShadow>
          <cylinderGeometry args={data.args} />
          <meshStandardMaterial color={data.color} />
        </mesh>
      );

    case 'half-cylinder':
      return (
        <mesh position={data.localPosition} rotation={data.localRotation} castShadow>
          <cylinderGeometry args={data.args} />
          <meshStandardMaterial color={data.color} side={THREE.DoubleSide} />
        </mesh>
      );
  }
}

function RailingSupport({ data }: { data: RailingSupportRenderData }) {
  switch (data.kind) {
    case 'square':
      return (
        <mesh position={data.localPosition} castShadow>
          <boxGeometry args={data.args} />
          <meshStandardMaterial color={data.color} />
        </mesh>
      );
    case 'cylinder':
      return (
        <mesh position={data.localPosition} castShadow>
          <cylinderGeometry args={data.args} />
          <meshStandardMaterial color={data.color} />
        </mesh>
      );
  }
}

export function Scene({
  site, activeSetup, sun, date, showPoints, density, threshold, onProductionUpdate,
}: SceneProps) {
  const gridSize = site.boundingRadius * 3;

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
        {/* Floor */}
        <mesh receiveShadow position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <extrudeGeometry args={[floorShape, { depth: 0.02, bevelEnabled: false }]} />
          <meshStandardMaterial color="#b45d16" side={THREE.DoubleSide} />
        </mesh>

        {/* Wall intersection posts — only rendered at convex vertices */}
        {site.wallIntersections.map(wi => {
          if (!wi.isRendered) return null;
          return (
            <group key={`post-${wi.index}`}>
              <mesh
                position={[wi.worldPosition.x, wi.worldPosition.y, wi.worldPosition.z]}
                castShadow
              >
                <boxGeometry args={wi.renderData.boxArgs} />
                <meshStandardMaterial color={wi.renderData.color} />
              </mesh>

              {wi.railingConnect && (
                <group position={[wi.worldPosition.x, 0, wi.worldPosition.z]}>
                  <RailingRail data={wi.railingConnect} />
                </group>
              )}
            </group>
          );
        })}

        {/* Wall segments: body + rail + supports */}
        {site.walls.map(wall => (
          <group
            key={`wall-${wall.index}`}
            position={[wall.worldPosition.x, wall.worldPosition.y, wall.worldPosition.z]}
            rotation-y={wall.worldRotation.y}
          >
            <mesh position={wall.renderData.meshLocalPosition} castShadow>
              <boxGeometry args={wall.renderData.boxArgs} />
              <meshStandardMaterial color={wall.renderData.color} />
            </mesh>

            {wall.railing && <RailingRail data={wall.railing.rail} />}

            {wall.railing?.supports.map((support, i) => (
              <RailingSupport key={i} data={support} />
            ))}
          </group>
        ))}
      </group>

      {/* Panels — outside the site group: azimuth is absolute */}
      <ShadowedScene
        site={site}
        activeSetup={activeSetup}
        sun={sun}
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