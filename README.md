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
- Displays annual results in a dedicated right-column panel alongside the 3D viewport, with a responsive stacked layout on narrow screens.
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
│   │                              #   worker message protocol (WorkerIncomingMessage,
│   │                              #   WorkerOutgoingMessage, WorkerSimulationPayload, ...),
│   │                              #   SimulationPanelData, SimulationSamplePoint
│   └── index.ts                   # Re-exports
│
├── engine/
│   ├── SolarEngine.ts             # Pure functions: sun state, incidence, panel output,
│   │                              #   string mismatch (applyStringMismatch exported).
│   │                              #   calculateInstantProduction delegates panel normal
│   │                              #   computation to SolarPanelConverter.toWorldNormal.
│   │                              #   Used by both the interactive view and the worker.
│   └── AnnualSimulationEngine.ts  # Pure accumulation functions for the annual loop:
│                                  #   initAccumulators, accumulateStep, finalizePanel,
│                                  #   buildSetupResult. No Three.js, no worker coupling.
│
├── factory/
│   ├── SiteFactory.ts             # Config → Site (walls, intersections, bounding radius, angle validation)
│   ├── WallFactory.ts             # Wall segment geometry + railing + supports + extensions
│   ├── WallIntersectionFactory.ts # Corner posts (all non-collinear vertices)
│   ├── PanelSetupFactory.ts       # PanelSetupConfiguration + Site → PanelSetup
│   ├── SolarPanelArrayFactory.ts  # Computes array origin, creates panels
│   ├── SolarPanelFactory.ts       # Single panel world position + render data
│   ├── SamplePointFactory.ts      # Sample points for raycasting per panel
│   ├── PointXZFactory.ts          # Safe PointXZ constructor
│   └── MeshFactory.ts             # Collects shadow-casting meshes from the scene and
│                                  #   serialises them for worker transfer (one independent
│                                  #   copy per worker via MeshFactory.fromScene().build()).
│
├── converter/
│   ├── ThreeConverter.ts          # Domain Vector3/Euler3 → THREE.Vector3/Euler
│   └── SolarPanelConverter.ts     # SolarPanel → SimulationPanelData / SimulationSamplePoint
│                                  #   / Vector3 (world normal). toWorldNormal is the single
│                                  #   source of truth for panel normal computation, used by
│                                  #   both SolarEngine (interactive) and the pre-computation
│                                  #   step before worker transfer.
│
├── store/
│   └── useAppStore.ts             # Zustand store — all app state + actions
│
├── hooks/
│   ├── useBVH.ts                  # Builds BVH over shadow-casting meshes
│   ├── useShadowSampler.ts        # Casts rays, returns ShadowMap (interactive)
│   └── useAnnualSimulation.ts     # Orchestrates worker pool for annual simulation.
│                                  #   Cache key computed once per setup and passed to
│                                  #   both the cache lookup and the worker payload.
│
├── db/
│   └── SimulationCache.ts         # IndexedDB wrapper for SetupAnnualResult persistence
│
├── workers/
│   └── AnnualSimulation.worker.ts # Full annual simulation loop. Imports from SolarEngine,
│                                  #   AnnualSimulationEngine, ThreeUtils, and TimeUtils.
│                                  #   Contains only worker orchestration and the raycasting
│                                  #   call (computeShadedZones), which requires THREE.Raycaster
│                                  #   and cannot be shared with the main-thread path.
│
└── utils/
    ├── HashUtils.ts               # FNV-1a 32-bit hash — deterministic cache key generation
    ├── SimulationCacheUtils.ts    # buildCacheKey() and hashCacheKey() for simulation results
    ├── PointXZUtils.ts            # computeLeftHandNormal, convexity, right-angle check, prev/next helpers
    ├── RailingUtils.ts            # Shared railing rail render data builder
    ├── ThreeUtils.ts              # serializeMesh / reconstructMesh / reconstructMeshes —
    │                              #   Three.js mesh ↔ typed-array conversion for worker transfer
    └── TimeUtils.ts               # getAllTimezones, getBrowserTimezone, resolveInitialTimezone,
                                   #   timeSteps generator, totalTimeSteps, formatEta

└── components/
    ├── Scene.tsx                  # Root 3D scene (walls + panels + helpers); wires annual simulation
    ├── ShadowedScene.tsx          # Dirty-flag raycasting loop, feeds ShadowMap
    ├── SolarPanelComponent.tsx    # Single panel render (purely presentational)
    ├── Sun.tsx                    # Sun sphere + directional light
    ├── Compass.tsx                # N/S/E/W labels in 3D
    ├── MainControls.tsx           # Date/time/play UI panel
    ├── SimulationControls.tsx     # Simulation settings, annual run button, inline results summary
    ├── ResultsPanel.tsx           # Right-column annual results panel (placeholder → text → charts)
    ├── AnnualSimulationProgress.tsx  # Per-setup progress bars with ETA and pending count
    ├── AngleWarningBanner.tsx     # Warning banner listing non-90° angle coordinate triples
    └── DeveloperFooter.tsx        # Ko-fi link + personal site
