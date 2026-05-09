import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { PanelRenderData, SamplePoint } from '../types/installation';
import { ShadowMap } from '../hooks/useShadowSampler';

interface SolarPanelComponentProps {
  panelId: string;
  hasOptimizer: boolean;
  showPoints: boolean;
  renderData: PanelRenderData;
  samplePoints: readonly SamplePoint[];
  shadowMap: ShadowMap;
}

/**
 * Renders a single solar panel: the aluminium frame, the diode-zone glass
 * planes, zone ID labels, and (optionally) the sample points used for shadow
 * detection.
 *
 * Zone labels use the format `{panelId}-z{zoneIndex}` (e.g. `a0-r0-c0-z0`),
 * matching the identifier scheme used in the results panel heat maps so the
 * user can correlate 3D view and heat map without ambiguity.
 *
 * All geometry (panel dimensions, zone positions and sizes) is consumed from
 * `renderData`, which is pre-computed by SolarPanelFactory. This component
 * is purely presentational and performs no calculations.
 *
 * The frame mesh carries `userData={{ isPanelFrame: true }}` so that
 * MeshFactory can exclude it from the static scene geometry batch sent to
 * simulation workers. Panel frame geometry for each simulated setup is built
 * independently by PanelMeshFactory from SimulationPanelData, ensuring the
 * worker always receives the correct panels regardless of which setup is
 * currently rendered in the 3D viewport.
 */
export function SolarPanelComponent({
  panelId,
  hasOptimizer,
  showPoints,
  renderData,
  samplePoints,
  shadowMap,
}: SolarPanelComponentProps) {
  const { actualWidth, actualHeight, frameColor, emissiveColor } = renderData;

  return (
    <group>
      {/* Frame + glass body */}
      <mesh
        castShadow
        receiveShadow
        userData={{ isPanelFrame: true }}
      >
        <boxGeometry args={[actualWidth, 0.03, actualHeight]} />
        <meshStandardMaterial
          color={frameColor}
          metalness={hasOptimizer ? 0.4 : 0.7}
          roughness={0.2}
          emissive={emissiveColor}
        />
      </mesh>

      {/* Diode zones */}
      {renderData.zones.map((zone) => {
        const zoneId = `${panelId}-z${zone.zoneIndex}`;
        const zonePoints = showPoints
          ? samplePoints.filter(sp => sp.zoneIndex === zone.zoneIndex)
          : [];

        return (
          <group key={zone.zoneIndex}>
            {/* Translucent zone plane */}
            <mesh position={[zone.posX, 0.016, zone.posZ]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[zone.width, zone.height]} />
              <meshStandardMaterial
                color="#1a3a6d"
                transparent
                opacity={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Zone ID label rendered above the panel surface */}
            <Text
              position={[zone.posX, 0.035, zone.posZ]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={Math.min(zone.width, zone.height) * 0.18}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              depthOffset={-1}
            >
              {zoneId}
            </Text>

            {/* Sample points (only shown when showPoints is enabled) */}
            {zonePoints.map((sp) => {
              const isShaded = shadowMap.get(sp.id) ?? false;
              return (
                <mesh
                  key={sp.id}
                  position={[sp.localPosition.x, sp.localPosition.y, sp.localPosition.z]}
                >
                  <sphereGeometry args={[0.01, 8, 8]} />
                  <meshBasicMaterial color={isShaded ? '#ff4444' : '#ccff00'} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}