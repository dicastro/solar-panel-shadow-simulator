# Annual Simulation — Analysis and Phased Implementation Plan

This document captures the full design analysis for the annual simulation feature before any code is written. The goal is to establish a wide enough vision that individual implementation phases do not require architectural rework as the feature grows.

---

## Table of Contents

1. [What we are building](#1-what-we-are-building)
2. [Constraints and context](#2-constraints-and-context)
3. [Raycasting in a Web Worker — feasibility analysis](#3-raycasting-in-a-web-worker--feasibility-analysis)
4. [Caching strategy — hashing and persistence](#4-caching-strategy--hashing-and-persistence)
5. [Progress reporting](#5-progress-reporting)
6. [Output data model](#6-output-data-model)
7. [Irradiance integration — PVGIS and alternatives](#7-irradiance-integration--pvgis-and-alternatives)
8. [Visualisation layer](#8-visualisation-layer)
9. [Application layout — splitting the view](#9-application-layout--splitting-the-view)
10. [Export and import](#10-export-and-import)
11. [Phased implementation plan](#11-phased-implementation-plan)

---

## 1. What we are building

An annual simulation that:

- Steps through every N minutes of a full year for **each setup** defined in the configuration.
- At each time step, casts rays from every sample point on every panel toward the sun, exactly as the interactive instant simulation already does.
- Accumulates energy (kWh) per panel, per zone, per string, and per setup across the year, broken down by month, day-of-month, and hour-of-day.
- Persists the results in the browser so that re-running the same configuration is instant.
- Displays comparative charts between setups (bar chart, radar/spider, daily curves, per-panel heat maps).
- Optionally adjusts the purely geometric irradiance estimate with real climate data from PVGIS or a similar source.

---

## 2. Constraints and context

| Constraint                                  | Impact                                                           |
|---------------------------------------------|------------------------------------------------------------------|
| No backend — static GitHub Pages deployment | All computation and storage must be browser-only                 |
| Interactive use must remain smooth          | Annual simulation must not block the main thread                 |
| Potentially underpowered hardware           | Worker count and workload must adapt to available cores          |
| No external build-time data                 | PVGIS irradiance must be fetched at runtime and cached           |
| Existing raycasting is Three.js-based       | Three.js Scene and BVH are not transferable to a worker directly |

The key architectural constraint is the last one: **Three.js geometry and the BVH live on the main thread**. Workers cannot access the DOM, WebGL context, or `THREE.Scene`. This shapes the entire worker strategy.

---

## 3. Raycasting in a Web Worker — feasibility analysis

### The problem with naïve offloading

A Web Worker runs in a separate thread with no access to the DOM or WebGL. Three.js `Scene`, `Mesh`, `Raycaster`, and the BVH patched onto `BufferGeometry` all depend on the main thread's JavaScript context. You cannot `postMessage` a Three.js scene to a worker.

### Viable approach: geometry serialisation

The BVH internally represents geometry as typed arrays (`Float32Array` for positions, `Uint32Array` for indices, and a flat serialised BVH node structure). `three-mesh-bvh` provides `MeshBVH.serialize()` which produces a plain transferable object containing only typed arrays — no Three.js class instances.

The plan:

1. **Main thread** builds the BVH for each setup as it already does via `useBVH`.
2. **Main thread** serialises the BVH of every shadow-casting mesh via `MeshBVH.serialize()` and collects the world matrices of those meshes.
3. **Main thread** transfers these typed arrays to the worker(s) via `postMessage` with the `transfer` option (zero-copy — no memory is copied).
4. **Worker** reconstructs a minimal raycaster using `three-mesh-bvh`'s `MeshBVH.deserialize()` and Three.js core math classes (`Vector3`, `Matrix4`, `Raycaster`), which have no DOM or WebGL dependencies and work correctly in a worker context.
5. **Worker** steps through the year, computing `SunState` via `SunCalc` (also DOM-free) and running raycasting entirely in isolation.

This approach moves the heavy loop off the main thread while reusing all the existing BVH infrastructure.

### Worker count strategy

`navigator.hardwareConcurrency` returns the number of logical CPU cores available. A sensible strategy:

```
workerCount = Math.max(1, Math.min(navigator.hardwareConcurrency - 1, setups.length))
```

Reserving one core for the main thread avoids UI jank. Capping at `setups.length` avoids creating workers with nothing to do. Each worker handles one setup; if there are more setups than workers, the remaining setups are queued and dispatched as workers become free.

For a typical laptop (4–8 cores) and 2–3 setups, this means 1–2 workers run in parallel, which is both effective and conservative.

If `navigator.hardwareConcurrency` is `undefined` (very old browsers), fall back to 1 worker.

---

## 4. Caching strategy — hashing and persistence

### What determines whether a cached result is still valid

A simulation result is a pure function of:

| Input                                                | How it feeds the simulation                                            |
|------------------------------------------------------|------------------------------------------------------------------------|
| Setup geometry (panels, positions, rotations, zones) | Determines which sample points exist and where they are in world space |
| Density (NxN per zone)                               | Determines the number and local positions of sample points             |
| Threshold                                            | Determines the zone-shading decision boundary                          |
| Simulation interval (minutes)                        | Determines which time steps are evaluated                              |
| Site location (lat/lon)                              | Determines sun positions                                               |
| Simulation year                                      | Determines which dates are evaluated (affects PVGIS data lookup too)   |
| Irradiance source (geometric / PVGIS / other)        | Determines the energy multiplier at each step                          |

The hash must capture all of these. A simple and reliable approach: JSON-serialise the relevant subset of config + simulation parameters, then compute a deterministic hash (FNV-1a or djb2, both implementable in ~10 lines with no dependencies).

```ts
interface SimulationCacheKey {
  setupId: string;          // derived label+index id, already stable
  setupHash: string;        // hash of panel geometry (positions, zones, peakPower, string, hasOptimizer)
  density: number;
  threshold: number;
  intervalMinutes: number;
  latitude: number;
  longitude: number;
  year: number;             // simulation year — affects both time steps and PVGIS data
  irradianceSource: 'geometric' | 'pvgis' | 'open-meteo';
}
```

The full cache key is the hash of this object. If the key matches a stored result, the result is returned immediately without any computation.

### Simulation year

The current interactive controls are locked to the current calendar year. The annual simulation uses the current year automatically. The `year` field is included in the cache key from the start so that a year selector can be added later (for use with PVGIS historical data) without breaking existing cached results.

### Storage

`localStorage` has a 5–10 MB limit, which is too small for a full year of per-panel data. The correct storage layer is **IndexedDB**, which has no practical size limit for this use case.

Each cache entry is stored under its hash key. Multiple entries coexist, so switching between configurations or parameter sets retrieves pre-computed results instantly. All write operations are wrapped in try/catch; if IndexedDB storage is denied or quota is exceeded, a warning is shown and the result is held in memory for the session only.

A lightweight IndexedDB wrapper (no external dependency — the native API is verbose but straightforward) handles get/set/list/delete with Promise-based wrappers.

### Cache management UI

The user can see which cached simulations exist (label, parameters, size, date computed) and delete them individually or all at once. This belongs in the simulation controls panel or a dedicated settings drawer.

---

## 5. Progress reporting

Because multiple setups can run in parallel across multiple workers, progress is tracked at two levels simultaneously.

### Overall progress bar

A single bar showing how many setups have completed out of the total:

```
Setups: ████████░░░░░░░░  2 / 5
```

This bar advances by one step each time any worker finishes its setup.

### Per-setup progress bars

One bar per setup, each labelled with the setup's name and showing its individual time-step progress:

```
"3 filas a 70cm alto"   ████████████░░░  73%   ~0:42 remaining
"Configuración Actual"  █████░░░░░░░░░░  34%   ~1:28 remaining
```

Each worker reports progress periodically (every N time steps, e.g. every 100 steps) via `postMessage` to avoid flooding the main thread. The main thread updates only the bar for that worker's setup.

Setups waiting for a free worker show a "Waiting..." state. Setups loaded from cache show "Loaded from cache" immediately and do not appear in the running bars.

### Remaining time estimate

A rolling ETA is displayed per active setup:

1. Record wall-clock timestamp when the worker starts processing a setup.
2. At each progress update: `estimatedTotal = elapsed / completedFraction`; `remaining = estimatedTotal - elapsed`.
3. Apply an exponential moving average (EMA, α ≈ 0.2) to smooth bursts caused by variable shadow complexity — steps at solar noon (many hits) take longer than steps at dawn or dusk (sun below horizon, no rays cast):

```
smoothedRemaining = 0.2 × newEstimate + 0.8 × previousSmoothedRemaining
```

The ETA is displayed once at least 5% of the work is done (to avoid wildly inaccurate early estimates) and is rounded to whole seconds.

### UI locking during simulation

While any simulation is running:
- The "Run Calculation" button becomes "Stop".
- The confirmation dialog for "Stop" lists each in-progress setup with its current completion percentage.
- All simulation parameters (density, threshold, interval, irradiance source) are disabled.
- The setup selector, 3D view, and date/time controls remain fully functional — they run on the main thread and are unaffected by the workers.

---

## 6. Output data model

The output must support all planned chart types without requiring re-simulation. The finest granularity needed is hour-of-day × day-of-month × month, per panel. Everything coarser is a rollup of this.

```ts
interface PanelAnnualData {
  panelId: string;
  arrayIndex: number;
  row: number;
  col: number;
  // kWh produced — shape: [month(0-11)][dayOfMonth(0-30)][hourOfDay(0-23)]
  // Days beyond the actual month length are 0.
  energyKwh: number[][][];
  // Fraction of time-steps in each bucket where the panel was at least partially shaded.
  shadeFraction: number[][][];
  // Per-zone shade fraction — shape: [zone][month][dayOfMonth][hourOfDay]
  zoneShadeFraction: number[][][][];
}

interface SetupAnnualResult {
  setupId: string;
  setupLabel: string;
  cacheKey: string;           // hash used to store/retrieve this result
  computedAt: number;         // Unix timestamp ms
  year: number;
  intervalMinutes: number;
  irradianceSource: 'geometric' | 'pvgis' | 'open-meteo';
  panels: PanelAnnualData[];
  monthlyTotalKwh: number[];  // [0..11] — sum across all panels, pre-rolled for chart performance
  annualTotalKwh: number;
}
```

All chart types derive from `energyKwh`:
- **Annual bar chart**: `annualTotalKwh` directly.
- **Monthly radar**: `monthlyTotalKwh`.
- **Daily curve (by hour)**: sum `[month][day][0..23]` across all panels.
- **Monthly curve (by day)**: sum `[month][0..30]` across all hours and panels.
- **Panel heat map**: sum `shadeFraction` or `zoneShadeFraction` across all time buckets and normalise per panel.

### Storage size estimate

9 panels × 12 months × 31 days × 24 hours × 8 bytes ≈ 200 KB per setup for `energyKwh` alone. Including `shadeFraction` and `zoneShadeFraction` (2 zones): ~700 KB per setup. For 3 setups: ~2 MB — well within IndexedDB limits.

---

## 7. Irradiance integration — PVGIS and alternatives

### What PVGIS provides

The EU Joint Research Centre's [PVGIS API](https://joint-research-centre.ec.europa.eu/pvgis-photovoltaic-geographical-information-system_en) offers a free, no-authentication REST endpoint returning hourly irradiance data (W/m²) for any location and year:

```
GET https://re.jrc.ec.europa.eu/api/v5_2/seriescalc
  ?lat=40.62&lon=-4.01&startyear=2023&endyear=2023&pvcalculation=0&outputformat=json
```

Returns ~8760 hourly records with GHI, DNI, and DHI. A single request covers the entire year.

### How to use it in the simulation

Currently `basePower = peakPower / 1000 × incidenceFactor`. With PVGIS DNI:

```
basePower = peakPower / 1000 × incidenceFactor × (DNI_at_this_hour / 1000)
```

Where 1000 W/m² is the standard test condition irradiance. Hours with cloud cover or haze are automatically discounted by the measured DNI value.

### Caching PVGIS data

The PVGIS response (~300–500 KB JSON) is stored in IndexedDB under `pvgis:{lat}:{lon}:{year}` and reused across all simulation runs for the same location. On fetch failure (network unavailable), the simulation falls back to the geometric model and shows a warning.

### Alternative sources

| Source      | Coverage           | Free tier           | API style            | Notes                                      |
|-------------|--------------------|---------------------|----------------------|--------------------------------------------|
| PVGIS (JRC) | Europe + worldwide | Fully free, no auth | Single call per year | Best for EU installations                  |
| Open-Meteo  | Worldwide          | Free, no auth       | Single call per year | Slightly less accurate but very accessible |
| NASA POWER  | Worldwide          | Free                | Single call per year | Coarser spatial resolution (0.5°)          |

**Plan**: implement PVGIS first, add Open-Meteo as a second selectable source in the UI.

---

## 8. Visualisation layer

### Chart library

**Apache ECharts** (`echarts` + `echarts-for-react`) is the selected library. It covers every planned chart type (bar, radar, line, heatmap) natively, has a smaller bundle than Plotly (~1 MB vs ~3 MB), is actively maintained, and supports PNG/SVG export natively via `getDataURL()`.

### Planned chart types

| Chart                             | Data source                                              | Purpose                                                  |
|-----------------------------------|----------------------------------------------------------|----------------------------------------------------------|
| Annual total bar chart            | `annualTotalKwh` per setup                               | Compare total production across setups                   |
| Monthly radar/spider              | `monthlyTotalKwh[0..11]` per setup                       | Compare seasonal distribution across setups              |
| Daily production curve (hourly)   | `energyKwh[month][day][0..23]` summed across panels      | Understand production shape for a specific day           |
| Monthly production curve (by day) | `energyKwh[month][0..30]` summed across hours and panels | Understand day-to-day variation within a month           |
| Per-panel shadow heat map         | `shadeFraction` / `zoneShadeFraction` per panel          | Identify shading hot-spots and guide optimizer placement |

### Per-panel heat map design

The heat map shows a schematic top-down view of the panel array matching the real installation geometry. Each panel cell is coloured by its annual (or monthly) shadow fraction using a green→yellow→red scale. Hovering a cell shows panel id, array position, and exact shade percentage.

---

## 9. Application layout — splitting the view

### Selected approach: side-by-side split with responsive stacking

```
Desktop (≥ 1024px):
┌─────────────────────┬──────────────────────┐
│                     │                      │
│   3D Canvas         │   Charts / Reports   │
│   + 3D controls     │                      │
│                     │                      │
└─────────────────────┴──────────────────────┘

Mobile / narrow (< 1024px):
┌──────────────────────┐
│   3D Canvas          │
│   + 3D controls      │
├──────────────────────┤
│   Charts / Reports   │
└──────────────────────┘
```

Implemented with CSS flexbox at the `app-container` level. No additional library needed. The Three.js canvas has a `minWidth`/`minHeight` so it remains usable when the charts panel is open.

The results panel is only rendered when at least one `SetupAnnualResult` exists. Before any simulation has run, the right column shows a prompt to run the calculation.

---

## 10. Export and import

### Export formats

| Format | Use case                          | Implementation                      |
|--------|-----------------------------------|-------------------------------------|
| PNG    | Quick screenshot for reports      | ECharts `getDataURL('png')`         |
| SVG    | Scalable for print                | ECharts `getDataURL('svg')`         |
| CSV    | Raw data for spreadsheet analysis | Serialise `panels` to flat CSV rows |
| JSON   | Reimport into the application     | `JSON.stringify(SetupAnnualResult)` |

### Import

A JSON export is re-imported via a file picker (`<input type="file">`). On import the result is validated, stored in IndexedDB under its original cache key, and loaded into the charts immediately. This is also the mechanism for sharing results between users on different machines.

---

## 11. Phased implementation plan

### Phase 0 — Viability validation and infrastructure

The primary goal of Phase 0 is to validate every non-obvious technical assumption before any production feature is built on top of it. Each validation produces a small, focused test that either confirms the approach or forces a design revision. Infrastructure code is committed only after all validations pass.

**Validations:**

1. **BVH serialisation round-trip**: build a `MeshBVH` on the main thread using the project's pinned `three-mesh-bvh` version (`^0.9.9`). Serialise it with `MeshBVH.serialize()`, transfer to a worker via `postMessage` with the `transfer` option, deserialise with `MeshBVH.deserialize()`, cast a ray, and verify the hit result matches the main-thread result. Confirms the API exists, is transferable, and produces correct geometry in this exact version.

2. **Three.js in a Vite worker**: import `three` inside a `?worker`-suffix worker file in the current Vite config. Create a `Vector3`, apply a `Matrix4`, post the result back. Confirm no module resolution errors and that `three-mesh-bvh` (with the `overrides` in `package.json`) is bundled correctly into the worker chunk without being deduplicated away.

3. **SunCalc in a worker**: import `suncalc` inside the same worker, call `getPosition`, post the result back. Confirm no DOM dependency errors.

4. **IndexedDB round-trip**: write a `SetupAnnualResult`-shaped object to IndexedDB, read it back, confirm integrity. Measure write and read latency for a realistic payload (~700 KB).

5. **Worker count heuristic**: log `navigator.hardwareConcurrency` in the browser on the development machine and any other available devices. Confirm the formula `Math.max(1, Math.min(hardwareConcurrency - 1, setups.length))` produces sensible values across different hardware.

**Infrastructure (committed after validations pass):**

- `src/utils/hash.ts` — FNV-1a, ~15 lines, no dependencies.
- `src/db/simulationCache.ts` — IndexedDB Promise wrapper (get/set/list/delete) with quota-exceeded handling.
- Extended types in `src/types/simulation.ts`: `PanelAnnualData`, `SetupAnnualResult`, `SimulationCacheKey`.
- `src/utils/simulationCacheKey.ts` — `buildCacheKey()` and `hashCacheKey()`.
- `src/workers/annualSimulation.worker.ts` — scaffolded worker: receives a ping, responds with a pong. No simulation logic yet.
- No UI changes.

### Phase 1 — Worker simulation loop

- Implement BVH serialisation on the main thread after `useBVH` runs (`useSerializedScene` hook or helper).
- Implement the full simulation loop in the worker: receive serialised geometry + sample points + params, step through the year, emit progress every 100 steps, return `SetupAnnualResult`.
- Worker orchestration: spawn N workers per the count formula, dispatch one setup per worker, queue remaining setups, handle completion and re-dispatch.
- Progress state in the store: `setupsTotal`, `setupsCompleted`, and a `Map<setupId, { completed, total, smoothedRemaining }>`.
- Update `SimulationControls`: overall setups bar + one bar per active setup with label and ETA.
- On "Run": check cache for each setup, skip cached ones, dispatch only uncached.
- "Stop" with confirmation dialog showing per-setup completion percentages.
- On completion: store in IndexedDB; show `annualTotalKwh` as plain text. No charts yet.

### Phase 2 — Layout split

- Two-column flex layout in `App.tsx` and `App.css`.
- `ResultsPanel` component (placeholder or plain-text results from Phase 1).
- Responsive breakpoint at 1024px: columns stack vertically.
- Three.js canvas retains correct sizing in its column at all viewport widths.

### Phase 3 — Core charts

- Install `echarts` + `echarts-for-react`.
- Annual total bar chart comparing all setups.
- Monthly radar chart comparing setups by month.
- Charts load from IndexedDB on startup and update when a new simulation completes.

### Phase 4 — Advanced charts

- Daily production curve: select month + day, compare setups by hour-of-day.
- Monthly production curve: select month, compare setups by day.
- Per-panel shadow heat map: select setup + time range; colour each panel by shadow fraction with tooltip.

### Phase 5 — PVGIS irradiance

- PVGIS fetch on first use; cache in IndexedDB under `pvgis:{lat}:{lon}:{year}`.
- Toggle in simulation controls: geometric / PVGIS / Open-Meteo.
- Pass hourly irradiance array to the worker; apply DNI multiplier per time step.
- Graceful fallback to geometric model on fetch failure.

### Phase 6 — Export and import

- ECharts PNG and SVG export per chart.
- CSV and JSON export of `SetupAnnualResult`.
- JSON import via file picker with shape validation.
- Cache management UI: list stored simulations, delete individually or all at once.