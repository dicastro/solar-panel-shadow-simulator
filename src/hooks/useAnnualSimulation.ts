import { useCallback, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { PanelSetup, Site } from '../types/installation';
import {
  WorkerSimulationPayload,
  WorkerOutgoingMessage,
  SetupSimulationProgress,
  IrradianceSource,
} from '../types/simulation';
import { SimulationCacheUtils } from '../utils/SimulationCacheUtils';
import { SimulationCache } from '../db/SimulationCache';
import { SolarPanelConverter } from '../converter/SolarPanelConverter';
import AnnualWorker from '../workers/AnnualSimulation.worker?worker';
import { MeshFactory } from '../factory/MeshFactory';

/**
 * How many logical CPU cores to use for simulation workers.
 * One core is always kept free for the main thread to preserve UI responsiveness.
 */
const maxWorkers = (): number =>
  Math.max(1, (navigator.hardwareConcurrency ?? 2) - 1);

/** Builds the worker payload for a single setup, using a fresh mesh serialisation. */
const buildPayload = (
  setup: PanelSetup,
  site: Site,
  density: number,
  threshold: number,
  intervalMinutes: number,
  year: number,
  irradianceSource: IrradianceSource,
  getMeshes: ReturnType<typeof MeshFactory.fromScene>['build'],
): { payload: WorkerSimulationPayload; transferables: ArrayBuffer[] } => {
  const cacheKey = SimulationCacheUtils.hashCacheKey(
    SimulationCacheUtils.buildCacheKey(
      setup, density, threshold, intervalMinutes,
      site.location.latitude, site.location.longitude,
      year, irradianceSource,
    ),
  );

  const allPanels = setup.panelArrays.flatMap(pa => pa.panels);
  const panels = SolarPanelConverter.toSimulationPanelDataArray(allPanels);
  const { meshes, transferables } = getMeshes();

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
 *  - Checks IndexedDB for each setup's cached result before doing any work.
 *  - Serialises scene geometry independently for each worker (zero-copy per
 *    worker, no shared buffer detachment between workers).
 *  - Spawns up to `maxWorkers()` concurrent workers; queues the rest.
 *  - Tracks per-setup progress with EMA-smoothed ETA.
 *  - Persists completed results to IndexedDB.
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

    // Check cache for each setup. Cached setups are reported immediately;
    // only uncached ones proceed to worker dispatch.
    const uncachedSetups: PanelSetup[] = [];
    for (const setup of setups) {
      const key = SimulationCacheUtils.hashCacheKey(
        SimulationCacheUtils.buildCacheKey(
          setup, density, threshold, intervalMinutes,
          site.location.latitude, site.location.longitude,
          year, irradianceSource,
        ),
      );
      const cached = await SimulationCache.getResult(key);
      if (cached) {
        callbacks.onResult(setup.id, setup.label, cached.annualTotalKwh);
        callbacks.onSetupComplete(setup.id);
      } else {
        uncachedSetups.push(setup);
      }
    }

    if (uncachedSetups.length === 0) {
      callbacks.onAllComplete();
      return;
    }

    // Traverse the scene once and produce a factory that yields fresh typed-array
    // copies on each call. Each worker receives its own independent copy so that
    // zero-copy transfer does not detach buffers needed by subsequent workers.
    const { build: getMeshes } = MeshFactory.fromScene(scene);

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

        const { payload, transferables } = buildPayload(
          setup, site, density, threshold, intervalMinutes,
          year, irradianceSource, getMeshes,
        );
        worker.postMessage({ type: 'run', payload }, transferables);
      }

      callbacks.onPendingUpdate(queue.length);
    };

    launchNext();
  }, [scene, stop]);

  return { run, stop };
}