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
11. [Application layout](#application-layout)
12. [Timezone and DST](#timezone-and-dst)
13. [Known limitations](#known-limitations)
14. [Lessons learned](#lessons-learned)

---
 
## What it does
 
- Renders a rooftop installation in 3D (walls, railings with balusters, solar panels) using Three.js.
- Animates the sun's trajectory across the sky for any date and time.
- Detects which panel zones are shaded using raycasting against all shadow-casting geometry (walls, railings, supports, and other panels).
- Estimates instantaneous power output in kW, applying bypass-diode, string-mismatch and optimizer logic.
- Supports multiple installation layouts ("setups") selectable via the UI.
- Runs a full annual simulation for all configured setups in parallel Web Workers, accumulating energy (kWh) per panel broken down by month, day, and hour. Results are cached in IndexedDB so re-running the same configuration is instant.
- Displays annual results in a dedicated right-column panel alongside the 3D viewport, with a responsive stacked layout on narrow screens. Past simulation runs can be selected and compared from a dropdown.
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
| i18n                 | `i18next` + `react-i18next`     | EN/ES support, lazy-loaded JSON          |
| Build                | Vite                            | Fast HMR, static output for GitHub Pages |
 
---
 
## Project structure
 
```
src/
├── App.tsx                        # Root: loads config, wires two-column layout + canvas
├── i18n.ts                        # i18next initialisation
│
├── types/
│   ├── config.ts                  # JSON config shapes (InstallationConfiguration, ...)
│   ├── geometry.ts                # PointXZ, Vector3, Euler3, AngleWarning (renderer-agnostic)
│   ├── installation.ts            # Domain models: Site, Wall, SolarPanel, ...
│   ├── simulation.ts              # SunState, SimulationResult, annual simulation types,
│   │                              #   worker message protocol, SimulationPanelData, ...
│   └── index.ts                   # Re-exports
│
├── engine/
│   ├── SolarEngine.ts             # Pure functions: sun state, incidence, panel output,
│   │                              #   string mismatch. Used by both the interactive view
│   │                              #   and the annual simulation worker.
│   └── AnnualSimulationEngine.ts  # Pure accumulation functions: initAccumulators,
│                                  #   accumulateStep, finalizePanel, buildSetupResult.
│
├── factory/
│   ├── SiteFactory.ts             # Config → Site (walls, intersections, angle validation)
│   ├── WallFactory.ts             # Wall segment geometry + railing + supports
│   ├── WallIntersectionFactory.ts # Corner posts
│   ├── PanelSetupFactory.ts       # PanelSetupConfiguration + Site → PanelSetup
│   ├── SolarPanelArrayFactory.ts  # Computes array origin, creates panels
│   ├── SolarPanelFactory.ts       # Single panel world position + render data
│   ├── SamplePointFactory.ts      # Sample points for raycasting per panel
│   ├── PointXZFactory.ts          # Safe PointXZ constructor
│   └── MeshFactory.ts             # Collects and serialises shadow-casting meshes for workers
│
├── converter/
│   ├── ThreeConverter.ts          # Domain Vector3/Euler3 → THREE.Vector3/Euler
│   └── SolarPanelConverter.ts     # SolarPanel → SimulationPanelData / world normal
│
├── store/
│   ├── AppStore.ts                # Zustand facade: composes all slices into useAppStore.
│   │                              #   Re-exports makeDateInTimezone, availableSimulationYears,
│   │                              #   SimulationInterval for consumer convenience.
│   └── slices/
│       ├── configSlice.ts         # config, site, angleWarnings, loadConfig
│       ├── renderSlice.ts         # active setup, date/time, timezone, playback, sun,
│       │                          #   showPoints, renderDensity, renderThreshold.
│       │                          #   Also exports makeDateInTimezone.
│       └── simulationSlice.ts     # simulationDensity, simulationThreshold, interval, year,
│                                  #   irradianceSource, isRunning, progress, annualResults.
│                                  #   Also exports availableSimulationYears, SimulationInterval.
│
├── hooks/
│   ├── useBVH.ts                  # Builds BVH over shadow-casting meshes
│   ├── useShadowSampler.ts        # Casts rays, returns ShadowMap (interactive)
│   └── useAnnualSimulation.ts     # Orchestrates worker pool for annual simulation
│
├── db/
│   └── SimulationCache.ts         # IndexedDB wrapper for SetupAnnualResult persistence
│
├── workers/
│   └── AnnualSimulation.worker.ts # Full annual simulation loop
│
└── utils/
    ├── HashUtils.ts               # FNV-1a 32-bit hash
    ├── SimulationCacheUtils.ts    # buildCacheKey() and hashCacheKey()
    ├── PointXZUtils.ts            # 2D geometry helpers
    ├── RailingUtils.ts            # Railing rail render data builder
    ├── ThreeUtils.ts              # Mesh serialisation / reconstruction for workers
    └── TimeUtils.ts               # Timezone helpers, timeSteps generator, formatEta

└── components/
    ├── Scene.tsx                  # Root 3D scene; wires annual simulation hook
    ├── ShadowedScene.tsx          # Dirty-flag raycasting loop, feeds ShadowMap
    ├── SolarPanelComponent.tsx    # Single panel render (purely presentational)
    ├── Sun.tsx                    # Sun sphere + directional light
    ├── Compass.tsx                # N/S/E/W labels in 3D
    ├── RenderControls.tsx         # Top-left panel: setup selector, date/time/play controls,
    │                              #   timezone/language, plus render-specific sampling
    │                              #   controls (showPoints, renderDensity, renderThreshold)
    │                              #   and the instant production readout.
    ├── SimulationControls.tsx     # Bottom-left panel: annual simulation parameters
    │                              #   (simulationDensity, simulationThreshold, interval,
    │                              #   year, irradiance source) and run/stop button.
    ├── SimulationResultsPanel.tsx # Right-column panel: selector of past simulation runs
    │                              #   loaded from IndexedDB, parameter summary, and
    │                              #   per-setup results ranked by annual production.
    ├── AnnualSimulationProgress.tsx  # Per-setup progress bars with ETA
    ├── AngleWarningBanner.tsx     # Warning banner for non-90° angles
    └── DeveloperFooter.tsx        # Ko-fi link + personal site
```
 
---
 
## Architecture decisions

### Factory pattern for domain models
 
All domain objects are plain immutable value objects created by dedicated factory functions. React components never construct domain objects — they only consume pre-computed `renderData`.

### Pre-computed render data with discriminated unions
 
Railing shapes use a discriminated union (`kind: 'square' | 'cylinder' | 'half-cylinder'`). The factory computes the exact Three.js geometry args for each shape and stores them in the render data. `Scene.tsx` switches on `kind` to render the correct geometry without any cast. TypeScript will error if a new shape is added to the union but not handled in the switch.
 
### CylinderGeometry for half-cylinders
 
Three.js `CylinderGeometry` constructor signature:
```
(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength)
```
A half-cylinder uses `openEnded=true` and `thetaLength=Math.PI`. `thetaStart` selects which half: `0` for flat face down (`orientation: 'up'`), `Math.PI` for flat face up (`orientation: 'down'`). `heightSegments=1` is required to reach the `openEnded` positional parameter.
 
### Density changes do not rebuild panel geometry
 
`PanelSetupFactory.rebuildSamplePoints(existing, density)` reuses all panel geometry and only regenerates the NxN sample point grids. Both `setRenderDensity` and `setSimulationDensity` in the store call this for their respective active setup references. See [Lessons learned](#lessons-learned).

### Two independent density/threshold parameters

The application exposes two separate pairs of density and threshold controls:

- `renderDensity` / `renderThreshold` — live in `renderSlice`. Control the sample points visible in the 3D view and the instant production readout. Changing them rebuilds the active setup's sample points immediately and triggers a new shadow pass.
- `simulationDensity` / `simulationThreshold` — live in `simulationSlice`. Used exclusively when launching an annual simulation run. Changing them has no effect on the 3D view. This separation allows using a coarser grid for fast interactive exploration and a finer grid for the annual computation, or vice-versa.

`showPoints` belongs only to `renderSlice` — it has no meaning in the annual simulation context since no visual output is produced during a worker run.
 
### Setup selection by index, id derived from label
 
`PanelSetupConfiguration` has no `id` field. `PanelSetupFactory.create` derives a stable internal id from the label plus the index suffix, guaranteeing uniqueness even if two setups share the same normalised label. The id is used only as a React key and as the BVH rebuild signal.

### Store architecture — slice pattern with facade

The global store is structured as three domain slices composed behind a single `useAppStore` facade:

- `configSlice` — configuration and site geometry. Owns `config`, `site`, `angleWarnings`, and `loadConfig`.
- `renderSlice` — interactive 3D view state. Owns `activeSetup`, `activeSetupIndex`, `date`, `timezone`, `isPlaying`, `sun`, `showPoints`, `renderDensity`, `renderThreshold`, and all their actions.
- `simulationSlice` — annual simulation state. Owns `simulationDensity`, `simulationThreshold`, `simulationInterval`, `simulationYear`, `irradianceSource`, `isRunning`, `activeProgress`, `pendingSetups`, `annualResults`, `simulationResult`, and all their actions.

Each slice is a pure function `createXxxSlice(set, get?) => SliceType`. Slices never import each other — cross-slice reads in `renderSlice` go through a `CrossSliceRead` interface satisfied by the full store `get()` at the facade level. This avoids circular imports between slice files.

The facade (`AppStore.ts`) calls `create<AppStore>` once, spreads all three slices, and overrides `loadConfig` to coordinate config parsing and render initialisation in a single logical operation and a single store commit. All consumers import only `useAppStore` from `AppStore.ts` — they are unaware of which slice owns which piece of state.

### Two distinct tick mechanisms
 
- **Interactive playback** (`tickHour`): advances 1 hour per 100 ms interval. Unit fixed at 1 hour.
- **Annual simulation**: uses `simulationInterval` (15/30/60 min) in its own loop running in a Web Worker.

### `showPoints` excluded from ShadowedScene
 
`showPoints` only controls rendering of sample point spheres in `SolarPanelComponent`. `ShadowedScene` does not accept it as a prop — doing so would cause raycasting to run on every visibility toggle with no change in shadow output.
 
### `allPanels` memoised in ShadowedScene

`activeSetup.panelArrays.flatMap(pa => pa.panels)` is wrapped in `useMemo` inside `ShadowedScene`. Without memoisation, the flat array is reconstructed on every render, which invalidates the `panels` identity passed to `useShadowSampler` and triggers an unnecessary re-creation of the `computeShadows` callback on every frame.

### Shadow mesh cache in `useShadowSampler`
 
The list of shadow-casting meshes is built via `scene.traverse` once and stored in a `useRef`, invalidated only when `rebuildKey` changes. `ShadowedScene` is the single source of truth for this key.
 
### Timezone as store state, not Site geometry
 
`timezone` is absent from the `Site` type. It lives in `renderSlice` as display state. All solar calculations use `date.toDate()` (native `Date`, always UTC). Timezone never affects calculations.

### Simulation results grouping in SimulationResultsPanel

IndexedDB stores one `SetupAnnualResult` per setup. `SimulationResultsPanel` groups entries by their shared parameters (`year`, `intervalMinutes`, `irradianceSource`) to present them as a single "simulation run" in the selector. Within each group, setups are ranked by `annualTotalKwh` descending. The group label format is defined in a single `buildGroupLabel` function and driven by the i18n key `simulationResultsPanel.groupLabel`, making it straightforward to change the format without touching component logic.

When density and threshold are added to the `listResults` summary type in a future phase, they can be included in the grouping key and the label without changing the component structure.

### Layout — minimum canvas height via CSS custom property

The minimum height of the canvas column in the stacked (narrow) layout is controlled by the `--canvas-min-height` CSS custom property defined at `:root` level in `App.css`. The default is `50vh`. Changing it to `60vh` or any other value requires editing only that one line.

### Wall geometry — only 90° angles are supported

The application is restricted to wall configurations where every angle between adjacent wall segments is exactly 90° (or 180° for collinear segments). Collinear vertices produce no intersection post. All other vertices produce an intersection post and are listed in `site.wallIntersections`. `SiteFactory` emits `angleWarnings` for any non-right-angle vertices, which `AngleWarningBanner` renders.

### `RailingUtils` — shared railing render data builder

`WallFactory` and `WallIntersectionFactory` both need to build `RailingRailRenderData` for all three railing shapes. The logic is consolidated in `RailingUtils.buildRailRenderData`. Adding a new shape requires editing only this function.

### Railing support distribution

Two modes — homogeneous (no `edgeDistance`) and edge-anchored (`edgeDistance` provided) — computed by `computeSupportPositions` inside `WallFactory`.

### Railing rail extensions

Extension length per end: `wallThickness / 2 − extensionGap / 2`. With `extensionGap = 0` the tips meet flush at the post centre.

### `engine/` — separation of physics from orchestration

`SolarEngine.ts` is importable in both the main thread and workers. `AnnualSimulationEngine.ts` provides pure accumulation functions with no Three.js or worker dependencies.

### `SolarPanelConverter.toWorldNormal` — single source of truth for panel normals

Used by `SolarEngine.calculateInstantProduction` (interactive) and `SolarPanelConverter.toSimulationPanelData` (pre-computation before worker transfer). One implementation, two consumers.

### `ThreeUtils` — mesh serialisation and reconstruction

Both directions of the serialisation round-trip live in the same module, making it the single place to update if the BVH serialisation API changes.

### `MeshFactory` — independent copies per worker

Each call to `MeshFactory.fromScene(scene).build()` produces a fresh `MeshBatch`. This is the only safe pattern when multiple workers each need a zero-copy transfer.

### Cache key computed once per setup in `useAnnualSimulation`

The simulation cache key for each setup is computed once at the start of `run()` and passed directly to both the IndexedDB lookup and the worker payload constructor.

### No inline styles in components

All visual styling is defined in `App.css` using class names. React components use `className` references only.

### i18n key structure

- `renderControls.*` — keys for `RenderControls`
- `simulationControls.*` — keys for `SimulationControls`
- `simulationResultsPanel.*` — keys for `SimulationResultsPanel`
- `angleWarning.*` — keys for `AngleWarningBanner`
- Top-level keys (`title`, `loading`, `coordinates.*`, `footer.*`) are shared

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

### Wall segment numbering
 
Segment `i` runs from `wallPoints[i]` to `wallPoints[(i+1) % n]`.

### Floor outline

Derived from `site.wallIntersections` (non-collinear vertices only).
 
---

## 2D geometry — normals, dot product, cross product

### Unit normal to a segment

```
n = (-dz, dx) / |d|    (left-hand perpendicular)
```

`PointXZUtils.computeLeftHandNormal(pA, pB)` computes this for any segment.

### Dot product

For unit vectors: `dot(a, b) = cos(θ)`. Used for collinearity detection.

### Cross product (2D)

```
cross(a, b) = a.x·b.z − a.z·b.x
```

Because Three.js negates Z relative to config space, `isConvex = true` in Three.js coordinates means an interior recess (270° interior angle) in real-world terms.

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
    "railingDefaults": {
      "active": true,
      "heightOffset": 0.18,
      "extendAtStart": false,
      "extendAtEnd": false,
      "extensionGap": 0,
      "shape": { "kind": "cylinder", "radius": 0.025 },
      "support": {
        "shape": { "kind": "cylinder", "radius": 0.012 },
        "count": 3,
        "edgeDistance": 0.15
      }
    },
    "wallsSettings": [...]
  },
  "setups": [...]
}
```

### Railing shapes
 
| kind            | Parameters                            |
|-----------------|---------------------------------------|
| `square`        | `width`, `height`                     |
| `cylinder`      | `radius`                              |
| `half-cylinder` | `radius`, `orientation: 'up'\|'down'` |
 
### `zonesDisposition`
 
| Value        | Layout                     | Split axis |
|--------------|----------------------------|------------|
| `horizontal` | Zones are horizontal bands | Z (height) |
| `vertical`   | Zones are vertical columns | X (width)  |
 
---
 
## Solar production model

### 1. Sun position
 
`suncalc.getPosition(date, lat, lon)` returns altitude and azimuth. Converted to a Three.js direction vector:
 
```ts
x =  cos(altitude) * sin(-azimuth)
y =  sin(altitude)
z =  cos(altitude) * cos(azimuth)
```
 
### 2. Incidence factor
 
```
incidenceFactor = max(0, dot(sunDirection, panelNormal))
basePower (kW)  = peakPower (Wp) / 1000 × incidenceFactor
```
 
### 3. Panel output with bypass diodes

| Shaded zones | Without optimizer                                   | With optimizer        |
|--------------|-----------------------------------------------------|-----------------------|
| 0            | `basePower`                                         | `basePower`           |
| k out of n   | `basePower × (n−k)/n × 0.9` (10% mismatch penalty) | `basePower × (n−k)/n` |
| all          | 0                                                   | 0                     |
 
### 4. String mismatch

Without optimizers, string efficiency is limited by the least-efficient panel.
`applyStringMismatch` is exported from `engine/SolarEngine.ts` and shared between the interactive view and the worker.
 
---
 
## Shadow detection — Raycasting + BVH
 
### Why BVH?
 
`three-mesh-bvh` pre-organises each geometry into a Bounding Volume Hierarchy. A ray tests O(log n) nodes instead of O(n) triangles.
 
### How it is set up
 
1. **Patch Three.js once** (`useBVH.ts`).
2. **Build the BVH** (`useBVH` hook): rebuilt only when `rebuildKey` changes.
3. **Cast rays** (`useShadowSampler` hook): `firstHitOnly = true` stops traversal after the first hit.
4. **Avoid GC pressure**: all scratch objects allocated once at module scope.

### Dirty flag
 
`ShadowedScene` only runs the raycasting pass when a `needsUpdate` ref is `true`. The flag is set by a `useEffect` watching `[sun, activeSetup, density, threshold]`.

### `three-mesh-bvh` override
 
`package.json` contains `"overrides": { "three-mesh-bvh": "^0.9.9" }`. This must be kept to prevent two coexisting versions.

---

## Annual simulation

### Overview

Steps through every N-minute interval of a full year for all setups simultaneously. Accumulates energy and shade fractions per panel broken down by month, day-of-month, and hour-of-day.

### Year selector

The UI offers the current year plus up to 5 past years. Controlled by `PAST_YEARS_AVAILABLE` in `simulationSlice.ts`.

### Irradiance source

Three options: geometric, PVGIS, Open-Meteo. Only geometric is implemented; the others are stored in the cache key so results from different models coexist in IndexedDB without collision.

### Worker architecture

**BVH serialisation and per-worker geometry copies:** `MeshFactory.fromScene(scene).build()` produces independent typed-array copies per worker. Each worker's buffers are zero-copy transferred via `postMessage`.

**Sample points pre-computed on the main thread:** `SolarPanelConverter.toSimulationPanelDataArray` transforms local-space sample points to world space before transfer.

**Worker pool:**
```
workerCount = max(1, hardwareConcurrency − 1)
```

**Progress reporting:** Workers emit every 100 steps. EMA (α = 0.2) smooths the remaining-time estimate. ETA shown after 5% of steps complete.

### Accumulation and finalisation

`engine/AnnualSimulationEngine.ts` provides pure functions (`initAccumulators`, `accumulateStep`, `finalizePanel`, `buildSetupResult`) with no Three.js or worker dependencies.

### Cache key and hashing

Keyed by `SimulationCacheKey` (setup geometry hash, density, threshold, interval, location, year, irradiance source). FNV-1a 32-bit hash. Computed once per setup in `useAnnualSimulation.run()`, reused for both the IndexedDB lookup and the worker payload.

### IndexedDB persistence

`SimulationCache` provides a Promise-based wrapper. Storage failures surface as rejected Promises. Results survive page reloads.

### Output data model

```
PanelAnnualData.energyKwh         [month][dayOfMonth][hourOfDay]
PanelAnnualData.shadeFraction     [month][dayOfMonth][hourOfDay]
PanelAnnualData.zoneShadeFraction [zone][month][dayOfMonth][hourOfDay]
```

`SetupAnnualResult` also carries pre-rolled `monthlyTotalKwh` and `annualTotalKwh`.

### Annual simulation and the Canvas tree

`useAnnualSimulation` calls `useThree()` internally. `Scene.tsx` is always rendered inside `<Canvas>` in `App.tsx`, making it the correct host.

The annual simulation uses `simulationDensity` to build setups for the workers, independent of the `renderDensity` used in the interactive view.

---

## Application layout

### Two-column split

```
Desktop (≥ 1024px):
┌─────────────────────┬──────────────────────┐
│                     │                      │
│   3D Canvas         │   Results Panel      │
│   + 3D controls     │   (light background) │
│                     │                      │
└─────────────────────┴──────────────────────┘

Mobile / narrow (< 1024px):
┌──────────────────────┐
│   3D Canvas          │  ← min-height: --canvas-min-height (default 50vh)
│   + 3D controls      │
├──────────────────────┤
│   Results Panel      │  ← expands to content height, scrollable
└──────────────────────┘
```

The minimum height of the canvas column in the stacked layout is controlled by the CSS custom property `--canvas-min-height` in `App.css` (default `50vh`). The results column sits below it, expands to fit its content, and scrolls independently. This makes it ready to accommodate charts without structural changes.

The results column has a light off-white background (`#f5f4f0`) so that text is readable without any additional colour configuration.

### SimulationResultsPanel (`SimulationResultsPanel.tsx`)

Occupies the right column and offers three content states:

1. **Empty + idle**: prompt to run the simulation.
2. **Empty + running**: "simulation in progress" indicator.
3. **Results available**: a dropdown selector of past simulation runs (grouped from IndexedDB), a parameter summary card, and per-setup results ranked by annual production.

While a simulation is running, partial results appear below the selector as they arrive. The panel is always mounted so the CSS flex layout reserves the column width.

---
 
## Timezone and DST
 
`makeDateInTimezone(year, month, day, hour, minute, timezone)` uses `dayjs.tz(isoString, timezone)`. Exported from `renderSlice.ts` and re-exported from `AppStore.ts`. This function is the **only** correct way to construct dates from user inputs.

`date.toDate()` (native JS `Date`) always represents a UTC instant. SunCalc receives this value. The annual simulation worker uses UTC timestamps directly via `Date.UTC()`.

---
 
## Known limitations
 
- **90° wall angles only**: non-right angles produce incorrect post placement. A warning lists the exact coordinate triples from config.json.
- **Single year for interactive view**: date controls constrained to current year. Annual simulation supports past years.
- **No diffuse irradiance**: only direct (beam) irradiance modelled geometrically. PVGIS and Open-Meteo planned.
- **Rail extensions end in a 90° cut**: a 45° mitre would require custom `BufferGeometry`.
- **`window.confirm` for stop confirmation**: native dialog used. Custom modal straightforward to add.
- **density/threshold not in `listResults` summary**: the `SimulationResultsPanel` grouping key does not yet include these parameters because `SimulationCache.listResults()` does not expose them. They will be added to the summary type in a future phase, at which point the grouping and label will include them without structural changes.

---
 
## Lessons learned
 
### `useEffect` dependency arrays must reflect semantic intent
 
`showPoints` is absent from `ShadowedScene`'s props and the shadow dirty-flag effect. The annual simulation effect in `Scene` lists only `isRunning`.

### Memoising derived arrays that feed hooks

`allPanels` inside `ShadowedScene` is wrapped in `useMemo([activeSetup])`.
 
### Separating factory methods by what changes
 
`PanelSetupFactory.rebuildSamplePoints` vs `create`: separate entry points make the intent explicit at the call site.
 
### Caching scene traversal in hooks
 
Cache the result in a `useRef` and invalidate with the same key used to rebuild the BVH.

### Per-worker geometry copies, not shared transfer

Each worker must receive its own copy. `MeshFactory.fromScene(scene).build()` produces a fresh `MeshBatch` on each call.

### Sample points pre-computed before worker transfer

`SolarPanelConverter.toSimulationPanelDataArray` pre-computes world-space positions once, avoiding matrix multiplication inside the worker at every time step.

### EMA for ETA smoothing

An EMA with α = 0.2 smooths burst noise from variable shadow complexity.
 
### The three-mesh-bvh override
 
npm `overrides` are appropriate when a package patches a shared global prototype.
 
### Discriminated unions over string enums for geometry variants
 
Adding a new shape without handling it in the renderer is a compile error.

### Restricting to 90° simplifies geometry significantly

Angle validation at load time with a visible UI warning is the correct trade-off.

### FNV-1a for cache key hashing

Synchronous, ~10 lines, public domain, negligible collision probability for config-sized objects.

### Slice pattern with facade for global store

Each slice owns a clearly bounded domain. Cross-slice reads use a structural interface to avoid circular imports. The facade (`AppStore.ts`) is the only place where slices interact, making cross-slice coordination explicit and auditable. Adding a new domain (e.g. export/import state) means adding a new slice and spreading it in the facade — existing slices are untouched.

### Two independent sampling parameter pairs

Using separate `renderDensity`/`renderThreshold` and `simulationDensity`/`simulationThreshold` eliminates the previous coupling where a density change for visual exploration would also change what the next simulation would compute. Each control surface now affects only what it is responsible for.

### Simulation results grouped at display time, not at storage time

IndexedDB stores one entry per setup. Grouping into "runs" at display time in `SimulationResultsPanel` avoids any schema change and keeps the storage model simple. Adding more grouping parameters (density, threshold) in a future phase only requires updating `groupResults` and `buildGroupLabel`.

### CSS custom property for canvas minimum height

`--canvas-min-height` at `:root` is the single knob for adjusting the stacked layout. No JavaScript change needed, no component prop needed.

### Light background for results panel — no shared body background

The results panel has its own `background: #f5f4f0` applied to `.app-layout__results-column`. The rest of the app remains dark. This avoids any global body background change that would affect the Three.js canvas or the overlay controls.

### Shared railing render data logic in `RailingUtils`

Adding a new railing shape requires editing only `RailingUtils.buildRailRenderData`.

### `SiteFactory` returns a result object, not just `Site`

Returning `{ site, angleWarnings }` keeps the factory free of side effects.

### Solar engine shared between interactive view and worker

`engine/SolarEngine.ts` uses only Three.js math classes (`Vector3`, `Euler`, `Matrix4`) which are DOM-free.

### Cache key computed once, used twice

Computing it once at the start of `run()` and passing it to both the cache lookup and the worker payload eliminates the risk of the two computations drifting apart.

### Naming types by role, not by transport

`SimulationPanelData` and `SimulationSamplePoint` describe what the data represents, not how it is transported.

### `AnnualSimulationEngine` contains no I/O or orchestration

Every function is pure. The worker drives the loop; the engine only knows how to accumulate one step and finalise one panel.

### Two-column layout with flex, no library needed

Two CSS flex rules and one media query. The canvas column is `flex: 1`.