```
 
---
 
## Architecture decisions

### Factory pattern for domain models
 
All domain objects are plain immutable value objects created by dedicated factory functions. React components never construct domain objects — they only consume pre-computed `renderData`.

### Pre-computed render data with discriminated unions
 
Railing shapes use a discriminated union (`kind: 'square' | 'cylinder' | 'half-cylinder'`). The factory computes the exact Three.js geometry args for each shape and stores them in the render data. `Scene.tsx` switches on `kind` to render the correct geometry without any cast. TypeScript will error if a new shape is added to the union but not handled in the switch — this is the primary benefit of discriminated unions over string enums.
 
### CylinderGeometry for half-cylinders
 
Three.js `CylinderGeometry` constructor signature:
```
(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength)
```
A half-cylinder uses `openEnded=true` and `thetaLength=Math.PI`. `thetaStart` selects which half: `0` for flat face down (`orientation: 'up'`), `Math.PI` for flat face up (`orientation: 'down'`). The full args tuple is therefore 8 elements. `heightSegments=1` is required to reach the `openEnded` positional parameter.
 
### Density changes do not rebuild panel geometry
 
`PanelSetupFactory.rebuildSamplePoints(existing, density)` reuses all panel geometry and only regenerates the NxN sample point grids. `setDensity` in the store calls this instead of a full `create()`. See [Lessons learned](#lessons-learned).
 
### Setup selection by index, id derived from label
 
`PanelSetupConfiguration` has no `id` field — the user-facing `label` is sufficient, and internal identification uses the array index. `PanelSetupFactory.create` derives a stable internal id from the label (diacritics stripped, spaces replaced with hyphens) plus the index suffix, guaranteeing uniqueness even if two setups share the same normalised label. The id is used only as a React key and as the BVH rebuild signal.
 
### Two distinct tick mechanisms
 
- **Interactive playback** (`tickHour`): advances 1 hour per 100 ms interval. Unit fixed at 1 hour.
- **Annual simulation**: uses `simulationInterval` (15/30/60 min) in its own loop running in a Web Worker, separate from interactive playback.

### `showPoints` excluded from ShadowedScene
 
`showPoints` only controls rendering of sample point spheres in `SolarPanelComponent`. `ShadowedScene` does not accept it as a prop — doing so would cause raycasting to run on every visibility toggle with no change in shadow output.
 
### `allPanels` memoised in ShadowedScene

`activeSetup.panelArrays.flatMap(pa => pa.panels)` is wrapped in `useMemo` inside `ShadowedScene`. Without memoisation, the flat array is reconstructed on every render, which invalidates the `panels` identity passed to `useShadowSampler` and triggers an unnecessary re-creation of the `computeShadows` callback on every frame even when no setup has changed.

### Shadow mesh cache in `useShadowSampler`
 
The list of shadow-casting meshes is built via `scene.traverse` once and stored in a `useRef`, invalidated only when `rebuildKey` changes. `ShadowedScene` is the single source of truth for this key — it constructs the same string that is passed to both `useBVH` and `useShadowSampler`, ensuring the mesh cache and the BVH are always invalidated together. This avoids O(scene nodes) traversal on every raycasting pass. All geometry with `castShadow=true` is included: wall bodies, railing rails, railing supports (balusters), and solar panel bodies. Inter-panel shading is therefore correctly modelled.
 
### Timezone as store state, not Site geometry
 
`timezone` is absent from the `Site` type. It lives in `useAppStore.timezone` as UI/display state because:
1. The user can change it at runtime without reloading geometry.
2. All solar calculations use `date.toDate()` (native `Date`, always UTC). Timezone never affects calculations.
3. `SiteFactory` only deals with geometry — injecting a display concern would violate separation of concerns.

When the user changes timezone, `setTimezone` reconverts the `date` Dayjs object to the new timezone via `date.tz(newTimezone)`. This preserves the UTC instant (solar calculations are unchanged) while updating the displayed local time.
 
### Wall geometry — only 90° angles are supported

The application is restricted to wall configurations where every angle between adjacent wall segments is exactly 90° (or 180° for collinear segments). This constraint enables a clean, simple geometric model:

- **Collinear vertices** (angle = 180°): no intersection post is created. These vertices are structurally valid and exist to allow adjacent wall segments to have different heights or railing configurations. They add no information to the floor outline and are therefore omitted from `wallIntersections`.
- **All other vertices** (angle = 90° or 270°): an intersection post is always created. Every entry in `site.wallIntersections` is rendered.

If the configuration contains non-90° angles, `SiteFactory` populates `angleWarnings` with `AngleWarning` objects, each carrying the three config-space coordinates of the offending vertex and its two neighbours. The store exposes this list and `AngleWarningBanner` renders it as a human-readable list showing the actual coordinate values from config.json. Geometry is still constructed but may be visually incorrect.

### AngleWarning carries config-space coordinates, not indices

`AngleWarning` stores the three `[x, z]` coordinate pairs from the original `config.json` (`pointPrev`, `point`, `pointNext`). This makes the warning banner immediately actionable — the user can search for those exact values in their config file. Three points are needed (not two) because an angle is defined by a vertex and its two neighbours.

### `RailingUtils` — shared railing render data builder

`WallFactory` and `WallIntersectionFactory` both need to build `RailingRailRenderData` for all three railing shapes. The logic is consolidated in `RailingUtils.buildRailRenderData(shape, wallHeight, heightOffset, length, zOffset?)`, which is imported by both factories. The optional `zOffset` parameter shifts the rail centre along the wall's local Z axis; it is used by `WallFactory` when a rail extends asymmetrically at its two ends. `WallIntersectionFactory` always uses the default (`zOffset = 0`) and needs no changes when new shapes are added — only `RailingUtils` needs updating.

### Railing support distribution

Support positions are computed by `computeSupportPositions` inside `WallFactory`. Two modes:

- **Homogeneous** (no `edgeDistance`): all `count` supports are spaced evenly across the full adjusted wall length using `count + 1` equal intervals.
- **Edge-anchored** (`edgeDistance` provided): the two outermost supports are placed at exactly `edgeDistance` from each wall end. Any additional supports are distributed evenly in the remaining span between them. A minimum of 2 supports is enforced.

### Railing rail extensions

When `extendAtStart` or `extendAtEnd` is `true` for a wall's railing, the rail mesh extends beyond the adjusted wall end and overlaps the intersection post at that corner. The extension length per end is:

```
extensionLength = wallThickness / 2 − extensionGap / 2
```

With `extensionGap = 0` (the default), each rail extends by exactly `wallThickness / 2`, so the tips of two meeting rails at a corner meet flush at the post centre. A positive `extensionGap` leaves a visible gap between the rail tips.

### Wall vertex classification — isConvex and the Three.js Z inversion

Each vertex is classified by the 2D cross product of the incoming and outgoing edge direction vectors, computed in Three.js scene coordinates (where Z is negated relative to config space). This negation flips every CCW walk in config space into a CW walk in Three.js space, which inverts the sign of the cross product and therefore inverts the meaning of `isConvex`:

| `isConvex` in Three.js space | Real-world vertex type | Interior angle | Wall adjustment                            |
|------------------------------|------------------------|---------------:|--------------------------------------------|
| `false`                      | Exterior corner        |            90° | None                                       |
| `true`                       | Interior recess        |           270° | `wallThickness` at both adjacent wall ends |
| — (isStraight)               | Collinear              |           180° | None                                       |

### Wall longitudinal adjustment at interior recess vertices

Walls are displaced `thickness/2` outward along their perpendicular normal. At interior recess vertices (`isConvex = true` in Three.js coordinates) the displaced wall bodies would overlap the intersection post volume. Each wall is shortened by `wallThickness` at the end touching the recess vertex. The adjustment is stored as `adjustStart` and `adjustEnd` on the `Wall` object.

### `computeLeftHandNormal` — single implementation, shared across factories

The unit outward normal of a directed segment is computed once in `PointXZUtils.computeLeftHandNormal` and imported by all factories that need it.

### Vertex classification and angle validation in a single pass

`SiteFactory` classifies every vertex with `pointAlignedWithPreviousAndNext` in a single `.map` over `centeredPoints`. The resulting `vertexInfo` array is reused for both angle validation and geometry construction, avoiding two traversals of the same data.

### No inline styles in components

All visual styling is defined in `App.css` using class names. React components use `className` references only.

### i18n key structure

Translation keys are grouped by the component that owns them:
- `mainControls.*` — keys used exclusively by `MainControls`
- `simulationControls.*` — keys used exclusively by `SimulationControls`
- `resultsPanel.*` — keys used exclusively by `ResultsPanel`
- `angleWarning.*` — keys used by `AngleWarningBanner`
- Top-level keys (`title`, `loading`, `coordinates.*`, `footer.*`) are shared or belong to no specific component

### `Intl.supportedValuesOf` — TypeScript lib target

`Intl.supportedValuesOf('timeZone')` is part of the ES2022 Intl spec. The project's `tsconfig.app.json` sets `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, making this API available without any workarounds.

