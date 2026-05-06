# Solar Panel Shadow Simulator

A browser-based 3D simulator for analysing shadow impact on rooftop photovoltaic installations. No backend required — all computation runs in the browser. Deployable as a static site on GitHub Pages.

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Architecture decisions](#architecture-decisions)
5. [Coordinate system](#coordinate-system)
6. [2D geometry — normals, dot product, cross product](#2d-geometry--normals-dot-product-cross-product)
7. [Configuration reference](#configuration-reference)
8. [Solar production model](#solar-production-model)
9. [Shadow detection — Raycasting + BVH](#shadow-detection--raycasting--bvh)
10. [Annual simulation](#annual-simulation)
11. [Results panel](#results-panel)
12. [Application layout](#application-layout)
13. [Timezone and DST](#timezone-and-dst)
14. [Known limitations](#known-limitations)
15. [Lessons learned](#lessons-learned)

---

## What it does

- Renders a rooftop installation in 3D (walls, railings with balusters, solar panels) using Three.js.
- Animates the sun's trajectory across the sky for any date and time.
- Detects which panel zones are shaded using raycasting against all shadow-casting geometry (walls, railings, supports, and other panels).
- Displays zone ID labels in the 3D view (`a{array}-r{row}-c{col}-z{zone}`) so each zone can be correlated with the results panel heat maps without ambiguity.
- Estimates instantaneous power output in kW, applying bypass-diode, string-mismatch and optimizer logic.
- Supports multiple installation layouts ("setups") selectable via the UI.
- Runs a full annual simulation for all configured setups in parallel Web Workers, accumulating energy (kWh) per panel broken down by month, day, and hour. Results are cached in IndexedDB so re-running the same configuration is instant.
- Supports two irradiance sources: a geometric clear-sky model (no network required) and Open-Meteo (real hourly DNI data fetched from a free, CORS-compatible API, cached in IndexedDB).
- Displays annual results in a floating resizable overlay panel with three tabs (Annual, Monthly, Daily), each containing a Production section (ECharts charts) and a Shadows section (per-panel zone heat maps). A shared legend lets the user toggle setups on/off and all charts update accordingly.
- Validates the wall configuration and displays a prominent warning listing the exact config-space coordinate triples that form non-90° or non-180° angles.

---

## Tech stack

| Layer                | Library                         | Why                                      |
|----------------------|---------------------------------|------------------------------------------|
| UI framework         | React 18 + TypeScript           | Component model, type safety             |
| 3D rendering         | Three.js + `@react-three/fiber` | Declarative Three.js in React            |
| 3D helpers           | `@react-three/drei`             | OrbitControls, Grid, Text, Sphere        |
| Raycast acceleration | `three-mesh-bvh`                | O(log n) ray–triangle intersection       |
| Sun position         | `suncalc`                       | Altitude + azimuth from lat/lon/date     |
| Date handling        | `dayjs` + UTC/timezone plugins  | Timezone-aware date arithmetic           |
| Global state         | `zustand`                       | Minimal, selector-based store            |
| Charts               | `echarts` + `echarts-for-react` | Bar, radar, line charts; interactive tooltips |
| i18n                 | `i18next` + `react-i18next`     | EN/ES support, lazy-loaded JSON          |
| Build                | Vite                            | Fast HMR, static output for GitHub Pages |

---

## Project structure

```
src/
├── App.tsx                        # Root: loads config, full-viewport canvas + overlay panel
├── i18n.ts                        # i18next initialisation
│
├── assets/icons/                  # SVG icon files for the results panel header buttons
│   ├── panel-reset-width.svg
│   ├── panel-expand.svg
│   ├── panel-collapse.svg
│   └── panel-minimise.svg
│
├── styles/                        # CSS modules (imported via styles/index.css)
│   ├── index.css
│   ├── base.css
│   ├── layout.css
│   ├── controls.css
│   ├── simulation.css
│   └── results-panel.css
│
├── types/
│   ├── config.ts
│   ├── geometry.ts
│   ├── installation.ts
│   ├── results.ts
│   ├── simulation.ts              # IrradianceSource ('geometric' | 'open-meteo'),
│   │                              #   WorkerSimulationPayload (includes irradianceData)
│   └── index.ts
│
├── engine/
│   ├── SolarEngine.ts
│   └── AnnualSimulationEngine.ts
│
├── factory/
│   ├── SiteFactory.ts
│   ├── WallFactory.ts
│   ├── WallIntersectionFactory.ts
│   ├── PanelSetupFactory.ts
│   ├── SolarPanelArrayFactory.ts
│   ├── SolarPanelFactory.ts
│   ├── SamplePointFactory.ts
│   ├── PointXZFactory.ts
│   └── MeshFactory.ts
│
├── irradiance/                    # Irradiance provider strategy pattern
│   ├── IrradianceProvider.ts      # Interface + factory function (createIrradianceProvider)
│   ├── GeometricIrradianceProvider.ts  # Returns null → worker uses geometric model
│   └── OpenMeteoIrradianceProvider.ts  # Fetches hourly DNI from Open-Meteo; IndexedDB cache
│
├── converter/
│   ├── ThreeConverter.ts
│   └── SolarPanelConverter.ts
│
├── store/
│   ├── AppStore.ts                # Re-exports availableIntervals
│   └── slices/
│       ├── ConfigSlice.ts
│       ├── RenderSlice.ts
│       └── SimulationSlice.ts     # availableIntervals() conditioned by irradiance source;
│                                  #   setIrradianceSource resets interval if incompatible
│
├── hooks/
│   ├── useBVH.ts
│   ├── useShadowSampler.ts
│   ├── useAnnualSimulation.ts     # Resolves irradiance data before launching workers
│   ├── useResultsPanel.ts
│   └── useResizablePanel.ts
│
├── db/
│   ├── SimulationCache.ts         # IndexedDB v2: simulation-results store
│   └── IrradianceCache.ts         # IndexedDB v2: irradiance-cache store (permanent cache, past years only)
│
├── workers/
│   └── AnnualSimulation.worker.ts # Applies irradianceData multiplier when present
│
└── utils/
    ├── HashUtils.ts
    ├── SetupColoursUtils.ts
    ├── SimulationCacheUtils.ts
    ├── PointXZUtils.ts
    ├── RailingUtils.ts
    ├── ThreeUtils.ts
    └── TimeUtils.ts

└── components/
    ├── Scene.tsx
    ├── ShadowedScene.tsx
    ├── SolarPanelComponent.tsx
    ├── Sun.tsx
    ├── Compass.tsx
    ├── RenderControls.tsx
    ├── SimulationControls.tsx     # Interval selector conditioned to irradiance source
    ├── SimulationResultsPanel.tsx
    ├── AnnualSimulationProgress.tsx
    ├── AngleWarningBanner.tsx
    ├── DeveloperFooter.tsx
    └── results/
        ├── AnnualTab.tsx
        ├── MonthlyTab.tsx
        ├── DailyTab.tsx
        ├── AnnualBarChart.tsx
        ├── MonthlyRadarChart.tsx
        ├── MonthlyLineChart.tsx
        ├── DailyLineChart.tsx
        └── PanelShadowHeatmap.tsx
```

---

## Architecture decisions

### Factory pattern for domain models

All domain objects are plain immutable value objects created by dedicated factory functions. React components never construct domain objects — they only consume pre-computed `renderData`.

### Pre-computed render data with discriminated unions

Railing shapes use a discriminated union (`kind: 'square' | 'cylinder' | 'half-cylinder'`). The factory computes the exact Three.js geometry args for each shape and stores them in the render data. `Scene.tsx` switches on `kind` to render the correct geometry without any cast.

### CylinderGeometry for half-cylinders

Three.js `CylinderGeometry` constructor signature:
```
(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength)
```
A half-cylinder uses `openEnded=true` and `thetaLength=Math.PI`.

### Density changes do not rebuild panel geometry

`PanelSetupFactory.rebuildSamplePoints(existing, density)` reuses all panel geometry and only regenerates the NxN sample point grids.

### Two independent density/threshold parameters

- `renderDensity` / `renderThreshold` — live in `RenderSlice`. Control the 3D view and instant production readout.
- `simulationDensity` / `simulationThreshold` — live in `SimulationSlice`. Used exclusively when launching an annual simulation run.

### Store architecture — slice pattern with facade

Three domain slices composed behind a single `useAppStore` facade. Each slice is a pure function. Slices never import each other.

### Irradiance provider — Strategy pattern

The `IrradianceProvider` interface (`src/irradiance/IrradianceProvider.ts`) defines a single method:

```ts
getHourlyDNI(lat, lon, year): Promise<Float32Array | null>
```

Concrete implementations live in separate modules:

- `GeometricIrradianceProvider` — returns `null` immediately. The worker interprets `null` as "use geometric clear-sky model unchanged".
- `OpenMeteoIrradianceProvider` — fetches hourly DNI from Open-Meteo, caches in IndexedDB, returns a `Float32Array` of W/m² values.

The factory function `createIrradianceProvider(source)` uses dynamic `import()` so each provider module is only bundled into the chunk that needs it.

The worker is completely unaware of the irradiance source. `useAnnualSimulation` resolves the data once on the main thread and includes it in the `WorkerSimulationPayload` as `irradianceData: Float32Array | null`. Adding a new source in the future requires only a new module and a new `case` in the factory — the worker, store, and simulation engine are unaffected.

### Irradiance data — main thread fetch, not worker fetch

Fetching irradiance data inside the worker would require network access from a Worker context (which is supported, but adds complexity) and would result in one fetch per worker even though all setups share the same location and year. Fetching once on the main thread and distributing via `postMessage` is simpler and more efficient. Each worker receives its own `slice()` copy of the `Float32Array` so that zero-copy buffer transfer does not detach the shared array.

### Open-Meteo — why this API

- Free for non-commercial use, no API key, no registration.
- Explicitly supports CORS from browser origins — the only hard requirement for a static GitHub Pages app with no backend.
- Single call returns a full year of hourly DNI data (~26 KB gzipped JSON).
- Data goes back to 1940 via the historical archive endpoint.

PVGIS was evaluated and rejected: its API explicitly blocks AJAX requests from browser origins (`Warning: access to PVGIS APIs via AJAX is not allowed`). A proxy or backend would be required, which contradicts the no-backend constraint.

### Irradiance cache — permanent, no TTL

`IrradianceCache` stores entries under `{source}:{lat4dp}:{lon4dp}:{year}`.

Open-Meteo only supports completed past years via its historical archive endpoint. Historical reanalysis data is immutable — it will never change for a given (location, year) pair. The cache therefore has no TTL: any stored entry is returned as-is, and only one record per key is ever stored (`put` overwrites). The store size is bounded by the number of distinct (source, location, year) combinations the user has simulated.

### Interval and year selectors conditioned to irradiance source

Open-Meteo has two constraints that must be reflected in the UI:

**Interval**: DNI is available at hourly resolution only. Using a 15- or 30-minute interval would repeat the same DNI value for every sub-hourly step — correct numerically but misleading. `availableIntervals(source)` returns `[60]` for `open-meteo` and `[15, 30, 60]` for `geometric`.

**Year**: The Open-Meteo historical archive only covers completed past years. The current year is not yet available in full — requesting it would leave all future hours at 0 W/m², producing severely underestimated production figures. `availableSimulationYears(source)` excludes the current year when `source === 'open-meteo'`.

`setIrradianceSource` in `SimulationSlice` resets both interval and year atomically in a single `set((state) => ...)` updater, so no component ever observes an inconsistent combination.

### Results panel — floating resizable overlay

The results panel is a `position: fixed` overlay that sits on top of the 3D canvas. The canvas always fills `100vw × 100vh`.

### CSS fragmentation into modules

`src/styles/index.css` is a barrel import of five focused files.

### Panel shadow heat map — zone-level cells

Panels grouped by `arrayIndex`, sized proportionally to `actualWidth × actualHeight`, with zone sub-cells coloured by `zoneShadeFraction`.

### Physical geometry in `PanelAnnualData`

Carries `orientation`, `actualWidth`, `actualHeight`, `zones`, `zonesDisposition` so the results panel can render correct heat maps without the original config.

---

## Coordinate system

### Config space

```
      North (+Z)
          ↑
West ─────┼───── East (+X)
          ↓
      South (−Z)
```

### Three.js scene space

```
      North (−Z)
          ↑
West ─────┼───── East (+X)
          ↓
      South (+Z)
```

Config coordinates are flipped (`z_three = −z_config`) in `SiteFactory` and `SolarPanelArrayFactory`.

### Site azimuth

- Defined in degrees, **South = 0**.
- Positive values rotate towards West; negative towards East.
- Panel arrays have their own independent `azimuth` (absolute, not relative to site).

---

## 2D geometry — normals, dot product, cross product

### Unit normal to a segment

```
n = (-dz, dx) / |d|    (left-hand perpendicular)
```

### Cross product (2D)

```
cross(a, b) = a.x·b.z − a.z·b.x
```

`isConvex = true` in Three.js coordinates means an interior recess (270° interior angle).

---

## Configuration reference

```json
{
  "site": {
    "location": { "latitude": 40.62, "longitude": -4.01 },
    "azimuth": 0,
    "timezone": "Europe/Madrid",
    "wallPoints": [[0,0], [3.7,0], ...],
    "wallDefaults": { "height": 0.7, "thickness": 0.2 },
    "railingDefaults": { ... },
    "wallsSettings": [...]
  },
  "setups": [...]
}
```

### `arraysSettings` — per-panel overrides

Each entry targets one specific panel by its `array` / `row` / `col` address (all 0-based) and overrides `hasOptimizer` and/or `string`.

| Index | Axis | 0 = … |
|-------|------|--------|
| `row` | North–South | northernmost row |
| `col` | West–East   | westernmost column |

---

## Solar production model

### 1. Sun position

`suncalc.getPosition(date, lat, lon)` → altitude and azimuth → Three.js direction vector.

### 2. Incidence factor

```
incidenceFactor = max(0, dot(sunDirection, panelNormal))
basePower (kW)  = peakPower (Wp) / 1000 × incidenceFactor
```

### 3. Irradiance correction (Open-Meteo source)

When real DNI data is available:

```
basePower (kW) = peakPower (Wp) / 1000 × incidenceFactor × (DNI / 1000)
```

where 1000 W/m² is the Standard Test Condition (STC) reference irradiance. Clear-sky days with DNI ≈ 1000 W/m² produce results identical to the geometric model; overcast days with lower DNI are automatically discounted.

### 4. Panel output with bypass diodes

| Shaded zones | Without optimizer                                   | With optimizer        |
|--------------|-----------------------------------------------------|-----------------------|
| 0            | `basePower`                                         | `basePower`           |
| k out of n   | `basePower × (n−k)/n × 0.9` (10% mismatch penalty) | `basePower × (n−k)/n` |
| all          | 0                                                   | 0                     |

### 5. String mismatch

Without optimizers, string efficiency is limited by the least-efficient panel.

---

## Shadow detection — Raycasting + BVH

### Why BVH?

`three-mesh-bvh` pre-organises each geometry into a Bounding Volume Hierarchy. A ray tests O(log n) nodes instead of O(n) triangles.

### How it is set up

1. Patch Three.js once (`useBVH.ts`).
2. Build the BVH (`useBVH` hook): rebuilt only when `rebuildKey` changes.
3. Cast rays (`useShadowSampler` hook): `firstHitOnly = true`.
4. Avoid GC pressure: all scratch objects allocated once at module scope.

### `three-mesh-bvh` override

`package.json` contains `"overrides": { "three-mesh-bvh": "^0.9.9" }`.

---

## Annual simulation

### Overview

Steps through every N-minute interval of a full year for all setups simultaneously. Accumulates energy and shade fractions per panel broken down by month, day-of-month, and hour-of-day.

### Irradiance sources

| Source | Description | Network | Interval support | Year support |
|--------|-------------|---------|-----------------|--------------|
| `geometric` | Clear-sky model, sun geometry only | None | 15, 30, 60 min | Current + past 5 years |
| `open-meteo` | Hourly DNI from Open-Meteo Historical API | Required | 60 min only | Past 5 years only |

Selecting Open-Meteo automatically restricts both the interval selector (60 min only) and the year selector (past years only). The current year is excluded because the Open-Meteo archive only covers completed years — including it would produce results where all future hours show 0 W/m².

On fetch failure, `useAnnualSimulation` logs a warning and proceeds with `irradianceData = null`, which causes the worker to fall back to the geometric model transparently.

### Irradiance data flow

```
Main thread                        Worker
──────────────────────────────     ─────────────────────────────────
createIrradianceProvider(source)
  → provider.getHourlyDNI(...)     receives irradianceData: Float32Array | null
  → Float32Array (8760 values)     per time step:
  → slice() per worker copy          dni = irradianceData[utcHourOfYear]
  → zero-copy postMessage            basePower *= dni / 1000  (if data present)
```

### IndexedDB — two independent databases

Each cache module manages its own database, keeping them fully decoupled:

| Database | Version | Store | Key | Contents |
|----------|---------|-------|-----|----------|
| `solar-simulator` | 1 | `simulation-results` | `cacheKey` hash | Full `SetupAnnualResult` |
| `solar-simulator-irradiance` | 1 | `irradiance-cache` | `{source}:{lat4dp}:{lon4dp}:{year}` | Hourly DNI array |

Separate databases mean each module's `onupgradeneeded` handler only knows about its own stores — no cross-module coupling during schema creation or migration.

### Worker architecture

**Worker pool:** `max(1, hardwareConcurrency − 1)` concurrent workers.

**Irradiance multiplier per step:**
```ts
const hourIdx = Math.floor((date.getTime() - yearStartUTC) / 3_600_000);
const dni = irradianceData ? irradianceData[hourIdx] : 1000;
irradianceMultiplier = dni / 1000;
basePower = peakPower/1000 × incidenceFactor × irradianceMultiplier;
```

**Progress reporting:** every 100 steps, EMA-smoothed ETA.

### Cache key and hashing

Keyed by `SimulationCacheKey` (setup geometry hash, density, threshold, interval, location, year, irradiance source). FNV-1a 32-bit hash.

### Output data model

```
PanelAnnualData.energyKwh         [month][dayOfMonth][hourOfDay]
PanelAnnualData.shadeFraction     [month][dayOfMonth][hourOfDay]
PanelAnnualData.zoneShadeFraction [zone][month][dayOfMonth][hourOfDay]
```

---

## Results panel

### Layout and interaction

Fixed overlay on the right edge. Drag handle resizes between 280px and 100vw. Three icon buttons: reset width, fullscreen, minimise.

### Content organisation

Parameter summary strip → setup legend → three tabs (Annual, Monthly, Daily). Each tab has a Production section and a Shadows section.

### Setup colour consistency

`src/utils/SetupColoursUtils.ts` — fixed eight-colour palette, assigned by rank within the simulation group.

### Panel shadow zone heat map

Physical panel grid, proportional cell sizes, bypass-diode zones coloured by shade fraction (green → yellow → red). Zone IDs match the 3D view labels.

---

## Application layout

Canvas fills `100vw × 100vh`. All UI elements are absolute or fixed overlays.

---

## Timezone and DST

`makeDateInTimezone(year, month, day, hour, minute, timezone)` uses `dayjs.tz(isoString, timezone)`. The annual simulation worker uses UTC timestamps directly via `Date.UTC()`.

---

## Known limitations

- **90° wall angles only**: non-right angles produce incorrect post placement.
- **Open-Meteo resolution is hourly**: sub-hourly intervals are only available with the geometric model.
- **No diffuse irradiance**: only DNI (direct beam) is used for the Open-Meteo correction. Diffuse sky radiation is not modelled.
- **Rail extensions end in a 90° cut**: a 45° mitre would require custom `BufferGeometry`.
- **Drag-to-resize is mouse-only**: touch not supported.

---

## Lessons learned

### Factory pattern for irradiance sources

The Strategy pattern via an `IrradianceProvider` interface keeps the simulation worker and engine completely agnostic of how irradiance data is obtained. Adding a new source is a two-file change: one new module and one new `case` in the factory.

### Fetch once on the main thread, distribute to workers

Resolving irradiance data centrally before worker launch avoids duplicate network requests (one per worker) and keeps the worker free of I/O concerns.

### Zero-copy buffer transfer with per-worker copies

`Float32Array.slice()` produces an independent copy of the irradiance buffer for each worker. Without this, the first `postMessage` with `transfer` would detach the shared buffer, causing subsequent workers to receive an empty array.

### IndexedDB schema versioning

Bumping `DB_VERSION` and handling `onupgradeneeded` correctly ensures the new `irradiance-cache` store is created on upgrade without losing existing `simulation-results` records.

### No TTL needed when only immutable data is cached

Since Open-Meteo is restricted to past years, all cached irradiance data is from immutable historical reanalysis. A permanent cache (no TTL, no expiry) is correct and simpler than maintaining a TTL strategy.

### Year restriction communicates API coverage gap

Rather than fetching partial data for the current year and leaving future hours at 0 W/m², the year selector is restricted to past years when Open-Meteo is selected. This is the honest approach: the user sees only years for which complete data exists.

### Interval and year reset atomically on source change

Changing the irradiance source, clamping the interval, and clamping the year all happen in a single `set((state) => ...)` updater call, so no component ever sees an inconsistent combination of source + interval + year.

### `useEffect` dependency arrays must reflect semantic intent

`showPoints` is absent from `ShadowedScene`'s props and the shadow dirty-flag effect. The annual simulation effect in `Scene` lists only `isRunning`.

### Memoising derived arrays that feed hooks

`allPanels` inside `ShadowedScene` is wrapped in `useMemo([activeSetup])`.

### Caching scene traversal in hooks

Cache the result in a `useRef` and invalidate with the same key used to rebuild the BVH.

### Per-worker geometry copies, not shared transfer

Each worker must receive its own copy. `MeshFactory.fromScene(scene).build()` produces a fresh `MeshBatch` on each call.

### Sample points pre-computed before worker transfer

`SolarPanelConverter.toSimulationPanelDataArray` pre-computes world-space positions once.

### EMA for ETA smoothing

An EMA with α = 0.2 smooths burst noise from variable shadow complexity.

### Discriminated unions over string enums for geometry variants

Adding a new shape without handling it in the renderer is a compile error.

### FNV-1a for cache key hashing

Synchronous, ~10 lines, public domain, negligible collision probability.

### Slice pattern with facade for global store

Each slice owns a clearly bounded domain. Cross-slice reads use a structural interface to avoid circular imports.

### Simulation results grouped at display time, not at storage time

IndexedDB stores one entry per setup. Grouping at display time keeps the storage model simple.

### Fixed overlay panel avoids canvas resize

Making the results panel a `position: fixed` overlay means the Three.js `<Canvas>` always occupies `100vw × 100vh`.

### Component-scoped state stays out of Zustand

The results panel's selected group, active tab, legend toggles, and loaded data are all managed by `useResultsPanel`.

### Physical geometry propagated through simulation pipeline

Carrying `orientation`, `actualWidth`, `actualHeight`, `zones`, `zonesDisposition` from `SolarPanel` through `SimulationPanelData` into `PanelAnnualData` means the results panel can render proportionally correct heat maps without access to the original config.

### SVG icons as files, not inline or Unicode

Icon SVGs live in `src/assets/icons/` and are imported as URLs by Vite.

### Zone ID scheme: 0-based throughout

Zone IDs follow `a{arr}-r{row}-c{col}-z{zone}` using 0-based indices everywhere.

### `arraysSettings` applied after geometry, not during construction

Per-panel overrides are applied in `PanelSetupFactory.create` as a post-processing pass over the fully built arrays.