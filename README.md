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
│   ├── panel-reset-width.svg      # Double horizontal arrow — reset panel width
│   ├── panel-expand.svg           # Corner arrows pointing outward — enter fullscreen
│   ├── panel-collapse.svg         # Corner arrows pointing inward — exit fullscreen
│   └── panel-minimise.svg         # Arrow toward right edge — hide panel
│
├── styles/                        # CSS modules (imported via styles/index.css)
│   ├── index.css                  # Barrel import
│   ├── base.css                   # CSS custom properties and shared variables
│   ├── layout.css                 # App container, angle-warning banner
│   ├── controls.css               # Control panels, buttons, developer footer
│   ├── simulation.css             # Annual simulation progress bars
│   └── results-panel.css          # Floating resizable results panel, tabs, heat maps
│
├── types/
│   ├── config.ts                  # JSON config shapes
│   ├── geometry.ts                # PointXZ, Vector3, Euler3, AngleWarning
│   ├── installation.ts            # Domain models: Site, Wall, SolarPanel, ...
│   ├── results.ts                 # SimulationGroup, SimulationGroupSetup, LoadedSetupResult
│   ├── simulation.ts              # SunState, annual simulation types, worker protocol
│   └── index.ts                   # Re-exports
│
├── engine/
│   ├── SolarEngine.ts             # Pure functions: sun state, incidence, panel output, string mismatch
│   └── AnnualSimulationEngine.ts  # Pure accumulation: initAccumulators, accumulateStep, finalizePanel
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
│   ├── AppStore.ts                # Zustand facade composing all slices
│   └── slices/
│       ├── ConfigSlice.ts         # config, site, angleWarnings, loadConfig
│       ├── RenderSlice.ts         # active setup, date/time, timezone, playback, sun,
│       │                          #   showPoints, renderDensity, renderThreshold,
│       │                          #   instantProductionResult. Exports makeDateInTimezone.
│       └── SimulationSlice.ts     # simulationDensity, simulationThreshold, interval, year,
│                                  #   irradianceSource, isRunning, progress,
│                                  #   annualProductionResults.
│                                  #   Exports availableSimulationYears, SimulationInterval.
│
├── hooks/
│   ├── useBVH.ts                  # Builds BVH over shadow-casting meshes
│   ├── useShadowSampler.ts        # Casts rays, returns ShadowMap (interactive)
│   ├── useAnnualSimulation.ts     # Orchestrates worker pool for annual simulation
│   ├── useResultsPanel.ts         # State for results panel: groups, selection, lazy loading
│   └── useResizablePanel.ts       # Drag-to-resize, minimise, fullscreen for the overlay
│
├── db/
│   └── SimulationCache.ts         # IndexedDB wrapper for SetupAnnualResult persistence
│
├── workers/
│   └── AnnualSimulation.worker.ts # Full annual simulation loop
│
└── utils/
    ├── HashUtils.ts               # FNV-1a 32-bit hash
    ├── SetupColoursUtils.ts       # Colour palette assigned by setup index (shared across charts)
    ├── SimulationCacheUtils.ts    # buildCacheKey() and hashCacheKey()
    ├── PointXZUtils.ts            # 2D geometry helpers
    ├── RailingUtils.ts            # Railing rail render data builder
    ├── ThreeUtils.ts              # Mesh serialisation / reconstruction for workers
    └── TimeUtils.ts               # Timezone helpers, timeSteps generator, formatEta

└── components/
    ├── Scene.tsx                  # Root 3D scene; wires annual simulation hook
    ├── ShadowedScene.tsx          # Dirty-flag raycasting loop, feeds ShadowMap
    ├── SolarPanelComponent.tsx    # Single panel render; zone ID labels in 3D
    ├── Sun.tsx                    # Sun sphere + directional light
    ├── Compass.tsx                # N/S/E/W labels in 3D
    ├── RenderControls.tsx         # Top-left panel: setup selector, date/time/play, sampling
    ├── SimulationControls.tsx     # Bottom-left panel: annual simulation parameters + run/stop
    ├── SimulationResultsPanel.tsx # Floating resizable overlay: header, params, legend, tabs
    ├── AnnualSimulationProgress.tsx  # Per-setup progress bars with ETA
    ├── AngleWarningBanner.tsx     # Warning banner for non-90° angles
    ├── DeveloperFooter.tsx        # Ko-fi link + personal site
    └── results/                   # Chart and tab components for the results panel
        ├── AnnualTab.tsx          # Annual tab: bar chart + radar + annual heat map
        ├── MonthlyTab.tsx         # Monthly tab: nav + monthly total bar + daily line + heat map
        ├── DailyTab.tsx           # Daily tab: nav + daily total bar + hourly line + heat map
        ├── AnnualBarChart.tsx     # Horizontal bar chart: annualTotalKwh per setup
        ├── MonthlyRadarChart.tsx  # Radar chart: monthlyTotalKwh by month per setup (localised)
        ├── MonthlyLineChart.tsx   # Line chart: daily production totals for a selected month
        ├── DailyLineChart.tsx     # Line chart: hourly production for a selected day
        └── PanelShadowHeatmap.tsx # Physical panel grid; zone-level cells with shade colour
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

