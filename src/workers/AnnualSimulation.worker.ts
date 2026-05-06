/**
 * Annual simulation worker.
 *
 * Receives a 'run' message with serialised BVH geometry, panel data, and an
 * optional irradiance array. Steps through every N-minute interval of a full
 * year, casts shadow rays at each step, and returns a SetupAnnualResult.
 * Progress updates are emitted every PROGRESS_INTERVAL steps.
 *
 * Irradiance model:
 *   When `irradianceData` is provided (a Float32Array of hourly DNI values in
 *   W/m²), each time step's base power is scaled by `dni / 1000`, where 1000
 *   W/m² is the Standard Test Condition reference irradiance. This applies a
 *   real-weather correction to the otherwise clear-sky geometric estimate.
 *   When `irradianceData` is null the worker uses the geometric model unchanged
 *   (basePower = peakPower × incidenceFactor).
 *
 * Three.js math classes (Vector3, Matrix4, Raycaster) work correctly in a
 * worker context — they have no DOM or WebGL dependencies. SunCalc is
 * similarly DOM-free.
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

// Patch THREE.Mesh.prototype.raycast once so every mesh in this worker uses BVH.
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const PROGRESS_INTERVAL = 100;

// Scratch objects — allocated once, reused per ray to avoid GC pressure.
const _sunDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();

/**
 * Determines which zones are shaded for a single panel at one time step.
 *
 * Casts one ray per sample point toward the sun and counts hits per zone.
 * A zone is considered shaded when its hit count reaches the threshold.
 */
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

/**
 * Returns the UTC hour-of-year index (0-based) for a given Date object.
 * Used to look up the correct entry in the irradianceData array.
 */
const utcHourOfYear = (date: Date, year: number): number => {
  const yearStart = Date.UTC(year, 0, 1, 0, 0, 0);
  return Math.floor((date.getTime() - yearStart) / 3_600_000);
};

// ── Simulation loop ───────────────────────────────────────────────────────────

const runSimulation = (payload: WorkerSimulationPayload) => {
  const {
    setupId, setupLabel, cacheKey, year, intervalMinutes,
    latitude, longitude, irradianceSource,
    density, threshold, meshes: serializedMeshes, panels,
    irradianceData,
  } = payload;

  const meshObjects = ThreeUtils.reconstructMeshes(serializedMeshes);

  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;

  const accumulators = AnnualSimulationEngine.initAccumulators(panels);
  const hoursPerStep = intervalMinutes / 60;
  const stepTotal = TimeUtils.totalTimeSteps(year, intervalMinutes);
  let completedSteps = 0;

  for (const { date, month, day, hour } of TimeUtils.timeSteps(year, intervalMinutes)) {
    const sun = SolarEngine.calculateSunState(date, latitude, longitude);

    if (sun.isDaylight) {
      _sunDir.set(sun.direction.x, sun.direction.y, sun.direction.z);
      raycaster.ray.direction.copy(_sunDir);

      // Compute the irradiance multiplier for this time step.
      // When irradianceData is present, scale by actual DNI / STC reference.
      // DNI values cover UTC hours; for sub-hourly intervals all steps within
      // the same UTC hour share the same DNI value.
      let irradianceMultiplier = 1;
      if (irradianceData) {
        const hourIdx = utcHourOfYear(date, year);
        const dni = hourIdx >= 0 && hourIdx < irradianceData.length
          ? irradianceData[hourIdx]
          : 0;
        irradianceMultiplier = dni / 1000;
      }

      const stringGroups = new Map<string, StringPanelEntry[]>();
      const shadedZonesByPanel: boolean[][] = [];

      panels.forEach((panel, idx) => {
        const basePower = (panel.peakPower / 1000) *
          SolarEngine.calculateIncidenceFactor(sun.direction, panel.worldNormal) *
          irradianceMultiplier;
        const shadedZones = computeShadedZones(panel, meshObjects, raycaster, threshold);
        const power = SolarEngine.calculatePanelOutput(basePower, shadedZones, panel.hasOptimizer);

        const group = stringGroups.get(panel.string) ?? [];
        group.push({ panelIdx: idx, basePower, power, hasOptimizer: panel.hasOptimizer });
        stringGroups.set(panel.string, group);

        shadedZonesByPanel[idx] = shadedZones;
      });

      const stepPowers = SolarEngine.applyStringMismatch(stringGroups, panels.length);

      panels.forEach((_, idx) => {
        AnnualSimulationEngine.accumulateStep(
          accumulators[idx],
          month, day, hour,
          stepPowers[idx],
          shadedZonesByPanel[idx],
          hoursPerStep,
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

  return AnnualSimulationEngine.buildSetupResult(
    setupId, setupLabel, cacheKey, year, intervalMinutes,
    irradianceSource, density, threshold, finalPanels,
  );
};

// ── Message handler ───────────────────────────────────────────────────────────

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

    const pong: WorkerOutgoingMessage = { type: 'pong', diagnostics };
    self.postMessage(pong);
    return;
  }

  if (type === 'run') {
    try {
      const result = runSimulation(event.data.payload);
      const msg: WorkerOutgoingMessage = { type: 'result', result };
      self.postMessage(msg);
    } catch (err) {
      const msg: WorkerOutgoingMessage = {
        type: 'error',
        setupId: event.data.payload.setupId,
        message: err instanceof Error ? err.message : String(err),
      };
      self.postMessage(msg);
    }
  }
};