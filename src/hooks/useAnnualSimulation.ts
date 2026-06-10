import { useCallback, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PanelSetup, Site } from '../types/installation';
import {
  WorkerSimulationPayload,
  WorkerOutgoingMessage,
  SetupSimulationProgress,
  IrradianceSource,
  SerializedMesh,
  SystemLossParams,
  SimulationSetupResult,
} from '../types/simulation';
import { SimulationCacheUtils } from '../utils/SimulationCacheUtils';
import { SimulationCache } from '../db/SimulationCache';
import { AnnualSimulationEngine } from '../engine/AnnualSimulationEngine';
import { SolarPanelConverter } from '../converter/SolarPanelConverter';
import AnnualWorker from '../workers/AnnualSimulation.worker?worker';
import { MeshFactory } from '../factory/MeshFactory';
import { PanelMeshFactory } from '../factory/PanelMeshFactory';
import { createIrradianceProvider } from '../irradiance/IrradianceProvider';
import { appEvents } from '../events/AppEvents';
import { Config } from '../types/config';

/**
 * Module-level stop flag. Activated synchronously by stopSimulation() in the
 * store before any React effect cleanup runs. This ensures worker messages
 * arriving after the user stops the simulation are discarded immediately,
 * without depending on React's asynchronous effect cleanup timing.
 */
export const simulationStopFlag = { current: false };

const maxWorkers = (): number =>
  Math.max(1, (navigator.hardwareConcurrency ?? 2) - 1);

const isNotPanelFrame = (mesh: THREE.Mesh): boolean =>
  mesh.userData.isPanelFrame !== true;

const meanInclinationRad = (setup: PanelSetup): number => {
  const allPanels = setup.panelArrays.flatMap(pa => pa.panels);
  if (allPanels.length === 0) return 0;
  return allPanels.reduce((acc, p) => acc + p.worldRotation.x, 0) / allPanels.length;
};

const buildPayload = (
  setup: PanelSetup,
  site: Site,
  density: number,
  threshold: number,
  intervalMinutes: number,
  year: number,
  irradianceSource: IrradianceSource,
  getStaticMeshes: () => { meshes: SerializedMesh[]; transferables: ArrayBuffer[] },
  weatherData: { dni: Float32Array; dhi: Float32Array; temperature: Float32Array | null } | null,
): { payload: WorkerSimulationPayload; transferables: ArrayBuffer[] } => {
  const allPanels = setup.panelArrays.flatMap(pa => pa.panels);
  const panels = SolarPanelConverter.toSimulationPanelDataArray(allPanels);

  const staticBatch = getStaticMeshes();
  const panelBatch = PanelMeshFactory.buildFromPanelData(panels);

  const meshes: SerializedMesh[] = [...staticBatch.meshes, ...panelBatch.meshes];
  const transferables: ArrayBuffer[] = [
    ...staticBatch.transferables,
    ...panelBatch.transferables,
  ];

  const systemLoss: SystemLossParams = {
    inverterEfficiency: site.inverterEfficiency,
    wiringLoss: site.wiringLoss,
    groundAlbedo: site.groundAlbedo,
  };

  let workerWeatherData: WorkerSimulationPayload['weatherData'] = null;
  if (weatherData) {
    const dniCopy = weatherData.dni.slice();
    const dhiCopy = weatherData.dhi.slice();
    const tempCopy = weatherData.temperature?.slice() ?? null;
    transferables.push(dniCopy.buffer as ArrayBuffer, dhiCopy.buffer as ArrayBuffer);
    if (tempCopy) transferables.push(tempCopy.buffer as ArrayBuffer);
    workerWeatherData = { dni: dniCopy, dhi: dhiCopy, temperature: tempCopy };
  }

  return {
    payload: {
      setupId: setup.id,
      setupLabel: setup.label,
      year,
      intervalMinutes,
      latitude: site.location.latitude,
      longitude: site.location.longitude,
      irradianceSource,
      density,
      threshold,
      meshes,
      panels,
      panelInclinationRad: meanInclinationRad(setup),
      systemLoss,
      weatherData: workerWeatherData,
    },
    transferables,
  };
};

export interface AnnualSimulationCallbacks {
  onProgress: (progress: SetupSimulationProgress) => void;
  onSetupComplete: (setupId: string) => void;
  onRunSaved: () => void;
  onError: (setupId: string, message: string) => void;
  onAllComplete: () => void;
  onPendingUpdate: (count: number) => void;
}