`PanelSetupFactory.rebuildSamplePoints(existing, density)` reuses all panel geometry and only regenerates the NxN sample point grids. Both `setRenderDensity` and `setSimulationDensity` in the store call this for their respective active setup references.

### Two independent density/threshold parameters

- `renderDensity` / `renderThreshold` — live in `RenderSlice`. Control the 3D view and instant production readout.
- `simulationDensity` / `simulationThreshold` — live in `SimulationSlice`. Used exclusively when launching an annual simulation run.

### Store architecture — slice pattern with facade

Three domain slices composed behind a single `useAppStore` facade:
- `ConfigSlice` — configuration and site geometry.
- `RenderSlice` — interactive 3D view state.
- `SimulationSlice` — annual simulation parameters and lifecycle state.

Each slice is a pure function. Slices never import each other. The facade is the only place where slices interact. A single `typedSet` cast satisfies all three slice constructors.

### Results panel — floating resizable overlay

The results panel is a `position: fixed` overlay that sits on top of the 3D canvas on the right side of the screen. This avoids any resize event on the Three.js renderer when the panel is opened, closed, or resized, because the canvas always fills `100vw × 100vh`.

The drag handle on the left edge of the panel uses `mousedown` → `mousemove` on `document` → `mouseup` to track the cursor across the full viewport while dragging. Width state lives in `useResizablePanel`. Panel state is one of `normal | minimised | fullscreen`. When minimised, a vertical restore button appears on the right edge.

Icon buttons in the header use SVG files (`src/assets/icons/`) rather than Unicode characters, ensuring the intended meaning is unambiguous regardless of the user's font or operating system. Each icon is a 16×16 stroked SVG with no fill, using `currentColor` so it responds to CSS colour changes on hover.

### Results panel — simulation parameter summary

Between the header and the legend, a parameter summary strip shows the key attributes of the selected simulation run: year, interval, irradiance source, sampling density, threshold, and computation timestamp. This replaces the previous approach of encoding all parameters into the dropdown label alone.

### Results panel — state management

All results panel state lives in `useResultsPanel` (a custom hook), not in Zustand. The state is purely UI-local to the panel: selected simulation group, active tab, which setups are visible in the legend, and the lazily loaded full result data. Zustand is not the right tool for component-scoped state.

### Lazy loading of full result data

`SimulationCache.listResults()` returns only lightweight metadata (no per-panel energy arrays). When the user selects a simulation group in the dropdown, `useResultsPanel` calls `SimulationCache.getResult(cacheKey)` for each setup in the group via `Promise.all`. A loading spinner is shown during this fetch. Full data is then held in `loadedResults` state and reused across tab switches until the selected group changes.

### Setup colour palette — single source of truth

`src/utils/SetupColoursUtils.ts` exports a fixed array of eight visually distinct colours and a `getSetupColour(index)` helper. Colour assignment is by position in the sorted group (best-producing setup is always colour 0). Every chart component and the legend use this same function, guaranteeing cross-chart colour consistency.

### Shared legend with toggle

The legend above the tabs renders one button per setup. Clicking a button toggles that setup's ID in the `activeSetupIds: Set<string>` state. Every chart filters its input data to only the active setups before building its ECharts option. At least one setup must remain active — toggling the last active setup is a no-op. Labels are truncated with CSS ellipsis; the full label is accessible via the native `title` tooltip.

### CSS fragmentation into modules

`App.css` has been replaced by `src/styles/index.css`, which is a barrel import of five focused files:
- `base.css` — CSS custom properties.
- `layout.css` — app container, angle-warning banner.
- `controls.css` — control panels, buttons, developer footer.
- `simulation.css` — annual simulation progress bars.
- `results-panel.css` — floating overlay, tabs, heat maps.

### Panel shadow heat map — zone-level cells

