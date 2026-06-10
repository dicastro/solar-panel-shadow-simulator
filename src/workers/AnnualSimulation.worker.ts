/**
 * Annual simulation worker.
 *
 * Receives a 'run' message with serialised BVH geometry, panel data, and an
 * optional weather data payload. Steps through every N-minute interval of a
 * full year, casts shadow rays at each step, and returns a SimulationSetupResult
 * for one setup. Progress updates are emitted every PROGRESS_INTERVAL steps.
 *
 * The worker is unaware of caching, configuration hashes, or run grouping —
 * those concerns are handled entirely on the main thread.
 */

import * as THREE from 'three';
import SunCalc from 'suncalc';
import { acceleratedRaycast } from 'three-mesh-bvh';
import {
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  WorkerSimulationPayload,
  SimulationPanelData,
  WorkerDiagnostics,
} from '../types/simulation';
import { SolarEngine, StringPanelEntry } from '../engine/SolarEngine';
import { ThreeUtils } from '../utils/ThreeUtils';
import { TimeUtils } from '../utils/TimeUtils';
import { AnnualSimulationEngine } from '../engine/AnnualSimulationEngine';

THREE.Mesh.prototype.raycast = acceleratedRaycast;

const PROGRESS_INTERVAL = 100;
const STC_IRRADIANCE = 1000;
const STC_TEMPERATURE = 25;

const _sunDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();

const computeShadedZones = (
  panel: SimulationPanelData,
  meshes: THREE.Mesh[],
  raycaster: THREE.Raycaster,
  threshold: number,
): boolean[] => {
  const shadedCountByZone = new Array<number>(panel.zones).fill(0);
  for (const sp of panel.samplePoints) {
    _rayOrigin.set(sp.x, sp.y, sp.z);
    raycaster.ray.origin.copy(_rayOrigin);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.some(h => h.distance > 0.01)) {
      shadedCountByZone[sp.zoneIndex]++;
    }
  }
  return shadedCountByZone.map(count => count >= threshold);
};

const utcHourOfYear = (date: Date, year: number): number => {
  const yearStart = Date.UTC(year, 0, 1, 0, 0, 0);
  return Math.floor((date.getTime() - yearStart) / 3_600_000);
};

const skyViewFactor = (tiltRad: number): number => (1 + Math.cos(tiltRad)) / 2;
const groundViewFactor = (tiltRad: number): number => (1 - Math.cos(tiltRad)) / 2;

const computePOA = (
  incidenceFactor: number,
  hourIdx: number,
  tiltRad: number,
  sunAltitude: number,
  weatherData: WorkerSimulationPayload['weatherData'],
  groundAlbedo: number,
): number => {
  if (!weatherData) return STC_IRRADIANCE;

  const dni = hourIdx >= 0 && hourIdx < weatherData.dni.length ? weatherData.dni[hourIdx] : 0;
  const dhi = hourIdx >= 0 && hourIdx < weatherData.dhi.length ? weatherData.dhi[hourIdx] : 0;
  const cosZenith = Math.sin(sunAltitude);
  const ghi = dni * Math.max(0, cosZenith) + dhi;

  return Math.max(0,
    dni * incidenceFactor +
    dhi * skyViewFactor(tiltRad) +
    ghi * groundAlbedo * groundViewFactor(tiltRad),
  );
};

const computeTemperatureFactor = (
  poa: number,
  hourIdx: number,
  temperatureCoefficient: number,
  noct: number,
  weatherData: WorkerSimulationPayload['weatherData'],
): number => {
  if (!weatherData?.temperature) return 1.0;
  const tAmbient = hourIdx >= 0 && hourIdx < weatherData.temperature.length
    ? weatherData.temperature[hourIdx]
    : STC_TEMPERATURE;
  const tCell = tAmbient + ((noct - 20) / 800) * poa;
  return Math.max(0, 1 + temperatureCoefficient * (tCell - STC_TEMPERATURE));
};

