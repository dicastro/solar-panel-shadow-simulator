/**
 * Annual simulation worker.
 *
 * Receives a 'run' message with serialised BVH geometry and panel data,
 * steps through every N-minute interval of a full year, casts shadow rays
 * at each step, accumulates energy and shade fractions, and returns a
 * SetupAnnualResult. Progress updates are emitted every PROGRESS_INTERVAL
 * steps to avoid flooding the main thread.
 *
 * Three.js math classes (Vector3, Matrix4, Raycaster) work correctly in a
 * worker context — they have no DOM or WebGL dependencies. SunCalc is
 * similarly DOM-free. Both are validated in Phase 0.
 *
 * Responds to 'ping' with diagnostic information (preserved from Phase 0).
 */

import * as THREE from 'three';
import SunCalc from 'suncalc';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import {
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  WorkerSimulationPayload,
  WorkerPanelData,
  SetupAnnualResult,
  PanelAnnualData,
  WorkerDiagnostics,
} from '../types/simulation';

// Patch THREE.Mesh.prototype.raycast once so every mesh in this worker uses BVH.
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const PROGRESS_INTERVAL = 100;

// ── Scratch objects — allocated once, reused per ray to avoid GC pressure ────

const _sunDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();

// ── BVH reconstruction ────────────────────────────────────────────────────────

interface ReconstructedMesh {
  mesh: THREE.Mesh;
}

const reconstructMeshes = (
  serializedMeshes: WorkerSimulationPayload['meshes'],
): ReconstructedMesh[] =>
  serializedMeshes.map(sm => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(sm.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(sm.indices, 1));
    geometry.boundsTree = MeshBVH.deserialize(sm.serializedBvh, geometry);

    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.matrixAutoUpdate = false;
    mesh.matrix.fromArray(Array.from(sm.worldMatrix));
    mesh.matrixWorld.copy(mesh.matrix);

    return { mesh };
  });

// ── Sun direction helper ──────────────────────────────────────────────────────

const getSunDirection = (
  date: Date,
  lat: number,
  lon: number,
): { direction: THREE.Vector3; isDaylight: boolean } => {
  const pos = SunCalc.getPosition(date, lat, lon);
  const isDaylight = pos.altitude > 0;

  _sunDir.set(
    Math.cos(pos.altitude) * Math.sin(-pos.azimuth),
    Math.sin(pos.altitude),
    Math.cos(pos.altitude) * Math.cos(pos.azimuth),
  ).normalize();

  return { direction: _sunDir, isDaylight };
};

// ── Incidence factor (Lambert's cosine law) ───────────────────────────────────

const incidenceFactor = (
  sunDir: THREE.Vector3,
  normal: { x: number; y: number; z: number },
): number => Math.max(0, sunDir.x * normal.x + sunDir.y * normal.y + sunDir.z * normal.z);

// ── Zone shading ──────────────────────────────────────────────────────────────

/**
 * Determines which zones are shaded for a single panel at one time step.
 * Returns a boolean array indexed by zone.
 */