### `SiteFactory` return type

`SiteFactory.create` returns a `SiteFactoryResult` object containing both the `Site` geometry and the `angleWarnings` array. This avoids side effects and keeps all output in one place.

### `three-mesh-bvh` declaration file

`src/types/three-mesh-bvh.d.ts` extends `THREE.BufferGeometry` with the three methods that `three-mesh-bvh` patches onto the prototype. The `boundsTree` property is typed as `MeshBVH` so that `MeshBVH.serialize(geometry.boundsTree)` compiles without a cast.

### `engine/` — separation of physics from orchestration

Solar physics functions (`calculateSunState`, `calculateIncidenceFactor`, `calculatePanelOutput`, `applyStringMismatch`) live in `engine/SolarEngine.ts` and are imported by both the interactive `ShadowedScene` and the annual simulation worker. There is no duplication: the worker calls the same functions as the main thread.

`calculateInstantProduction` delegates panel normal computation to `SolarPanelConverter.toWorldNormal`, which is the single source of truth for that operation. `SolarPanelConverter` is the correct layer for converting a `SolarPanel` domain object into derived values — `SolarEngine` consuming it follows the natural dependency direction (engine uses converter, not the other way around).

Annual-specific accumulation logic (`initAccumulators`, `accumulateStep`, `finalizePanel`, `buildSetupResult`) lives in `engine/AnnualSimulationEngine.ts`. These are pure functions with no Three.js or worker dependencies — they can be tested independently and are kept separate from the physics to maintain a clear boundary between "what physics produces at one instant" and "how we aggregate across a year".

