import SunCalc from 'suncalc';
import * as THREE from 'three';
import { SunState, SimulationResult, PanelSimulationResult } from './types/simulation';
import { Vector3 } from './types/geometry';
import { SolarPanel } from './types/installation';
import { ShadowMap } from './hooks/useShadowSampler';

export const calculateSunState = (date: Date, lat: number, lon: number): SunState => {
    const sunPos = SunCalc.getPosition(date, lat, lon);
    const isDaylight = sunPos.altitude > 0;
    
    const threeDirection = new THREE.Vector3(
        Math.cos(sunPos.altitude) * Math.sin(-sunPos.azimuth),
        Math.sin(sunPos.altitude),
        Math.cos(sunPos.altitude) * Math.cos(sunPos.azimuth)
    ).normalize();

    const direction: Vector3 = { x: threeDirection.x, y: threeDirection.y, z: threeDirection.z };

    return {
        altitude: sunPos.altitude,
        azimuth: sunPos.azimuth,
        isDaylight,
        direction
    };
};

/**
 * Calculates panel efficiency based uniquely in sun angle
 */
export const calculateIncidenceFactor = (sunDir: Vector3, panelNormal: Vector3): number => {
    const dot = sunDir.x * panelNormal.x + sunDir.y * panelNormal.y + sunDir.z * panelNormal.z;
    return Math.max(0, dot); // if it is negative, the sun is behind the panel
};

/**
 * Calcula la potencia de un panel basándose en sus zonas sombreadas
 * @param basePower Potencia pico ajustada por el factor de incidencia (W)
 * @param shadedZones Array de booleanos (true = zona sombreada)
 * @param hasOptimizer Si el panel tiene optimizador independiente
 */
export const calculatePanelOutput = (
    basePower: number, 
    shadedZones: boolean[], 
    hasOptimizer: boolean
): number => {
    const zonesCount = shadedZones.length;
    const shadedCount = shadedZones.filter(z => z).length;

    if (shadedCount === 0) return basePower;
    if (shadedCount === zonesCount) return 0;

    const efficiency = (zonesCount - shadedCount) / zonesCount;

    if (hasOptimizer) { // Scenario A: With Optimizer
        // La pérdida es puramente proporcional. 
        // Si tienes 3 zonas y falla 1, produces exactamente el 66.6%.
        return basePower * efficiency;
    } else { // Scenario B: Without Optimizador (Traditional Bypass Diodes)
        // En muchos paneles reales, si una zona entra en sombra, el diodo 
        // "salta" y la producción de esa zona cae a 0, pero además suele haber 
        // una pequeña penalización por desajuste de voltaje (mismatch).
        // Para nuestra simulación, aplicaremos una penalización extra del 10% 
        // sobre la capacidad restante por no tener optimización activa.
        const mismatchLoss = 0.9; // mismatch penalty of 10% without optimizer
        return basePower * efficiency * mismatchLoss;
    }
};

/**
 * Determines if a zone is shaded based on how many of its sample points are shaded.
 * threshold: minimum number of shaded points to consider the zone as shaded.
 */
const isZoneShaded = (
    panelId: string,
    zoneIndex: number,
    density: number,
    shadowMap: ShadowMap,
    threshold: number,
): boolean => {
  let shadedCount = 0;
  
  for (let row = 0; row < density; row++) {
    for (let col = 0; col < density; col++) {
      const pointId = `${panelId}-z${zoneIndex}-r${row}-c${col}`;
      if (shadowMap.get(pointId)) shadedCount++;
    }
  }

  return shadedCount >= threshold;
};

/**
 * Calculates the panel normal vector from its world rotation.
 * A panel lying flat has normal pointing up (0,1,0).
 * When inclined, the normal rotates with the panel.
 */
const getPanelNormal = (worldRotation: { x: number, y: number, z: number }): Vector3 => {
  // Panel normal in local space points up (0, 1, 0)
  // We apply the panel rotation to get the world-space normal
  const normal = new THREE.Vector3(0, 1, 0);
  const euler  = new THREE.Euler(worldRotation.x, worldRotation.y, worldRotation.z);
  
  normal.applyEuler(euler);
  
  return { x: normal.x, y: normal.y, z: normal.z };
};

/**
 * Full instantaneous production calculation.
 * Groups panels by string and applies string-level mismatch if no optimizer.
 */
export const calculateInstantProduction = (
    panels: readonly SolarPanel[],
    sun: SunState,
    shadowMap: ShadowMap,
    density: number,
    threshold: number,
): SimulationResult => {
  if (!sun.isDaylight) {
    return {
      instantPower: 0,
      panels: panels.map(p => ({ id: p.id, power: 0, isShaded: false })),
    };
  }

  // Step 1 — calculate each panel's maximum possible output (incidence factor applied)
  const panelResults = panels.map(panel => {
    const normal = getPanelNormal(panel.worldRotation);
    const incidenceFactor = calculateIncidenceFactor(sun.direction, normal);
    const basePower = (panel.peakPower / 1000) * incidenceFactor; // W → kW

    const shadedZones = Array.from({ length: panel.zones }, (_, zIdx) =>
      isZoneShaded(panel.id, zIdx, density, shadowMap, threshold)
    );

    const power = calculatePanelOutput(basePower, shadedZones, panel.hasOptimizer);
    const isShaded = shadedZones.some(z => z);

    return {
      id: panel.id,
      string: panel.string,
      power,
      peakKw: basePower,
      hasOptimizer: panel.hasOptimizer,
      isShaded
    };
  });

  // Step 2 — apply string-level mismatch for panels without optimizer
  // In a string without optimizers, all panels are limited to the worst panel's efficiency
  const stringGroups = new Map<string, typeof panelResults>();
  panelResults.forEach(p => {
    const group = stringGroups.get(p.string) ?? [];
    group.push(p);
    stringGroups.set(p.string, group);
  });

  let totalPower = 0;
  const finalPanels: PanelSimulationResult[] = [];

  stringGroups.forEach((group) => {
    const hasAnyOptimizer = group.some(p => p.hasOptimizer);

    if (hasAnyOptimizer) {
      // Mixed or full optimizer string: each panel produces independently
      group.forEach(p => {
        finalPanels.push({ id: p.id, power: p.power, isShaded: p.isShaded });
        totalPower += p.power;
      });
    } else {
      // Pure string without optimizers: bottleneck effect
      // The string efficiency is the minimum individual efficiency
      const worstEfficiency = Math.min(
        ...group.map(p => p.peakKw > 0 ? p.power / p.peakKw : 1)
      );
      group.forEach(p => {
        const limitedPower = p.peakKw * worstEfficiency;
        finalPanels.push({ id: p.id, power: limitedPower, isShaded: p.isShaded });
        totalPower += limitedPower;
      });
    }
  });

  return { instantPower: totalPower, panels: finalPanels };
};