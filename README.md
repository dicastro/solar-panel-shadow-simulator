# Instructions
 
* Quiero que revises el apartado "To Review" de este mismo fichero donde están los puntos que quiero que revises antes de continuar con las tareas de Open Tasks. Tras procesar todo el apartado "To Review" inspecciona el código para comprender mejor lo que se dice antes de ponerte a cambiar código. Si tras hacer esto tienes alguna duda o no entiendes algo de lo que se dice o no coincide lo que se dice con el código, pregúntame antes de proponer ningún cambio de código.
* Quiero una solución de alta calidad técnica y que lo que haya programado tenga su sentido y que sea defendible ante cualquier programador/desarrollador/arquitecto experto en el stack tecnológico del proyecto.
* Tras los cambios de código que se hagan debería de actualizarse el README en consecuencia para reflejar las decisiones tomadas, cambios de configuración, cambios de arquitectura, etc. cualquier cosa que sea relevante y que encaje con lo que se escribe en el README
* El criterio para actualizar el README es siempre con la idea de complementar lo existente (o adaptarlo si es necesario). La idea no es que el README refleje únicamente los los cambios que se están realizando. Se tiene que hacer un ejercicio de "merge" entre el contenido existente en el README y los cambios que se han realizado. Todo el contenido del README tiene que estar en inglés.
* El criterio para actualizar los comentarios del código. Los comentarios del código tienen que ser explicativos, no tienen que hacer referencia al refactor que se está haciendo, incluyendo frases como: introducido para..., antes del refactor se hacía..., ahora se hace... Y si ya hay comentarios previos en el código que siguen teniendo sentido tras los cambios que se hagan hay que dejarlos. No quiero comentarios que sirvan para marcar inicios de secciones, por ejemplo en las definiciones de clases, un comentario que simplemente diga que debajo de esta línea hay clases de cierto ámbito, esto con el tiempo no se respeta y deja de tener sentido el comentario
* Estas instrucciones están en en español, y puede que la sección "To Review" o la de "Open Tasks" tenga mezcla de inglés o de español. A la hora de programar código y comentarlo y actualizar el README será siempre en inglés todo.
* Al actualizar el README deja las secciones iniciales "Instructions", "To Review" y "Open Tasks" intactas, ya me encargo yo de poner esto al día. Actualiza a partir de la sección "Solar Panel Shadow Simulator"
* Si tienes discrepancias entre el código y lo que dice el README, lo que manda es el código. Y con código me refiero a únicamente el código, excluyendo los posibles comentarios que haya en el código (que también podrían ser incorrectos y no corresponderse con el código). Las pruebas se hacen sobre el código y el README debería ser un reflejo de lo que hace el código. No se ha escrito primero el README y se ha tratado de implementar lo que dice el README. El proceso es el inverso, el README es una documentación sobre lo que hay.
* Al final de todos los cambios propuestos quiero me me proporciones un mensaje para el commit al repositorio git. Ten en cuenta que ese mensaje tiene que ser condensado.

# To Review

* Para solucionar el problema `Property 'supportedValuesOf' does not exist on type 'typeof Intl'.` en `return [...Intl.supportedValuesOf('timeZone')].sort();` de `TimezoneUtils.ts` se ha propuesto en otra conversación incluir el siguiente código:

```typescript
declare namespace Intl {
  function supportedValuesOf(key: 'timeZone' | 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'unit'): string[];
}
```

Esto rompe la línea `Intl.DateTimeFormat().resolvedOptions().timeZone;` porque no reconoce `DateTimeFormat`

No estoy anclado a una versión de Node/ES/Typescript, así que si lo mejor es cambiar algo de esto, pues lo cambio y no hay que hacer redefiniciones raras. En otra conversación se ha mencionado "ampliar a ES2022", que no sé qué es lo que significa ni las implicaciones que podría tener

Por el momento lo he arreglado así `return [...(Intl as any).supportedValuesOf('timeZone')].sort();` pero no me gusta ese `(Intl as any)`

* En `WallIntersectionFactory.ts` está la función `getOutwardNormal`. Es una copia de la que hay en `PointXZUtils.ts`, que no está expuesta. Habría que exponerla en `PointXZUtils.ts` y usar esta desde `WallIntersectionFactory.ts`. No sé por qué en un caso se nombra con `Outward`, aunque la implementación es la misma que la que se llama `getNormal`. Hay que utilizar el nombre más preciso posible y que tenga un comentario explicativo. Si el comentario de `getOutwardNormal` sigue aplicando al trasladarla a `PointXZUtils.ts`, se deja ese comentario. Si hay que adaptar el comentario para que sea genérico, ya que `PointXZUtils.ts` es una utilidad que puede ser usada en cualquier punto de la aplicación, no debería tener comentarios específicos a una parte concreta como `WallIntersection` o `Wall`, ya que en el contexto de esa clase de utilidad no se sabe nada de esas entidades, ni se reciben como argumento.