### `SolarPanelConverter.toWorldNormal` — single source of truth for panel normals

`toWorldNormal(panel: SolarPanel): Vector3` is the canonical way to derive a panel's world-space normal. It is used in two contexts:

1. **Interactive production** (`SolarEngine.calculateInstantProduction`): called once per panel per dirty frame on the main thread.
2. **Annual simulation pre-computation** (`SolarPanelConverter.toSimulationPanelData`): called once per panel before worker transfer, embedding the result in `SimulationPanelData.worldNormal` so the worker never needs to recompute it.

Having one implementation in the converter layer (which owns the `SolarPanel → derived value` transformation) and zero implementations in the engine eliminates the duplication that previously existed between `SolarEngine.getPanelNormal` and `SolarPanelConverter.toWorldNormal`.

### `ThreeUtils` — mesh serialisation and reconstruction

`serializeMesh` (main thread) and `reconstructMesh` / `reconstructMeshes` (worker) are consolidated in `utils/ThreeUtils.ts`. Both directions of the serialisation round-trip live in the same module, making it the single place to update if the BVH serialisation API changes. Both functions are DOM-free and importable in either context.

### `MeshFactory` — independent copies per worker

`MeshFactory.fromScene(scene)` traverses the scene once and returns a `{ build }` object. Each call to `build()` produces a fresh `MeshBatch` (meshes + transferables). This is the only safe pattern when multiple workers each need a zero-copy transfer: typed array buffers are detached after the first `postMessage` with the `transfer` option, so each worker must receive its own independently allocated copy. `MeshFactory` encapsulates this requirement so callers cannot accidentally reuse a transferred buffer.

### Cache key computed once per setup in `useAnnualSimulation`

The simulation cache key for each setup is computed once at the start of `run()` and stored alongside the setup reference. The same key is then passed directly to both the IndexedDB lookup and the worker payload constructor. This eliminates the double hash that would otherwise occur if the payload builder recomputed the key from scratch, and makes it impossible for the two uses to drift apart.

### `SolarPanelConverter` — world-space pre-computation

`toSimulationPanelData` and `toSimulationPanelDataArray` in `converter/SolarPanelConverter.ts` convert `SolarPanel` domain objects into `SimulationPanelData` — the shape the annual worker consumes. World-space sample point positions and the panel normal are computed once here on the main thread, avoiding repeated matrix multiplications inside the worker at every time step. The converter uses `Vector3` (from `types/geometry.ts`) as the return type of `toWorldNormal`, keeping the result decoupled from any rendering library.

### `TimeUtils` — all time utilities in one place

`utils/TimeUtils.ts` consolidates timezone resolution (`getAllTimezones`, `getBrowserTimezone`, `resolveInitialTimezone`), the `timeSteps` generator and `totalTimeSteps` helper used by the annual simulation, and `formatEta` for the progress UI. Grouping them avoids a proliferation of single-purpose utility modules and reflects that they all operate on the same domain — time.

### Simulation type naming — `SimulationPanelData` and `SimulationSamplePoint`

Types representing data sent to the annual simulation worker are named after their semantic role (`SimulationPanelData`, `SimulationSamplePoint`) rather than their transport mechanism (`WorkerPanelData`, `WorkerSamplePoint`). This makes the types reusable if the simulation strategy changes (e.g. running in the main thread for debugging) without renaming.

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
 
Three.js has no built-in concept of North, but the convention used throughout this project is **North = −Z**. Config coordinates are flipped (`z_three = −z_config`) in `SiteFactory` and `SolarPanelArrayFactory`.
 