export function useAnnualSimulation() {
  const { scene } = useThree();
  const workersRef = useRef<Worker[]>([]);

  const stop = useCallback(() => {
    simulationStopFlag.current = true;
    workersRef.current.forEach(w => w.terminate());
    workersRef.current = [];
  }, []);

  const run = useCallback(async (
    setups: PanelSetup[],
    site: Site,
    config: Config,
    density: number,
    threshold: number,
    intervalMinutes: number,
    year: number,
    irradianceSource: IrradianceSource,
    callbacks: AnnualSimulationCallbacks,
  ) => {
    stop();
    simulationStopFlag.current = false;

    // Build the cache key from the five UI parameters only.
    const cacheKeyObj = SimulationCacheUtils.buildCacheKey(
      year, intervalMinutes, irradianceSource, density, threshold,
    );
    const cacheKey = SimulationCacheUtils.hashCacheKey(cacheKeyObj);

    // Hash of all simulation-relevant config fields. Stored in the result so
    // the UI can detect when the configuration has changed since the run.
    const simulationInputHash = SimulationCacheUtils.buildSimulationInputHash(config);

    // Check whether a valid cached result already exists for this combination
    // of UI parameters AND current configuration. If both the cache key and
    // the simulationInputHash match, the stored result is still valid and
    // there is nothing to recompute.
    const existingResult = await SimulationCache.getResult(cacheKey);
    if (existingResult && existingResult.simulationInputHash === simulationInputHash) {
      // Cached result is up to date — notify UI and finish immediately.
      callbacks.onRunSaved();
      appEvents.emit('simulationResultsChanged', { autoSelect: true });
      callbacks.onAllComplete();
      return;
    }

    // Fetch weather data before spawning workers so all workers share the
    // same data without each making an independent network request.
    let sharedWeatherData: { dni: Float32Array; dhi: Float32Array; temperature: Float32Array | null } | null = null;
    try {
      const provider = await createIrradianceProvider(irradianceSource);
      const data = await provider.getHourlyWeatherData(
        site.location.latitude, site.location.longitude, year,
      );
      if (data) {
        sharedWeatherData = { dni: data.dni, dhi: data.dhi, temperature: data.temperature };
      } else if (irradianceSource !== 'geometric') {
        console.warn('useAnnualSimulation: irradiance fetch failed, falling back to geometric model');
      }
    } catch (err) {
      console.warn('useAnnualSimulation: irradiance provider error', err);
    }

    if (simulationStopFlag.current) return;

    const { build: getStaticMeshes } = MeshFactory.fromScene(scene, isNotPanelFrame);

    // Accumulate SimulationSetupResult from each worker. When all have
    // completed, assemble and persist the single SimulationRunResult.
    const completedSetupResults = new Map<string, SimulationSetupResult>();
    const totalSetups = setups.length;

    const queue = [...setups];
    let activeWorkerCount = 0;
    let completedWorkerCount = 0;
    let hasError = false;
    const progressState = new Map<string, SetupSimulationProgress>();

    const persistAndFinish = async () => {
      if (hasError) {
        callbacks.onAllComplete();
        return;
      }

      // Assemble results in the same order as the input setups array so the
      // display order is deterministic regardless of which worker finished first.
      const orderedSetups = setups
        .map(s => completedSetupResults.get(s.id))
        .filter((r): r is SimulationSetupResult => r !== undefined);

      const runResult = AnnualSimulationEngine.buildRunResult(
        cacheKey, simulationInputHash,
        year, intervalMinutes, irradianceSource, density, threshold,
        orderedSetups,
      );

      try {
        await SimulationCache.saveResult(runResult);
        callbacks.onRunSaved();
        appEvents.emit('simulationResultsChanged', { autoSelect: true });
      } catch (err) {
        console.warn('useAnnualSimulation: failed to persist to IndexedDB', err);
      }

      callbacks.onAllComplete();
    };

    const onWorkerDone = (worker: Worker) => {
      activeWorkerCount--;
      completedWorkerCount++;
      worker.terminate();
      workersRef.current = workersRef.current.filter(w => w !== worker);

      if (completedWorkerCount === totalSetups) {
        persistAndFinish();
      } else {
        launchNext();
      }
    };

    const launchNext = () => {
      while (activeWorkerCount < maxWorkers() && queue.length > 0) {
        const setup = queue.shift()!;
        activeWorkerCount++;

        progressState.set(setup.id, {
          setupId: setup.id,
          setupLabel: setup.label,
          completed: 0,
          total: 0,
          smoothedRemainingSeconds: null,
          startedAt: Date.now(),
          lastRawRemaining: null,
        });

        const worker = new AnnualWorker();
        workersRef.current.push(worker);

        worker.onmessage = (event: MessageEvent<WorkerOutgoingMessage>) => {
          if (simulationStopFlag.current) return;

          const msg = event.data;

          if (msg.type === 'progress') {
            const prev = progressState.get(msg.setupId);
            if (!prev) return;

            const elapsed = (Date.now() - prev.startedAt) / 1000;
            const fraction = msg.completed / msg.total;
            let smoothedRemaining = prev.smoothedRemainingSeconds;

            if (fraction >= 0.05) {
              const rawRemaining = elapsed / fraction - elapsed;
              smoothedRemaining = prev.lastRawRemaining === null
                ? rawRemaining
                : 0.2 * rawRemaining + 0.8 * (prev.smoothedRemainingSeconds ?? rawRemaining);
            }

            const updated: SetupSimulationProgress = {
              ...prev,
              completed: msg.completed,
              total: msg.total,
              smoothedRemainingSeconds: smoothedRemaining,
              lastRawRemaining: smoothedRemaining,
            };
            progressState.set(msg.setupId, updated);
            callbacks.onProgress(updated);
          }

          if (msg.type === 'result') {
            completedSetupResults.set(msg.result.setupId, msg.result);
            callbacks.onSetupComplete(msg.result.setupId);
            onWorkerDone(worker);
          }

          if (msg.type === 'error') {
            hasError = true;
            callbacks.onError(msg.setupId, msg.message);
            callbacks.onSetupComplete(msg.setupId);
            onWorkerDone(worker);
          }
        };

        worker.onerror = (err) => {
          if (simulationStopFlag.current) return;
          hasError = true;
          callbacks.onError(setup.id, err.message ?? 'Unknown worker error');
          callbacks.onSetupComplete(setup.id);
          onWorkerDone(worker);
        };

        const { payload, transferables } = buildPayload(
          setup, site, density, threshold, intervalMinutes,
          year, irradianceSource, getStaticMeshes, sharedWeatherData,
        );
        worker.postMessage({ type: 'run', payload }, transferables);
      }

      callbacks.onPendingUpdate(queue.length);
    };

    launchNext();
  }, [scene, stop]);

  return { run, stop };
}