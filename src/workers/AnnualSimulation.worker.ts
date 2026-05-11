/**
 * Annual simulation worker.
 *
 * Receives a 'run' message with serialised BVH geometry, panel data, and an
 * optional weather data payload. Steps through every N-minute interval of a
 * full year, casts shadow rays at each step, and returns a SetupAnnualResult.
 * Progress updates are emitted every PROGRESS_INTERVAL steps.
 *
 * ## Irradiance model
 *
 * When `weatherData` is null the worker uses a geometric clear-sky model:
 *   basePower = peakPower × incidenceFactor
 * where incidenceFactor is the cosine of the angle between the sun direction
 * and the panel normal (Lambert's law). No weather or temperature correction.
 *
 * When `weatherData` is present the worker computes full Plane-of-Array (POA)
 * irradiance, combining three components:
 *
 *   POA_direct  = DNI × cos(angle_of_incidence)
 *   POA_diffuse = DHI × (1 + cos(tilt)) / 2          [isotropic sky model]
 *   POA_albedo  = GHI × groundAlbedo × (1 − cos(tilt)) / 2
 *
 * where GHI = DNI × cos(solar_zenith) + DHI and tilt is the panel inclination.
 *
 * The isotropic sky model is a well-established simplification that treats
 * diffuse irradiance as uniform across the sky hemisphere. It slightly
 * underestimates diffuse on clear days (when the circumsolar region is
 * brighter) but overestimates on partly cloudy days, and is accurate enough
 * for residential comparison purposes without requiring additional inputs.
 *
 * basePower = peakPower × (POA / 1000) × temperatureFactor × systemLossFactor
 *
 * Temperature factor (when temperature data is available):
 *   T_cell = T_ambient + (NOCT − 20) / 800 × POA
 *   temperatureFactor = 1 + γ × (T_cell − 25)
 * where γ is the panel temperature coefficient (typically −0.004 /°C) and
 * 25°C is the Standard Test Condition reference temperature.
 *
 * System loss factor:
 *   systemLossFactor = inverterEfficiency × (1 − wiringLoss)
 * Applied once to the total string/setup power after string mismatch.
 *
 * ## Worker architecture
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

THREE.Mesh.prototype.raycast = acceleratedRaycast;

const PROGRESS_INTERVAL = 100;
const STC_IRRADIANCE = 1000; // W/m² — Standard Test Condition reference
const STC_TEMPERATURE = 25;  // °C

// Scratch objects — allocated once, reused per ray to avoid GC pressure.
const _sunDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();

/**
 * Determines which zones are shaded for a single panel at one time step.
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
 * Used to look up the correct entry in the hourly weather data arrays.
 */
const utcHourOfYear = (date: Date, year: number): number => {
  const yearStart = Date.UTC(year, 0, 1, 0, 0, 0);
  return Math.floor((date.getTime() - yearStart) / 3_600_000);
};

/**
 * Computes the sky-view factor for the diffuse component: (1 + cos(tilt)) / 2.
 * At tilt = 0° (horizontal): factor = 1 (full sky visible).
 * At tilt = 90° (vertical): factor = 0.5 (half sky visible).
 */
const skyViewFactor = (tiltRad: number): number => (1 + Math.cos(tiltRad)) / 2;

/**
 * Computes the ground-view factor for the albedo component: (1 − cos(tilt)) / 2.
 * At tilt = 0°: factor = 0 (panel sees no ground).
 * At tilt = 90°: factor = 0.5 (panel sees half ground).
 */
const groundViewFactor = (tiltRad: number): number => (1 - Math.cos(tiltRad)) / 2;

/**
 * Computes the effective POA irradiance (W/m²) for one time step.
 *
 * When weather data is absent, returns STC_IRRADIANCE so that
 * basePower = peakPower × incidenceFactor (the original geometric model).
 *
 * When weather data is present, applies the isotropic sky decomposition model:
 *   POA = POA_direct + POA_diffuse + POA_albedo
 *
 * incidenceFactor is passed in (already computed from the sun direction and
 * panel normal) to avoid recomputing it here.
 */
const computePOA = (
  incidenceFactor: number,
  hourIdx: number,
  tiltRad: number,
  sunAltitude: number,
  weatherData: WorkerSimulationPayload['weatherData'],
  groundAlbedo: number,
): number => {
  if (!weatherData) return STC_IRRADIANCE;

  const dni = hourIdx >= 0 && hourIdx < weatherData.dni.length
    ? weatherData.dni[hourIdx]
    : 0;
  const dhi = hourIdx >= 0 && hourIdx < weatherData.dhi.length
    ? weatherData.dhi[hourIdx]
    : 0;

  // Global Horizontal Irradiance: beam component on a horizontal surface.
  const cosZenith = Math.sin(sunAltitude); // sin(altitude) = cos(zenith)
  const ghi = dni * Math.max(0, cosZenith) + dhi;

  const poaDirect = dni * incidenceFactor;
  const poaDiffuse = dhi * skyViewFactor(tiltRad);
  const poaAlbedo = ghi * groundAlbedo * groundViewFactor(tiltRad);

  return Math.max(0, poaDirect + poaDiffuse + poaAlbedo);
};

/**
 * Computes the temperature correction factor for one panel at one time step.
 *
 * Uses the NOCT (Nominal Operating Cell Temperature) model to estimate cell
 * temperature from ambient temperature and POA irradiance, then applies the
 * linear temperature coefficient relative to STC (25°C).
 *
 * Returns 1.0 (no correction) when temperature data is unavailable.
 */
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

  // NOCT model: T_cell = T_ambient + (NOCT − 20) / 800 × POA
  const tCell = tAmbient + ((noct - 20) / 800) * poa;
  const factor = 1 + temperatureCoefficient * (tCell - STC_TEMPERATURE);

  // Guard against negative output from extreme temperature excursions.
  return Math.max(0, factor);
};

// ── Simulation loop ───────────────────────────────────────────────────────────

const runSimulation = (payload: WorkerSimulationPayload) => {
  const {
    setupId, setupLabel, cacheKey, year, intervalMinutes,
    latitude, longitude, irradianceSource,
    density, threshold, meshes: serializedMeshes, panels,
    panelInclinationRad, systemLoss, weatherData,
  } = payload;

  const meshObjects = ThreeUtils.reconstructMeshes(serializedMeshes);

  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;

  const accumulators = AnnualSimulationEngine.initAccumulators(panels);
  const hoursPerStep = intervalMinutes / 60;
  const stepTotal = TimeUtils.totalTimeSteps(year, intervalMinutes);
  let completedSteps = 0;

  // System loss multiplier is constant for all time steps in this setup.
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
          incidenceFactor,
          hourIdx,
          panelInclinationRad,
          sun.altitude,
          weatherData,
          systemLoss.groundAlbedo,
        );

        const temperatureFactor = computeTemperatureFactor(
          poa,
          hourIdx,
          panel.temperatureCoefficient,
          panel.noct,
          weatherData,
        );

        // basePower in kW: peakPower(Wp) / 1000 × (POA/STC) × temperatureFactor
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
        // Apply system losses (inverter + wiring) to the final panel power.
        const effectivePower = stepPowers[idx] * systemLossFactor;
        AnnualSimulationEngine.accumulateStep(
          accumulators[idx],
          month, day, hour,
          effectivePower,
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