### Site azimuth
 
- Defined in degrees, **South = 0**.
- Positive values rotate towards West; negative towards East.
- The site group in the scene is rotated by `azimuthRad` around the Y axis.
- Panel arrays have their own independent `azimuth` (absolute, not relative to site).

### Wall segment numbering
 
Segments are numbered by the index of the point that **starts** them: segment `i` runs from `wallPoints[i]` to `wallPoints[(i+1) % n]`.

### Floor outline

The floor is a flat plane. Its outline is derived from `site.wallIntersections`, which contains only non-collinear vertices. Collinear vertices carry no geometric information for a flat floor and are excluded, so the floor outline correctly represents the terrace perimeter even when wall segments are split for configuration purposes.
 
---

## 2D geometry — normals, dot product, cross product

These three operations are the building blocks for all wall geometry in this project. The implementation lives in `PointXZUtils.ts`.

### Unit normal to a segment

Given a directed segment from A to B, the **unit outward normal** for a CCW-walked polygon is always to the **left** of the direction of travel:

```
n = (-dz, dx) / |d|    (left-hand perpendicular)
```

`PointXZUtils.computeLeftHandNormal(pA, pB)` computes this for any segment.

### Dot product

For unit vectors: `dot(a, b) = cos(θ)`. Used for collinearity detection: collinear normals have dot ≈ +1.

### Cross product (2D)

```
cross(a, b) = a.x·b.z − a.z·b.x
```

Sign encodes turn direction: `> 0` = left turn (convex in CCW polygon), `< 0` = right turn (concave).

Because Three.js negates Z relative to config space, every CCW walk in config space becomes CW in Three.js coordinates, inverting the cross product sign. `isConvex = true` in Three.js coordinates therefore means an interior recess (270° interior angle) in real-world terms.

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

### Bypass diodes and zone shading

A solar panel is divided into zones each protected by a bypass diode. When a zone is shaded, its diode activates, bypassing it so the rest of the panel continues producing. A zone is considered shaded when the number of shaded sample points within it reaches the configured `threshold`.
 
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

| Shaded zones | Without optimizer                                    | With optimizer        |
|--------------|------------------------------------------------------|-----------------------|
| 0            | `basePower`                                          | `basePower`           |
| k out of n   | `basePower × (n−k)/n × 0.9` (10% mismatch penalty)  | `basePower × (n−k)/n` |
| all          | 0                                                    | 0                     |
 
### 4. String mismatch

Without optimizers, string efficiency is limited by the least-efficient panel:
```
stringEfficiency = min(power/peakKw) across all panels in the string
```
Strings where any panel has an optimizer treat every panel independently.

`applyStringMismatch` is exported from `engine/SolarEngine.ts` and shared between the interactive production calculation and the annual simulation worker.
 
---
 
## Shadow detection — Raycasting + BVH
 
### Why BVH?
 
`three-mesh-bvh` pre-organises each geometry into a Bounding Volume Hierarchy. A ray tests O(log n) nodes instead of O(n) triangles, making it practical to cast thousands of rays per frame.
 
### How it is set up
 
1. **Patch Three.js once** (`useBVH.ts`): `THREE.BufferGeometry.prototype.computeBoundsTree` and `THREE.Mesh.prototype.raycast`.
2. **Build the BVH** (`useBVH` hook): walks the scene, calls `geometry.computeBoundsTree()` on every shadow-casting mesh. Rebuilt only when `rebuildKey` changes.
3. **Cast rays** (`useShadowSampler` hook): for each sample point, transforms local → world space, sets the ray origin, calls `intersectObjects`. `firstHitOnly = true` stops BVH traversal after the first hit.
4. **Avoid GC pressure**: all `THREE.Vector3`, `THREE.Matrix4`, `THREE.Quaternion` scratch objects are allocated once at module scope and reused.

### Dirty flag
 
`ShadowedScene` only runs the raycasting pass when a `needsUpdate` ref is `true`. The flag is set by a `useEffect` watching `[sun, activeSetup, density, threshold]`.

### `three-mesh-bvh` override
 
`package.json` contains `"overrides": { "three-mesh-bvh": "^0.9.9" }`. This must be kept: `@react-three/drei` pulls in `three-mesh-bvh` as a transitive dependency. Two coexisting versions would mean only one prototype is patched, silently falling back to brute-force intersection.

---

## Annual simulation

### Overview

The annual simulation steps through every N-minute interval of a full year for all configured setups simultaneously. At each time step it casts shadow rays from every sample point, applies the same bypass-diode and string-mismatch logic as the interactive view, and accumulates energy (kWh) and shade fractions per panel broken down by month, day-of-month, and hour-of-day.

### Year selector

