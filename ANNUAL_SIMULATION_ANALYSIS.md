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

The user can see which cached simulations exist (label, parameters, size, date computed) and delete them individually or all at once. This belongs in the settings sidebar introduced in Phase 6a.

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

### Selected approach: fixed overlay panel

```
Desktop (all viewport widths):
┌─────────────────────────────────────┐
│                                     │
│   3D Canvas (always 100vw × 100vh)  │
│   + left control panels (absolute)  │
│                              ┌──────┤
│                              │Result│
│                              │panel │
│                              │(fixed│
│                              │overlay│
└──────────────────────────────┴──────┘
```

Implemented as a `position: fixed` overlay on the right edge. The Three.js canvas always occupies `100vw × 100vh`. A drag handle on the left edge of the results panel lets the user resize it freely between a minimum width and full viewport width. Three icon buttons in the header control panel state: reset width, fullscreen, minimise.

---

## 10. Export and import

### Export formats (Phase 6b)

| Format         | Use case                          | Implementation                           |
|----------------|-----------------------------------|------------------------------------------|
| `.solarsim`    | Full backup (config + results)    | Gzip-compressed JSON, versioned schema   |
| PNG / SVG      | Chart screenshots for reports     | ECharts `getDataURL('png'/'svg')`        |
| PDF            | Printable simulation report       | `jsPDF` + ECharts `getDataURL` + `html2canvas` |

### Import (Phase 6b)

A `.solarsim` backup is re-imported via a file picker. On import the file is decompressed, parsed, migrated to the current schema version if needed, and applied: config is loaded into the app store (triggering a full scene rebuild) and simulation results are written to IndexedDB. The results panel reloads its group list automatically.

---

## 11. Phased implementation plan

### Phase 0 — Viability validation and infrastructure ✅

*(completed — see codebase)*

### Phase 1 — Worker simulation loop ✅

*(completed — see codebase)*

### Phase 2 — Layout split ✅

*(completed — see codebase)*

### Phase 3 — Core charts ✅

*(completed — see codebase)*

### Phase 4 — Advanced charts ✅

*(completed — see codebase)*

### Phase 5 — Irradiance integration ✅

*(completed with Open-Meteo instead of PVGIS — PVGIS blocks AJAX from browser origins; see Architecture decisions in README)*

---

### Phase 6a — Settings sidebar + cache management + shared DB layer

The goal of this phase is to give the user a dedicated settings surface, to expose cache management without requiring browser developer tools, and to remove the duplicated IndexedDB boilerplate between `SimulationCache` and `IrradianceCache`.

#### Settings sidebar

A gear icon button (⚙) is placed above the left-side control panels (above `RenderControls`). Clicking it opens a sidebar that slides in from the left as a `position: fixed` overlay, covering the control panels and part of the 3D canvas. A close button (✕) in the sidebar header dismisses it; the gear icon reappears. The sidebar never resizes the canvas.

The sidebar contains three sections with clear headings:

**1. Cache management**

Two sub-sections: *Simulation results* and *Irradiance data (Open-Meteo)*.

Each sub-section lists its cached entries. For simulation results, each entry shows: setup label, year, interval, irradiance source, density × threshold, computed-at date, and annual total kWh. For irradiance entries, each shows: source, location (lat/lon), year, and fetched-at date. Every entry has a trash icon (🗑) to delete it individually.

A "Delete all" button at the bottom of each sub-section clears all entries of that type. Deleting any simulation result triggers an immediate reload of the results panel group list so stale entries never appear in the selector.

**2. Export / Import** — placeholder heading in this phase; content added in Phase 6b.

**3. Configuration** — placeholder heading in this phase; content added in Phase 6d.

#### Shared IndexedDB helper

`SimulationCache` and `IrradianceCache` both contain an inline `openDb` Promise wrapper. A shared utility is extracted to `src/db/DbUtils.ts`:

