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
- Provides a settings sidebar (gear icon, top-left) with cache management and backup export/import.
- Exports a complete backup (config + all simulation results) to a gzip-compressed `.solarsim` file and imports it back.
- Validates the wall configuration and displays a prominent warning for non-90°/non-180° angles.
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
| PDF generation       | `jspdf` + `svg2pdf.js`          | Client-side PDF with ECharts SSR charts and drawn primitives |
| i18n                 | `i18next` + `react-i18next`     | EN/ES support, lazy-loaded JSON          |
| Build                | Vite                            | Fast HMR, static output for GitHub Pages |

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
├── styles/
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
├── backup/
│   ├── BackupConstants.ts
│   ├── BackupTypes.ts
│   ├── BackupExporter.ts
│   └── BackupImporter.ts
│
├── pdf/
│   ├── PdfTypes.ts           # ReportDay, PdfLabels, GenerateReportOptions
│   ├── PdfLayout.ts          # Cursor, page geometry constants, colour palette, font helper
│   ├── PdfPrimitives.ts      # drawSectionHeading, drawSubHeading, drawLegend, drawTable, drawScaleBar
│   ├── PdfCharts.ts          # ECharts SSR, svg2pdf embedding, timezone helpers, option builders
│   ├── PdfHeatmap.ts         # drawSetupHeatmap, shade colour helpers, zone average
│   ├── PdfSections.ts        # drawCover, drawAnnualSection, drawHeatmapsSection, drawMonthlySection, drawDailySection
│   └── PdfReportGenerator.ts # Public entry point: generatePdfReport, footer, filename
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
│       └── SettingsSlice.ts
│
├── hooks/
│   ├── useBVH.ts
│   ├── useShadowSampler.ts
│   ├── useAnnualSimulation.ts
│   ├── useResultsPanel.ts
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
    ├── SimulationCacheUtils.ts
    ├── PointXZUtils.ts
    ├── RailingUtils.ts
    ├── ThreeUtils.ts
    ├── TimeUtils.ts
    └── SimulationGroupUtils.ts

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
    ├── SettingsSidebar.tsx
    ├── SettingsSidebarButton.tsx
    └── results/
        ├── AnnualTab.tsx
        ├── MonthlyTab.tsx
        ├── DailyTab.tsx
        ├── AnnualBarChart.tsx
        ├── MonthlyRadarChart.tsx
        ├── MonthlyLineChart.tsx
        ├── DailyLineChart.tsx       # UTC→local timezone correction on X axis
        ├── PanelShadowHeatmap.tsx   # Array N at top, array 0 at bottom; row N at top, row 0 at bottom
        └── ReportModal.tsx
