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
10. [Annual simulation — infrastructure](#annual-simulation--infrastructure)
11. [Timezone and DST](#timezone-and-dst)
12. [Known limitations](#known-limitations)
13. [Lessons learned](#lessons-learned)

---
 
## What it does
 
- Renders a rooftop installation in 3D (walls, railings with balusters, solar panels) using Three.js.
- Animates the sun's trajectory across the sky for any date and time.
- Detects which panel zones are shaded using raycasting against all shadow-casting geometry (walls, railings, supports, and other panels).
- Estimates instantaneous power output in kW, applying bypass-diode, string-mismatch and optimizer logic.
- Supports multiple installation layouts ("setups") selectable via the UI.
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
├── App.tsx                        # Root: loads config, wires canvas + UI
├── solarEngine.ts                 # Pure functions: sun state, incidence, production
├── i18n.ts                        # i18next initialisation
│
├── types/
│   ├── config.ts                  # JSON config shapes (InstallationConfiguration, ...)
│   ├── geometry.ts                # PointXZ, Vector3, Euler3, AngleWarning (renderer-agnostic)
│   ├── installation.ts            # Domain models: Site, Wall, SolarPanel, ...
│   ├── simulation.ts              # SunState, SimulationResult, annual simulation types
│   └── index.ts                   # Re-exports
│
├── factory/
│   ├── SiteFactory.ts             # Config → Site (walls, intersections, bounding radius, angle validation)
│   ├── WallFactory.ts             # Wall segment geometry + railing + supports + extensions
│   ├── WallIntersectionFactory.ts # Corner posts (all non-collinear vertices)
│   ├── PanelSetupFactory.ts       # PanelSetupConfiguration + Site → PanelSetup
│   ├── SolarPanelArrayFactory.ts  # Computes array origin, creates panels
│   ├── SolarPanelFactory.ts       # Single panel world position + render data
│   ├── SamplePointFactory.ts      # Sample points for raycasting per panel
│   └── PointXZFactory.ts          # Safe PointXZ constructor
│
├── converter/
│   └── ThreeConverter.ts          # Domain Vector3/Euler3 → THREE.Vector3/Euler
│
├── store/
│   └── useAppStore.ts             # Zustand store — all app state + actions
│
├── hooks/
│   ├── useBVH.ts                  # Builds BVH over shadow-casting meshes
│   └── useShadowSampler.ts        # Casts rays, returns ShadowMap
│
├── db/
│   └── simulationCache.ts         # IndexedDB wrapper for SetupAnnualResult persistence
│
├── workers/
│   └── annualSimulation.worker.ts # Annual simulation Web Worker (Phase 0: ping/pong scaffold)
│
├── utils/
│   ├── hash.ts                    # FNV-1a 32-bit hash — deterministic cache key generation
│   ├── simulationCacheKey.ts      # buildCacheKey() and hashCacheKey() for simulation results
│   ├── PointXZUtils.ts            # computeLeftHandNormal, convexity, right-angle check, prev/next helpers
│   ├── RailingUtils.ts            # Shared railing rail render data builder
│   └── TimezoneUtils.ts           # getAllTimezones(), getBrowserTimezone(), resolveInitialTimezone()
│
├── components/
│   ├── Scene.tsx                  # Root 3D scene (walls + panels + helpers)
│   ├── ShadowedScene.tsx          # Dirty-flag raycasting loop, feeds ShadowMap
│   ├── SolarPanelComponent.tsx    # Single panel render (purely presentational)
│   ├── Sun.tsx                    # Sun sphere + directional light
│   ├── Compass.tsx                # N/S/E/W labels in 3D
│   ├── MainControls.tsx           # Date/time/play UI panel
│   ├── SimulationControls.tsx     # Simulation settings UI panel
│   ├── AngleWarningBanner.tsx     # Warning banner listing non-90° angle coordinate triples
│   └── DeveloperFooter.tsx        # Ko-fi link + personal site
│
└── _phase0_validation/            # TEMPORARY — delete when Phase 1 begins
    └── phase0Validations.ts       # Exercises BVH round-trip, IndexedDB, worker, SunCalc
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

- **Homogeneous** (no `edgeDistance`): all `count` supports are spaced evenly across the full adjusted wall length using `count + 1` equal intervals. This matches the classic "divide the wall into equal segments" mental model.
- **Edge-anchored** (`edgeDistance` provided): the two outermost supports are placed at exactly `edgeDistance` from each wall end. Any additional supports are distributed evenly in the remaining span between them. A minimum of 2 supports is enforced — a single support cannot hold a railing.

The mode is selected by the presence of `edgeDistance` in the config. Both modes operate on `currentDist` (the adjusted wall length), never on the extended rail length.

### Railing rail extensions

When `extendAtStart` or `extendAtEnd` is `true` for a wall's railing, the rail mesh extends beyond the adjusted wall end and overlaps the intersection post at that corner. The extension length per end is:

```
extensionLength = wallThickness / 2 − extensionGap / 2
```

With `extensionGap = 0` (the default), each rail extends by exactly `wallThickness / 2`, so the tips of two meeting rails at a corner meet flush at the post centre. A positive `extensionGap` leaves a visible gap between the rail tips.

The extension is implemented by computing a longer `railLength` and a `railZOffset` to keep the mesh centred within the wall group. `RailingUtils.buildRailRenderData` accepts the optional `zOffset` parameter for this purpose. Supports are always placed along `currentDist`, not along the extended portion.

Extensions use a straight 90° cut at the tip. A 45° mitre cut was evaluated but requires a custom `BufferGeometry` for all three rail shapes (square, cylinder, half-cylinder) and was deemed disproportionate to the visual benefit.

### `extensionGap` inheritance — defaults and overrides

`extensionGap`, `extendAtStart`, and `extendAtEnd` follow the same defaults-then-override pattern as all other railing fields: set once in `railingDefaults` to apply to every wall, then override per wall in `wallsSettings`. This is consistent with how `heightOffset`, `shape`, and `support` work, and requires no special handling in the factory.

### Wall vertex classification — isConvex and the Three.js Z inversion

Each vertex is classified by the 2D cross product of the incoming and outgoing edge direction vectors, computed in Three.js scene coordinates (where Z is negated relative to config space). This negation flips every CCW walk in config space into a CW walk in Three.js space, which inverts the sign of the cross product and therefore inverts the meaning of `isConvex`:

| `isConvex` in Three.js space | Real-world vertex type | Interior angle | Wall adjustment                            |
|------------------------------|------------------------|---------------:|--------------------------------------------|
| `false`                      | Exterior corner        |            90° | None                                       |
| `true`                       | Interior recess        |           270° | `wallThickness` at both adjacent wall ends |
| — (isStraight)               | Collinear              |           180° | None                                       |

The post position is computed as `(normalPrev + normalNext) × thickness/2`, where `normalPrev` and `normalNext` are the unit outward normals of the two adjacent wall segments. For 90° angles this equals `thickness/2` in each of the two perpendicular directions, placing the post centre exactly at the intersection of the two displaced wall centre-lines.

### Wall longitudinal adjustment at interior recess vertices

Walls are displaced `thickness/2` outward along their perpendicular normal. At interior recess vertices (`isConvex = true` in Three.js coordinates) the displaced wall bodies would overlap the intersection post volume. Each wall is shortened by `wallThickness` at the end touching the recess vertex. The adjustment is stored as `adjustStart` and `adjustEnd` on the `Wall` object. Both are always non-negative (shortening only).

### `computeLeftHandNormal` — single implementation, shared across factories

The unit outward normal of a directed segment is computed once in `PointXZUtils.computeLeftHandNormal` and imported by all factories that need it. The name encodes the geometric contract: the result is the left-hand perpendicular of the direction of travel, which is the outward direction for a CCW-walked polygon.

### Vertex classification and angle validation in a single pass

`SiteFactory` classifies every vertex with `pointAlignedWithPreviousAndNext` in a single `.map` over `centeredPoints`. The resulting `vertexInfo` array is reused for both angle validation and geometry construction, avoiding two traversals of the same data.

### No inline styles in components

All visual styling is defined in `App.css` using class names. React components use `className` references only. The Phase 0 validation button in `SimulationControls` is a temporary exception — the button and its inline style are removed when `_phase0_validation` is deleted.

### i18n key structure

Translation keys are grouped by the component that owns them:
- `mainControls.*` — keys used exclusively by `MainControls`
- `simulationControls.*` — keys used exclusively by `SimulationControls`
- `angleWarning.*` — keys used by `AngleWarningBanner`
- Top-level keys (`title`, `loading`, `coordinates.*`, `footer.*`) are shared or belong to no specific component

The `angleWarning.tripletLabel` key uses i18next interpolation (`{{prev}}`, `{{point}}`, `{{next}}`) to format the three coordinate pairs. The format string can be adjusted per language without changing any component code.

### `Intl.supportedValuesOf` — TypeScript lib target

`Intl.supportedValuesOf('timeZone')` is part of the ES2022 Intl spec. The project's `tsconfig.app.json` sets `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, making this API available without any workarounds. The `target` remains `ES2020` — `lib` and `target` are independent: `target` controls emitted JavaScript syntax, `lib` tells the TypeScript compiler which runtime APIs to expect.

### `SiteFactory` return type

`SiteFactory.create` returns a `SiteFactoryResult` object containing both the `Site` geometry and the `angleWarnings` array. This avoids side effects and keeps all output in one place. The store's `loadConfig` action destructures the result.

### `three-mesh-bvh` declaration file

`src/types/three-mesh-bvh.d.ts` extends `THREE.BufferGeometry` with the three methods that `three-mesh-bvh` patches onto the prototype: `computeBoundsTree`, `disposeBoundsTree`, and `boundsTree`. The `boundsTree` property is typed as `MeshBVH` (imported from `three-mesh-bvh`), not as `unknown`. This allows `MeshBVH.serialize(geometry.boundsTree)` to be called in the BVH serialisation code without a cast — the compiler knows the type and can check the call site. Declaration files (`.d.ts`) contain only type information and produce no JavaScript output; they exist solely to tell the TypeScript compiler about runtime APIs that are not part of the library's own type definitions.

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
 
Walk the perimeter **counter-clockwise** when viewed from above (i.e. South-West corner first):
 
```
SW (0) → S (1) → SE (2) → E (3) → NE (4) → N (5) → NW (6) → W (7) → back to SW
```
 
Use segment indices in `wallsSettings` to override height, railing, or apply trim to specific walls.

### Floor outline

The floor is a flat plane. Its outline is derived from `site.wallIntersections`, which contains only non-collinear vertices. Collinear vertices carry no geometric information for a flat floor and are excluded, so the floor outline correctly represents the terrace perimeter even when wall segments are split for configuration purposes.
 
---

## 2D geometry — normals, dot product, cross product

These three operations are the building blocks for all wall geometry in this project. The implementation lives in `PointXZUtils.ts`.

### Unit normal to a segment

A **normal** to a line segment is a vector perpendicular to it. A **unit** normal has length exactly 1.

Given a directed segment from A to B:

```
A ──────────────► B
direction d = (dx, dz) = B - A
```

There are always two perpendicular directions: left and right of the direction of travel. For a polygon walked **counter-clockwise** (CCW), the **outward** normal — pointing away from the interior — is always to the **left**:

```
         outward normal
              ↑
A ──────────────► B
```

**Formula** (rotate direction vector 90° counter-clockwise):
```
d = (dx, dz) / |d|          unit direction
n = (-dz, dx)                left-hand perpendicular (already unit length if d is unit)
```

**Example**: a wall going East, `d = (1, 0)`:
- Unit direction: `(1, 0)`
- Left-hand normal: `(0, 1)` → pointing South in Three.js (+Z = South)
- For a wall on the south side of a CCW floor, South is indeed outward ✓

`PointXZUtils.computeLeftHandNormal(pA, pB)` computes this for any segment.

### Dot product

```
dot(a, b) = a.x·b.x + a.z·b.z = |a|·|b|·cos(θ)
```

For **unit vectors**: `dot(a, b) = cos(θ)` where θ is the angle between them.

| dot value | angle θ | meaning             |
|----------:|--------:|---------------------|
|        +1 |      0° | same direction      |
|         0 |     90° | perpendicular       |
|        −1 |    180° | opposite directions |

**Used for collinearity detection**: if two adjacent wall segments are collinear, their outward normals point in the same direction → `dot(normalPrev, normalNext) ≈ +1`.

### Cross product (2D)

The 2D cross product is the Z component of the 3D cross product:

```
cross(a, b) = a.x·b.z − a.z·b.x
```

Its **sign** encodes the rotation direction from `a` to `b`:
- `cross > 0` → `b` is to the LEFT of `a` (CCW rotation, left turn)
- `cross < 0` → `b` is to the RIGHT of `a` (CW rotation, right turn)
- `cross = 0` → parallel vectors

**Applied to a polygon vertex**: compute the cross product of the incoming and outgoing edge directions:

```
         pPrev
           │
           │  incoming edge direction
           ↓
           p ──────────► pNext
                outgoing edge direction

cross(incoming, outgoing) > 0  →  left turn  →  convex vertex (CCW polygon)
cross(incoming, outgoing) < 0  →  right turn →  concave vertex (CCW polygon)
```

### The Three.js Z inversion effect on cross product sign

Config space uses `+Z = North`. Three.js uses `+Z = South`, so the Z axis is negated when converting. This negation **flips every CCW walk in config space into a CW walk** in Three.js coordinates:

```
Config space (CCW walk):    Three.js space (CW walk after Z flip):
     ┌───────────►                 ◄───────────┐
     │           │                 │           │
     │           │       →         │           │
     │           │                 │           │
     └───────────┘                 └───────────┘
```

A CW walk inverts the sign of every cross product, and therefore inverts `isConvex`:

| `isConvex` in Three.js | Real-world meaning | Interior angle |
|---|---|---|
| `false` | Exterior corner | 90° outward |
| `true` | Interior recess | 270° inward |

This is why `SiteFactory.computeAdjust` applies wall shortening when `isConvex = true`, not when `isConvex = false`.

### Worked example: L-shaped floor

```
Config space wallPoints (CCW walk, +Z = North):

 (0,8)  ───────────────  (3,8)
       │               │
       │               │
 (0,5)  ───── (1,5)    | (3,5)
             │         |
             │         |
 (0,2)  ───── (1,2)    |
       |               |
 (0,0) ────────────────  (3,0)

Segment walk: (0,0) → (3,0) → (3,5) → (3,8) → (0,8) → (0,5) → (1,5) → (1,2) → (0,2) → (0,0)
```

At the interior recess vertex `(0,5)`:
- Incoming direction: `(0,−1)` (going South in config = going North in Three.js after Z flip)
- Outgoing direction: `(1,0)` (going East)
- Config cross product: `0·0 − (−1)·1 = +1` → left turn → convex in CCW
- Three.js cross product (Z negated): sign flipped → `isConvex = true` → interior recess ✓

The wall shortening is applied at the ends of the two walls meeting at `(0,5)` to prevent the displaced wall bodies from overlapping the intersection post.

---
 
## Configuration reference
 
```json
{
  "site": {
    "location": { "latitude": 40.62, "longitude": -4.01 },
    "azimuth": 0,           // degrees, South=0, positive=West
    "timezone": "Europe/Madrid",
    "wallPoints": [[0,0], [3.7,0], ...],  // metres, +X=East, +Z=North
    "wallDefaults": { "height": 0.7, "thickness": 0.2 },
    "railingDefaults": {
      "active": true,
      "heightOffset": 0.18,
      "extendAtStart": false,    // extend rail over start-end intersection post
      "extendAtEnd": false,      // extend rail over end intersection post
      "extensionGap": 0,         // metres gap between two meeting extensions (default 0 = flush)
      "shape": { "kind": "cylinder", "radius": 0.025 },
      "support": {
        "shape": { "kind": "cylinder", "radius": 0.012 },
        "count": 3,
        "edgeDistance": 0.15    // optional: metres from wall end to nearest support
      }
    },
    "wallsSettings": [
      {
        "wall": 2,
        "override": {
          "height": 1.8,
          "railing": {
            "active": false
          }
        }
      },
      {
        "wall": 5,
        "override": {
          "railing": {
            "extendAtStart": true,
            "extendAtEnd": true,
            "extensionGap": 0.01,
            "support": {
              "count": 4,
              "edgeDistance": 0.1
            }
          }
        }
      }
    ]
  },
  "setups": [...]
}
```

#### Support distribution modes

Two modes are available depending on whether `edgeDistance` is set:

| `edgeDistance` | Behaviour                                                                                                                                |
|----------------|------------------------------------------------------------------------------------------------------------------------------------------|
| omitted        | Supports distributed homogeneously: `count` supports at intervals of `wallLength / (count + 1)`                                          |
| provided       | Two outermost supports at `edgeDistance` from each end; remaining supports distributed evenly between them. Minimum 2 supports enforced. |

#### Rail extensions

When `extendAtStart` or `extendAtEnd` is `true`, the rail overhangs the intersection post at that corner. Extension length per end:

```
extensionLength = wallThickness / 2 − extensionGap / 2
```

With `extensionGap = 0` (default), two meeting rails at the same corner post meet flush at the post centre. Setting `extensionGap` to a small positive value (e.g. `0.01`) leaves a visible gap between them.

Extensions end in a 90° cut. Supports are placed along the non-extended wall length only.
 
### Railing shapes
 
| kind            | Parameters                            | Three.js geometry                                        |
|-----------------|---------------------------------------|----------------------------------------------------------|
| `square`        | `width`, `height`                     | `BoxGeometry(width, height, wallLength)`                 |
| `cylinder`      | `radius`                              | `CylinderGeometry(r, r, wallLength, 8)`                  |
| `half-cylinder` | `radius`, `orientation: 'up'\|'down'` | `CylinderGeometry(r, r, len, 8, 1, true, thetaStart, π)` |
 
### Railing support shapes
 
| kind       | Parameters                                           |
|------------|------------------------------------------------------|
| `square`   | `width`, `depth` (height derived from wall geometry) |
| `cylinder` | `radius`                                             |
 
### `zonesDisposition`
 
| Value        | Layout                     | Split axis |
|--------------|----------------------------|------------|
| `horizontal` | Zones are horizontal bands | Z (height) |
| `vertical`   | Zones are vertical columns | X (width)  |
 
---
 
## Solar production model

### Bypass diodes and zone shading

A solar panel is not a single electrical component. It is an array of cells connected in series, divided into zones each protected by a bypass diode.

- **No shade**: current flows through all cells at full power.
- **Shade on one zone**: the diode for that zone activates, bypassing it electrically so the rest of the panel continues producing. If 1 of 2 zones is shaded the panel produces 50% of its potential output; with 1 of 3 zones shaded it produces 66.6%.
- A zone is considered shaded as soon as the number of shaded sample points within it reaches the configured `threshold`. The threshold allows partial shadow to be ignored (e.g. dappled light from a tree) without treating the zone as fully bypassed.
 
### 1. Sun position
 
`suncalc.getPosition(date, lat, lon)` returns altitude (elevation above horizon in radians) and azimuth (clockwise from South in radians). These are converted to a Three.js direction vector:
 
```ts
x =  cos(altitude) * sin(-azimuth)   // East (+) / West (−)
y =  sin(altitude)                    // Up
z =  cos(altitude) * cos(azimuth)    // South (+) / North (−) in Three.js
```
 
Calculations always receive `date.toDate()` (UTC). Timezone is display-only.
 
### 2. Incidence factor
 
Panel output scales with the cosine of the angle between the sun direction and the panel normal (Lambert's cosine law):
 
```
incidenceFactor = max(0, dot(sunDirection, panelNormal))
basePower (kW)  = peakPower (Wp) / 1000 × incidenceFactor
```
 
If the sun is behind the panel the dot product is negative, clamped to 0.
 
### 3. Zone shading
 
Each panel is divided into `zones` diode zones. A NxN grid of sample points is cast toward the sun via raycasting. A zone is considered **shaded** if the number of shaded sample points reaches the configured `threshold`. Raycasting tests against all shadow-casting geometry in the scene, including other solar panels.
 
### 4. Panel output with bypass diodes

| Shaded zones | Without optimizer                                   | With optimizer        |
|--------------|-----------------------------------------------------|-----------------------|
| 0            | `basePower`                                         | `basePower`           |
| k out of n   | `basePower × (n−k)/n × 0.9` (−10% mismatch penalty) | `basePower × (n−k)/n` |
| all          | 0                                                   | 0                     |

The 10% mismatch penalty for non-optimized panels models the voltage mismatch loss that occurs when some bypass diodes are active and the remaining cells must operate at a sub-optimal voltage to match the inverter's operating point.
 
### 5. String mismatch

Panels in the same string without optimizers are connected in series. Current flows like water in a pipe — the flow rate is set by the narrowest point. The string efficiency is limited by the least-efficient panel:

```
stringEfficiency = min(power/peakKw) across all panels in the string
each panel output = peakKw × stringEfficiency
```

Strings where every panel has an optimizer are treated as independent — each panel produces at its own efficiency. The optimizer performs DC/DC conversion per panel, isolating each one from the string's current constraint.

**Example without optimizer (3 panels, one panel loses 1 of 2 zones):**
```
Panel A: 100% efficient
Panel B:  50% efficient (1 zone shaded, no optimizer → 50% × 0.9 mismatch = 45%)
Panel C: 100% efficient

String efficiency = min(100%, 45%, 100%) = 45%
→ All three panels produce at 45% of basePower
```

**Example with optimizer (same scenario):**
```
Panel A: 100% → produces basePower
Panel B:  50% → produces 0.5 × basePower  (no mismatch penalty)
Panel C: 100% → produces basePower
Total = 2.5 × basePower  (vs 1.35 × basePower without optimizer)
```

### 6. String grouping with mixed optimizers

A string where at least one panel has an optimizer is treated as a fully independent string — each panel produces at its individual efficiency regardless of the others. This models the typical real-world deployment where optimizers are installed selectively on the most shadow-prone panels, and the inverter can accommodate the resulting voltage range.
 
---
 
## Shadow detection — Raycasting + BVH
 
### Why BVH?
 
Without acceleration, `raycaster.intersectObjects` tests every ray against every triangle in the scene — O(rays × triangles). For a scene with hundreds of wall and panel faces, and thousands of sample points, this is too slow for interactive use.
 
`three-mesh-bvh` pre-organises each geometry into a **Bounding Volume Hierarchy**: a tree of axis-aligned bounding boxes where each leaf contains a small subset of triangles. A ray only needs to test O(log n) nodes instead of O(n) triangles.

```
Scene triangles without BVH:          Scene triangles with BVH:
                                              [root AABB]
  △△△△△△△△△△△△△△△△△△△△                     /           \
  (test all O(n) triangles)          [left AABB]       [right AABB]
                                     /      \           /       \
                                  [AABBs] [AABBs]  [AABBs]   [AABBs]
                                  △△△      △△△       △△        △△△△
                                  (test only O(log n) leaf triangles)
```
 
### How it is set up
 
1. **Patch Three.js once** (`useBVH.ts`):
   ```ts
   THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
   THREE.Mesh.prototype.raycast = acceleratedRaycast;
   ```
   After this, every `Mesh.raycast` call automatically uses BVH if a bounds tree exists.
2. **Build the BVH** (`useBVH` hook): walks the scene, calls `geometry.computeBoundsTree()` on every shadow-casting mesh. Rebuilt only when `rebuildKey` changes (site or setup change).
3. **Cast rays** (`useShadowSampler` hook): for each sample point, transforms its local position to world space using the panel's pre-computed world matrix, sets the ray origin, and calls `intersectObjects`. `firstHitOnly = true` stops BVH traversal after the first hit.
4. **Avoid GC pressure**: all `THREE.Vector3`, `THREE.Matrix4`, `THREE.Quaternion` scratch objects are allocated **once at module scope** and reused for every ray.

### Dirty flag
 
`ShadowedScene` only runs the full raycasting pass when a `needsUpdate` ref is `true`. The flag is set by a `useEffect` that watches `[sun, activeSetup, density, threshold]`. Between frames where nothing changes, `useFrame` is a no-op.
 
### What is included in shadow casting
 
Every mesh with `castShadow={true}` is included in the raycasting:
- Wall bodies
- Railing rails (all shapes)
- Railing supports (balusters)
- Solar panel bodies

Inter-panel shading (one panel casting a shadow on another) is naturally modelled without any special handling.
 
### BVH and three-mesh-bvh override
 
`package.json` contains:
```json
  "overrides": { "three-mesh-bvh": "^0.9.9" }
```
 
**Must be kept.** `@react-three/drei` pulls in `three-mesh-bvh` as a transitive dependency without pinning a version. The BVH integration patches `THREE.BufferGeometry.prototype` and `THREE.Mesh.prototype` — if two versions coexist, only one is patched and the other falls back to brute-force intersection silently.

---

## Annual simulation — infrastructure

The annual simulation runs in a Web Worker to keep the main thread and 3D viewport fully responsive during a potentially multi-minute computation. The infrastructure is in place; the simulation loop itself is implemented in Phase 1.

### Cache key and hashing

Every simulation result is keyed by a `SimulationCacheKey` object that captures every input that affects the output: setup geometry hash, density, threshold, interval, location, year, and irradiance source. Two runs with the same key are guaranteed to produce identical output.

The geometry hash is computed with FNV-1a (`src/utils/hash.ts`) over a JSON serialisation of each panel's world position, rotation, zones, peak power, string, and optimizer flag. FNV-1a was chosen for its public-domain status, zero dependencies, and compact 8-character hex output.

`buildCacheKey` and `hashCacheKey` in `src/utils/simulationCacheKey.ts` are the only correct way to construct and hash cache keys.

### IndexedDB persistence

`src/db/simulationCache.ts` provides a Promise-based wrapper over the native IndexedDB API. The database has a single object store keyed by `cacheKey`. All operations (`saveResult`, `getResult`, `listResults`, `deleteResult`, `clearAllResults`) open the database on demand and close it automatically — there is no persistent connection to manage.

Storage failures (quota exceeded, private-browsing restrictions) surface as rejected Promises. Callers that only need best-effort caching can catch and discard the error.

### Web Worker

`src/workers/annualSimulation.worker.ts` is imported with Vite's `?worker` suffix, which bundles the worker as a separate chunk. Three.js and SunCalc are imported directly inside the worker — neither has DOM or WebGL dependencies, so both work correctly in a worker context.

The worker currently implements a ping/pong protocol for Phase 0 validation. The response includes diagnostics: Three.js version, SunCalc availability, `navigator.hardwareConcurrency`, and the recommended worker count formula (`max(1, min(hardwareConcurrency − 1, setupCount))`).

### BVH serialisation (Phase 1 prerequisite)

The BVH for each shadow-casting mesh will be serialised on the main thread with `MeshBVH.serialize()` and transferred to the worker via `postMessage` with the `transfer` option (zero-copy typed array transfer). The worker will reconstruct the BVH with `MeshBVH.deserialize()` and run the raycast loop entirely off the main thread. The `boundsTree` property on `THREE.BufferGeometry` is typed as `MeshBVH` (not `unknown`) in `src/types/three-mesh-bvh.d.ts`, enabling this call without a cast.

### Phase 0 validation

`src/_phase0_validation/phase0Validations.ts` exercises all five technical assumptions before Phase 1 is built:

1. BVH serialise → deserialise → raycast round-trip (main thread, checks hit distance matches).
2. Three.js imports correctly inside a Vite `?worker` bundle.
3. SunCalc is DOM-free and works in a worker.
4. IndexedDB write/read round-trip with latency measurement.
5. `navigator.hardwareConcurrency` heuristic produces sensible values.

Run by clicking "Phase 0 — Run validations (console)" in the Simulation Controls panel and inspecting the browser console. **Delete `src/_phase0_validation/` when Phase 1 begins.**
 
---
 
## Timezone and DST
 
### The problem

`dayjs(string)` and `dayjs()` create objects in the **browser's local timezone**. When the browser's timezone differs from the installation's timezone, or when a DST shift occurs, the time the user enters does not match the time shown in the display.

### The solution

`makeDateInTimezone(year, month, day, hour, minute, timezone)` uses `dayjs.tz(isoString, timezone)`, which interprets the components as local time in the specified timezone. This function is the **only** correct way to construct dates from user inputs in this application.

When the user changes timezones, `setTimezone` calls `date.tz(newTimezone)` on the current `Dayjs` object. This preserves the UTC instant (solar calculations unchanged) and updates the displayed local time.

### geo-tz — discarded for browser

`geo-tz` is the most accurate library for inferring timezones from GPS coordinates, but it reads geographic data from disk at runtime and is not compatible with browser bundlers. Its data (~10 MB of GeoJSON) cannot be included in a static GitHub Pages bundle.

**Implemented solution**: `Intl.supportedValuesOf('timeZone')` (native ES2022, no dependencies) for the full IANA timezone list. The initial preset is the browser's detected timezone. The user confirms or changes it via the UI selector.

### UTC in calculations

`date.toDate()` (native JS `Date`) always represents a UTC instant. SunCalc receives this value. Timezone never affects solar position or production calculations.

---
 
## Known limitations
 
- **90° wall angles only**: non-right angles produce incorrect post placement and wall overlaps. A warning lists the exact coordinate triples from config.json when violations are detected.
- **Single year**: time controls are constrained to the current year.
- **No diffuse irradiance**: only direct (beam) irradiance is modelled.
- **Rail extensions end in a 90° cut**: a 45° mitre would be more aesthetic but requires custom `BufferGeometry` for all three rail shapes and was not implemented.

---
 
## Lessons learned
 
### `useEffect` dependency arrays must reflect semantic intent
 
A dependency should be included if its change logically invalidates the effect's output — not merely because it is read inside the effect. `showPoints` controls rendering of sample point spheres but does not affect shadow computation; it is absent from both `ShadowedScene`'s props and from the shadow dirty-flag effect. Always document intentional omissions with a comment.

### Memoising derived arrays that feed hooks

`allPanels` inside `ShadowedScene` is the result of `flatMap` over `activeSetup.panelArrays`. Without `useMemo`, this array is a new object reference on every render, which invalidates the `panels` identity inside `useShadowSampler` and causes `computeShadows` to be recreated every frame. Wrapping it in `useMemo([activeSetup])` means the identity is stable between renders unless the setup actually changes.
 
### Separating factory methods by what changes
 
`PanelSetupFactory.rebuildSamplePoints` vs `create`: sample point density is the only input that changes interactively. Panel geometry is stable between density changes. Separate entry points make the intent explicit at the call site and avoid redundant computation.
 
### Caching scene traversal in hooks
 
`scene.traverse` is O(scene nodes). Cache the result in a `useRef` and invalidate with the same key used to rebuild the BVH — they share the same invalidation signal and must always be in sync.
 
### The three-mesh-bvh override
 
npm `overrides` are appropriate when a package patches a shared global (a prototype) and two instances would mean only one gets patched — silently. This is the semantically correct declaration that this package must have exactly one instance in the dependency tree.
 
### Discriminated unions over string enums for geometry variants
 
A `kind: 'square' | 'cylinder' | 'half-cylinder'` discriminated union carries its own shape-specific parameters with no casts needed. A switch on `kind` is exhaustively checked by TypeScript — adding a new shape without handling it in the renderer is a compile error, not a runtime surprise.
 
### Wall vertex classification via cross product
 
The 2D cross product of the incoming and outgoing edge directions at a vertex cleanly separates the three geometrically distinct cases in a single operation. Because Three.js negates Z relative to config space, the sign convention is inverted: `isConvex = true` in Three.js coordinates corresponds to an interior recess in real-world terms.

### Restricting to 90° simplifies geometry significantly

Supporting arbitrary wall angles requires bisector offsets with trigonometric formulas that diverge at near-parallel angles. Restricting to 90° collapses this to: post offset = `(normalPrev + normalNext) × thickness/2` and wall shortening at interior recess corners = exactly `wallThickness`. Angle validation at load time with a visible UI warning is the correct trade-off.

### Wall adjustment naming: `adjust` not `trim`

`trim` implies only shortening. `adjustStart`/`adjustEnd` better reflects that the field is a geometric correction (which happens to always be a positive shortening for 90° configurations, but the name should not encode that assumption).

### Collinear vertices excluded from `wallIntersections`

Collinear wall points (180°) are valid configuration — they allow adjacent segments to differ in height or railing. However, they add no geometric information to the floor outline and require no intersection post. Excluding them keeps `wallIntersections` semantically clean: every entry is a rendered post.

### `SiteFactory` returns a result object, not just `Site`

Returning `{ site, angleWarnings }` keeps the factory free of side effects. The caller (`loadConfig`) decides what to do with each part. This pattern generalises to any future metadata the factory needs to return.

### `AngleWarning` carries coordinates, not indices

Showing raw 0-based indices forces the user to count positions in their config file. Storing the actual `[x, z]` pairs makes the warning immediately actionable.

### Shared railing render data logic in `RailingUtils`

Adding a new railing shape requires editing only `RailingUtils.buildRailRenderData`. Both `WallFactory` and `WallIntersectionFactory` get the change automatically. The `zOffset` parameter is optional (defaults to 0) so `WallIntersectionFactory` needs no changes when wall extensions are added.

### Rail extensions versus mitre cuts

A 45° mitre cut at rail extension tips would look more aesthetic where two rails meet at a corner post. However, computing the correct mitre geometry requires a custom `BufferGeometry` for each of the three rail shapes (box, cylinder, half-cylinder), each with different vertex layouts. The engineering cost is disproportionate to the visual benefit for an application focused on solar production analysis. A 90° cut is implemented and the limitation is documented.

A 45° mitre cut at rail extension tips would look more aesthetic where two rails meet at a corner post. However, computing the correct mitre geometry requires a custom `BufferGeometry` for each of the three rail shapes (box, cylinder, half-cylinder), each with different vertex layouts. The engineering cost is disproportionate to the visual benefit for an application focused on solar production analysis. A 90° cut is implemented and the limitation is documented.

### Support `edgeDistance` versus homogeneous distribution

The original support distribution was purely homogeneous (equal intervals along the wall). Edge-anchored distribution with `edgeDistance` is more realistic for physical installations where supports must clear the corner posts. The two modes coexist: omitting `edgeDistance` preserves the original behaviour exactly.

### FNV-1a for cache key hashing

Cryptographic hashes (SHA-256) require the Web Crypto API and return a Promise, adding async overhead at a point in the code where synchronous execution is simpler. FNV-1a is synchronous, fits in ~10 lines, is public domain, and produces collisions only with astronomically low probability for the small config objects hashed here.

### `lib` vs `target` in tsconfig

`target` controls emitted JavaScript syntax. `lib` tells the TypeScript compiler which runtime APIs to expect. They are independent. Raising `lib` to ES2022 to unlock `Intl.supportedValuesOf` does not change the compiled output — it only adds type definitions.

### `computeLeftHandNormal` — one implementation, used everywhere

The outward normal of a wall segment is computed in exactly one place. When geometry behaviour needs to change, there is exactly one place to change it.

### i18n keys grouped by owning component

Grouping keys under the component that owns them avoids naming collisions and makes it immediately clear where each string is used as the translation file grows.

### Typing `boundsTree` as `MeshBVH`, not `unknown`

The `.d.ts` declaration for `boundsTree` must use the concrete `MeshBVH` type so that `MeshBVH.serialize(geometry.boundsTree)` compiles without a cast. `unknown` requires a type assertion at every call site, which defeats the purpose of having the declaration file in the first place. Importing `MeshBVH` from `three-mesh-bvh` inside a `.d.ts` file is valid — declaration files can import types from other modules.