* En `SiteFactory.ts` he tenido que corregir la función `computeAdjust` para que se renderice todo bien. La he dejado de esta forma

```typescript
const computeAdjust = (isConvex: boolean, isStraight: boolean, wallThickness: number): number => {
  if (isStraight || !isConvex) return 0;
  return wallThickness;
};
```

Inicialmente estaba definida así

```typescript
const computeAdjust = (isConvex: boolean, isStraight: boolean, wallThickness: number): number => {
  if (isStraight || isConvex) return 0;
  return wallThickness / 2;
};
```

No he revisado el comentario de documentación de la función, habrá que actualizarlo con la implementación final. También habrá que actualizar el README.md si hay alguna mención a este respecto.

Insisto en que la implementación final funciona correctamente ya que lo he probado y se renderiza todo perfecto.

* En `SiteFactory.ts` cuando se calcula `angleWarnings` se está iterando `centeredPoints` y llamando a `PointXZUtils.pointAlignedWithPreviousAndNext` recogiendo únicamente el `isStraight`. Justo después para calcular `vertexInfo` se está iterando de nuevo `centeredPoints` y se vuelve a hacer la misma llamada `PointXZUtils.pointAlignedWithPreviousAndNext`. Estas 2 iteraciones sobre `centeredPoints` se podrían hacer de una sola vez y calcular al mismo tiempo tanto `angleWarnings` como `vertexInfo`.

* Antes de continuar implementando "Open Tasks". Tengo la sensación de que he perdido el control sobre el código ya que hay varias partes que no entiendo. Me gustaría hacer una reorganización de la lógica, creando funciones auxiliares con nombres descriptivos y con comentarios explicativos. Sé que no debería de ser necesario pero quiero que se incluyan todas las explicaciones necesarias. Por ejemplo: qué es una normal, qué es la función `dot` entre dos puntos, y todo lo relacionado con cálculos espaciales para Three.js

* Analiza lógica duplicada en varias clases en general y sobre todo en relación a la gestión de puntos, coordenadas, cálculos de puntos en línea, tipos de ángulos, etc. Quiero que no haya lógica duplicada o distintas implementaciones para hacer los mismos cálculos en diferentes lugares. Creo que esto es la parte más compleja de la aplicación y quiero que esté bien claro y limpio.

* Quiero que el código sea lo más fácil de mantener. En un futuro se me olvidará gran parte de esto y sin nombres claros de funciones y con muchos cálculos dentro de las funciones que hay ahora, sin saber para qué se hacen no me voy a enterar de mucho.

* Haz una revisión de estilos que estén embebidos directamente en html. Todos los estilos deberían de estar en css y hacer referencia a los mismos con class en el html.

# Open tasks
 
- [ ] Implement annual simulation loop (step through year at configured interval, accumulate kWh per panel/setup)
- [ ] Display a graph with the total annual production and production per month (radar/spider graph)
- [ ] Implement daily simulation loop
- [ ] Display a graph with the accumulated hourly production curve
- [ ] Create a UI to modify `config.json` (settings sidebar with form, localStorage persistence, export/import)
- [ ] Investigate PVGis integration for climate-adjusted irradiance
- [ ] Cache PVGis irradiance data
- [ ] Export graphs / calculated data (png, pdf, csv — TBD)
- [ ] Review Three.js deprecation warnings (`Clock`, `PCFSoftShadowMap`)
- [ ] Add unit tests for `solarEngine.ts` and factory functions
- [ ] When performing the raycasting take into account only the solar panels that are in the direction between the current panel and the sun. The ones that could cast shadow over the panel

---
 
# Solar Panel Shadow Simulator
 
A browser-based 3D simulator for analysing shadow impact on rooftop photovoltaic installations. No backend required — all computation runs in the browser. Deployable as a static site on GitHub Pages.
 
---
 
## Table of Contents
 
