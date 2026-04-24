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
 * Calculates the cosine of the angle between the sun direction and the panel normal
 * (Lambert's cosine law). Returns 0 when the sun is behind the panel.
 */
export const calculateIncidenceFactor = (sunDir: Vector3, panelNormal: Vector3): number => {
  const dot = sunDir.x * panelNormal.x + sunDir.y * panelNormal.y + sunDir.z * panelNormal.z;
  return Math.max(0, dot);
};

/**
 * Calculates the output power of a single panel based on its shaded zones.
 *
 * @param basePower   Peak power adjusted by the incidence factor (kW).
 * @param shadedZones Boolean array where true means the zone is shaded.
 * @param hasOptimizer Whether the panel has an independent DC/DC optimizer.
 *
 * Without an optimizer, bypass diodes activate for shaded zones and a 10%
 * mismatch penalty is applied to the remaining output, modelling the voltage
 * mismatch that occurs when some diodes are active and the remaining cells must
 * operate at a sub-optimal voltage.
 *
 * With an optimizer, loss is purely proportional to the fraction of shaded zones
 * because the optimizer isolates the panel's operating point from the string.
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

  if (hasOptimizer) {
    return basePower * efficiency;
  } else {
    const mismatchLoss = 0.9;
    return basePower * efficiency * mismatchLoss;
  }
};

/**
 * Determines whether a zone is shaded based on how many of its sample points
 * are shaded. The zone is considered shaded when the shaded point count reaches
 * or exceeds `threshold`.
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
 * Derives the panel's world-space normal vector from its world rotation.
 * A flat panel (zero rotation) has its normal pointing straight up (0, 1, 0).
 * The normal rotates with the panel as inclination and azimuth are applied.
 */
const getPanelNormal = (worldRotation: { x: number, y: number, z: number }): Vector3 => {
  const normal = new THREE.Vector3(0, 1, 0);
  const euler = new THREE.Euler(worldRotation.x, worldRotation.y, worldRotation.z);
  normal.applyEuler(euler);
  return { x: normal.x, y: normal.y, z: normal.z };
};

/**
 * Calculates instantaneous production across all panels for a given sun state
 * and shadow map.
 *
 * Panels are grouped by string. Strings where no panel has an optimizer apply
 * a bottleneck effect: all panels in the string are limited to the efficiency
 * of the least-efficient panel (series current constraint). Strings where at
 * least one panel has an optimizer treat every panel as independent.
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

  const panelResults = panels.map(panel => {
    const normal = getPanelNormal(panel.worldRotation);
    const incidenceFactor = calculateIncidenceFactor(sun.direction, normal);
    const basePower = (panel.peakPower / 1000) * incidenceFactor;

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
      group.forEach(p => {
        finalPanels.push({ id: p.id, power: p.power, isShaded: p.isShaded });
        totalPower += p.power;
      });
    } else {
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