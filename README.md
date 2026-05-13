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
12. [Settings sidebar](#settings-sidebar)
13. [Application layout](#application-layout)
14. [Timezone and DST](#timezone-and-dst)
15. [Known limitations](#known-limitations)
16. [Lessons learned](#lessons-learned)

---

## What it does

- Renders a rooftop installation in 3D (walls, railings with balusters, solar panels) using Three.js.
- Animates the sun's trajectory across the sky for any date and time.
- Detects which panel zones are shaded using raycasting against all shadow-casting geometry (walls, railings, supports, and other panels).
- Displays zone ID labels in the 3D view (`a{array}-r{row}-c{col}-z{zone}`) so each zone can be correlated with the results panel heat maps without ambiguity.
- Estimates instantaneous power output in kW, applying bypass-diode, string-mismatch and optimizer logic.
- Supports multiple installation layouts ("setups") selectable via the UI.
- Runs a full annual simulation for all configured setups in parallel Web Workers, accumulating energy (kWh) per panel broken down by month, day, and hour. Results are cached in IndexedDB so re-running the same configuration is instant.
- Supports two irradiance sources: a geometric clear-sky model (no network required) and Open-Meteo (real hourly DNI + DHI + temperature data fetched from a free, CORS-compatible API, cached in IndexedDB). The Open-Meteo model applies full Plane-of-Array irradiance decomposition and panel temperature correction.
- Applies configurable system losses (inverter efficiency, wiring loss) to the DC output of every time step.
- Displays annual results in a floating resizable overlay panel with three tabs (Annual, Monthly, Daily), each containing a Production section (ECharts charts) and a Shadows section (per-panel zone heat maps). A shared legend lets the user toggle setups on/off and all charts update accordingly.
- Provides a settings sidebar (gear icon, top-left) for cache management: cached simulation results and Open-Meteo irradiance data can be listed and deleted individually or in bulk without requiring browser developer tools.
- Validates the wall configuration and displays a prominent warning listing the exact config-space coordinate triples that form non-90° or non-180° angles.
- Displays the application version in the footer, sourced from `package.json` at build time.

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
├── App.tsx                        # Root: loads config, full-viewport canvas + overlay panels
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
│   ├── results-panel.css
│   └── settings-sidebar.css
│
├── types/
│   ├── config.ts
│   ├── geometry.ts
│   ├── installation.ts
│   ├── results.ts
│   ├── simulation.ts
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
│   ├── MeshFactory.ts
│   └── PanelMeshFactory.ts
│
├── irradiance/
│   ├── IrradianceProvider.ts
│   ├── GeometricIrradianceProvider.ts
│   └── OpenMeteoIrradianceProvider.ts
│
├── converter/
│   ├── ThreeConverter.ts
│   └── SolarPanelConverter.ts
│
├── store/
│   ├── AppStore.ts
│   └── slices/
│       ├── ConfigSlice.ts
│       ├── RenderSlice.ts
│       ├── SimulationSlice.ts
│       └── SettingsSlice.ts       # Settings sidebar open/close state
│
├── hooks/
│   ├── useBVH.ts
│   ├── useShadowSampler.ts
│   ├── useAnnualSimulation.ts
│   ├── useResultsPanel.ts
│   └── useResizablePanel.ts
│
├── db/
│   ├── DbUtils.ts                 # Shared openDatabase helper (used by all cache modules)
│   ├── SimulationCache.ts
│   ├── IrradianceCache.ts
│   └── IrradianceCacheManager.ts  # List/delete operations for the settings sidebar UI
│
├── workers/
│   └── AnnualSimulation.worker.ts
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
    ├── SimulationControls.tsx
    ├── SimulationResultsPanel.tsx
    ├── AnnualSimulationProgress.tsx
    ├── AngleWarningBanner.tsx
    ├── DeveloperFooter.tsx
    ├── SettingsSidebar.tsx        # Settings sidebar with cache management
    ├── SettingsSidebarButton.tsx  # Gear icon button that opens the sidebar
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

Four domain slices composed behind a single `useAppStore` facade:

- `ConfigSlice` — raw config and site geometry.
- `RenderSlice` — 3D view state (date, timezone, active setup, sun, density, threshold).
- `SimulationSlice` — annual simulation parameters and lifecycle.
- `SettingsSlice` — settings sidebar open/close state.

Each slice is a pure function. Slices never import each other.

### Settings sidebar as a fixed overlay

The settings sidebar is a `position: fixed` overlay on the left edge, consistent with the results panel on the right. The Three.js canvas always fills `100vw × 100vh` — no layout reflow occurs when the sidebar opens or closes. A semi-transparent backdrop covers the rest of the viewport; clicking it closes the sidebar. The gear button disappears while the sidebar is open (the sidebar provides its own close button), preventing a visual overlap.

### RenderControls top offset when gear button is visible

The gear button (40px height) and `RenderControls` share the same `top: 20px; left: 20px` anchor. When the sidebar is closed and the gear button is visible, `RenderControls` receives an `offsetTop` prop that applies the `.controls-panel--offset-top` CSS modifier, shifting the panel 68px from the top (button height + 8px gap). When the sidebar is open the gear button is hidden and `RenderControls` returns to its default position.

### Shared IndexedDB helper

`SimulationCache` and `IrradianceCache` previously duplicated an inline `openDb` Promise wrapper. The shared helper `src/db/DbUtils.ts` exposes a single `openDatabase(name, version, onUpgrade)` function that both modules delegate to. The public APIs of both cache modules are unchanged.

### Simulation group building — shared utility

The logic that groups flat per-setup cache entries into logical simulation runs (by year, interval, irradiance source, density, threshold) lives in `src/utils/SimulationGroupUtils.ts` as `buildSimulationGroups`. Both `useResultsPanel` (results panel dropdown) and `SettingsSidebar` (cache management UI) import it, ensuring the two views always apply the same grouping rules without duplicating logic.

### `useResizablePanel` — parametrised hook

The hook that manages drag-to-resize, minimise, and fullscreen for a floating panel is parametrised with `defaultWidth` and `minWidth` options. This lets it be reused for both the results panel (right edge, 420px default) and the settings sidebar (left edge, 440px default) without any code duplication.

### Cache management split between provider and manager modules

`IrradianceCache` handles get/set for the simulation pipeline and has no knowledge of the UI. `IrradianceCacheManager` exposes list/delete operations used exclusively by the settings sidebar. This separation keeps the provider module free of UI concerns and avoids coupling the simulation pipeline to display logic.

### Cache UI — two-level grouping for simulation results

The settings sidebar displays simulation results in two levels: simulation run (group header, showing year/interval/irradiance/density/threshold and a delete-group button) and individual setups within that run (each with its own delete button). This mirrors the grouping in the results panel dropdown and lets users delete an entire simulation run in one click rather than deleting each setup individually.

### App version sourced from package.json at build time

`vite.config.ts` defines `__APP_VERSION__` as a compile-time constant populated from `process.env.npm_package_version` (set by npm at build time). `DeveloperFooter` reads this global directly. No runtime fetch, environment variable lookup, or separate version file is needed. The ambient declaration in `src/vite-env.d.ts` gives TypeScript full type safety for the global.

### Panel world-space positioning pipeline

Panels are rendered outside the site `<group>` (which carries the site azimuth rotation) so their raycasting sample points are already in absolute world space. The positioning pipeline is:

1. **`SiteFactory`** computes `swCornerX`, `swCornerZ` and `azimuthRad`. These are stored on the `Site` domain object alongside the system loss parameters.

2. **`SolarPanelArrayFactory`** converts the array's config-space position into Three.js world space.

3. **`SolarPanelFactory`** places each panel relative to the array SW corner using axis vectors derived from the array's own azimuth. `temperatureCoefficient` and `noct` are resolved by preferring the array-level value over the setup-level `panelDefaults` value, following the same override pattern used for `peakPower`, `zones`, etc.

4. **`ThreeConverter`** applies `order: 'YXZ'` Euler rotations so that inclination is always around the panel's own East-West axis.

### Azimuth sign convention — unified across site and panels

Both the site azimuth and panel array azimuths follow the same convention: 0 = South, positive = East, negative = West.

### Irradiance provider — Strategy pattern

The `IrradianceProvider` interface (`src/irradiance/IrradianceProvider.ts`) defines a single method:

```ts
getHourlyWeatherData(lat, lon, year): Promise<HourlyWeatherData | null>
```

`HourlyWeatherData` carries three parallel `Float32Array` arrays indexed by UTC hour-of-year:
- `dni` — Direct Normal Irradiance (W/m²)
- `dhi` — Diffuse Horizontal Irradiance (W/m²)
- `temperature` — ambient temperature at 2 m (°C), or null when unavailable

Concrete implementations:

- `GeometricIrradianceProvider` — returns `null` immediately. The worker uses the geometric clear-sky model.
- `OpenMeteoIrradianceProvider` — fetches all three variables from Open-Meteo in a single request, caches in IndexedDB (DB version 2), returns a `HourlyWeatherData` object.

Adding a new source requires only a new module and a new `case` in the factory — the worker, store, and simulation engine are unaffected.

### Irradiance data — main thread fetch, not worker fetch

Fetching on the main thread and distributing via `postMessage` is simpler and avoids one fetch per worker. Each worker receives its own `slice()` copy of each `Float32Array` so zero-copy buffer transfer does not detach the shared array.

### Open-Meteo — why this API

- Free for non-commercial use, no API key, no registration.
- Explicit CORS support from browser origins — hard requirement for a static GitHub Pages app.
- Single call returns a full year of hourly DNI, DHI, and temperature data.
- Data goes back to 1940 via the historical archive endpoint.

PVGIS was evaluated and rejected: its API explicitly blocks AJAX requests from browser origins. A proxy or backend would be required, which contradicts the no-backend constraint.

### Irradiance cache — DB version 2, permanent, no TTL

`IrradianceCache` uses `DB_VERSION = 2`. The upgrade handler drops the old store (which contained only DNI) and creates a fresh one. Historical reanalysis data is immutable, so no TTL is needed. Store size is bounded by distinct (source, location, year) combinations.

### Panel-level temperature and NOCT — resolved with defaults in SolarPanelConverter

`SolarPanel` carries `temperatureCoefficient` and `noct` as optional fields. `SolarPanelConverter.toSimulationPanelData` resolves them with well-known defaults (−0.004 /°C and 45°C) when absent. This keeps the domain model free of hard-coded fallback knowledge — the factory chain simply passes through whatever the config provides.

### System losses applied after string mismatch

`SystemLossParams` (inverter efficiency, wiring loss, ground albedo) is built from `Site` in `useAnnualSimulation` and transferred in the worker payload as a constant object. The combined loss factor `inverterEfficiency × (1 − wiringLoss)` is computed once at the start of `runSimulation` and applied to each panel's effective power after the string mismatch algorithm, matching the physical order of DC→AC conversion.

### Panel shadow heat map — zone-level cells

Panels grouped by `arrayIndex`, sized proportionally to `actualWidth × actualHeight`, with zone sub-cells coloured by `zoneShadeFraction`.

### Physical geometry in `PanelAnnualData`

Carries `orientation`, `actualWidth`, `actualHeight`, `zones`, `zonesDisposition` so the results panel can render correct heat maps without the original config.

### Results panel — floating resizable overlay

The results panel is a `position: fixed` overlay that sits on top of the 3D canvas. The canvas always fills `100vw × 100vh`.

### CSS fragmentation into modules

`src/styles/index.css` is a barrel import of six focused files: `base.css`, `layout.css`, `controls.css`, `simulation.css`, `results-panel.css`, and `settings-sidebar.css`.

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

### Azimuth convention

| Value | Meaning |
|-------|---------|
| 0     | Panel face / site orientation points due South |
| > 0   | Rotated toward East (clockwise from South, viewed from above) |
| < 0   | Rotated toward West (anticlockwise from South, viewed from above) |

### Array position reference point

`position: [x, z]` is the offset of the SW corner of the array from the SW corner of the site, measured in the site's rotated reference frame.

### Panel indexing within an array

| Index | Axis      | 0 = …             | Increases toward … |
|-------|-----------|-------------------|--------------------|
| `row` | North–South | southernmost row | North (up the slope) |
| `col` | West–East   | westernmost column | East |

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

---

## Configuration reference

```json
{
  "site": {
    "location": { "latitude": 40.62, "longitude": -4.01 },
    "azimuth": 18.5,
    "timezone": "Europe/Madrid",
    "groundAlbedo": 0.20,
    "inverterEfficiency": 0.97,
    "wiringLoss": 0.02,
    "wallPoints": [[0,0], [3.7,0], ...],
    "wallDefaults": { "height": 0.7, "thickness": 0.2 },
    "railingDefaults": { ... },
    "wallsSettings": [...]
  },
  "setups": [
    {
      "label": "My setup",
      "panelDefaults": {
        "width": 1, "height": 2, "peakPower": 415,
        "zones": 2, "zonesDisposition": "horizontal",
        "hasOptimizer": false, "string": "S1",
        "temperatureCoefficient": -0.004,
        "noct": 45
      },
      "arrays": [...]
    }
  ]
}
```

### Site-level physical properties

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `groundAlbedo` | number (0–1) | 0.20 | Fraction of GHI reflected by the ground toward the panels. Typical: 0.20 concrete, 0.25 light gravel, 0.10 dark membrane. |
| `inverterEfficiency` | number (0–1) | 0.97 | Rated DC/AC conversion efficiency of the inverter. |
| `wiringLoss` | number (0–1) | 0.02 | Fraction of DC power lost in cables between panels and inverter. |

All three default to industry-standard values when omitted, so existing `config.json` files without these fields continue to work correctly.

### Panel-level physical properties (in `panelDefaults` and `arrays[*]`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `temperatureCoefficient` | number (per °C) | −0.004 | Relative change in peak power per °C above 25°C. Available in the panel datasheet as "Pmax temperature coefficient". |
| `noct` | number (°C) | 45 | Nominal Operating Cell Temperature. Used to estimate cell temperature from ambient temperature and POA. Available in the panel datasheet. |

Both can be set at the `panelDefaults` level and overridden per `arrays[*]` entry, following the same pattern as `peakPower`, `zones`, etc. A setup-level override (`setup.temperatureCoefficient`) is also supported to apply a uniform value across all arrays without editing each entry.

### `azimuth` — site and panel arrays

- `0` = South-facing
- Positive = rotated toward **East** (clockwise from South, viewed from above)
- Negative = rotated toward **West**

### `position` — panel array placement

`position: [x, z]` is the distance in metres from the SW corner of the site to the SW corner of the array, measured in the site's rotated frame.

### `arraysSettings` — per-panel overrides

Each entry targets one specific panel by its `array` / `row` / `col` address (all 0-based) and overrides `hasOptimizer` and/or `string`.

---

## Solar production model

### 1. Sun position

`suncalc.getPosition(date, lat, lon)` → altitude and azimuth → Three.js direction vector.

### 2. Geometric model (no weather data)

```
incidenceFactor = max(0, dot(sunDirection, panelNormal))
basePower (kW)  = peakPower (Wp) / 1000 × incidenceFactor
```

This is the clear-sky model used when the irradiance source is set to "Geometric". It produces an upper-bound estimate because it assumes perfect clear-sky conditions at all times with no temperature penalty.

### 3. POA irradiance model (Open-Meteo source)

When real weather data is available, the worker computes Plane-of-Array (POA) irradiance using the isotropic sky decomposition model:

```
POA_direct  = DNI × cos(angle_of_incidence)
POA_diffuse = DHI × (1 + cos(tilt)) / 2
POA_albedo  = GHI × groundAlbedo × (1 − cos(tilt)) / 2

GHI = DNI × cos(solar_zenith) + DHI

basePower (kW) = peakPower (Wp) / 1000 × (POA / 1000)
```

where 1000 W/m² is the Standard Test Condition (STC) reference irradiance. The isotropic sky model treats diffuse irradiance as uniform across the sky hemisphere — a well-established simplification that is accurate enough for residential comparison purposes.

### 4. Temperature correction (Open-Meteo source)

When ambient temperature data is available, a temperature factor is applied to `basePower`:

```
T_cell = T_ambient + (NOCT − 20) / 800 × POA
temperatureFactor = max(0, 1 + γ × (T_cell − 25))

basePower_corrected = basePower × temperatureFactor
```

where:
- `NOCT` = Nominal Operating Cell Temperature (°C), from the panel datasheet
- `γ` = temperature coefficient of maximum power (per °C, negative for Si panels)
- 25°C = STC reference temperature
- 800 W/m² = NOCT reference irradiance

### 5. Panel output with bypass diodes

| Shaded zones | Without optimizer                                   | With optimizer        |
|--------------|-----------------------------------------------------|-----------------------|
| 0            | `basePower`                                         | `basePower`           |
| k out of n   | `basePower × (n−k)/n × 0.9` (10% mismatch penalty) | `basePower × (n−k)/n` |
| all          | 0                                                   | 0                     |

### 6. String mismatch

Without optimizers, string efficiency is limited by the least-efficient panel (series current constraint). With at least one optimizer in the string, every panel is treated as independent.

### 7. System losses

After string mismatch, a system loss factor is applied to all panel powers simultaneously:

```
systemLossFactor = inverterEfficiency × (1 − wiringLoss)
effectivePower   = stringPower × systemLossFactor
```

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

| Source | Description | Network | Variables | Interval support | Year support |
|--------|-------------|---------|-----------|-----------------|--------------|
| `geometric` | Clear-sky model, sun geometry only | None | — | 15, 30, 60 min | Current + past 5 years |
| `open-meteo` | POA model with DNI, DHI, temperature | Required | DNI, DHI, T_ambient | 60 min only | Past 5 years only |

### Weather data flow

```
Main thread                              Worker
────────────────────────────────────     ─────────────────────────────────────
createIrradianceProvider(source)
  → getHourlyWeatherData(lat, lon, year) receives weatherData: {dni, dhi, temperature} | null
  → HourlyWeatherData {                  per time step:
      dni: Float32Array,                   hourIdx = utcHourOfYear(date, year)
      dhi: Float32Array,                   POA = direct + diffuse + albedo
      temperature: Float32Array            T_cell from NOCT model
    }                                      temperatureFactor = 1 + γ(T_cell − 25)
  → slice() per worker copy               basePower × (POA/1000) × tempFactor
  → zero-copy postMessage                 × systemLossFactor
```

### IndexedDB — two independent databases

| Database | Version | Store | Key | Contents |
|----------|---------|-------|-----|----------|
| `solar-simulator` | 1 | `simulation-results` | `cacheKey` hash | Full `SetupAnnualResult` |
| `solar-simulator-irradiance` | 2 | `irradiance-cache` | `{source}:{lat4dp}:{lon4dp}:{year}` | DNI + DHI + temperature arrays |

Both databases use the shared `openDatabase` helper from `src/db/DbUtils.ts`.

### Worker architecture

**Worker pool:** `max(1, hardwareConcurrency − 1)` concurrent workers.

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

## Settings sidebar

A gear icon button (⚙) at the top-left of the screen opens a settings sidebar. The sidebar is a `position: fixed` overlay on the left edge, with a semi-transparent backdrop that closes it on click. While the sidebar is open the gear button is hidden; the sidebar provides its own close button (✕).

The sidebar is user-resizable: a drag handle on its right edge lets the user widen or narrow it freely (minimum 300px). The chosen width persists for the session; refreshing the page resets it to the 440px default. The sidebar body scrolls vertically when content exceeds the viewport height, which is important for future sections (e.g. the configuration editor) that may require substantial vertical space.

The sidebar contains three collapsible sections:

### Cache management

**Simulation results** are shown in two levels. The first level is the simulation run (identified by year, interval, irradiance source, density, and threshold — the same label as in the results panel dropdown), with a trash button to delete the entire run. The second level lists the individual setup entries within that run, each with their own trash button. A "Delete all simulation results" button at the bottom clears everything. Deletions are reflected immediately in the results panel group selector.

**Irradiance data (Open-Meteo)** entries are flat (one row per source/location/year combination), each with an individual delete button and a "Delete all" button.

The irradiance cache listing is handled by `IrradianceCacheManager` (a dedicated read/delete module) rather than `IrradianceCache` (the get/set provider used by the simulation pipeline). This separation keeps the provider free of UI concerns.

### Export / Import

Placeholder for Phase 6b — full backup export/import with versioned `.solarsim` files.

### Configuration

Placeholder for Phase 6d — in-app JSON configuration editing with schema validation.
---

## Application layout

Canvas fills `100vw × 100vh`. All UI elements are absolute or fixed overlays:

- `RenderControls` — absolute, top-left. Shifts down by 68px when the gear button is visible.
- `SimulationControls` — absolute, bottom-left.
- `DeveloperFooter` — fixed, bottom-right. Displays app version, developer name, Ko-fi link.
- `SettingsSidebarButton` — absolute, top-left (hidden when sidebar is open).
- `SettingsSidebar` — fixed overlay, left edge (rendered only when open).
- `SimulationResultsPanel` — fixed overlay, right edge.
- `AngleWarningBanner` — absolute, top-centre.

---

## Timezone and DST

`makeDateInTimezone(year, month, day, hour, minute, timezone)` uses `dayjs.tz(isoString, timezone)`. The annual simulation worker uses UTC timestamps directly via `Date.UTC()`.

---

## Known limitations

- **90° wall angles only**: non-right angles produce incorrect post placement.
- **Open-Meteo resolution is hourly**: sub-hourly intervals are only available with the geometric model.
- **Isotropic sky model**: the diffuse component assumes uniform sky radiance. More accurate models (Perez, Hay-Davies) require additional inputs not available from Open-Meteo's free tier.
- **Single inclination per setup for POA**: the worker uses the mean inclination across all arrays. Setups with mixed inclinations will have a small systematic error in the diffuse and albedo components.
- **Rail extensions end in a 90° cut**: a 45° mitre would require custom `BufferGeometry`.
- **Drag-to-resize is mouse-only**: touch not supported.
- **Daily charts display UTC hours**: hourly energy data is accumulated in UTC buckets; the interactive daily charts and PDF report do not yet shift hours to the configured installation timezone.

---

## Lessons learned

### Fixed overlay panels preserve canvas size

Making both the results panel and the settings sidebar `position: fixed` overlays means the Three.js `<Canvas>` always occupies `100vw × 100vh`. No layout reflow, no canvas resize, no Three.js camera recalculation on panel open/close.

### Separation of provider and manager for cached data

The irradiance get/set API (`IrradianceCache`) and the irradiance list/delete API (`IrradianceCacheManager`) are deliberately split into two modules. The provider module is used in the simulation hot path and must remain free of UI imports. The manager module is imported only by the settings sidebar. If they were merged, any future tree-shaking or worker bundling change could accidentally pull UI code into a non-UI context.

### Shared IndexedDB helper eliminates boilerplate

A single `openDatabase(name, version, onUpgrade)` function replaces two identical `openDb` wrappers. The cost of the abstraction is near zero (one extra function call) and the benefit is that any future change to the Promise-wrapping pattern (e.g. adding telemetry, connection pooling) is applied in one place.

### Compile-time version constant avoids runtime indirection

Reading the app version from `package.json` at build time via Vite's `define` is simpler and more reliable than a runtime fetch of a JSON file or reading from `import.meta.env`. The value is inlined as a string literal in the compiled bundle, with full TypeScript type safety via the ambient declaration in `vite-env.d.ts`.

### Full POA irradiance is essential for realistic estimates

Using only DNI (direct beam on a perpendicular surface) severely underestimates production because it ignores the diffuse sky component, which can represent 20–35% of annual yield — especially in winter and on partly cloudy days. The isotropic sky model adds DHI and albedo components with minimal complexity: two view-factor multiplications per time step.

### Temperature correction is significant in summer

At 35°C ambient with 1000 W/m² irradiance, a panel with NOCT=45°C reaches ~60°C, giving a ~14% loss for γ=−0.004/°C. Omitting temperature correction causes systematic overestimation of summer production.

### NOCT model is accurate enough for residential comparison

The NOCT model (`T_cell = T_ambient + (NOCT−20)/800 × POA`) is a linear approximation that ignores wind speed and mounting configuration. For a tool whose primary goal is comparing setups against each other, the NOCT model provides sufficient relative accuracy.

### System losses must be applied after string mismatch

Applying inverter and wiring losses before the string mismatch algorithm would understate the bottleneck effect. The correct order is: shading → bypass diode → string mismatch → system losses.

### Factory pattern for irradiance sources

The Strategy pattern via an `IrradianceProvider` interface keeps the simulation worker and engine completely agnostic of how irradiance data is obtained. Adding a new source is a two-file change.

### Fetch once on the main thread, distribute to workers

Resolving weather data centrally before worker launch avoids duplicate network requests and keeps the worker free of I/O concerns.

### Zero-copy buffer transfer with per-worker copies

`Float32Array.slice()` produces an independent copy for each worker. Without this, the first `postMessage` with `transfer` would detach the shared buffer, corrupting subsequent workers.

### Panel geometry for simulation must be independent of the active viewport

Static geometry (walls, railings) from the live scene + panel frames built procedurally per setup from `SimulationPanelData`. `userData.isPanelFrame = true` on rendered panel frames allows clean exclusion from the static batch.

### IndexedDB schema versioning

Bumping `DB_VERSION` to 2 and dropping the old store in `onupgradeneeded` ensures all clients migrate cleanly.

### No TTL needed when only immutable data is cached

All cached irradiance data covers completed past years — historical reanalysis is immutable. A permanent cache with no expiry is correct and simpler.

### Simulation results grouped at display time, not at storage time

IndexedDB stores one entry per setup. Grouping at display time keeps the storage model simple.

### Physical geometry propagated through simulation pipeline

Carrying `orientation`, `actualWidth`, `actualHeight`, `zones`, `zonesDisposition` from `SolarPanel` through `SimulationPanelData` into `PanelAnnualData` means the results panel can render proportionally correct heat maps without access to the original config.

### SVG icons as files, not inline or Unicode

Icon SVGs live in `src/assets/icons/` and are imported as URLs by Vite.

### Zone ID scheme: 0-based throughout

Zone IDs follow `a{arr}-r{row}-c{col}-z{zone}` using 0-based indices everywhere.

### `arraysSettings` applied after geometry, not during construction

Per-panel overrides are applied in `PanelSetupFactory.create` as a post-processing pass over the fully built arrays.