The UI offers the current year plus up to 5 past years. The number of past years is controlled by the `PAST_YEARS_AVAILABLE` constant in `useAppStore.ts` — changing it to expose more or fewer historical years requires no other code changes. Past years are meaningful when irradiance sources with historical data (PVGIS, Open-Meteo) are implemented.

### Irradiance source

The selector currently offers three options: geometric (no weather data), PVGIS, and Open-Meteo. At present only the geometric model is implemented — the other options are selectable in the UI and stored in the cache key so that results computed under different irradiance models are kept separate in IndexedDB. PVGIS and Open-Meteo integration are planned for a future phase.

### Worker architecture

The annual simulation runs in Web Workers to keep the main thread and 3D viewport fully responsive during a multi-minute computation.

**Why workers can run the simulation:**
Three.js math classes (`Vector3`, `Matrix4`, `Raycaster`, `Euler`) and SunCalc have no DOM or WebGL dependencies and work correctly inside a worker. Only `THREE.Scene` and rendering-related classes require the main thread. `engine/SolarEngine.ts` is importable in both contexts for this reason.

**BVH serialisation and per-worker geometry copies:**

`MeshFactory.fromScene(scene)` collects all shadow-casting meshes from the Three.js scene. Each call to `build()` produces a fresh `MeshBatch` — independent typed-array copies (positions, indices, serialised BVH, world matrix) for one worker. This ensures each worker's buffers can be zero-copy transferred via `postMessage` with the `transfer` option without detaching the data for other workers. Peak memory usage is approximately 2× the geometry size regardless of the number of workers.

The serialisation and reconstruction logic is centralised in `utils/ThreeUtils.ts` (`serializeMesh`, `reconstructMesh`, `reconstructMeshes`), making it the single place to update if the BVH API changes.

The worker reconstructs the BVH with `MeshBVH.deserialize()` and runs raycasting entirely off the main thread.

**Sample points and normals pre-computed on the main thread:**

`SolarPanelConverter.toSimulationPanelDataArray` transforms each panel's local-space sample points to world space and computes the world-space normal (via `toWorldNormal`) before transfer. This avoids repeating the matrix multiplication inside the worker at every time step. The converter produces `SimulationPanelData` objects, whose type names reflect their semantic role rather than their transport mechanism.

**Worker pool:**

```
workerCount = max(1, hardwareConcurrency − 1)
```

One core is kept free for the main thread. Each worker handles one setup. If there are more setups than available worker slots, the remaining setups wait in a queue and are dispatched as workers complete. The UI shows the number of queued setups and a per-setup progress bar with a smoothed ETA for each active worker.

**Progress reporting:**

Workers emit a `progress` message every 100 time steps. The main thread applies an exponential moving average (EMA, α = 0.2) to smooth the remaining-time estimate:

```
smoothedRemaining = 0.2 × rawRemaining + 0.8 × previousSmoothed
```

The ETA is shown only after 5% of steps are complete, to avoid wildly inaccurate early estimates. `formatEta` in `utils/TimeUtils.ts` converts seconds to a human-readable string shared by the worker orchestration and the progress UI.

### Accumulation and finalisation

`engine/AnnualSimulationEngine.ts` provides the pure functions that manage per-panel data across the year:

- `initAccumulators` — allocates zeroed 3D arrays (month × day × hour) per panel.
- `accumulateStep` — records one time step's energy and shade counts into the accumulator.
- `finalizePanel` — converts raw counts to shade fractions and produces a `PanelAnnualData`.
- `buildSetupResult` — assembles the final `SetupAnnualResult` with pre-rolled monthly totals.

These functions have no Three.js or worker dependencies and can be tested in isolation. The worker is responsible only for driving the time-step loop and calling `computeShadedZones` (which requires `THREE.Raycaster` and cannot be shared with the main-thread interactive path).

### Cache key and hashing

Every result is keyed by a `SimulationCacheKey` capturing all inputs that affect output: setup geometry hash, density, threshold, interval, location, year, and irradiance source. The geometry hash is an FNV-1a 32-bit hash over panel world positions, rotations, zones, peak power, string, and optimizer flag. `SimulationCacheUtils.buildCacheKey` and `hashCacheKey` are the only correct entry points for constructing and hashing keys. The key is computed once per setup at the start of the simulation run and reused for both the IndexedDB lookup and the worker payload.

### IndexedDB persistence

`SimulationCache` provides a Promise-based wrapper over IndexedDB. Results are stored under their hash key and survive page reloads. On the next run with the same parameters, the cached result is loaded immediately and the worker is not spawned. Storage failures (quota exceeded, private browsing) surface as rejected Promises; the caller logs a warning and continues without persistence.

### Output data model

```
PanelAnnualData.energyKwh         [month][dayOfMonth][hourOfDay]  kWh
PanelAnnualData.shadeFraction     [month][dayOfMonth][hourOfDay]  0–1
PanelAnnualData.zoneShadeFraction [zone][month][dayOfMonth][hourOfDay]  0–1
```