`PanelShadowHeatmap` groups panels by `arrayIndex`, then arranges them in a grid of `rows × cols` using each panel's `row` and `col` fields from `PanelAnnualData`. Each panel cell is sized proportionally to the physical panel dimensions (`actualWidth × actualHeight`, capped at `MAX_PANEL_PX` on the longer axis). Within each cell, one sub-cell is rendered per bypass-diode zone, coloured by `zoneShadeFraction` for the selected time window. Zones are laid out horizontally or vertically according to `zonesDisposition`, exactly mirroring the physical panel construction.

The shade colour interpolates green (0%) → yellow (50%) → red (100%) using RGB interpolation. Hovering a cell shows the zone ID and exact shade percentage as a native browser tooltip. Zone IDs follow the 0-based scheme `{panelId}-z{zoneIndex}` (e.g. `a0-r0-c0-z1`), matching the labels rendered in the 3D view.

### Physical geometry in `PanelAnnualData`

`SimulationPanelData` carries `orientation`, `actualWidth`, `actualHeight`, `zones`, and `zonesDisposition` alongside the raycasting data. `SolarPanelConverter.toSimulationPanelData` populates these from `panel.renderData`. `AnnualSimulationEngine.finalizePanel` propagates them unchanged into `PanelAnnualData`. This allows the results panel to render correct heat map proportions without needing access to the original config.

### `SimulationResultsPanel` — auto-select on completion, no live results

The panel does not show partial results during an active run. When `isRunning` transitions from `true` to `false`, `useResultsPanel` reloads IndexedDB and auto-selects the most recently computed group. This is tracked with a `useRef` holding the previous `isRunning` value — a `useEffect` that only fires on transition.

### Simulation results grouping

IndexedDB stores one `SetupAnnualResult` per setup. `useResultsPanel` groups entries by `(year, intervalMinutes, irradianceSource, density, threshold)`. The group label encodes density and threshold compactly as `NNpMt`. `density` and `threshold` are stored directly on `SetupAnnualResult` and exposed by `SimulationCache.listResults()`.

### Localised month names

Month labels in the radar chart, and in the month/day selectors of the Monthly and Daily tabs, are driven by `t('months.short', { returnObjects: true })` and `t('months.long', { returnObjects: true })`. Both EN and ES translation files provide these arrays. This avoids hardcoded English strings in chart components and ensures the UI language setting is respected throughout.

### Month and day navigation buttons

The Monthly tab provides `‹` / `›` buttons that cycle through months circularly (December → January and back). The Daily tab provides the same for days, advancing to the next month when the last day is reached, and wrapping across year boundaries (31 Dec → 1 Jan). This pattern avoids the user having to change both the month and day selectors manually when stepping across month boundaries.

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

### `arraysSettings` — per-panel overrides

Each entry in `arraysSettings` targets one specific panel by its `array` / `row` / `col` address and overrides `hasOptimizer` and/or `string`. All three address fields are **0-based**.

Row and column conventions:

| Index | Axis | 0 = … |
|-------|------|--------|
| `row` | North–South | northernmost row |
| `col` | West–East   | westernmost column |

Example: give an optimizer only to the south-west panel of array 0 in a 3×3 layout:

```json
"arraysSettings": [
  { "array": 0, "row": 2, "col": 0, "hasOptimizer": true }
]
```

The panel's 3D colour updates automatically to reflect the override (green frame = optimizer present). Multiple entries can target different panels within the same setup.

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
`applyStringMismatch` is shared between the interactive view and the worker.

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

The UI offers the current year plus up to 5 past years. Controlled by `PAST_YEARS_AVAILABLE` in `SimulationSlice.ts`.

### Irradiance source

Three options: geometric, PVGIS, Open-Meteo. Only geometric is implemented; the others are stored in the cache key so results from different models coexist in IndexedDB without collision.

### Worker architecture

**BVH serialisation and per-worker geometry copies:** `MeshFactory.fromScene(scene).build()` produces independent typed-array copies per worker. Each worker's buffers are zero-copy transferred via `postMessage`.

**Sample points pre-computed on the main thread:** `SolarPanelConverter.toSimulationPanelDataArray` transforms local-space sample points to world space before transfer. Physical geometry fields (`orientation`, `actualWidth`, `actualHeight`, `zones`, `zonesDisposition`) are also included so the worker can propagate them into `PanelAnnualData`.

**Worker pool:**
```
workerCount = max(1, hardwareConcurrency − 1)
```

**Progress reporting:** Workers emit every 100 steps. EMA (α = 0.2) smooths the remaining-time estimate. ETA shown after 5% of steps complete.

### Accumulation and finalisation

`engine/AnnualSimulationEngine.ts` provides pure functions (`initAccumulators`, `accumulateStep`, `finalizePanel`, `buildSetupResult`) with no Three.js or worker dependencies. `finalizePanel` propagates all physical geometry fields from `SimulationPanelData` into `PanelAnnualData`.

