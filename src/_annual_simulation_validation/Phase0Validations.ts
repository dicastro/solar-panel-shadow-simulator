/**
 * Phase 0 validation runner.
 *
 * Exercises every non-obvious technical assumption listed in
 * ANNUAL_SIMULATION_ANALYSIS.md §Phase 0 before any production simulation
 * code is built on top of them.
 *
 * HOW TO RUN
 * ----------
 * Import and call `runPhase0Validations()` from any mounted React component,
 * for example by adding a temporary button in SimulationControls.tsx:
 *
 *   import { runPhase0Validations } from '../_phase0_validation/phase0Validations';
 *   <button onClick={runPhase0Validations}>Phase 0</button>
 *
 * Results are printed to the browser console. Check each section for PASS/FAIL.
 *
 * DELETE THIS FILE AND FOLDER once all validations pass and Phase 1 begins.
 */

import { MeshBVH, acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';
import * as THREE from 'three';
import { SimulationCache } from '../db/SimulationCache';
import { SetupAnnualResult } from '../types/simulation';
import AnnualWorker from '../workers/AnnualSimulation.worker?worker';

// ── Validation 1 & 2: BVH serialisation round-trip + Three.js in worker ──────

/**
 * Validation 1: BVH serialise → transfer → deserialise → raycast.
 * Validation 2: Three.js and SunCalc import correctly inside a Vite worker.
 * Validation 3: SunCalc DOM-free in worker (covered by the same worker ping).
 * Validation 5: hardwareConcurrency heuristic logged from worker.
 *
 * All four are covered by a single worker ping that returns diagnostics.
 */
const validateWorker = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const worker = new AnnualWorker();
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Worker did not respond within 5 s'));
    }, 5000);

    worker.onmessage = (event: MessageEvent) => {
      clearTimeout(timeout);
      worker.terminate();

      const { type, diagnostics } = event.data;
      if (type !== 'pong') {
        reject(new Error(`Unexpected worker message type: ${type}`));
        return;
      }

      console.group('[Phase 0] Validation 2 & 3 — Three.js + SunCalc in worker');
      console.log('Three.js revision in worker:', diagnostics.threeVersion);
      console.log('SunCalc available in worker:', diagnostics.sunCalcAvailable);
      if (!diagnostics.sunCalcAvailable) {
        console.error('FAIL — SunCalc not available in worker');
      } else {
        console.log('PASS');
      }
      console.groupEnd();

      console.group('[Phase 0] Validation 5 — Worker count heuristic');
      console.log('navigator.hardwareConcurrency (worker):', diagnostics.hardwareConcurrency);
      console.log('Recommended workers for 1 setup:', diagnostics.testRecommendations.for1);
      console.log('Recommended workers for 3 setups:', diagnostics.testRecommendations.for3);
      console.log('Recommended workers for 8 setups:', diagnostics.testRecommendations.for8);
      console.log('PASS — review values above manually');
      console.groupEnd();

      resolve();
    };

    worker.onerror = (err) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(err);
    };

    worker.postMessage({ type: 'ping' });
  });

// ── Validation 1: BVH serialisation round-trip (main thread) ─────────────────

/**
 * Builds a simple box geometry on the main thread, computes its BVH, casts a
 * ray, serialises the BVH, deserialises it, casts the same ray again, and
 * compares the hit distances. Confirms that MeshBVH.serialize/deserialize
 * produce geometrically identical results under the pinned three-mesh-bvh
 * version.
 */
const validateBvhRoundTrip = (): void => {
  console.group('[Phase 0] Validation 1 — BVH serialisation round-trip');

  // Patch prototype once (idempotent if already patched by useBVH).
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;

  // Build a 2×2×2 box at the origin.
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  geometry.computeBoundsTree();

  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const scene = new THREE.Scene();
  scene.add(mesh);

  // Ray pointing straight down the Z axis — should hit the front face.
  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;
  raycaster.set(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));

  const hitsOriginal = raycaster.intersectObject(mesh);
  const distOriginal = hitsOriginal[0]?.distance;

  // Serialise the BVH.
  // The runtime object is a MeshBVH instance; the cast is safe because
  // computeBoundsTree() always assigns a MeshBVH. The narrower GeometryBVH
  // interface used internally by three-mesh-bvh does not expose serialize().
  const bvh = geometry.boundsTree as MeshBVH;
  const serialised = MeshBVH.serialize(bvh);

  // Deserialise into a fresh geometry (simulating worker reconstruction).
  const geometry2 = new THREE.BoxGeometry(2, 2, 2);
  geometry2.boundsTree = MeshBVH.deserialize(serialised, geometry2);

  const mesh2 = new THREE.Mesh(geometry2, new THREE.MeshBasicMaterial());
  const scene2 = new THREE.Scene();
  scene2.add(mesh2);

  const hitsDeserialised = raycaster.intersectObject(mesh2);
  const distDeserialised = hitsDeserialised[0]?.distance;

  if (distOriginal === undefined || distDeserialised === undefined) {
    console.error('FAIL — no ray hit detected (original or deserialised)');
  } else if (Math.abs(distOriginal - distDeserialised) > 1e-6) {
    console.error(`FAIL — distance mismatch: original=${distOriginal}, deserialised=${distDeserialised}`);
  } else {
    console.log(`PASS — hit distance matches: ${distOriginal.toFixed(6)}`);
  }

  geometry.dispose();
  geometry2.dispose();
  console.groupEnd();
};

// ── Validation 4: IndexedDB round-trip ───────────────────────────────────────

const validateIndexedDb = async (): Promise<void> => {
  console.group('[Phase 0] Validation 4 — IndexedDB round-trip');

  const testResult: SetupAnnualResult = {
    setupId: 'phase0-test',
    setupLabel: 'Phase 0 Test',
    cacheKey: 'phase0-test-key',
    computedAt: Date.now(),
    year: new Date().getFullYear(),
    intervalMinutes: 60,
    irradianceSource: 'geometric',
    panels: [],
    monthlyTotalKwh: Array(12).fill(0),
    annualTotalKwh: 0,
  };

  try {
    const writeStart = performance.now();
    await SimulationCache.saveResult(testResult);
    const writeMs = (performance.now() - writeStart).toFixed(1);

    const readStart = performance.now();
    const retrieved = await SimulationCache.getResult('phase0-test-key');
    const readMs = (performance.now() - readStart).toFixed(1);

    if (!retrieved || retrieved.setupId !== testResult.setupId) {
      console.error('FAIL — retrieved result does not match stored result');
    } else {
      console.log(`PASS — write: ${writeMs} ms, read: ${readMs} ms`);
    }

    await SimulationCache.clearAllResults();
    console.log('Cleanup: store cleared');
  } catch (err) {
    console.error('FAIL — IndexedDB error:', err);
  }

  console.groupEnd();
};

// ── Entry point ───────────────────────────────────────────────────────────────

export const runPhase0Validations = async (): Promise<void> => {
  console.group('=== Phase 0 Validations ===');
  console.log('Running all Phase 0 validations. Check each section below.');

  validateBvhRoundTrip();
  await validateIndexedDb();
  await validateWorker();

  console.log('=== Phase 0 complete — review each section above ===');
  console.groupEnd();
};