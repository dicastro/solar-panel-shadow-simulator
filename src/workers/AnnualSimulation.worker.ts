/**
 * Annual simulation worker.
 *
 * This worker runs the full year simulation loop off the main thread,
 * receiving serialised BVH geometry and panel data via postMessage and
 * returning progress updates and the final SetupAnnualResult.
 *
 * Phase 0: responds to a 'ping' message with a 'pong' and logs environment
 * diagnostics (Three.js availability, SunCalc availability, worker count
 * heuristic). No simulation logic is implemented yet.
 *
 * Phase 1 will replace the ping/pong handler with the full simulation loop.
 */

import * as THREE from 'three';
import SunCalc from 'suncalc';

export type WorkerIncomingMessage =
  | { type: 'ping' };

export type WorkerOutgoingMessage =
  | { type: 'pong'; diagnostics: WorkerDiagnostics };

export interface WorkerDiagnostics {
  threeVersion: string;
  sunCalcAvailable: boolean;
  /** navigator.hardwareConcurrency as seen from the worker. */
  hardwareConcurrency: number;
  testRecommendations: {
    for1: number;
    for3: number;
    for8: number;
  };
}

self.onmessage = (event: MessageEvent<WorkerIncomingMessage>) => {
  const { type } = event.data;

  if (type === 'ping') {
    const hardwareConcurrency = navigator.hardwareConcurrency ?? 1;

    const getRecommendation = (setupCount: number) => 
      Math.max(1, Math.min(hardwareConcurrency - 1, setupCount));

    const diagnostics: WorkerDiagnostics = {
      threeVersion: THREE.REVISION,
      sunCalcAvailable: typeof SunCalc.getPosition === 'function',
      hardwareConcurrency,
      testRecommendations: {
        for1: getRecommendation(1),
        for3: getRecommendation(3),
        for8: getRecommendation(8),
      }
    };

    const response: WorkerOutgoingMessage = { type: 'pong', diagnostics };
    self.postMessage(response);
  }
};