`SetupAnnualResult` also carries pre-rolled `monthlyTotalKwh` (array of 12) and `annualTotalKwh` for fast chart rendering without re-summing the full array.

### Annual simulation and the Canvas tree

`useAnnualSimulation` calls `useThree()` internally to access the Three.js scene for mesh serialisation. `useThree` is only available inside a `<Canvas>` subtree. `Scene.tsx` is always rendered inside `<Canvas>` in `App.tsx`, making it the correct host for this hook. The simulation is triggered by watching `isRunning` in the store: when it transitions from false to true, `Scene` calls `run()` with all configured setups.

---

## Application layout

### Two-column split

```
Desktop (≥ 1024px):
┌─────────────────────┬──────────────────────┐
│                     │                      │
│   3D Canvas         │   Results Panel      │
│   + 3D controls     │                      │
│                     │                      │
└─────────────────────┴──────────────────────┘

Mobile / narrow (< 1024px):
┌──────────────────────┐
│   3D Canvas          │
│   + 3D controls      │
├──────────────────────┤
│   Results Panel      │
└──────────────────────┘
```

The layout is implemented with CSS flexbox at `app-viewport` level. The canvas column is `flex: 1` and takes all available width when the results column is not shown. The results column is a fixed `380px` wide on desktop and expands to full width with a capped height on mobile.

### Results Panel (`ResultsPanel.tsx`)

`ResultsPanel` occupies the right column and progresses through three states:

1. **Empty + idle**: a prompt encouraging the user to run the calculation.
2. **Empty + running**: a "simulation in progress" indicator.
3. **Results available**: a ranked list of setups sorted by annual energy production (highest first), showing label and `annualTotalKwh`. Results update as each setup completes.

The panel is designed to be replaced by charts (phase 3) without structural changes — the list of text results is the placeholder content that charts will supersede.

---
 
## Timezone and DST
 
### The problem

`dayjs(string)` and `dayjs()` create objects in the **browser's local timezone**. When the browser's timezone differs from the installation's timezone, or when a DST shift occurs, the time the user enters does not match the time shown in the display.

### The solution

`makeDateInTimezone(year, month, day, hour, minute, timezone)` uses `dayjs.tz(isoString, timezone)`, which interprets the components as local time in the specified timezone. This function is the **only** correct way to construct dates from user inputs in this application.

### UTC in calculations

`date.toDate()` (native JS `Date`) always represents a UTC instant. SunCalc receives this value. Timezone never affects solar position or production calculations. The annual simulation worker uses UTC timestamps directly via `Date.UTC()`.

---
 
## Known limitations
 
- **90° wall angles only**: non-right angles produce incorrect post placement and wall overlaps. A warning lists the exact coordinate triples from config.json when violations are detected.
- **Single year for interactive view**: the date controls are constrained to the current year. The annual simulation supports past years via the year selector.
- **No diffuse irradiance**: only direct (beam) irradiance is modelled geometrically. PVGIS and Open-Meteo integration (which include diffuse and reflected components) are planned.
- **Rail extensions end in a 90° cut**: a 45° mitre would be more aesthetic but requires custom `BufferGeometry` for all three rail shapes and was not implemented.
- **`window.confirm` for stop confirmation**: the stop button uses the browser's native confirm dialog. A custom modal is straightforward to add in a future iteration.

---
 
## Lessons learned
 
### `useEffect` dependency arrays must reflect semantic intent
 
A dependency should be included if its change logically invalidates the effect's output. `showPoints` controls rendering of sample point spheres but does not affect shadow computation — it is absent from both `ShadowedScene`'s props and the shadow dirty-flag effect. The annual simulation effect in `Scene` lists only `isRunning` as a dependency: the simulation is a one-shot operation triggered by the false→true transition, and re-running it mid-flight on density or threshold changes is not desired since those controls are locked during a run.

### Memoising derived arrays that feed hooks

`allPanels` inside `ShadowedScene` is wrapped in `useMemo([activeSetup])`. Without memoisation, a new array reference is created on every render, invalidating `computeShadows` every frame.
 
### Separating factory methods by what changes
 
`PanelSetupFactory.rebuildSamplePoints` vs `create`: sample point density is the only input that changes interactively. Separate entry points make the intent explicit at the call site and avoid redundant computation.
 
### Caching scene traversal in hooks
 
`scene.traverse` is O(scene nodes). Cache the result in a `useRef` and invalidate with the same key used to rebuild the BVH — they share the same invalidation signal.

### Per-worker geometry copies, not shared transfer

When multiple workers are spawned, each must receive its own copy of the serialised geometry data. Typed array buffers are detached after the first `postMessage` with the `transfer` option — subsequent workers would receive empty buffers. `MeshFactory.fromScene(scene).build()` produces a fresh `MeshBatch` on each call, one per worker. Peak memory cost is ~2× geometry size, which is acceptable given that geometry is small compared to the simulation workload.