### Cache key and hashing

Keyed by `SimulationCacheKey` (setup geometry hash, density, threshold, interval, location, year, irradiance source). FNV-1a 32-bit hash. Computed once per setup in `useAnnualSimulation.run()`.

### IndexedDB persistence

`SimulationCache` provides a Promise-based wrapper. `listResults()` exposes `density` and `threshold` alongside the other summary fields so `useResultsPanel` can group and label runs without re-deriving these values from the cache key hash.

### Output data model

```
PanelAnnualData.energyKwh         [month][dayOfMonth][hourOfDay]
PanelAnnualData.shadeFraction     [month][dayOfMonth][hourOfDay]
PanelAnnualData.zoneShadeFraction [zone][month][dayOfMonth][hourOfDay]
PanelAnnualData.orientation       PanelOrientation
PanelAnnualData.actualWidth       number (metres)
PanelAnnualData.actualHeight      number (metres)
PanelAnnualData.zones             number
PanelAnnualData.zonesDisposition  ZonesDisposition
```

`SetupAnnualResult` also carries `density`, `threshold`, pre-rolled `monthlyTotalKwh` and `annualTotalKwh`.

---

## Results panel

### Layout and interaction

The results panel is a `position: fixed` overlay anchored to the right edge of the viewport. It sits above the 3D canvas and render/simulation controls, which remain fully functional beneath it.

The left edge of the panel is a drag handle. Dragging it resizes the panel freely between a minimum of 280px and `100vw`. Three icon buttons in the header control panel state:

| Button | Icon | Action |
|--------|------|--------|
| Reset width | Double horizontal arrow | Restore default width (420px) |
| Fullscreen | Corner arrows outward/inward | Toggle 100vw width |
| Minimise | Arrow toward right edge | Collapse panel; restore button appears |

Icons are 16×16 SVG files in `src/assets/icons/`, using `currentColor` for theme compatibility. They communicate intent unambiguously without relying on Unicode character availability.

### Content organisation

Below the header, a parameter summary strip shows year, interval, irradiance source, density, threshold, and computation timestamp for the selected simulation run.

Below the summary, a shared legend shows one pill per setup. Clicking toggles that setup's visibility across all charts. Labels are truncated with CSS ellipsis; the full label is shown as a native tooltip on hover.

Content is divided into three tabs:

| Tab | Production section | Shadows section |
|-----|--------------------|-----------------|
| **Annual** | Bar chart (annual kWh/setup) + radar chart (monthly distribution) | Zone heat map — annual average |
| **Monthly** | Monthly total bar chart + daily production line chart | Zone heat map — monthly average |
| **Daily** | Daily total bar chart + hourly production line chart | Zone heat map — daily average |

The Monthly tab has `‹` / `›` navigation buttons for circular month stepping. The Daily tab has the same for days, wrapping across month and year boundaries.

### Setup colour consistency

`src/utils/SetupColoursUtils.ts` defines a fixed eight-colour palette. Colour assignment is by the setup's rank within the simulation group (the highest-producing setup is always colour 0). Every chart and the legend use `getSetupColour(index)`.

### Panel shadow zone heat map

Each setup gets its own heat map block. Panels are arranged in their physical grid layout (North top, South bottom, West left, East right). Each panel cell is sized proportionally to `actualWidth × actualHeight`, capped at 56px on the longer axis to prevent oversized cells on wide screens. Within each cell, bypass-diode zones are shown as coloured sub-cells matching the physical zone disposition (`horizontal` = horizontal bands, `vertical` = vertical columns). Colours interpolate green → yellow → red by shade fraction. Zone IDs (`a{arr}-r{row}-c{col}-z{zone}`) match the labels shown in the 3D view.

---

## Application layout

The canvas fills the full viewport (`100vw × 100vh`). All UI elements — render controls, simulation controls, developer footer, and the results panel — are absolute or fixed overlays. This avoids any resize event on the Three.js renderer when the results panel is opened, closed, or resized.

---

## Timezone and DST

`makeDateInTimezone(year, month, day, hour, minute, timezone)` uses `dayjs.tz(isoString, timezone)`. Exported from `RenderSlice.ts` and re-exported from `AppStore.ts`. This function is the **only** correct way to construct dates from user inputs.

`date.toDate()` (native JS `Date`) always represents a UTC instant. SunCalc receives this value. The annual simulation worker uses UTC timestamps directly via `Date.UTC()`.

---

## Known limitations