const computeShadedZones = (
  panel: WorkerPanelData,
  meshes: THREE.Mesh[],
  raycaster: THREE.Raycaster,
  sunDir: THREE.Vector3,
  density: number,
  threshold: number,
): boolean[] => {
  const shadedCountByZone = new Array<number>(panel.zones).fill(0);

  raycaster.ray.direction.copy(sunDir);

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

// ── Panel output (mirrors solarEngine.ts logic) ───────────────────────────────

const panelOutput = (
  basePower: number,
  shadedZones: boolean[],
  hasOptimizer: boolean,
): number => {
  const total = shadedZones.length;
  const shaded = shadedZones.filter(Boolean).length;

  if (shaded === 0) return basePower;
  if (shaded === total) return 0;

  const efficiency = (total - shaded) / total;
  return hasOptimizer ? basePower * efficiency : basePower * efficiency * 0.9;
};

// ── String mismatch (mirrors solarEngine.ts logic) ────────────────────────────

interface StringPanelState {
  panelIdx: number;
  basePower: number;
  power: number;
  hasOptimizer: boolean;
}

const applyStringMismatch = (
  stringGroups: Map<string, StringPanelState[]>,
  out: number[],
): void => {
  stringGroups.forEach(group => {
    const hasAnyOptimizer = group.some(p => p.hasOptimizer);
    if (hasAnyOptimizer) {
      group.forEach(p => { out[p.panelIdx] = p.power; });
    } else {
      const worstEfficiency = Math.min(
        ...group.map(p => p.basePower > 0 ? p.power / p.basePower : 1),
      );
      group.forEach(p => { out[p.panelIdx] = p.basePower * worstEfficiency; });
    }
  });
};

// ── Time step iteration ───────────────────────────────────────────────────────

/**
 * Generates every simulation time step for a given year at the specified
 * interval. Each step is a Date representing the start of that interval
 * in UTC, along with its month, day-of-month (0-based), and hour-of-day.
 */
function* timeSteps(year: number, intervalMinutes: number): Generator<{
  date: Date;
  month: number;
  day: number;
  hour: number;
}> {
  const msPerStep = intervalMinutes * 60 * 1000;
  const start = Date.UTC(year, 0, 1, 0, 0, 0);
  const end = Date.UTC(year + 1, 0, 1, 0, 0, 0);

  for (let ms = start; ms < end; ms += msPerStep) {
    const d = new Date(ms);
    yield {
      date: d,
      month: d.getUTCMonth(),
      day: d.getUTCDate() - 1,
      hour: d.getUTCHours(),
    };
  }
}

// ── Simulation loop ───────────────────────────────────────────────────────────

const runSimulation = (payload: WorkerSimulationPayload): SetupAnnualResult => {
  const {
    setupId, setupLabel, cacheKey, year, intervalMinutes,
    latitude, longitude, irradianceSource,
    density, threshold, meshes: serializedMeshes, panels,
  } = payload;

  const reconstructed = reconstructMeshes(serializedMeshes);
  const meshObjects = reconstructed.map(r => r.mesh);

  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;

  // Initialise per-panel accumulators.
  const panelData: Array<{
    energyKwh: number[][][];
    shadeFraction: number[][][];
    zoneShadeFraction: number[][][][];
    stepCountByBucket: number[][][];
    shadedStepsByBucket: number[][][];
    shadedZoneStepsByBucket: number[][][][];
  }> = panels.map(p => ({
    energyKwh: Array.from({ length: 12 }, () =>
      Array.from({ length: 31 }, () => new Array(24).fill(0))),
    shadeFraction: Array.from({ length: 12 }, () =>
      Array.from({ length: 31 }, () => new Array(24).fill(0))),
    zoneShadeFraction: Array.from({ length: p.zones }, () =>
      Array.from({ length: 12 }, () =>
        Array.from({ length: 31 }, () => new Array(24).fill(0)))),
    stepCountByBucket: Array.from({ length: 12 }, () =>
      Array.from({ length: 31 }, () => new Array(24).fill(0))),
    shadedStepsByBucket: Array.from({ length: 12 }, () =>
      Array.from({ length: 31 }, () => new Array(24).fill(0))),
    shadedZoneStepsByBucket: Array.from({ length: p.zones }, () =>
      Array.from({ length: 12 }, () =>
        Array.from({ length: 31 }, () => new Array(24).fill(0)))),
  }));

  // Count total steps for progress reporting.
  const msPerStep = intervalMinutes * 60 * 1000;
  const totalSteps = Math.floor(
    (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / msPerStep,
  );

  let completedSteps = 0;

  const stepPowers = new Array<number>(panels.length).fill(0);

  for (const { date, month, day, hour } of timeSteps(year, intervalMinutes)) {
    const { direction, isDaylight } = getSunDirection(date, latitude, longitude);

    if (isDaylight) {
      // Compute per-panel outputs for this step.
      const currentStepGroups = new Map<string, StringPanelState[]>();
      panels.forEach((p, idx) => {
        const base = (p.peakPower / 1000) * incidenceFactor(direction, p.worldNormal);
        const shadedZones = computeShadedZones(p, meshObjects, raycaster, direction, density, threshold);
        const power = panelOutput(base, shadedZones, p.hasOptimizer);

        const group = currentStepGroups.get(p.string) ?? [];
        group.push({ panelIdx: idx, basePower: base, power, hasOptimizer: p.hasOptimizer });
        currentStepGroups.set(p.string, group);

        // Accumulate shade fractions.
        const acc = panelData[idx];
        acc.stepCountByBucket[month][day][hour]++;
        if (shadedZones.some(Boolean)) {
          acc.shadedStepsByBucket[month][day][hour]++;
        }
        shadedZones.forEach((isShaded, zIdx) => {
          if (isShaded) acc.shadedZoneStepsByBucket[zIdx][month][day][hour]++;
        });
      });

      applyStringMismatch(currentStepGroups, stepPowers);

      // Accumulate energy (kWh = kW × hours per step).
      const hoursPerStep = intervalMinutes / 60;
      panels.forEach((_, idx) => {
        panelData[idx].energyKwh[month][day][hour] += stepPowers[idx] * hoursPerStep;
      });
    }

    completedSteps++;

    if (completedSteps % PROGRESS_INTERVAL === 0 || completedSteps === totalSteps) {
      const msg: WorkerOutgoingMessage = {
        type: 'progress',
        setupId,
        completed: completedSteps,
        total: totalSteps,
      };
      self.postMessage(msg);
    }
  }

  // Compute shade fractions from raw counts.
  panels.forEach((p, idx) => {
    const acc = panelData[idx];
    for (let m = 0; m < 12; m++) {
      for (let d = 0; d < 31; d++) {
        for (let h = 0; h < 24; h++) {
          const count = acc.stepCountByBucket[m][d][h];
          if (count > 0) {
            acc.shadeFraction[m][d][h] = acc.shadedStepsByBucket[m][d][h] / count;
            for (let z = 0; z < p.zones; z++) {
              acc.zoneShadeFraction[z][m][d][h] =
                acc.shadedZoneStepsByBucket[z][m][d][h] / count;
            }
          }
        }
      }
    }
  });

  // Build final PanelAnnualData array.
  const finalPanels: PanelAnnualData[] = panels.map((p, idx) => ({
    panelId: p.id,
    arrayIndex: p.arrayIndex,
    row: p.row,
    col: p.col,
    energyKwh: panelData[idx].energyKwh,
    shadeFraction: panelData[idx].shadeFraction,
    zoneShadeFraction: panelData[idx].zoneShadeFraction,
  }));

  // Roll up monthly totals across all panels.
  const monthlyTotalKwh = Array(12).fill(0) as number[];
  finalPanels.forEach(p => {
    p.energyKwh.forEach((days, m) => {
      days.forEach(hours => {
        hours.forEach(kwh => { monthlyTotalKwh[m] += kwh; });
      });
    });
  });

  const annualTotalKwh = monthlyTotalKwh.reduce((s, v) => s + v, 0);

  // Dispose reconstructed geometries.
  reconstructed.forEach(r => r.mesh.geometry.dispose());

  return {
    setupId,
    setupLabel,
    cacheKey,
    computedAt: Date.now(),
    year,
    intervalMinutes,
    irradianceSource,
    panels: finalPanels,
    monthlyTotalKwh,
    annualTotalKwh,
  };
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