```

---

## Architecture decisions

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

### Settings sidebar and results panel as fixed overlays

Both are `position: fixed` overlays. The Three.js canvas always fills `100vw × 100vh`. No layout reflow on open/close.

### Shared IndexedDB helper

`SimulationCache` and `IrradianceCache` both delegate to `src/db/DbUtils.ts`.

### Simulation group building — shared utility

`src/utils/SimulationGroupUtils.ts` → `buildSimulationGroups`. Used by both `useResultsPanel` and `SettingsSidebar`.

### `useResizablePanel` — parametrised hook

Manages drag-to-resize, minimise, and fullscreen. Parametrised with `defaultWidth`, `minWidth`, `dragDirection`. Used for both the results panel and the settings sidebar.

### Backup export/import — `src/backup/`

`BackupExporter` + `BackupImporter`. Native `CompressionStream`/`DecompressionStream` for gzip, auto-detected on import via magic bytes.

### Event bus — `src/events/AppEvents.ts`

`mitt`-based typed event bus. `simulationResultsChanged` event decouples IndexedDB mutations from UI reloads.

### PDF report — `src/pdf/` module

The PDF module is split into seven focused files with clear single responsibilities:

| File | Responsibility |
|------|---------------|
| `PdfTypes.ts` | Public interfaces (`ReportDay`, `PdfLabels`, `GenerateReportOptions`) |
| `PdfLayout.ts` | `Cursor` class, page geometry constants, colour palette, `font` helper, `setupLetter` |
| `PdfPrimitives.ts` | `drawSectionHeading`, `drawSubHeading`, `drawLegend`, `drawTable`, `drawScaleBar` |
| `PdfCharts.ts` | ECharts SSR init/dispose, `embedSvg` (svg2pdf), timezone helpers, all option builders |
| `PdfHeatmap.ts` | `drawSetupHeatmap`, shade colour interpolation, zone average computation |
| `PdfSections.ts` | `drawCover`, `drawAnnualSection`, `drawHeatmapsSection`, `drawMonthlySection`, `drawDailySection` |
| `PdfReportGenerator.ts` | Public entry point: `generatePdfReport`, footer rendering, filename encoding |

External callers import only from `PdfReportGenerator.ts`, which re-exports the public types. The internal sub-modules are implementation details.

**Generation flow** is controlled by a three-state machine in `SimulationResultsPanel`:

```
idle → modal → generating → idle
```

`generatePdfReport` is called directly as an `async` function — no React components are mounted for chart capture.

### Charts in PDF — ECharts SSR + svg2pdf.js

ECharts v5.3+ supports SSR rendering: `echarts.init(null, null, { renderer: 'svg', ssr: true })` produces an SVG string without any DOM or canvas dependency. `svg2pdf.js` converts that SVG string into native jsPDF vector content. This combination is fully synchronous on the ECharts side (SSR) and Promise-based on the pdf side (svg2pdf).

### Heat maps in PDF — jsPDF primitives

Panel shadow heat maps are drawn directly as `doc.rect()` calls with computed fill colours — no DOM capture, no `html2canvas`. The colour computation is a pure function of the shade fraction, identical to the web UI. Each zone cell shows the zone ID in the upper half and the shade percentage (bold, larger font) in the lower half, both scaled proportionally to the cell size.

### Heat map physical orientation

Both the web UI (`PanelShadowHeatmap.tsx`) and the PDF (`PdfHeatmap.ts`) display arrays and rows in physical order:
- **Arrays**: highest index at top, array 0 at bottom (southernmost).
- **Rows within an array**: highest row index at top (northernmost), row 0 at bottom (southernmost).

### Daily chart timezone correction

Energy data is stored in UTC hour buckets. `DailyLineChart` and the PDF daily section both:
1. Compute `offsetHours` using `Intl.DateTimeFormat` at noon UTC on the selected date (DST-safe).
2. Derive `startUtc = (-offsetHours + 24) % 24` — the UTC hour corresponding to local midnight.
3. Use sequential local labels `00:00–23:00` on the X axis.
4. Map each X position `i` to UTC bucket `(startUtc + i) % 24`.

This means `data[i]` = production at local hour `i`, so 08:00–20:00 local always shows correctly regardless of timezone or DST.

### PDF multilingual support

All strings (section headings, table headers, parameter labels, month abbreviations) are resolved by `SimulationResultsPanel` via `t()` and passed to `generatePdfReport` as a `PdfLabels` object. The generator has no i18next dependency and is trivially testable.

### PDF filename convention

```
solarsim-{lat}-{lon}-sim-{simulationCode}-{YYYYMMDDHHMMSS}.pdf
```

`{simulationCode}` mirrors the results panel run selector label in compact form, e.g. `2025-60m-openmeteo-16p4t-4s`. Coordinates use the same `p`/`n`/`d` encoding as `.solarsim` backup filenames.

### Panel world-space positioning pipeline

Panels are rendered outside the site `<group>` so raycasting sample points are already in absolute world space. `temperatureCoefficient` and `noct` are resolved with defaults in `SolarPanelConverter`.

### Irradiance provider — Strategy pattern

`IrradianceProvider` interface with two implementations: `GeometricIrradianceProvider` (returns null) and `OpenMeteoIrradianceProvider` (fetches DNI, DHI, temperature; caches in IndexedDB v2).

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
| 0     | South-facing |
| > 0   | Rotated toward East |
| < 0   | Rotated toward West |

### Panel indexing within an array

| Index | 0 = … | Increases toward … |
|-------|-------|--------------------|
| `row` | southernmost row | North |
| `col` | westernmost column | East |

---

## 2D geometry — normals, dot product, cross product

Unit normal to a segment: `n = (-dz, dx) / |d|` (left-hand perpendicular).

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

| Field | Default | Description |
|-------|---------|-------------|
| `groundAlbedo` | 0.20 | Fraction of GHI reflected toward panels |
| `inverterEfficiency` | 0.97 | DC/AC conversion efficiency |
| `wiringLoss` | 0.02 | DC cable loss fraction |

### Panel-level physical properties

| Field | Default | Description |
|-------|---------|-------------|
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
|--------|---------|----------|--------------|
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
|----------|---------|-------|-----|
| `solar-simulator` | 1 | `simulation-results` | `cacheKey` hash |
| `solar-simulator-irradiance` | 2 | `irradiance-cache` | `{source}:{lat4dp}:{lon4dp}:{year}` |

---

## Results panel

Fixed overlay, right edge. Drag handle resizes between 280px and 100vw. Three icon buttons: reset width, fullscreen, minimise.

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

Seven files with single responsibilities (see Architecture decisions above). External callers import only from `PdfReportGenerator.ts`.

### Document structure

| Pages | Content |
|-------|---------|
| 1 | Cover: simulation parameters, computed-at date |
| 2 | Annual: legend + horizontal bar chart (ECharts SSR) + totals table |
| 3..N | Heat maps: one page per setup, arrays highest-index-first, rows highest-index-first |
| N+1 | Monthly: legend + grouped bar chart (ECharts SSR) + monthly totals table |
| N+2..M | Daily (one pair per selected day): page 1 = charts, page 2 = hourly table |

### Charts — ECharts SSR + svg2pdf.js

`echarts.init(null, null, { renderer: 'svg', ssr: true })` → `renderToSVGString()` → `doc.svg(svgEl, {...})`. No DOM, no canvas, no timing dependencies.

### Heat maps — jsPDF primitives

`doc.rect()` with shade-interpolated fill colours. Zone cells show zone ID (upper half, smaller font) and shade percentage (lower half, bold larger font), both scaled to cell size.

### PDF filename

```
solarsim-{lat}-{lon}-sim-{year}-{interval}m-{source}-{density}p{threshold}t-{setups}s-{YYYYMMDDHHMMSS}.pdf
```

### Multilingual support

All strings resolved via `t()` in `SimulationResultsPanel` and passed as `PdfLabels`. The generator has no i18next dependency.

---

## Settings sidebar

Three collapsible sections: Cache management, Export / Import, Configuration (placeholder).

### Export / Import

Export: gzip-compressed `.solarsim` backup (config + simulation results). Import: replaces config and results, preserves irradiance cache.

---

## Application layout

Canvas fills `100vw × 100vh`. All UI elements are fixed or absolute overlays. `ReportModal` uses z-index 200 (above all other overlays).

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

---

## Lessons learned

### PDF module decomposition

An 800-line monolithic generator file is replaced by seven focused modules. The split follows natural seams: types, layout primitives, drawing primitives, chart rendering, heat map drawing, section composition, and the public entry point. Each file is independently readable and the dependency graph is a strict DAG with no cycles.

### ECharts SSR eliminates timing and DOM dependencies

`echarts.init(null, null, { renderer: 'svg', ssr: true })` works in any JavaScript context without a DOM. Combined with `svg2pdf.js`, it produces crisp vector charts in the PDF without any timing hacks or off-screen React components.

### UTC array rotation for timezone-correct hourly display

Rotating the 24-element UTC array by `startUtc = (-offset + 24) % 24` positions and pairing it with sequential local labels `00:00–23:00` is both correct and simple. The key insight: the X axis always shows local hours sequentially; it is the data that is rotated, not the labels. Using `Intl.DateTimeFormat` at noon UTC (not midnight) as the DST reference avoids ambiguity during clock changes.

### Heat map physical orientation

Inverting both the array order (highest index first) and the row order within each array (highest index first) gives the correct physical orientation: the observer sees the installation from the south, with the southernmost panels (row 0, array 0) at the bottom. A single `.reverse()` on the array list and an `Array.from({length: rows}, (_, i) => rows-1-i)` index mapping for rows achieves both without any coordinate transformation.

### PdfLabels interface decouples generator from i18next

Resolving all strings in the React layer and passing them as a plain object means the PDF generator is pure TypeScript with no framework dependency. It can be tested with a simple mock object.

### Cursor top-convention eliminates layout overlaps

Defining `cursor.y` as the top of the next block (not a text baseline) makes every drawing call composable: receive top, draw downward, advance by exact height. There is no arithmetic between baseline offsets and block heights, which was the root cause of the table header overlap bug.