### Sample points pre-computed before worker transfer

World-space sample point positions depend only on each panel's world matrix, which is already available on the main thread. `SolarPanelConverter.toSimulationPanelDataArray` pre-computes them once before transfer, avoiding the matrix multiplication inside the worker at every one of the ~8,760 time steps, at the cost of a one-time allocation that is immediately transferred and freed.

### EMA for ETA smoothing

Raw remaining-time estimates are noisy because steps at solar noon (many shadow hits, more raycasts to process) take longer than steps at dawn or dusk (sun below horizon, no rays cast). An EMA with α = 0.2 smooths these bursts without introducing too much lag.
 
### The three-mesh-bvh override
 
npm `overrides` are appropriate when a package patches a shared global (a prototype) and two instances would mean only one gets patched — silently.
 
### Discriminated unions over string enums for geometry variants
 
A `kind: 'square' | 'cylinder' | 'half-cylinder'` discriminated union carries its own shape-specific parameters. A switch on `kind` is exhaustively checked by TypeScript — adding a new shape without handling it in the renderer is a compile error.

### Restricting to 90° simplifies geometry significantly

Supporting arbitrary wall angles requires bisector offsets with trigonometric formulas that diverge at near-parallel angles. Restricting to 90° collapses this to simple arithmetic. Angle validation at load time with a visible UI warning is the correct trade-off.

### FNV-1a for cache key hashing

Cryptographic hashes require the Web Crypto API and return a Promise, adding async overhead. FNV-1a is synchronous, ~10 lines, public domain, and produces negligible collision probability for the small config objects hashed here.

### `lib` vs `target` in tsconfig

`target` controls emitted JavaScript syntax. `lib` tells the TypeScript compiler which runtime APIs to expect. They are independent.

### Typing `boundsTree` as `MeshBVH`, not `unknown`

The `.d.ts` declaration for `boundsTree` must use the concrete `MeshBVH` type so that `MeshBVH.serialize(geometry.boundsTree)` compiles without a cast at the serialisation call site in `ThreeUtils.ts`.

### Shared railing render data logic in `RailingUtils`

Adding a new railing shape requires editing only `RailingUtils.buildRailRenderData`. Both `WallFactory` and `WallIntersectionFactory` get the change automatically.

### `SiteFactory` returns a result object, not just `Site`

Returning `{ site, angleWarnings }` keeps the factory free of side effects. The caller decides what to do with each part.

### `AngleWarning` carries coordinates, not indices

Showing raw 0-based indices forces the user to count positions in their config file. Storing the actual `[x, z]` pairs makes the warning immediately actionable.

### Solar engine shared between interactive view and worker

`engine/SolarEngine.ts` is imported by both `ShadowedScene` (main thread, interactive) and `AnnualSimulation.worker.ts`. This is safe because `SolarEngine` only uses Three.js math classes (`Vector3`, `Euler`, `Matrix4`) which are DOM-free. The functions that require `THREE.Scene` or `THREE.Raycaster` remain in their respective contexts (`useShadowSampler` for interactive, `computeShadedZones` in the worker) and are not shared.

### `SolarPanelConverter` is the right layer for panel normal computation

The panel world-space normal is a property derived from a `SolarPanel` domain object. The converter layer owns this derivation. `SolarEngine` consuming `SolarPanelConverter.toWorldNormal` follows the correct dependency direction: the engine calls the converter, not the other way around. This eliminated the previous duplication between `SolarEngine.getPanelNormal` and `SolarPanelConverter.toWorldNormal`.

### Cache key computed once, used twice

Computing a hash is cheap, but computing it twice from the same inputs for two different purposes (cache lookup + payload construction) is a code smell: any divergence between the two computations would produce a silent bug where the worker runs with a different key than what was checked in the cache. Structuring `run()` to compute each key once and pass it explicitly to both consumers eliminates this risk entirely.

### Naming types by role, not by transport

`SimulationPanelData` and `SimulationSamplePoint` describe what the data represents (simulation inputs for a panel / a sample point), not how it is transported (via a worker). This decouples the type contract from the implementation strategy and allows the same types to be used if the simulation is ever run in the main thread for debugging.

### `AnnualSimulationEngine` contains no I/O or orchestration

Every function in `engine/AnnualSimulationEngine.ts` is pure: given inputs, return outputs, no side effects. The worker drives the loop and emits progress messages; the engine only knows how to accumulate one step and how to finalise one panel. This separation makes the accumulation logic independently testable.

### Two-column layout with flex, no library needed

The split between the 3D canvas and the results panel is implemented with two CSS flex rules and one media query. No layout library is needed. The canvas column is `flex: 1` so it naturally expands to fill the available space when no results column is present (or when the viewport is narrow and the columns stack).