- **90° wall angles only**: non-right angles produce incorrect post placement. A warning lists the exact coordinate triples from config.json.
- **Single year for interactive view**: date controls constrained to current year. Annual simulation supports past years.
- **No diffuse irradiance**: only direct (beam) irradiance modelled geometrically. PVGIS and Open-Meteo planned.
- **Rail extensions end in a 90° cut**: a 45° mitre would require custom `BufferGeometry`.
- **`window.confirm` for stop confirmation**: native dialog used. Custom modal straightforward to add.
- **Drag-to-resize is mouse-only**: touch / trackpad pinch not supported.
- **Zone heat map granularity**: shade fraction is per zone, not per sample point. Per-point storage would require ~100 M values for typical configurations and is not stored.

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

### FNV-1a for cache key hashing

Synchronous, ~10 lines, public domain, negligible collision probability for config-sized objects.

### Slice pattern with facade for global store

Each slice owns a clearly bounded domain. Cross-slice reads use a structural interface to avoid circular imports. A single `typedSet` cast satisfies all three slice constructors.

### Two independent sampling parameter pairs

`renderDensity`/`renderThreshold` and `simulationDensity`/`simulationThreshold` are fully independent.

### Instant production is a render artifact, not a simulation result

`InstantProductionResult` with a single `power` field lives in `RenderSlice`.

### Simulation results grouped at display time, not at storage time

IndexedDB stores one entry per setup. Grouping at display time in `useResultsPanel` keeps the storage model simple.

### Compact sampling code in selector label

`16p1t` encodes density² and threshold in the dropdown without making the label unreadably long.

### Auto-select on simulation completion via `useRef` transition detection

Comparing `prevIsRunning.current !== isRunning` inside a `useEffect` fires exactly once on the running→complete transition.

### Fixed overlay panel avoids canvas resize

Making the results panel a `position: fixed` overlay means the Three.js `<Canvas>` always occupies `100vw × 100vh`. Opening, closing, or resizing the results panel has no effect on the renderer's viewport.

### Component-scoped state stays out of Zustand

The results panel's selected group, active tab, legend toggles, and loaded data are all managed by `useResultsPanel`, a custom hook local to the panel.

### Single colour source for chart consistency

Defining the setup colour palette once in `SetupColoursUtils.ts` and importing `getSetupColour` everywhere guarantees consistent colours across all charts.

### Lazy full-result loading with `Promise.all`

The summary list (`listResults`) is always fast. Full per-panel data is fetched in parallel for all setups in the selected group when the user changes the dropdown.

### CSS fragmentation by concern

Splitting `App.css` into five focused files eliminates the "where do I put this?" question. The barrel import in `index.css` means consumers import a single path.

### Physical geometry propagated through simulation pipeline

Carrying `orientation`, `actualWidth`, `actualHeight`, `zones`, `zonesDisposition` from `SolarPanel` through `SimulationPanelData` into `PanelAnnualData` means the results panel can render proportionally correct heat maps without access to the original config. The alternative — re-loading the config in the results panel — would create an unnecessary coupling between the storage layer and the config loading path.

### SVG icons as files, not inline or Unicode

Icon SVGs live in `src/assets/icons/` and are imported as URLs by Vite. This keeps component code readable, makes icons individually replaceable without touching component logic, and avoids the font-rendering variability of Unicode symbols.

### Zone ID scheme: 0-based throughout

Zone IDs follow `a{arr}-r{row}-c{col}-z{zone}` using 0-based indices everywhere, matching the internal data model. The same IDs are rendered as `<Text>` labels in the 3D view and as tooltip content in the heat map, so the user can correlate a shaded zone in the 3D scene with its heat map cell without conversion.

### `arraysSettings` applied after geometry, not during construction

Per-panel overrides (`hasOptimizer`, `string`) are applied in `PanelSetupFactory.create` as a post-processing pass over the fully built arrays. This keeps `SolarPanelArrayFactory` and `SolarPanelFactory` free of override logic — they always produce a canonical panel from the array config and defaults alone. The override pass is a thin map that replaces only the affected fields (and re-derives `frameColor`/`emissiveColor` from the new `hasOptimizer` value), leaving all geometry unchanged.

### `PanelArraySettings` uses `row`/`col`, not `PointXZ`

The earlier `panel: PointXZ` type for addressing a panel within an array reused the geometry coordinate type in a completely different semantic context (`PointXZ` means a point in the XZ plane, not a row/column index). Renaming to explicit `row: number` and `col: number` fields makes the intent unambiguous and matches the `row`/`col` fields already present on `SolarPanel` and `PanelAnnualData`. The address convention is 0-based, with row 0 at the northernmost position and col 0 at the westernmost position.