```ts
export const openDatabase = (
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase, event: IDBVersionChangeEvent) => void,
): Promise<IDBDatabase>
```

Both caches delegate to this function. Their public APIs are unchanged — this is a pure internal refactor with no behavioural impact.

#### App version in footer

`package.json` `version` is the single source of truth. Vite exposes it at build time via a `define` entry in `vite.config.ts`:

```ts
define: {
  __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
}
```

A corresponding ambient declaration in `src/vite-env.d.ts` types the global:

```ts
declare const __APP_VERSION__: string;
```

`DeveloperFooter` reads `__APP_VERSION__` and renders it alongside the developer name and Ko-fi link. No runtime fetch or environment variable is needed.

---

### Phase 6b — Export / Import backup

#### Backup format

A single file with the `.solarsim` extension (MIME type `application/json`, gzip-compressed) containing:

```ts
interface BackupFile {
  /** Backup schema version. Starts at 1. Increment on any breaking change. */
  version: number;
  exportedAt: number;                    // Unix ms
  config: Config;                        // full config.json content
  simulationResults: SetupAnnualResult[]; // all cached simulation results
}
```

Open-Meteo irradiance data is intentionally excluded: it is derived, immutable for past years, and will be re-fetched automatically on next simulation. Including it would inflate the backup for no practical benefit.

#### Compression

The Compression Streams API (`CompressionStream` / `DecompressionStream`) is used for gzip compression and decompression. It is available natively in all modern browsers with no additional dependency. The pipeline is:

```
export: JSON.stringify → TextEncoder → ReadableStream → CompressionStream('gzip') → Blob → download
import: File → ReadableStream → DecompressionStream('gzip') → TextDecoder → JSON.parse
```

If the browser does not support the Compression Streams API (very old browsers), the export falls back to uncompressed JSON and logs a console warning. Import auto-detects compression by inspecting the first two bytes for the gzip magic number (`0x1f 0x8b`).

#### Format versioning and migrations

```ts
type Migration = (data: unknown) => unknown;

const migrations: Record<number, Migration> = {
  1: (data) => data,  // version 1 — identity, no transformation needed
};

function migrateToCurrentVersion(data: BackupFile): BackupFile {
  let current = data.version;
  let payload: unknown = data;
  while (current < CURRENT_BACKUP_VERSION) {
    payload = migrations[current](payload);
    current++;
  }
  return payload as BackupFile;
}
```

Any future breaking change increments `CURRENT_BACKUP_VERSION` and adds a migration function. The importer always applies all migrations in sequence before validating or consuming the data.

#### Export flow

Triggered by an "Export backup" button in the settings sidebar (Export / Import section). Steps:

1. Read all simulation results from IndexedDB via `SimulationCache.listResults` (full payloads, not just summaries).
2. Read current config from the app store.
3. Assemble the `BackupFile` object.
4. Compress and trigger a browser download with a filename derived from the site location and current date: `solarsim-{lat}-{lon}-{date}.solarsim`.

#### Import flow

Triggered by a "Load backup" file input in the same settings sidebar section. Steps:

1. Read and decompress the file.
2. Parse JSON and apply version migrations.
3. Validate basic structure (presence of `version`, `config`, `simulationResults`).
4. Apply `config` to the app store (same code path as loading `config.json` from the server).
5. Write each `SetupAnnualResult` to IndexedDB via `SimulationCache.saveResult` (overwrites existing entries with the same `cacheKey`).
6. Reload the results panel group list.
7. Show a success message (e.g. "Loaded 3 simulation results") or a descriptive error message if any step fails.

---

### Phase 6c — PDF report generation

#### Trigger

A "Generate report" button is added to the results panel body, positioned between the simulation parameter summary strip and the setup legend. It is only visible when a simulation group is selected (i.e. there is data to report on).

#### Day selection overlay

Clicking "Generate report" opens a modal overlay (centred, with a backdrop). The overlay contains three areas, top to bottom:

**Explanatory text**