1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Architecture decisions](#architecture-decisions)
5. [Coordinate system](#coordinate-system)
6. [Configuration reference](#configuration-reference)
7. [Solar production model](#solar-production-model)
8. [Shadow detection — Raycasting + BVH](#shadow-detection--raycasting--bvh)
9. [BVH and three-mesh-bvh override](#bvh-and-three-mesh-bvh-override)
10. [Timezone y DST](#timezone-y-dst)
11. [Known limitations](#known-limitations)
12. [Lessons learned](#lessons-learned)

---
 
## What it does
 
- Renders a rooftop installation in 3D (walls, railings with balusters, solar panels) using Three.js.
- Animates the sun's trajectory across the sky for any date and time.
- Detects which panel zones are shaded using raycasting against all shadow-casting geometry (walls, railings, supports, and other panels).
- Estimates instantaneous power output in kW, applying bypass-diode, string-mismatch and optimizer logic.
- Supports multiple installation layouts ("setups") selectable via the UI.
- Validates the wall configuration and displays a prominent warning when non-90° angles are detected.
- Planned: full annual simulation stepping through every N minutes of the year.

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
| i18n | `i18next` + `react-i18next` | EN/ES support, lazy-loaded JSON |
| Build | Vite | Fast HMR, static output for GitHub Pages |
 
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
│   ├── geometry.ts                # PointXZ, Vector3, Euler3 (renderer-agnostic)
│   ├── installation.ts            # Domain models: Site, Wall, SolarPanel, ...
│   ├── simulation.ts              # SunState, SimulationResult
│   └── index.ts                   # Re-exports
│
├── factory/
│   ├── SiteFactory.ts             # Config → Site (walls, intersections, bounding radius, angle validation)
│   ├── WallFactory.ts             # Wall segment geometry + railing
│   ├── WallIntersectionFactory.ts # Corner posts (all non-collinear vertices)
│   ├── PanelSetupFactory.ts       # PanelSetupConfiguration + Site → PanelSetup
│   ├── SolarPanelArrayFactory.ts  # Computes array origin, creates panels
│   ├── SolarPanelFactory.ts       # Single panel world position + render data
│   ├── SamplePointFactory.ts      # Sample points for raycasting per panel
│   └── PointXZFactory.ts          # Safe PointXZ constructor
│
├── store/
│   └── useAppStore.ts             # Zustand store — all app state + actions
│
├── hooks/
│   ├── useBVH.ts                  # Builds BVH over shadow-casting meshes
│   └── useShadowSampler.ts        # Casts rays, returns ShadowMap
│
├── components/
│   ├── Scene.tsx                  # Root 3D scene (walls + panels + helpers)
│   ├── ShadowedScene.tsx          # Dirty-flag raycasting loop, feeds ShadowMap
│   ├── SolarPanelComponent.tsx    # Single panel render (purely presentational)
│   ├── Sun.tsx                    # Sun sphere + directional light
│   ├── Compass.tsx                # N/S/E/W labels in 3D
│   ├── MainControls.tsx           # Date/time/play UI panel
│   ├── SimulationControls.tsx     # Simulation settings UI panel
│   ├── AngleWarningBanner.tsx     # Warning banner for non-90° wall angles
│   └── DeveloperFooter.tsx        # Ko-fi link + personal site
│
└── utils/
    ├── PointXZUtils.ts            # computeLeftHandNormal, convexity, right-angle check, prev/next helpers
    ├── ThreeConverter.ts          # Domain Vector3/Euler3 → THREE.Vector3/Euler
    └── TimezoneUtils.ts           # getAllTimezones(), getBrowserTimezone(), resolveInitialTimezone()
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
- **Annual simulation** (planned): will use `simulationInterval` (15/30/60 min) in its own loop, separate from interactive playback.

### `showPoints` excluded from ShadowedScene
 
`showPoints` only controls rendering of sample point spheres in `SolarPanelComponent`. `ShadowedScene` does not accept it as a prop — doing so would tempt callers to include it in dependencies, triggering full raycasting passes on every visibility toggle with no change in shadow output.
 
### Shadow mesh cache in `useShadowSampler`
 
The list of shadow-casting meshes is built via `scene.traverse` once and stored in a `useRef`, invalidated only when `rebuildKey` changes. This avoids O(scene nodes) traversal on every raycasting pass. All geometry with `castShadow=true` is included: wall bodies, railing rails, railing supports (balusters), and solar panel bodies. Inter-panel shading is therefore correctly modelled.
 
### Timezone as store state, not Site geometry
 
`timezone` is absent from the `Site` type. It lives in `useAppStore.timezone` as UI/display state because:
1. The user can change it at runtime without reloading geometry.
2. All solar calculations use `date.toDate()` (native `Date`, always UTC). Timezone never affects calculations.
3. `SiteFactory` only deals with geometry — injecting a display concern would violate separation of concerns.

When the user changes timezone, `setTimezone` reconverts the `date` Dayjs object to the new timezone via `date.tz(newTimezone)`. This preserves the UTC instant (solar calculations are unchanged) while updating the displayed local time.
 
### Wall geometry — only 90° angles are supported

The application is restricted to wall configurations where every angle between adjacent wall segments is exactly 90° (or 180° for collinear segments). This constraint enables a clean, simple geometric model:

- **Collinear vertices** (angle = 180°): no intersection post is created. These vertices are structurally valid and exist to allow adjacent wall segments to have different heights or railing configurations. They add no information to the floor outline (which is a flat plane) and are therefore omitted from `wallIntersections`.
- **All other vertices** (angle = 90° or 270°): an intersection post is always created. There is no distinction between "rendered" and "not rendered" at the data level — every entry in `site.wallIntersections` is rendered.

If the configuration contains non-90° angles, `SiteFactory` populates `angleWarnings` with the indices of the offending points and the store exposes this list. `AngleWarningBanner` displays a prominent UI warning. Geometry is still constructed but may be visually incorrect.

### Wall vertex classification — isConvex and the Three.js Z inversion

Each vertex is classified by the 2D cross product of the incoming and outgoing edge direction vectors, computed in Three.js scene coordinates (where Z is negated relative to config space). This negation flips every CCW walk in config space into a CW walk in Three.js space, which inverts the sign of the cross product and therefore inverts the meaning of `isConvex`:

| `isConvex` in Three.js space | Real-world vertex type | Interior angle | Wall adjustment |
|---|---|---|---|
| `false` | Exterior corner | 90° | None |
| `true` | Interior recess | 270° | `wallThickness` at both adjacent wall ends |
| — (isStraight) | Collinear | 180° | None |

The post position is computed as `(normalPrev + normalNext) × thickness/2`, where `normalPrev` and `normalNext` are the unit outward normals of the two adjacent wall segments (see `computeLeftHandNormal`). For 90° angles this equals `thickness/2` in each of the two perpendicular directions, placing the post centre exactly at the intersection of the two displaced wall centre-lines.

### Wall longitudinal adjustment at interior recess vertices

Walls are displaced `thickness/2` outward (away from the floor) along their perpendicular normal. At interior recess vertices (`isConvex = true` in Three.js coordinates) the displaced wall bodies would overlap the intersection post volume. Each wall is shortened by `wallThickness` at the end touching the recess vertex to eliminate the overlap.

The adjustment is stored as `adjustStart` and `adjustEnd` on the `Wall` object. Both are always non-negative (shortening only). The naming `adjust` is preferred over `trim` because `trim` implies shortening exclusively, while the field name should reflect that it is a geometric correction.

### `computeLeftHandNormal` — single implementation, shared across factories

The unit outward normal of a directed segment is computed once in `PointXZUtils.computeLeftHandNormal` and imported by all three factories that need it: `WallFactory`, `WallIntersectionFactory`, and indirectly `PointXZUtils.pointAlignedWithPreviousAndNext`. There is no duplicate implementation.

The name encodes the geometric contract: the result is the left-hand perpendicular of the direction of travel, which is the outward direction for a CCW-walked polygon. "Left" is more precise than "outward" here because the function itself has no knowledge of the polygon winding — it is the caller's responsibility to pass segments in the correct direction.

### Vertex classification and angle validation in a single pass

`SiteFactory` classifies every vertex with `pointAlignedWithPreviousAndNext` in a single `.map` over `centeredPoints`. The resulting `vertexInfo` array is reused for both angle validation (populating `angleWarnings`) and geometry construction (wall adjustments, intersection posts). This avoids two separate traversals of the same data.

### No inline styles in components

All visual styling is defined in `App.css` using class names. React components use `className` references only. This keeps a single authoritative source for all visual decisions and avoids the maintenance burden of hunting for styles scattered across JSX files.

### i18n key structure

Translation keys are grouped by the component that owns them:
- `mainControls.*` — keys used exclusively by `MainControls`
- `simulationControls.*` — keys used exclusively by `SimulationControls`
- `angleWarning.*` — keys used by `AngleWarningBanner`
- Top-level keys (`title`, `loading`, `coordinates.*`, `footer.*`) are shared or belong to no specific component

### `Intl.supportedValuesOf` — TypeScript lib target

`Intl.supportedValuesOf('timeZone')` is part of the ES2022 Intl spec. The project's `tsconfig.app.json` sets `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, which makes this API available to TypeScript without any workarounds. The `target` remains `ES2020` — `lib` and `target` are independent settings: `target` controls what JavaScript syntax Vite emits, while `lib` tells the TypeScript compiler which runtime APIs to expect. Raising `lib` to ES2022 does not change the compiled output; it only unlocks type definitions for APIs that the browser already provides.

### `SiteFactory` return type

`SiteFactory.create` returns a `SiteFactoryResult` object containing both the `Site` geometry and the `angleWarnings` array. This avoids side effects (the factory does not write to the store) and keeps all output of the construction process in one place. The store's `loadConfig` action destructures the result and stores each part independently.

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
 
Three.js has no built-in concept of North, but the convention used throughout this project is **North = −Z**.  Config coordinates are flipped (`z_three = −z_config`) in `SiteFactory` and `SolarPanelArrayFactory`.
 
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

The floor is a flat plane. Its outline is derived from `site.wallIntersections`, which contains only non-collinear vertices. Collinear vertices (where two segments meet in a straight line) carry no geometric information for a flat floor and are excluded. This means the floor outline correctly represents the perimeter of the terrace even when some wall segments are split into two for configuration purposes.
 
---

## 2D geometry — normals, dot product, cross product

These three operations are the building blocks for all wall geometry. Understanding them makes the factory code readable without having to mentally re-derive the math.

### Normal to a segment

Given a directed segment from A to B with direction vector `d = (dx, dz)`, its **unit normal** is a vector perpendicular to `d` with length 1. There are two perpendicular directions (left and right). For a CCW-walked polygon the **outward** normal — pointing away from the interior — is always to the **left** of the direction of travel:

```
direction d = (dx, dz)
left-hand normal = (-dz, dx) / |d|
```

Example: a wall going East `(dx=1, dz=0)` → normal `(0, 1)`, pointing South in Three.js (+Z = South). For a wall on the south side of a CCW floor, South is outward.

`computeLeftHandNormal(pA, pB)` in `PointXZUtils.ts` computes this for any segment. It is the single implementation used by `WallFactory` (to displace the wall body outward), `WallIntersectionFactory` (to place the corner post), and `pointAlignedWithPreviousAndNext` (to detect collinearity).

### Dot product

```
dot(a, b) = a.x·b.x + a.z·b.z = |a|·|b|·cos(θ)
```

For unit vectors, `dot(a, b) = cos(θ)` where θ is the angle between them:
- `dot = +1` → same direction (0°)
- `dot =  0` → perpendicular (90°)
- `dot = -1` → opposite directions (180°)

Used here to detect collinear wall segments: two adjacent segments whose outward normals have `dot ≈ +1` are parallel — the vertex between them is a straight pass-through, not a corner.

### Cross product (2D)

```
cross(a, b) = a.x·b.z − a.z·b.x
```

The sign encodes the rotation direction from `a` to `b`:
- `cross > 0` → `b` is to the LEFT of `a` (CCW rotation)
- `cross < 0` → `b` is to the RIGHT of `a` (CW rotation)

Applied to the incoming and outgoing edge directions at a vertex, the sign tells us the turn type. Because Three.js negates Z relative to config space, every CCW config walk becomes a CW walk in Three.js coordinates, inverting the sign convention — see the `isConvex` note in [Wall vertex classification](#wall-vertex-classification--isconvex-and-the-threejs-z-inversion).

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
      "autoConnect": true,
      "shape": { "kind": "cylinder", "radius": 0.025 },
      "support": {
        "shape": { "kind": "cylinder", "radius": 0.012 },
        "count": 3,
        "includeAtStart": false,
        "includeAtEnd": false
      }
    },
    "wallsSettings": [
      // Override per-segment. wall = segment index (see numbering above)
      { "wall": 2, "override": { "height": 1.8, "railing": { "active": false } } }
    ]
  },
  "setups": [{
    "label": "Human-readable name",   // no id field — selection is by position
    "panelDefaults": {
      "width": 1, "height": 2,   // metres
      "peakPower": 415,           // Wp
      "zones": 2,                 // bypass-diode zones per panel
      "zonesDisposition": "horizontal",  // "horizontal" = stacked top/bottom, "vertical" = side by side
      "hasOptimizer": false,
      "string": "S1"
    },
    "arrays": [{
      "position": [0.2, 0.2],   // [East offset, North offset] from site origin, metres
      "azimuth": 0,              // absolute panel azimuth, South=0
      "elevation": 0.5,          // height of array bottom edge, metres
      "inclination": 20,         // tilt angle from horizontal, degrees
      "rows": 1, "columns": 3,
      "spacing": [0.02, 0.02],   // [horizontal gap, vertical gap] between panels, metres
      "orientation": "portrait"  // or "landscape"
    }]
  }]
}
```
 
### Railing shapes
 
| kind | Parameters | Three.js geometry |
|---|---|---|
| `square` | `width`, `height` | `BoxGeometry(width, height, wallLength)` |
| `cylinder` | `radius` | `CylinderGeometry(r, r, wallLength, 8)` |
| `half-cylinder` | `radius`, `orientation: 'up'\|'down'` | `CylinderGeometry(r, r, len, 8, 1, true, thetaStart, π)` |
 
### Railing support shapes
 
| kind | Parameters |
|---|---|
| `square` | `width`, `depth` (height derived from wall geometry) |
| `cylinder` | `radius` |
 
### `zonesDisposition`
 
| Value | Layout | Split axis |
|---|---|---|
| `horizontal` | Zones are horizontal bands | Z (height) |
| `vertical` | Zones are vertical columns | X (width) |
 
---
 
## Solar production model
 
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
 
| Shaded zones | Without optimizer | With optimizer |
|---|---|---|
| 0 | `basePower` | `basePower` |
| k out of n | `basePower × (n−k)/n × 0.9` (−10% mismatch penalty) | `basePower × (n−k)/n` |
| all | 0 | 0 |
 
### 5. String mismatch
 
Panels in the same string without optimizers are connected in series. The string output is limited by the least-efficient panel (bottleneck effect):
 
```
stringEfficiency = min(individualEfficiency for each panel in string)
each panel output = peakKw × stringEfficiency
```
 
Strings where every panel has an optimizer are treated as independent — each panel produces at its own efficiency.
 
---
 
## Shadow detection — Raycasting + BVH
 
### Why BVH?
 
Without acceleration, `raycaster.intersectObjects` tests every ray against every triangle in the scene — O(rays × triangles). For a scene with hundreds of wall and panel faces, and thousands of sample points, this is too slow for interactive use.
 
`three-mesh-bvh` pre-organises each geometry into a **Bounding Volume Hierarchy**: a tree of axis-aligned bounding boxes where each leaf contains a small subset of triangles. A ray only needs to test O(log n) nodes instead of O(n) triangles, giving a dramatic speedup.
 
### How it is set up
 
1. **Patch Three.js once** (`useBVH.ts`):
   ```ts
   THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
   THREE.Mesh.prototype.raycast = acceleratedRaycast;
   ```
   After this, every `Mesh.raycast` call automatically uses BVH if a bounds tree exists.
2. **Build the BVH** (`useBVH` hook): walks the scene, calls `geometry.computeBoundsTree()` on every shadow-casting mesh. Rebuilt only when `rebuildKey` changes (site or setup change), not on every frame.
3. **Cast rays** (`useShadowSampler` hook): for each sample point, transforms its local position to world space using the panel's pre-computed world matrix, sets the ray origin, and calls `intersectObjects`. `firstHitOnly = true` stops BVH traversal after the first hit, saving further work.
4. **Avoid GC pressure**: all `THREE.Vector3`, `THREE.Matrix4`, `THREE.Quaternion` scratch objects are allocated **once at module scope** and reused for every ray, avoiding garbage collector pauses.

### Dirty flag
 
`ShadowedScene` only runs the full raycasting pass when a `needsUpdate` ref is `true`. The flag is set by a `useEffect` that watches `[sun, activeSetup, density, threshold]`. Between frames where nothing changes, `useFrame` is a no-op.
 
### What is included in shadow casting
 
Every mesh with `castShadow={true}` is included in the raycasting. This covers:
- Wall bodies
- Railing rails (all shapes)
- Railing supports (balusters)
- Solar panel bodies

Inter-panel shading (one panel casting a shadow on another) is therefore naturally modelled without any special handling.
 
### BVH and three-mesh-bvh override
 
`package.json` contains:
```json
  "overrides": { "three-mesh-bvh": "^0.9.9" }
```
 
**Must be kept.** `@react-three/drei` pulls in `three-mesh-bvh` as a transitive dependency without pinning a version. Without the override, npm may install two different versions. The BVH integration patches `THREE.BufferGeometry.prototype` and `THREE.Mesh.prototype` — if two instances coexist, only one is patched. The other falls back to brute-force intersection silently. The override forces one version across the entire tree.
 
---
 
## Timezone y DST
 
### El problema
 
`dayjs(string)` y `dayjs()` crean objetos en la timezone **local del navegador**. Cuando la timezone del navegador difiere de la de la instalación (usuario remoto) o cuando hay un cambio horario (DST), la hora que el usuario escribe en los inputs no coincide con la que se muestra en el display de fecha.
 
### La solución
 
`makeDateInTimezone(year, month, day, hour, minute, timezone)` usa `dayjs.tz(isoString, timezone)`, que interpreta los componentes como hora local en la timezone indicada — no en la del navegador. Esta función es la **única** forma correcta de construir fechas desde inputs de usuario en esta aplicación.
 
Cuando el usuario cambia de timezone, `setTimezone` llama a `date.tz(newTimezone)` sobre el `Dayjs` actual. Esto preserva el instante UTC (los cálculos solares no cambian) y actualiza la hora local mostrada en los controles al equivalente en la nueva timezone.
 
### geo-tz — descartado para browser
 
`geo-tz` es la librería más precisa para inferir timezone desde coordenadas GPS, pero lee datos geográficos desde disco en runtime y **no es compatible con bundlers de browser**. Sus datos (~10 MB de GeoJSON) no pueden incluirse en un bundle estático de GitHub Pages.
 
**Solución usada**: `Intl.supportedValuesOf('timeZone')` (API nativa del navegador ES2022, sin dependencias) para la lista completa de timezones IANA. El preset inicial es `Intl.DateTimeFormat().resolvedOptions().timeZone` (timezone detectada por el navegador). El usuario confirma o cambia mediante el selector en la UI.
 
### UTC en los cálculos
 
`date.toDate()` (nativo `Date` de JS) siempre representa un instante UTC. SunCalc recibe este valor. La timezone nunca afecta a los cálculos de posición solar ni de producción.
 
---
 
## Known limitations
 
- **90° wall angles only**: the wall and intersection geometry model is restricted to right-angle corners. Non-right angles produce incorrect post placement and wall overlaps. A validation warning is shown in the UI when violations are detected in the configuration.
- **Single year**: time controls are constrained to the current year.
- **No diffuse irradiance**: only direct (beam) irradiance is modelled.
- **Annual simulation not yet implemented**.
- **Railing connect piece for mismatched shapes**: when the two walls meeting at a corner have different railing shapes, the connect piece uses the shape of the incoming wall. A small visual mismatch may be visible at the corner.

---
 
## Lessons learned
 
### `useEffect` dependency arrays must reflect semantic intent
 
A dependency should be included if its change logically invalidates the effect's output — not merely because it is read inside the effect. `showPoints` controls rendering of sample point spheres but does not affect shadow computation; it is therefore absent from both `ShadowedScene`'s props and from the shadow dirty-flag effect. Always document intentional omissions with a comment.
 
### Separating factory methods by what changes
 
`PanelSetupFactory.rebuildSamplePoints` vs `create`: sample point density is the only input that changes interactively. Panel geometry (positions, rotations, zone layouts) is stable between density changes. Separate entry points make the intent explicit at the call site and avoid redundant computation.
 
### Caching scene traversal in hooks
 
`scene.traverse` is O(scene nodes). Running it on every raycasting pass wastes CPU when the scene is stable. Cache the result in a `useRef` and invalidate with the same key used to rebuild the BVH — they share the same invalidation signal.
 
### The three-mesh-bvh override
 
npm `overrides` are appropriate when a package patches a shared global (a prototype) and two instances would mean only one gets patched — silently. This is not a hack; it is the semantically correct declaration that this package must have exactly one instance in the dependency tree.
 
### Discriminated unions over string enums for geometry variants
 
A `kind: 'square' | 'cylinder' | 'half-cylinder'` discriminated union carries its own shape-specific parameters with no casts needed. A switch on `kind` is exhaustively checked by TypeScript — adding a new shape without handling it in the renderer is a compile error, not a runtime surprise.
 
### Wall vertex classification via cross product
 
The 2D cross product of the incoming and outgoing edge directions at a vertex cleanly separates the three geometrically distinct cases (collinear, and the two non-collinear turn directions) in a single operation. The sign encodes the turn direction. Because Three.js negates Z relative to config space, the sign convention is inverted compared to a pure CCW walk: `isConvex = true` in Three.js coordinates corresponds to an interior recess in real-world terms. This inversion is documented in `PointXZUtils.ts` and accounted for in `SiteFactory.computeAdjust`.

### Restricting to 90° simplifies geometry significantly

Supporting arbitrary wall angles requires computing bisector offsets with trigonometric formulas that diverge at near-parallel angles, handling wall end-cuts that are not perpendicular to the wall direction, and reasoning about corner post shapes that change with the angle. Restricting to 90° collapses all of this to a single formula: the post offset is `(normalPrev + normalNext) × thickness/2` and the wall shortening at interior recess corners is exactly `wallThickness`. The geometric model becomes trivially correct and the code shrinks substantially. Angle validation at load time with a visible UI warning is the correct trade-off: the constraint is documented, enforced at startup, and easy to diagnose.

### Wall adjustment naming: `adjust` not `trim`

The longitudinal correction applied to wall ends at interior recess vertices was initially named `trimStart`/`trimEnd`. `trim` implies an operation that only shortens. The rename to `adjustStart`/`adjustEnd` better reflects that the field represents a geometric correction (which happens to always be a positive shortening for 90° configurations, but the name should not encode that assumption).

### Collinear vertices excluded from `wallIntersections`

Collinear wall points (where two segments meet at 180°) are valid configuration — they allow adjacent segments to differ in height or railing. However, they contribute no geometric information to a flat floor outline and no intersection post is needed. Excluding them from `wallIntersections` keeps the array semantically clean: every entry is a rendered post. The floor shape is built directly from this array, so omitting redundant collinear points also slightly reduces the number of vertices in the floor geometry.

### `SiteFactory` returns a result object, not just `Site`

Returning `{ site, angleWarnings }` from `SiteFactory.create` keeps the factory free of side effects. The factory does not write to any store or emit events — it produces data and returns it. The caller (`loadConfig` in the store) decides what to do with each part. This pattern generalises: if the factory ever needs to return additional metadata (e.g. validation errors for panel positions), the result object can be extended without changing the factory's signature.

### i18n keys grouped by owning component

Flat top-level keys become hard to navigate as the translation file grows. Grouping keys under the component that owns them (`mainControls.*`, `simulationControls.*`, `angleWarning.*`) makes it immediately clear where each string is used and avoids naming collisions. Keys that are genuinely shared or application-level (`title`, `loading`, `coordinates.*`, `footer.*`) remain at the top level.

### `lib` vs `target` in tsconfig

`target` controls the JavaScript syntax that TypeScript emits (e.g. ES2020 arrow functions, optional chaining). `lib` tells the TypeScript compiler which runtime APIs to expect in the browser (e.g. `Promise`, `Intl.supportedValuesOf`). They are independent. Raising `lib` to ES2022 to unlock `Intl.supportedValuesOf` does not change the compiled output at all — it only adds type definitions. This is always preferable to `(value as any)` casts or local `declare namespace` workarounds, both of which lose type safety.

### `computeLeftHandNormal` — one implementation, used everywhere

The outward normal of a wall segment is computed exactly once, in `PointXZUtils.computeLeftHandNormal`. All factories import this function. There is no inline copy of the formula anywhere else in the codebase. When geometry behaviour needs to change (e.g. switching from outward to inward displacement), there is exactly one place to change it.

---
 
# My Documentation
 
## ☀️ Lógica de Producción y Sombras
 
### 1. El Concepto de Zonas (Diodos de Bypass)
 
Un panel solar no es una única pieza eléctrica, sino un conjunto de celdas conectadas en serie. Habitualmente, los paneles se dividen en zonas protegidas por diodos de bypass.
 
* **Sin Sombra**: La corriente fluye por todas las celdas
* **Con Sombra en una zona**: El diodo de esa zona "se activa" y hace que la corriente salte esa zona para que el resto del panel siga funcionando
  * *Resultado*: Si 1 de 3 zonas tiene sombra, el panel pierde **1/3** de su producción (produce el 66.6%)
  * *Importante*: Si la sombra toca aunque sea un solo punto de una zona, esa zona entera se considera "anulada" eléctricamente

### 2. Comportamiento del String (Sin Optimizadores)
 
En un string, todos los paneles están conectados en serie. La corriente es como el agua en una tubería: **el caudal lo marca el punto más estrecho**.
 
* **Caso A (Sombra en 1 zona de 1 panel)**: Ese panel baja al 66%. Como el string es una serie "pura", **todos los paneles del string bajan su producción al 66%**, aunque les esté dando el sol plenamente. Es el efecto "cuello de botella"
* **Caso B (Sombra total en 1 panel)**: Si un panel se sombrea por completo (todas sus zonas), el string entero cae a **0%** (o a un valor residual ínfimo), a menos que los diodos del panel sombreado permitan puentearlo por completo, pero la pérdida de voltaje suele desplomar la eficiencia del inversor

### 3. Comportamiento con Optimizadores
 
* **¿Cómo funciona?**: El optimizador ajusta el voltaje y la corriente de su panel para que el "cuello de botella" no afecte a los demás. Un optimizador DC/DC aísla el rendimiento de cada panel del resto del string. Con sombra en un panel, el resto sigue produciendo al 100%.
* **Caso A (Sombra en 1 zona de 1 panel optimizado)**:
  * El panel afectado pierde **1/3** de su producción (produce el 66%)
  * **¡El resto de paneles del string siguen produciendo al 100%!**
* **Caso B (Sombra total en 1 panel optimizado)**:
  * Ese panel produce **0%**
  * El resto del string sigue produciendo al **100%**

### 4. Matriz de Combinaciones
 
| Escenario | Afectación Individual (Panel) | Afectación Global (String) |
|-----------|-------------------------------|----------------------------|
| Sin Sombras | 100% | 100% |
| Sombra en 1 Zona (Sin Optimizador) | Produce: (`Zonas Libres / Zonas Totales`) | **Todos** los paneles del string limitados a ese mismo % |
| Sombra en 1 Zona (Con Optimizador) | Produce: (`Zonas Libres / Zonas Totales`) | El resto del string produce al **100%** |
| Sombra en Varias Zonas (Mezcla) | Cada panel calcula su % máximo posible. | El string sin optimizadores se queda con el **% del panel más afectado**. |
 
## Hooks
 
* **useBVH**: construye el BVH una sola vez cuando cambia la escena (setup/site). Reconstruye solo si cambia `rebuildKey`.
* **useShadowSampler**: lanza todos los rayos en una sola pasada usando el BVH. Cachea la lista de meshes con `castShadow`. Devuelve `Map<pointId, isShaded>`.

## Geometría de Muros — Restricción a 90°

La aplicación solo soporta ángulos de 90° entre muros adyacentes. Esta restricción se valida al cargar la configuración. Si se detectan ángulos que no son de 90°, se muestra un banner de aviso en la UI indicando los índices de los puntos problemáticos.

Existen tres categorías de vértice. La clasificación se hace en coordenadas Three.js (donde Z está negado respecto al espacio de configuración), lo que invierte el significado del flag `isConvex` respecto a su sentido matemático puro en CCW:

* **Vértice con `isConvex = false`** (esquina exterior, ángulo interior 90°): se crea un post de intersección. El post se desplaza `thickness/2` en cada una de las dos direcciones perpendiculares de los muros adyacentes, quedando en el exterior de la terraza. Los muros no se acortan.
* **Vértice colineal** (`isStraight = true`, ángulo = 180°): no se crea `WallIntersection`. El suelo se construye a partir de los `WallIntersection` existentes, y los vértices colineales son redundantes en un plano plano.
* **Vértice con `isConvex = true`** (recodo interior, ángulo interior 270°): se crea un post de intersección. El post se desplaza `thickness/2` hacia el interior del recodo. Los muros adyacentes se acortan `wallThickness` en el extremo que toca esta intersección, para evitar que el cuerpo del muro invada el volumen del post.
