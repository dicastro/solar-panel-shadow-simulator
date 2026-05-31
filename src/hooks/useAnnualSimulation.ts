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
} from '../types/simulation';
import { SimulationCacheUtils } from '../utils/SimulationCacheUtils';
import { SimulationCache } from '../db/SimulationCache';
import { SolarPanelConverter } from '../converter/SolarPanelConverter';
import AnnualWorker from '../workers/AnnualSimulation.worker?worker';
import { MeshFactory } from '../factory/MeshFactory';
import { PanelMeshFactory } from '../factory/PanelMeshFactory';
import { createIrradianceProvider } from '../irradiance/IrradianceProvider';
import { appEvents } from '../events/AppEvents';

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
  const sum = allPanels.reduce((acc, p) => acc + p.worldRotation.x, 0);
  return sum / allPanels.length;
};

const buildPayload = (
  setup: PanelSetup,
  site: Site,
  density: number,
  threshold: number,
  intervalMinutes: number,
  year: number,
  irradianceSource: IrradianceSource,
  cacheKey: string,
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
      cacheKey,
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
  onResult: (setupId: string, label: string, annualTotalKwh: number) => void;
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
    density: number,
    threshold: number,
    intervalMinutes: number,
    year: number,
    irradianceSource: IrradianceSource,
    callbacks: AnnualSimulationCallbacks,
  ) => {
    stop();
    simulationStopFlag.current = false;

    let sharedWeatherData: { dni: Float32Array; dhi: Float32Array; temperature: Float32Array | null } | null = null;
    try {
      const provider = await createIrradianceProvider(irradianceSource);
      const data = await provider.getHourlyWeatherData(
        site.location.latitude,
        site.location.longitude,
        year,
      );
      if (data) {
        sharedWeatherData = { dni: data.dni, dhi: data.dhi, temperature: data.temperature };
      } else if (irradianceSource !== 'geometric') {
        console.warn(
          'useAnnualSimulation: irradiance fetch failed, falling back to geometric model',
        );
      }
    } catch (err) {
      console.warn('useAnnualSimulation: irradiance provider error', err);
    }

    const uncachedSetups: Array<{ setup: PanelSetup; cacheKey: string }> = [];
    for (const setup of setups) {
      const cacheKey = SimulationCacheUtils.hashCacheKey(
        SimulationCacheUtils.buildCacheKey(
          setup, density, threshold, intervalMinutes,
          site.location.latitude, site.location.longitude,
          year, irradianceSource,
        ),
      );
      const cached = await SimulationCache.getResult(cacheKey);
      if (cached) {
        callbacks.onResult(setup.id, setup.label, cached.annualTotalKwh);
        callbacks.onSetupComplete(setup.id);
        appEvents.emit('simulationResultsChanged', { autoSelect: true });
      } else {
        uncachedSetups.push({ setup, cacheKey });
      }
    }

    if (uncachedSetups.length === 0) {
      callbacks.onAllComplete();
      return;
    }

    const { build: getStaticMeshes } = MeshFactory.fromScene(scene, isNotPanelFrame);

    const queue = [...uncachedSetups];
    let activeWorkerCount = 0;
    let completedCount = 0;
    const total = uncachedSetups.length;
    const progressState = new Map<string, SetupSimulationProgress>();

    const onWorkerDone = (worker: Worker) => {
      activeWorkerCount--;
      completedCount++;
      worker.terminate();
      workersRef.current = workersRef.current.filter(w => w !== worker);

      if (completedCount === total) {
        callbacks.onAllComplete();
      } else {
        launchNext();
      }
    };

    const launchNext = () => {
      while (activeWorkerCount < maxWorkers() && queue.length > 0) {
        const { setup, cacheKey } = queue.shift()!;
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

        worker.onmessage = async (event: MessageEvent<WorkerOutgoingMessage>) => {
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
            try {
              await SimulationCache.saveResult(msg.result);
            } catch (err) {
              console.warn('useAnnualSimulation: failed to persist to IndexedDB', err);
            }
            callbacks.onResult(msg.result.setupId, msg.result.setupLabel, msg.result.annualTotalKwh);
            callbacks.onSetupComplete(msg.result.setupId);
            appEvents.emit('simulationResultsChanged', { autoSelect: true });
            onWorkerDone(worker);
          }

          if (msg.type === 'error') {
            callbacks.onError(msg.setupId, msg.message);
            callbacks.onSetupComplete(msg.setupId);
            onWorkerDone(worker);
          }
        };

        worker.onerror = (err) => {
          if (simulationStopFlag.current) return;
          callbacks.onError(setup.id, err.message ?? 'Unknown worker error');
          callbacks.onSetupComplete(setup.id);
          onWorkerDone(worker);
        };

        const { payload, transferables } = buildPayload(
          setup, site, density, threshold, intervalMinutes,
          year, irradianceSource, cacheKey, getStaticMeshes, sharedWeatherData,
        );
        worker.postMessage({ type: 'run', payload }, transferables);
      }

      callbacks.onPendingUpdate(queue.length);
    };

    launchNext();
  }, [scene, stop]);

  return { run, stop };
}