> "This report always includes annual and monthly production data and shadow heat maps for all setups. The daily section is optional — add representative days if you want to include hourly production curves for specific dates (e.g. one day per season)."

**Day picker**

- A date input restricted to the simulation year (same control pattern as in `RenderControls`).
- An "Add day" button. Duplicate days are silently ignored.
- A tag list below the input: each added day appears as a dismissable chip (`DD MMM YYYY  ✕`). There is no upper limit on the number of days.

**Actions**

- "Generate PDF" button (primary).
- "Cancel" button (secondary).

#### PDF structure

Generated client-side using `jsPDF`. Charts are captured using ECharts' native `getDataURL('png')` where possible; the panel shadow heat maps (React DOM) are captured using `html2canvas`. All images are embedded in the PDF at a resolution suitable for A4 printing (150–200 DPI equivalent).

Page structure:

1. **Cover page**: installation location (lat/lon), simulation parameters (year, interval, irradiance source, density, threshold), report generation date, app version.
2. **Annual section**: annual bar chart image + data table (one row per setup: label, annual kWh).
3. **Monthly section**: radar chart image + table of monthly totals (12 rows × N setups, with column headers per setup label).
4. **Daily section** (one page per selected day, omitted if no days were selected): date heading, daily total bar chart image, hourly line chart image, hourly data table (24 rows × N setups).
5. **Shadow heat maps**: one heat map image per setup (full-year aggregate), labelled with setup name and array index.

#### Timezone correction for daily charts

Hourly energy data is accumulated in UTC buckets. For display in the PDF (and in the interactive daily charts in the results panel — a known issue), hours are shifted to the configured installation timezone before rendering. A utility function `shiftHourlyDataToTimezone(energyKwh, timezone, year)` converts the UTC hour indices to local hour indices, handling DST transitions. This correction is applied both in the PDF renderer and retroactively to the interactive daily charts as part of this phase.

---

### Phase 6d — Configuration editing

#### Approach

The Configuration section of the settings sidebar shows the current config as formatted read-only JSON when first opened. An "Edit" button switches the view to an editable `<textarea>` pre-populated with the current config as indented JSON.

#### Validation

Two-level validation is applied on every change (debounced at 300 ms) and on "Apply":

1. **Syntax**: `JSON.parse`. If this fails, a parse error message is shown immediately (e.g. "Invalid JSON at line 14: unexpected token '}'") and schema validation is skipped.

2. **Structure**: a JSON Schema generated at build time from `src/types/config.ts` via a Vite plugin (e.g. `vite-plugin-ts-json-schema` or equivalent). The schema is bundled as a static JSON asset. At runtime, `ajv` validates the parsed object against the schema. Validation errors are mapped to human-readable messages rather than exposing raw `ajv` output (e.g. "site.wallPoints[2]: expected [number, number], got [number, number, number]").

Because the schema is generated from the TypeScript types at build time, changes to `src/types/config.ts` automatically update the schema on the next build with no manual maintenance of a parallel schema definition.

#### Persistence

When the user clicks "Apply":

1. The new config is validated (both levels).
2. If valid, it is written to the browser's **Origin Private File System (OPFS)** as `config.json`, so it survives page reloads without requiring a server.
3. The app store's `loadConfig` action is called with the new config, triggering a full scene rebuild (site geometry, active setup, sun state).
4. The settings sidebar reflects the updated config immediately.

On startup, `App.tsx` checks OPFS for a user-saved `config.json` before fetching the default from the server. If OPFS is unavailable (e.g. in certain private browsing modes), the config change is applied to the store for the current session only, and the user is warned that it will not persist.

"Cancel" discards all unsaved edits and reverts the textarea to the current config.

#### Version tracking

The config format itself does not carry an explicit version field (it is a domain object, not a storage artifact). Version tracking for config changes is handled at the backup level (`BackupFile.version` in Phase 6b). Any future change to the `Config` type that would break existing backup files requires a migration entry in the backup migrations map.