const runSimulation = (payload: WorkerSimulationPayload) => {
  const {
    setupId, setupLabel, year, intervalMinutes,
    latitude, longitude, threshold,
    meshes: serializedMeshes, panels,
    panelInclinationRad, systemLoss, weatherData,
  } = payload;

  const meshObjects = ThreeUtils.reconstructMeshes(serializedMeshes);
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;

  const accumulators = AnnualSimulationEngine.initAccumulators(panels);
  const hoursPerStep = intervalMinutes / 60;
  const stepTotal = TimeUtils.totalTimeSteps(year, intervalMinutes);
  let completedSteps = 0;

  const systemLossFactor = systemLoss.inverterEfficiency * (1 - systemLoss.wiringLoss);

  for (const { date, month, day, hour } of TimeUtils.timeSteps(year, intervalMinutes)) {
    const sun = SolarEngine.calculateSunState(date, latitude, longitude);

    if (sun.isDaylight) {
      _sunDir.set(sun.direction.x, sun.direction.y, sun.direction.z);
      raycaster.ray.direction.copy(_sunDir);

      const hourIdx = utcHourOfYear(date, year);
      const stringGroups = new Map<string, StringPanelEntry[]>();
      const shadedZonesByPanel: boolean[][] = [];

      panels.forEach((panel, idx) => {
        const incidenceFactor = SolarEngine.calculateIncidenceFactor(sun.direction, panel.worldNormal);
        const poa = computePOA(
          incidenceFactor, hourIdx, panelInclinationRad,
          sun.altitude, weatherData, systemLoss.groundAlbedo,
        );
        const temperatureFactor = computeTemperatureFactor(
          poa, hourIdx, panel.temperatureCoefficient, panel.noct, weatherData,
        );
        const basePower = (panel.peakPower / 1000) * (poa / STC_IRRADIANCE) * temperatureFactor;
        const shadedZones = computeShadedZones(panel, meshObjects, raycaster, threshold);
        const power = SolarEngine.calculatePanelOutput(basePower, shadedZones, panel.hasOptimizer);

        const group = stringGroups.get(panel.string) ?? [];
        group.push({ panelIdx: idx, basePower, power, hasOptimizer: panel.hasOptimizer });
        stringGroups.set(panel.string, group);
        shadedZonesByPanel[idx] = shadedZones;
      });

      const stepPowers = SolarEngine.applyStringMismatch(stringGroups, panels.length);

      panels.forEach((_, idx) => {
        const effectivePower = stepPowers[idx] * systemLossFactor;
        AnnualSimulationEngine.accumulateStep(
          accumulators[idx], month, day, hour,
          effectivePower, shadedZonesByPanel[idx], hoursPerStep,
        );
      });
    }

    completedSteps++;
    if (completedSteps % PROGRESS_INTERVAL === 0 || completedSteps === stepTotal) {
      const msg: WorkerOutgoingMessage = {
        type: 'progress',
        setupId,
        completed: completedSteps,
        total: stepTotal,
      };
      self.postMessage(msg);
    }
  }

  const finalPanels = panels.map((panel, idx) =>
    AnnualSimulationEngine.finalizePanel(panel, accumulators[idx]),
  );

  meshObjects.forEach(m => m.geometry.dispose());

  return AnnualSimulationEngine.buildSetupResult(setupId, setupLabel, finalPanels);
};

self.onmessage = (event: MessageEvent<WorkerIncomingMessage>) => {
  const { type } = event.data;

  if (type === 'ping') {
    const hardwareConcurrency = navigator.hardwareConcurrency ?? 1;
    const getRecommendation = (n: number) =>
      Math.max(1, Math.min(hardwareConcurrency - 1, n));

    const diagnostics: WorkerDiagnostics = {
      threeVersion: THREE.REVISION,
      sunCalcAvailable: typeof SunCalc.getPosition === 'function',
      hardwareConcurrency,
      testRecommendations: {
        for1: getRecommendation(1),
        for3: getRecommendation(3),
        for8: getRecommendation(8),
      },
    };
    self.postMessage({ type: 'pong', diagnostics } as WorkerOutgoingMessage);
    return;
  }

  if (type === 'run') {
    try {
      const result = runSimulation(event.data.payload);
      self.postMessage({ type: 'result', result } as WorkerOutgoingMessage);
    } catch (err) {
      self.postMessage({
        type: 'error',
        setupId: event.data.payload.setupId,
        message: err instanceof Error ? err.message : String(err),
      } as WorkerOutgoingMessage);
    }
  }
};