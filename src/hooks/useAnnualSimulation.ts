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
} from '../types/simulation';
import { SimulationCacheUtils } from '../utils/SimulationCacheUtils';
import { SimulationCache } from '../db/SimulationCache';
import { SolarPanelConverter } from '../converter/SolarPanelConverter';
import AnnualWorker from '../workers/AnnualSimulation.worker?worker';
import { MeshFactory } from '../factory/MeshFactory';
import { PanelMeshFactory } from '../factory/PanelMeshFactory';
import { createIrradianceProvider } from '../irradiance/IrradianceProvider';

/**
 * How many logical CPU cores to use for simulation workers.
 * One core is always kept free for the main thread to preserve UI responsiveness.
 */
const maxWorkers = (): number =>
  Math.max(1, (navigator.hardwareConcurrency ?? 2) - 1);

/**
 * Returns true for meshes that are NOT panel frames.
 *
 * Panel frame meshes are marked with `userData.isPanelFrame = true` by
 * SolarPanelComponent. Excluding them from the static batch ensures each
 * worker receives only the scene's structural geometry (walls, railings,
 * intersection posts). The correct panel geometry for each simulated setup
 * is added separately via PanelMeshFactory.
 */
const isNotPanelFrame = (mesh: THREE.Mesh): boolean =>
  mesh.userData.isPanelFrame !== true;

/**
 * Builds the complete worker payload for a single setup.
 *
 * The serialised mesh list combines:
 *  1. Static meshes (walls, railings, intersection posts) — extracted once
 *     from the live scene (panel frames excluded) and reused across all setups.
 *  2. Panel frame meshes — built procedurally from the setup's panel data by
 *     PanelMeshFactory, ensuring each worker receives the correct panels for
 *     the setup it simulates, independently of the 3D viewport state.
 *
 * All transferable buffers are collected into a single list for one-pass
 * zero-copy postMessage transfer.
 */
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
  irradianceData: Float32Array | null,
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

  if (irradianceData) {
    transferables.push(irradianceData.buffer as ArrayBuffer);
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
      irradianceData: irradianceData ?? null,
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
  /** Called whenever the number of queued (not-yet-started) setups changes. */
  onPendingUpdate: (count: number) => void;
}

/**
 * Manages the full lifecycle of the annual simulation:
 *  - Resolves the irradiance provider for the selected source.
 *  - Fetches and caches irradiance data on the main thread before worker launch.
 *  - Checks IndexedDB for each setup's cached result before doing any work.
 *  - Collects static scene meshes (walls, railings) once, excluding panel frames.
 *  - Builds panel frame meshes procedurally per setup via PanelMeshFactory so
 *    each worker always receives the correct geometry regardless of which setup
 *    is currently displayed in the 3D viewport.
 *  - Spawns up to `maxWorkers()` concurrent workers; queues the rest.
 *  - Tracks per-setup progress with EMA-smoothed ETA.
 *  - Persists completed results to IndexedDB.
 *
 * Irradiance data is fetched once per simulation run (not per setup), because
 * all setups share the same location and year. The same Float32Array is sliced
 * into each worker payload so zero-copy transfer does not detach the shared array.
 *
 * Must be called from inside a `<Canvas>` tree so that `useThree` works.
 * The returned `stop` function terminates all active workers immediately.
 */
export function useAnnualSimulation() {
  const { scene } = useThree();
  const workersRef = useRef<Worker[]>([]);

  const stop = useCallback(() => {
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

    let sharedIrradianceData: Float32Array | null = null;
    try {
      const provider = await createIrradianceProvider(irradianceSource);
      sharedIrradianceData = await provider.getHourlyDNI(
        site.location.latitude,
        site.location.longitude,
        year,
      );
      if (!sharedIrradianceData && irradianceSource !== 'geometric') {
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
      } else {
        uncachedSetups.push({ setup, cacheKey });
      }
    }

    if (uncachedSetups.length === 0) {
      callbacks.onAllComplete();
      return;
    }

    // Traverse the scene once, excluding panel frame meshes. The static batch
    // contains walls, railings, and intersection posts — geometry shared by all
    // setups that never changes during a simulation run.
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
            onWorkerDone(worker);
          }

          if (msg.type === 'error') {
            callbacks.onError(msg.setupId, msg.message);
            callbacks.onSetupComplete(msg.setupId);
            onWorkerDone(worker);
          }
        };

        worker.onerror = (err) => {
          callbacks.onError(setup.id, err.message ?? 'Unknown worker error');
          callbacks.onSetupComplete(setup.id);
          onWorkerDone(worker);
        };

        const irradianceCopy = sharedIrradianceData
          ? sharedIrradianceData.slice()
          : null;

        const { payload, transferables } = buildPayload(
          setup, site, density, threshold, intervalMinutes,
          year, irradianceSource, cacheKey, getStaticMeshes, irradianceCopy,
        );
        worker.postMessage({ type: 'run', payload }, transferables);
      }

      callbacks.onPendingUpdate(queue.length);
    };

    launchNext();
  }, [scene, stop]);

  return { run, stop };
}