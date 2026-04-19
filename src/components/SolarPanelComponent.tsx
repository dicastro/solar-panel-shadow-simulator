import * as THREE from 'three';
import { PanelRenderData, SamplePoint } from '../types/installation';
import { ShadowMap } from '../hooks/useShadowSampler';

interface SolarPanelComponentProps {
  hasOptimizer: boolean;
  showPoints: boolean;
  renderData: PanelRenderData;
  samplePoints: readonly SamplePoint[];
  shadowMap: ShadowMap;
}

/**
 * Renders a single solar panel: the aluminium frame, the diode-zone glass
 * planes, and (optionally) the sample points used for shadow detection.
 *
 * All geometry (panel dimensions, zone positions and sizes) is consumed from
 * `renderData`, which is pre-computed by SolarPanelFactory.  This component
 * is purely presentational and performs no calculations.
 */
export function SolarPanelComponent({
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
      <mesh castShadow receiveShadow>
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