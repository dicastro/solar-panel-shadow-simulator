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
12. [PDF report generation](#pdf-report-generation)
13. [Settings sidebar](#settings-sidebar)
14. [Application layout](#application-layout)
15. [Timezone and DST](#timezone-and-dst)
16. [Known limitations](#known-limitations)
17. [Lessons learned](#lessons-learned)

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
- Daily hourly charts display hours in the installation's local timezone (DST-aware) rather than UTC.
- Shadow heat maps display arrays and rows in physical orientation: highest array index at top, array 0 at bottom; within each array, highest row index at top (northernmost), row 0 at bottom (southernmost).
- Generates a downloadable PDF report from any simulation run, including annual totals, monthly grouped bar chart, optional per-day hourly charts, and panel shadow heat maps drawn directly in the PDF.
- Provides a settings sidebar (gear icon, top-left) with cache management, backup export/import, and configuration editing.
- Persists the active configuration to the Origin Private File System (OPFS) between sessions. On first launch the built-in example configuration is loaded automatically and the settings sidebar opens to guide the user.
- Validates configuration edits with a full JSON Schema (ajv) before applying them. Any change to the configuration triggers a confirmation dialog warning that existing simulation results will become inaccessible in the results panel.
- The results panel only shows simulation results that belong to the current active configuration; results from previous configurations remain in IndexedDB but are not visible.
- Exports a complete backup (config + simulation results for the current config only) to a gzip-compressed `.solarsim` file and imports it back.
- Validates the wall configuration and displays a prominent warning for non-90°/non-180° angles.
- Displays the application version in the footer, sourced from `package.json` at build time.
- Shows a blocking error screen when the browser does not support OPFS, with a table of minimum supported browser versions.

---

## Tech stack

| Layer | Library | Why |
|---|---|---|
| UI framework | React 18 + TypeScript | Component model, type safety |
| 3D rendering | Three.js + `@react-three/fiber` | Declarative Three.js in React |
| 3D helpers | `@react-three/drei` | OrbitControls, Grid, Text, Sphere |
| Raycast acceleration | `three-mesh-bvh` | O(log n) ray–triangle intersection |
| Sun position | `suncalc` | Altitude + azimuth from lat/lon/date |
| Date handling | `dayjs` + UTC/timezone plugins | Timezone-aware date arithmetic |
| Global state | `zustand` | Minimal, selector-based store |
| Charts | `echarts` + `echarts-for-react` | Bar, radar, line charts; interactive tooltips |
| PDF generation | `jspdf` + `svg2pdf.js` | Client-side PDF with ECharts SSR charts and drawn primitives |
| Schema validation | `ajv` | JSON Schema validation for configuration editing |
| i18n | `i18next` + `react-i18next` | EN/ES support, lazy-loaded JSON |
| Build | Vite | Fast HMR, static output for GitHub Pages |

---

## Project structure

```
src/
├── App.tsx
├── i18n.ts
│
├── assets/icons/
│   ├── panel-reset-width.svg
│   ├── panel-expand.svg
│   ├── panel-collapse.svg
│   └── panel-minimise.svg
│
├── config/
│   └── defaultConfig.ts          # Built-in example configuration (Madrid, 2×1 array)
│
├── styles/
│   ├── index.css
│   ├── base.css
│   ├── layout.css                # App container, loading overlay, OPFS error screen
│   ├── controls.css
│   ├── simulation.css
│   ├── results-panel.css
│   ├── settings-sidebar.css      # Sidebar shell, collapsible sections, shared button primitives
│   ├── settings-cache.css        # Cache management section styles
│   └── settings-config.css       # Configuration editor, banners, confirmation dialog
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
├── backup/
│   ├── BackupConstants.ts
│   ├── BackupTypes.ts
│   ├── BackupExporter.ts         # Filters results to current config before export
│   └── BackupImporter.ts
│
├── pdf/
│   ├── PdfTypes.ts
│   ├── PdfLayout.ts
│   ├── PdfPrimitives.ts
│   ├── PdfCharts.ts
│   ├── PdfHeatmap.ts
│   ├── PdfSections.ts
│   └── PdfReportGenerator.ts
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
│       └── SettingsSlice.ts      # isSidebarOpen, isFirstLaunch
│
├── hooks/
│   ├── useBVH.ts
│   ├── useShadowSampler.ts
│   ├── useAnnualSimulation.ts
│   ├── useResultsPanel.ts        # Filters results by current config's setupIds
│   └── useResizablePanel.ts
│
├── db/
│   ├── DbUtils.ts
│   ├── SimulationCache.ts
│   ├── IrradianceCache.ts
│   └── IrradianceCacheManager.ts
│
├── workers/
│   └── AnnualSimulation.worker.ts
│
├── events/
│   └── AppEvents.ts
│
└── utils/
    ├── HashUtils.ts
    ├── SetupColoursUtils.ts
    ├── SimulationCacheUtils.ts   # buildSetupHash exported separately
    ├── PointXZUtils.ts
    ├── RailingUtils.ts
    ├── ThreeUtils.ts
    ├── TimeUtils.ts
    ├── SimulationGroupUtils.ts
    ├── ConfigStorage.ts          # OPFS persistence with availability check
    └── ConfigValidator.ts        # ajv-based JSON Schema validation

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
    ├── SettingsSidebar.tsx        # Shell only; sections imported from settings/
    ├── SettingsSidebarButton.tsx
    ├── settings/
    │   ├── SimulationCacheSection.tsx
    │   ├── IrradianceCacheSection.tsx
    │   ├── ExportImportSection.tsx
    │   └── ConfigurationSection.tsx  # Inline editor, file I/O, reset
    └── results/
        ├── AnnualTab.tsx
        ├── MonthlyTab.tsx
        ├── DailyTab.tsx
        ├── AnnualBarChart.tsx
        ├── MonthlyRadarChart.tsx
        ├── MonthlyLineChart.tsx
        ├── DailyLineChart.tsx
        ├── PanelShadowHeatmap.tsx
        └── ReportModal.tsx
```

---

## Architecture decisions

### Configuration persistence — OPFS

The active configuration is persisted to the **Origin Private File System (OPFS)** between sessions. OPFS gives each origin a private directory managed by the browser, accessible via `navigator.storage.getDirectory()`. The config is stored as a single `config.json` file inside that directory.

OPFS was chosen over `localStorage` because it is semantically correct for file storage, is async (non-blocking), and has no practical size limit. It is available in Chrome 86+, Firefox 111+, and Safari 15.2+ (>98% of users as of 2026) and works with no backend and no special HTTP headers — fully compatible with GitHub Pages.

The application checks OPFS availability at startup via `checkOpfsAvailability()`. If absent, a blocking error screen is shown with a table of minimum supported browser versions. No fallback to `localStorage` is provided — the 2% of unsupported browsers see a clear message rather than a silently degraded experience.

`public/config.json` has been removed from the repository. On first launch (no OPFS file), the built-in example configuration from `src/config/defaultConfig.ts` is loaded, persisted to OPFS, and the settings sidebar opens automatically to guide the user. On subsequent launches the saved OPFS file is loaded directly.

### Configuration validation — ajv JSON Schema

Configuration edits (both inline editor and file load) are validated at two levels:

1. **JSON syntax** — `JSON.parse`. Errors are reported with the parser's message.
2. **JSON Schema** — a hand-maintained schema in `src/utils/ConfigValidator.ts` compiled by ajv with `allErrors: true`. All validation errors are formatted into human-readable messages before display.

The schema is maintained as a plain TypeScript object rather than generated at build time. This avoids a Vite plugin dependency and keeps the validation logic fully transparent and reviewable.

### Simulation results scoped to active configuration

`useResultsPanel` derives the set of valid `setupId`s from the current config and filters `SimulationCache.listResults()` to only include matching entries before grouping. Results from previous configurations that may still be present in IndexedDB are therefore not visible in the results panel.

This means "keep simulations and apply" in the config-change confirmation dialog preserves the data in IndexedDB (useful if the user wants to reload a previous config to recover results) but makes those results invisible immediately. Only results whose `setupId` matches the current config are displayed.

### Backup scoped to active configuration

`BackupExporter` filters simulation results to those whose `setupId` matches one of the current config's setups before exporting. Results from previous configurations present in IndexedDB are excluded. This keeps the backup coherent — a backup always contains exactly the config and the results that belong to it.

### Factory pattern for domain models

All domain objects are plain immutable value objects created by dedicated factory functions. React components never construct domain objects — they only consume pre-computed `renderData`.

### Pre-computed render data with discriminated unions

Railing shapes use a discriminated union (`kind: 'square' | 'cylinder' | 'half-cylinder'`). The factory computes the exact Three.js geometry args for each shape.

### Density changes do not rebuild panel geometry

`PanelSetupFactory.rebuildSamplePoints(existing, density)` reuses all panel geometry and only regenerates the NxN sample point grids.

### Two independent density/threshold parameters

- `renderDensity` / `renderThreshold` — `RenderSlice`. Control the 3D view and instant production readout.
- `simulationDensity` / `simulationThreshold` — `SimulationSlice`. Used exclusively for annual simulation runs.

### Store architecture — slice pattern with facade

Four domain slices: `ConfigSlice`, `RenderSlice`, `SimulationSlice`, `SettingsSlice`. Composed behind a single `useAppStore` facade. Slices never import each other.

`SettingsSlice` carries `isFirstLaunch: boolean` which is set to `true` when the app initialises from the built-in default and reset to `false` as soon as the user saves or loads a configuration. It drives the introductory banner in the Configuration section and the automatic opening of the sidebar.

### Settings sidebar — modular decomposition

The sidebar is split into a thin shell (`SettingsSidebar.tsx`) and four independent section components under `src/components/settings/`. Each section owns its state and side effects; the shell only handles the overlay, drag-to-resize, and section collapsing. CSS is split along the same lines: `settings-sidebar.css` (shell + shared primitives), `settings-cache.css` (cache management), `settings-config.css` (editor, banners, confirmation dialog).

### Loading overlay — unified

A single `LoadingOverlay` component in `App.tsx` is used for all blocking loading states: initial app startup, and the moment before `window.location.reload()` fires after a config reset. The overlay is `position: fixed` with `z-index: 200`, covering all content. Before reload, `App.tsx` listens for a custom `app:reload` DOM event dispatched by `ConfigurationSection` and shows the overlay for ~80 ms before the reload triggers, giving the browser time to paint.

### Shared IndexedDB helper

`SimulationCache` and `IrradianceCache` both delegate to `src/db/DbUtils.ts`.

### Simulation group building — shared utility

`src/utils/SimulationGroupUtils.ts` → `buildSimulationGroups`. Used by both `useResultsPanel` and `SettingsSidebar`.

### `useResizablePanel` — parametrised hook

Manages drag-to-resize, minimise, and fullscreen. Parametrised with `defaultWidth`, `minWidth`, `dragDirection`. Used for both the results panel and the settings sidebar.

### Backup export/import — `src/backup/`

`BackupExporter` + `BackupImporter`. Native `CompressionStream`/`DecompressionStream` for gzip, auto-detected on import via magic bytes. Export includes only results matching the current config's setupIds.

### Event bus — `src/events/AppEvents.ts`

`mitt`-based typed event bus. `simulationResultsChanged` event decouples IndexedDB mutations from UI reloads.

### PDF report — `src/pdf/` module

Split into seven focused files (see Project structure). External callers import only from `PdfReportGenerator.ts`.

### Charts in PDF — ECharts SSR + svg2pdf.js

`echarts.init(null, null, { renderer: 'svg', ssr: true })` produces SVG without DOM or canvas. `svg2pdf.js` converts SVG to native jsPDF vector content.

### Heat maps in PDF — jsPDF primitives

Panel shadow heat maps are drawn directly as `doc.rect()` calls with computed fill colours — no DOM capture, no `html2canvas`.

### Daily chart timezone correction

Energy data is stored in UTC hour buckets. Both `DailyLineChart` and the PDF daily section derive `startUtc = (-offsetHours + 24) % 24` via `Intl.DateTimeFormat` at noon UTC on the selected date (DST-safe), then map `data[i]` to local hour `i`.

### `buildSetupHash` — exported separately

`src/utils/SimulationCacheUtils.ts` exports `buildSetupHash` as a standalone function in addition to the full `buildCacheKey`. This allows `BackupExporter` to derive setup geometry hashes for result filtering without constructing a complete `SimulationCacheKey`.

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
|---|---|
| 0 | South-facing |
| > 0 | Rotated toward East |
| < 0 | Rotated toward West |

### Panel indexing within an array

| Index | 0 = … | Increases toward … |
|---|---|---|
| `row` | southernmost row | North |
| `col` | westernmost column | East |

---

## 2D geometry — normals, dot product, cross product

Unit normal to a segment: `n = (-dz, dx) / |d|` (left-hand perpendicular).

---

## Configuration reference

The configuration lives in a `config.json` file that the user edits and loads via the settings sidebar. There is no `public/config.json` in the repository — the app ships with a built-in example in `src/config/defaultConfig.ts` used only on first launch.

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

| Field | Default | Description |
|---|---|---|
| `groundAlbedo` | 0.20 | Fraction of GHI reflected toward panels |
| `inverterEfficiency` | 0.97 | DC/AC conversion efficiency |
| `wiringLoss` | 0.02 | DC cable loss fraction |

### Panel-level physical properties

| Field | Default | Description |
|---|---|---|
| `temperatureCoefficient` | −0.004 /°C | Relative change in peak power per °C above 25°C |
| `noct` | 45°C | Nominal Operating Cell Temperature |

---

## Solar production model

### 1. Geometric model

```
incidenceFactor = max(0, dot(sunDirection, panelNormal))
basePower (kW)  = peakPower (Wp) / 1000 × incidenceFactor
```

### 2. POA irradiance model (Open-Meteo)

```
POA_direct  = DNI × cos(angle_of_incidence)
POA_diffuse = DHI × (1 + cos(tilt)) / 2
POA_albedo  = GHI × groundAlbedo × (1 − cos(tilt)) / 2
GHI         = DNI × cos(solar_zenith) + DHI
basePower   = peakPower / 1000 × (POA / 1000)
```

### 3. Temperature correction

```
T_cell         = T_ambient + (NOCT − 20) / 800 × POA
tempFactor     = max(0, 1 + γ × (T_cell − 25))
basePower_corr = basePower × tempFactor
```

### 4. Panel output with bypass diodes and string mismatch

Without optimizers: `basePower × (n−k)/n × 0.9` (10% mismatch penalty for k shaded zones out of n).
With optimizer: `basePower × (n−k)/n` (proportional, no penalty).
String mismatch: efficiency limited by the least-efficient panel in the string (unless any panel has an optimizer).

### 5. System losses

```
systemLossFactor = inverterEfficiency × (1 − wiringLoss)
effectivePower   = stringPower × systemLossFactor
```

---

## Shadow detection — Raycasting + BVH

`three-mesh-bvh` pre-organises each geometry into a BVH. `firstHitOnly = true` stops traversal after the first hit. All scratch `Vector3`/`Matrix4` objects allocated once at module scope.

---

## Annual simulation

### Irradiance sources

| Source | Network | Interval | Year support |
|---|---|---|---|
| `geometric` | None | 15, 30, 60 min | Current + past 5 years |
| `open-meteo` | Required | 60 min only | Past 5 years only |

### Output data model

```
PanelAnnualData.energyKwh         [month][dayOfMonth][hourOfDay]   (UTC)
PanelAnnualData.shadeFraction     [month][dayOfMonth][hourOfDay]
PanelAnnualData.zoneShadeFraction [zone][month][dayOfMonth][hourOfDay]
```

All hour indices are UTC. The UI converts to local time using `Intl.DateTimeFormat`.

### IndexedDB

| Database | Version | Store | Key |
|---|---|---|---|
| `solar-simulator` | 1 | `simulation-results` | `cacheKey` hash |
| `solar-simulator-irradiance` | 2 | `irradiance-cache` | `{source}:{lat4dp}:{lon4dp}:{year}` |

---

## Results panel

Fixed overlay, right edge. Drag handle resizes between 280px and 100vw. Three icon buttons: reset width, fullscreen, minimise.

Only simulation results whose `setupId` matches one of the current config's setups are displayed. Results from previous configurations remain in IndexedDB but are invisible until that configuration is reloaded.

### Daily chart timezone

`DailyLineChart` derives `startUtc = (-offsetHours + 24) % 24` via `Intl.DateTimeFormat` at noon UTC on the selected date. Sequential local labels `00:00–23:00` are used on the X axis; data is rotated so `data[i]` = production at local hour `i`.

### Heat map physical orientation

Arrays: highest index at top, array 0 at bottom. Rows within each array: highest row index at top, row 0 at bottom. Both the web UI and the PDF heat maps use this convention.

---

## PDF report generation

### Trigger and flow

"Generate PDF Report" button in the results panel parameter strip → `ReportModal` (optional day selection) → `generatePdfReport` (async).

State machine: `idle → modal → generating → idle`.

### Module structure — `src/pdf/`

Seven files with single responsibilities. External callers import only from `PdfReportGenerator.ts`.

### Document structure

| Pages | Content |
|---|---|
| 1 | Cover: simulation parameters, computed-at date |
| 2 | Annual: legend + horizontal bar chart + totals table |
| 3..N | Heat maps: one page per setup |
| N+1 | Monthly: legend + grouped bar chart + monthly totals table |
| N+2..M | Daily (one pair per selected day): charts + hourly data table |

---

## Settings sidebar

Three collapsible sections, each implemented as an independent component under `src/components/settings/`:

### Cache management (`SimulationCacheSection`, `IrradianceCacheSection`)

Lists cached simulation results grouped by run parameters (year, interval, irradiance source, density, threshold) and cached Open-Meteo irradiance data. Supports deleting individual entries, entire groups, or all entries of each type.

### Export / Import (`ExportImportSection`)

Exports a gzip-compressed `.solarsim` backup containing the current configuration and only the simulation results that belong to it. Results from previous configurations present in IndexedDB are excluded. Import replaces the current config and all simulation results; irradiance cache is preserved.

### Configuration (`ConfigurationSection`)

Three capabilities:

1. **Inline JSON editor** with line numbers and two-level validation (JSON syntax + full ajv schema). The editor opens at the same pixel height as the read-only view to avoid a layout jump. The user can resize it vertically. Validation errors are listed below the editor, each referencing the field path reported by ajv.

2. **Export to file** — downloads the current config as a plain `config.json`.

3. **Load from file** — file picker accepting `.json` files. Same two-level validation is applied before the config is applied.

Any config change (editor Apply or file load) triggers a three-option confirmation dialog:
- **Delete simulations and apply** — clears IndexedDB results before applying.
- **Keep simulations and apply** — applies without deleting; existing results stay in IndexedDB but become invisible in the results panel because they no longer match the new config's setupIds.
- **Cancel** — discards the change.

A **Reset to default** button clears OPFS and reloads the page, restoring the built-in example configuration. A documentation link is always visible in the section header (with a first-launch message on initial load, and a regular help message thereafter).

---

## Application layout

Canvas fills `100vw × 100vh`. All UI elements are fixed or absolute overlays.

### Loading overlay

A full-screen `LoadingOverlay` component covers all content (z-index 200) during two scenarios: initial app startup (OPFS check + config load) and the moment before `window.location.reload()` fires. The overlay is triggered in the second case by a custom `app:reload` DOM event, giving React ~80 ms to paint before the browser navigates.

### OPFS error screen

When `checkOpfsAvailability()` returns false, a blocking `OpfsUnavailableScreen` replaces the entire app with an explanation and a table of minimum supported browser versions. No fallback storage is provided.

---

## Timezone and DST

`makeDateInTimezone` uses `dayjs.tz`. The worker uses `Date.UTC()`. The UI converts UTC hour buckets to local time using `Intl.DateTimeFormat` at noon UTC on the selected date — a DST-safe reference point.

---

## Known limitations

- **90° wall angles only**: non-right angles produce incorrect post placement.
- **Open-Meteo resolution is hourly**: sub-hourly intervals only available with geometric model.
- **Isotropic sky model**: diffuse component assumes uniform sky radiance.
- **Single inclination per setup for POA**: worker uses mean inclination across all arrays.
- **Drag-to-resize is mouse-only**: touch not supported.
- **OPFS required**: browsers older than Chrome 86 / Firefox 111 / Safari 15.2 cannot run the application.

---

## Lessons learned

### OPFS as the correct storage primitive for configuration

`localStorage` would work size-wise for a config JSON, but OPFS is semantically correct: the user is saving a file. Using the right abstraction produces cleaner code (async, file-oriented API) and makes the intent clear. The blocking error screen for unsupported browsers is preferable to a silent fallback — it sets honest expectations and affects fewer than 2% of users.

### Configuration validation with ajv

A hand-maintained JSON Schema compiled by ajv provides complete structural validation without a build-time schema generation step. The schema lives alongside the code it validates, is readable without tooling, and produces all errors in a single pass (`allErrors: true`). Error messages are post-processed from ajv's `ErrorObject` into field-path + plain-English descriptions before display.

### Editor height synchronisation via `getBoundingClientRect`

Capturing the rendered height of the read-only `<pre>` at the moment the Edit button is clicked and passing it as an inline `height` style to the editor wrapper avoids the layout jump that occurs when switching from a `max-height`-constrained element to an unconstrained one. The wrapper's `resize: vertical` then lets the user grow it from that stable starting point.

### Scoping results to the active configuration

Filtering `SimulationCache.listResults()` by the current config's `setupId` set in `useResultsPanel` is the correct boundary: IndexedDB is the source of truth for what is stored, but the UI is only responsible for showing what is relevant now. This decouples storage lifetime from display lifetime, which is exactly what the "keep simulations" option in the confirmation dialog exploits.

### PDF module decomposition

An 800-line monolithic generator file is replaced by seven focused modules. The split follows natural seams: types, layout primitives, drawing primitives, chart rendering, heat map drawing, section composition, and the public entry point.

### ECharts SSR eliminates timing and DOM dependencies

`echarts.init(null, null, { renderer: 'svg', ssr: true })` works in any JavaScript context without a DOM.

### UTC array rotation for timezone-correct hourly display

Rotating the 24-element UTC array by `startUtc = (-offset + 24) % 24` and pairing it with sequential local labels `00:00–23:00` correctly maps production data to local hours. Using noon UTC as the DST reference avoids ambiguity during clock changes.