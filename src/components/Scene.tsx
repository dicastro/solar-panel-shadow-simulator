import { useMemo, useEffect } from 'react';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Site, PanelSetup, SunState } from '../types';
import { InstantProductionResult } from '../types/simulation';
import { RailingRailRenderData, RailingSupportRenderData } from '../types/installation';
import { ShadowMap } from '../hooks/useShadowSampler';
import { ShadowedScene } from './ShadowedScene';
import { Compass } from './Compass';
import { Sun } from './Sun';
import { SolarPanelComponent } from './SolarPanelComponent';
import { useAnnualSimulation } from '../hooks/useAnnualSimulation';
import { useAppStore } from '../store/AppStore';
import { PanelSetupFactory } from '../factory/PanelSetupFactory';

interface SceneProps {
  site: Site;
  activeSetup: PanelSetup;
  sun: SunState;
  date: Date;
  showPoints: boolean;
  renderDensity: number;
  renderThreshold: number;
  onProductionUpdate: (result: InstantProductionResult) => void;
}

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

/**
 * Root 3D scene component.
 *
 * Walls and railings are children of the site group (rotation-y = site.azimuthRad)
 * so they inherit the site orientation automatically.
 *
 * Panels are rendered OUTSIDE the site group. Their worldPosition and
 * worldRotation are already in absolute world space (site azimuth baked in by
 * SolarPanelArrayFactory), which is required for the raycaster in useShadowSampler
 * to operate correctly without Three.js group inheritance.
 *
 * The annual simulation effect lists only isRunning as a dependency — the
 * simulation is a one-shot operation triggered by the false→true transition.
 */
export function Scene({
  site, activeSetup, sun, date, showPoints,
  renderDensity, renderThreshold, onProductionUpdate,
}: SceneProps) {
  const { run, stop } = useAnnualSimulation();

  const config = useAppStore(s => s.config);
  const isRunning = useAppStore(s => s.isRunning);
  const simulationDensity = useAppStore(s => s.simulationDensity);
  const simulationThreshold = useAppStore(s => s.simulationThreshold);
  const simulationInterval = useAppStore(s => s.simulationInterval);
  const simulationYear = useAppStore(s => s.simulationYear);
  const irradianceSource = useAppStore(s => s.irradianceSource);
  const updateProgress = useAppStore(s => s.updateProgress);
  const markSetupComplete = useAppStore(s => s.markSetupComplete);
  const setSetupResult = useAppStore(s => s.setSetupResult);
  const setPendingSetups = useAppStore(s => s.setPendingSetups);
  const simulationComplete = useAppStore(s => s.simulationComplete);

  useEffect(() => {
    if (!isRunning || !config || !site) return;

    const allSetups = config.setups.map((setupConfig, i) =>
      PanelSetupFactory.create(setupConfig, i, site, simulationDensity),
    );

    run(
      allSetups,
      site,
      simulationDensity,
      simulationThreshold,
      simulationInterval,
      simulationYear,
      irradianceSource,
      {
        onProgress: updateProgress,
        onSetupComplete: markSetupComplete,
        onResult: setSetupResult,
        onError: (setupId, message) => {
          console.error(`Annual simulation error for setup ${setupId}:`, message);
          markSetupComplete(setupId);
        },
        onPendingUpdate: setPendingSetups,
        onAllComplete: () => {
          simulationComplete();
          setPendingSetups(0);
        },
      },
    );

    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

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

      {/* Walls and railings — inside the site group, inherit site azimuth rotation. */}
      <group rotation-y={site.azimuthRad}>
        <mesh receiveShadow position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <extrudeGeometry args={[floorShape, { depth: 0.02, bevelEnabled: false }]} />
          <meshStandardMaterial color="#b45d16" side={THREE.DoubleSide} />
        </mesh>

        {site.wallIntersections.map(wi => (
          <mesh
            key={`post-${wi.index}`}
            position={[wi.worldPosition.x, wi.worldPosition.y, wi.worldPosition.z]}
            castShadow
          >
            <boxGeometry args={wi.renderData.boxArgs} />
            <meshStandardMaterial color={wi.renderData.color} />
          </mesh>
        ))}

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

      {/*
       * Panels — outside the site group. worldPosition and worldRotation are
       * in absolute world space (site azimuth already incorporated by
       * SolarPanelArrayFactory), so the raycaster in useShadowSampler receives
       * correct world-space coordinates without Three.js group inheritance.
       */}
      <ShadowedScene
        site={site}
        activeSetup={activeSetup}
        sun={sun}
        density={renderDensity}
        threshold={renderThreshold}
        onProductionUpdate={onProductionUpdate}
      >
        {(shadowMap: ShadowMap) =>
          activeSetup.panelArrays.flatMap(pa =>
            pa.panels.map(panel => (
              <group
                key={panel.id}
                position={[panel.worldPosition.x, panel.worldPosition.y, panel.worldPosition.z]}
                rotation={new THREE.Euler(
                  panel.worldRotation.x,
                  panel.worldRotation.y,
                  panel.worldRotation.z,
                  panel.worldRotation.order ?? 'XYZ',
                )}
              >
                <SolarPanelComponent
                  panelId={panel.id}
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