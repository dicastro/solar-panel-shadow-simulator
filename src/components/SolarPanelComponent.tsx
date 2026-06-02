import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { PanelRenderData, SamplePoint } from '../types/installation';
import { ShadowMap } from '../hooks/useShadowSampler';
import { StringColoursUtils } from '../utils/StringColourUtils';

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
 * planes, zone ID labels, the string colour border, and (optionally) the
 * sample points used for shadow detection.
 *
 * The string colour border is a rectangle rendered as edges on the front
 * face of the panel, rotated to match the zone planes (rotation X = -π/2).
 * It sits at Y = 0.018, just above the zone planes at Y = 0.016, to avoid
 * z-fighting.
 *
 * The frame mesh carries `userData={{ isPanelFrame: true }}` so that
 * MeshFactory can exclude it from the static scene geometry batch sent to
 * simulation workers.
 */
export function SolarPanelComponent({
  panelId,
  hasOptimizer,
  showPoints,
  renderData,
  samplePoints,
  shadowMap,
}: SolarPanelComponentProps) {
  const { actualWidth, actualHeight, frameColor, emissiveColor, stringColorIndex } = renderData;
  const stringColour = StringColoursUtils.getStringColour(stringColorIndex);

  return (
    <group>
      {/* Frame + glass body */}
      <mesh castShadow receiveShadow userData={{ isPanelFrame: true }}>
        <boxGeometry args={[actualWidth, 0.03, actualHeight]} />
        <meshStandardMaterial
          color={frameColor}
          metalness={hasOptimizer ? 0.4 : 0.7}
          roughness={0.2}
          emissive={emissiveColor}
        />
      </mesh>

      {/* String colour border */}
      <lineSegments position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(actualWidth - 0.01, actualHeight - 0.01)]} />
        <lineBasicMaterial color={stringColour} />
      </lineSegments>

      {/* Diode zones */}
      {renderData.zones.map((zone) => {
        const zoneId = `${panelId}-z${zone.zoneIndex}`;
        const zonePoints = showPoints
          ? samplePoints.filter(sp => sp.zoneIndex === zone.zoneIndex)
          : [];

        return (
          <group key={zone.zoneIndex}>
            <mesh position={[zone.posX, 0.016, zone.posZ]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[zone.width, zone.height]} />
              <meshStandardMaterial
                color="#1a3a6d"
                transparent
                opacity={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>

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