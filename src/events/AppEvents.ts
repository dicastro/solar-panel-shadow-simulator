import mitt from 'mitt';

/**
 * Application-wide event bus for communication between components that do not
 * share a direct parent-child relationship.
 *
 * Using mitt (a minimal typed event emitter) instead of a shared store value
 * means events represent things that *happen* rather than state that *is*.
 * Consumers subscribe in a useEffect and unsubscribe on cleanup, following
 * standard React patterns.
 *
 * Events:
 *
 *  simulationResultsChanged — emitted whenever the set of simulation results
 *    stored in IndexedDB changes. Consumers that display results (e.g.
 *    useResultsPanel) reload from IndexedDB in response.
 *
 *    autoSelect: when true the consumer should select the first available
 *    group after reloading (used after a simulation completes or a backup is
 *    imported). When false the consumer keeps the current selection if it
 *    still exists (used after individual cache deletions).
 */
type AppEventMap = {
  simulationResultsChanged: { autoSelect: boolean };
};

export const appEvents = mitt<AppEventMap>();