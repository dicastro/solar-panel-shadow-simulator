import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { useThree } from '@react-three/fiber';
import { SolarPanel } from '../types/installation';
import { PanelSetup, Site } from '../types/installation';
import {
  WorkerSimulationPayload,
  WorkerPanelData,
  WorkerSamplePoint,
  SerializedMesh,
  WorkerOutgoingMessage,
  SetupSimulationProgress,
  IrradianceSource,
} from '../types/simulation';
import { SimulationCacheUtils } from '../utils/SimulationCacheUtils';
import { SimulationCache } from '../db/SimulationCache';
import { ThreeConverter } from '../converter/ThreeConverter';
import AnnualWorker from '../workers/AnnualSimulation.worker?worker';

/**
 * How many logical CPU cores to use for simulation workers.
 * One core is always kept free for the main thread to preserve UI responsiveness.
 */
const maxWorkers = (): number =>
  Math.max(1, (navigator.hardwareConcurrency ?? 2) - 1);

/**
 * One serialised mesh ready for transfer to a worker, together with the
 * list of ArrayBuffers that must be included in the postMessage transfer list
 * for zero-copy transfer.
 */
interface MeshWithTransferables {
  mesh: SerializedMesh;
  transferables: ArrayBuffer[];
}

/**
 * Serialises a single shadow-casting mesh into plain typed arrays.
 * Each call produces fresh copies of the geometry data so the returned
 * ArrayBuffers can be independently transferred to different workers without
 * detaching each other.
 */
const serializeMesh = (obj: THREE.Mesh): MeshWithTransferables | null => {
  const geo = obj.geometry as THREE.BufferGeometry;
  const bvh = geo.boundsTree as MeshBVH | undefined;

  if (!bvh) {
    console.warn('useAnnualSimulation: mesh has castShadow but no boundsTree — skipping', obj);
    return null;
  }

  const positions = (geo.attributes.position.array as Float32Array).slice();
  const rawIndex = geo.index?.array;
  const indices = rawIndex
    ? new Uint32Array(rawIndex)
    : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);

  const serializedBvh = MeshBVH.serialize(bvh);

  obj.updateWorldMatrix(true, false);
  const worldMatrix = new Float32Array(obj.matrixWorld.elements);

  const transferables: ArrayBuffer[] = [
    positions.buffer,
    indices.buffer,
    worldMatrix.buffer,
  ];

  const bvhData = serializedBvh as unknown as Record<string, unknown>;
  Object.values(bvhData).forEach(v => {
    if (ArrayBuffer.isView(v)) transferables.push(v.buffer as ArrayBuffer);
    else if (v instanceof ArrayBuffer) transferables.push(v);
  });

  return {
    mesh: { positions, indices, serializedBvh, worldMatrix },
    transferables,
  };
};

/**
 * Collects all shadow-casting meshes from the scene and serialises them.
 *
 * Returns a factory function rather than a single array. Each call to the
 * factory produces a fresh set of typed-array copies for one worker, so
 * that each worker's buffers can be transferred zero-copy without detaching
 * the data for other workers. The factory re-reads the geometry from the
 * live Three.js objects, which are still intact on the main thread.
 *
 * This design avoids holding multiple full copies in memory simultaneously:
 * each copy is created immediately before it is transferred and then
 * detached, keeping peak memory usage at ~2× the geometry size regardless
 * of the number of workers.
 */
const buildMeshFactory = (scene: THREE.Scene): (() => {
  meshes: SerializedMesh[];
  transferables: ArrayBuffer[];
}) => {
  // Collect the live mesh objects once.
  const liveMeshes: THREE.Mesh[] = [];
  scene.traverse(obj => {
    if (obj instanceof THREE.Mesh && obj.castShadow) {
      liveMeshes.push(obj);
    }
  });

  return () => {
    const meshes: SerializedMesh[] = [];
    const transferables: ArrayBuffer[] = [];

    for (const obj of liveMeshes) {
      const result = serializeMesh(obj);
      if (!result) continue;
      meshes.push(result.mesh);
      transferables.push(...result.transferables);
    }

    return { meshes, transferables };
  };
};

/**
 * Transforms all sample points of a panel from local space to world space.
 * Mirrors the transform in `useShadowSampler`. Pre-computing world-space
 * positions here avoids repeating the matrix multiplication in the worker
 * at every time step.
 */
const toWorldSpaceSamplePoints = (panel: SolarPanel): WorkerSamplePoint[] => {
  const quat = new THREE.Quaternion().setFromEuler(
    ThreeConverter.toEuler(panel.worldRotation),
  );
  const worldPos = ThreeConverter.toVector3(panel.worldPosition);
  const matrix = new THREE.Matrix4().compose(worldPos, quat, new THREE.Vector3(1, 1, 1));

  return panel.samplePoints.map(sp => {
    const local = new THREE.Vector3(
      sp.localPosition.x,
      sp.localPosition.y,
      sp.localPosition.z,
    ).applyMatrix4(matrix);
    return { id: sp.id, zoneIndex: sp.zoneIndex, x: local.x, y: local.y, z: local.z };
  });
};

/**
 * Derives the panel's world-space normal from its world rotation.
 * A flat (zero-rotation) panel has its normal pointing straight up (0,1,0).
 */
const toWorldNormal = (panel: SolarPanel): { x: number; y: number; z: number } => {
  const normal = new THREE.Vector3(0, 1, 0).applyEuler(
    ThreeConverter.toEuler(panel.worldRotation),
  );
  return { x: normal.x, y: normal.y, z: normal.z };
};

/** Builds the worker payload for a single setup, using a fresh mesh serialisation. */
const buildPayload = (
  setup: PanelSetup,
  site: Site,
  density: number,
  threshold: number,
  intervalMinutes: number,
  year: number,
  irradianceSource: IrradianceSource,
  getMeshes: () => { meshes: SerializedMesh[]; transferables: ArrayBuffer[] },
): { payload: WorkerSimulationPayload; transferables: ArrayBuffer[] } => {
  const cacheKey = SimulationCacheUtils.hashCacheKey(
    SimulationCacheUtils.buildCacheKey(
      setup, density, threshold, intervalMinutes,
      site.location.latitude, site.location.longitude,
      year, irradianceSource,
    ),
  );

  const allPanels = setup.panelArrays.flatMap(pa => pa.panels);

  const workerPanels: WorkerPanelData[] = allPanels.map(panel => ({
    id: panel.id,
    arrayIndex: panel.arrayIndex,
    row: panel.row,
    col: panel.col,
    peakPower: panel.peakPower,
    zones: panel.zones,
    hasOptimizer: panel.hasOptimizer,
    string: panel.string,
    worldNormal: toWorldNormal(panel),
    samplePoints: toWorldSpaceSamplePoints(panel),
  }));

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
      panels: workerPanels,
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

    // Build a factory that produces fresh typed-array copies of scene geometry.
    // Called once per worker so each transfer is independent.
    const getMeshes = buildMeshFactory(scene);

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

        // Fresh typed-array copies for this worker — independent of other workers.
        const { payload, transferables } = buildPayload(
          setup, site, density, threshold, intervalMinutes,
          year, irradianceSource, getMeshes,
        );
        worker.postMessage({ type: 'run', payload }, transferables);
      }
      // Report how many setups remain in the queue after this dispatch round.
      callbacks.onPendingUpdate(queue.length);
    };

    launchNext();
  }, [scene, stop]);

  return { run, stop };
}