# Instructions
 
* Quiero que revises el todo el apartado "To Review" de este mismo fichero donde están los puntos que quiero que revises antes de continuar con las tareas de Open Tasks. Tras procesar todo el apartado "To Review" inspecciona el código para comprender mejor lo que se dice antes de ponerte a cambiar código. Si tras hacer esto tienes alguna duda o no entiendes algo de lo que se dice/pregunta/propone, pregúntame antes de proponer ningún cambio de código.
* Quiero una solución de alta calidad técnica, que lo que haya programado tenga su sentido y que sea defendible ante cualquier programador/desarrollador/arquitecto experto en el stack tecnológico del proyecto.
* Tras realizar cambios de código hay que actualizar el `README.md` en consecuencia para reflejar las decisiones tomadas, cómo queda la configuración finalmente, cómo queda la arquitectura finalmente, etc. cualquier cosa que sea relevante y que encaje con lo que se escribe en el `README.md`. Para poder actualizar el `README.md` haz un análisis previo de su contenido para proceder a determinar cómo actualizarlo.
* El criterio para actualizar el `README.md` es siempre con la idea de complementar lo existente (o adaptarlo si es necesario). La idea NO es que el `README.md` refleje únicamente los los cambios que se están realizando. Se tiene que hacer un ejercicio de "merge" entre el contenido existente en el `README.md` y los cambios que se han realizado. Todo el contenido del `README.md` tiene que estar en inglés.
* El criterio para actualizar los comentarios del código. Los comentarios del código tienen que ser explicativos, no tienen que hacer referencia al refactor que se está haciendo, incluyendo frases como: introducido para..., antes del refactor se hacía..., ahora se hace... Y si ya hay comentarios previos en el código que siguen teniendo sentido tras los cambios que se hagan hay que dejarlos. No quiero comentarios que sirvan para marcar inicios de secciones, por ejemplo en las definiciones de clases, un comentario que simplemente diga que debajo de esta línea hay clases de cierto ámbito, esto con el tiempo no se respeta y deja de tener sentido el comentario
* Estas instrucciones están en en español, y puede que la sección "To Review" o la de "Open Tasks" tenga mezcla de inglés o de español. A la hora de programar código y comentarlo y actualizar el `README.md` será siempre en inglés todo.
* Al actualizar el `README.md` deja las secciones iniciales "Instructions", "To Review" y "Open Tasks" intactas, ya me encargo yo de poner esto al día. Actualiza a partir de la sección "Solar Panel Shadow Simulator"
* Si tienes discrepancias entre el código y lo que dice el `README.md`, lo que manda es el código. Y con código me refiero a únicamente el código, excluyendo los posibles comentarios que haya en el código (que también podrían ser incorrectos y no corresponderse con el código). Las pruebas se hacen sobre el código y el `README.md` debería ser un reflejo de lo que hace el código. No se ha escrito primero el `README.md` y se ha tratado de implementar lo que dice el `README.md`. El proceso es el inverso, el `README.md` es una documentación sobre lo que hay.
* Al final de todos los cambios propuestos quiero me me proporciones un mensaje para el commit al repositorio git. Ten en cuenta que ese mensaje tiene que ser condensado.

# To Review

* Quiero que te pongas en el papel de un desarrollador experto que tiene que evaluar este proyecto como si hubiese sido desarrollado por un tercero. Antes de incorporarlo en el código base de su compañía y desplegarlo en producción tiene que evaluar la arquitectura, comentarios, documentación. Lo único que tiene que ignorar es la ausencia de tests, están por implementar y por el momento se acepta. Haz una evaluación general del proyecto y emite un reporte con mejoras, cambios, refactors, que harías.

* Quiero que analices los comentarios en el código para asegurar que lo que describen es lo que está implementado y también que cuando se hace referencia al `README.md` efectivamente está explicado. Si hay discrepancia entre el comentario de código y la implementación, adapta el comentario de código para que refleque la implementación. Si hay referencia al `README.md` y allí no está documentado, añade esa información. Si hay referencia al `README.md` y hay contenido allí, pero lo que dice el `README.md` no se ajusta a la implementación, corrige el `README.md`

* Revisa las funciones y clases sin comentarios explicativos y añádelos donde falten.

* En el `README.md` hay un apartado final `My Documentation` que no está bien integrado con el resto del fichero. Estas son unas notas que tomé para comprender el funcionamiento de los paneles con los diodos de bypass, los strings y optimizadores. No quiero perder esta información, pero quiero que esté mejor integrado con la documentación previa. Encuentra el punto donde encaje mejor para reorganizarlo. Mantén la información que ya se dice. Si en otro punto del `README.md` hay un solapamiento y la misma información está en varios sitios, haz un "merge" para que quede una estructura limpia, sin duplicidades y sin perder información.

* Quiero definir más en detalle la primera tarea de la sección "Open tasks" en relación a la simulación anual. Hay muchas cosas aquí. Antes de nada: PARA TODO EL ANÁLISIS DERIVADO DE ESTO NO LO INCLUYAS EN EL README TODAVIA, dame como resultado otro fichero diferente con la información sobre esto para ir revisándolo y dándole forma. Voy a anticiparte todo lo relacionado que he pensado hasta ahora para que te hagas una idea general de lo que me gustaría tener y que puedas plantear una solución y fasearla para ir implementándola poco a poco. No quiero que nos centremos ahora en una cosa muy específica y que al ir ampliando la solución haya que hacer refactors enormes por no haber tenido una visión más amplia desde el principio. Quiero que esa lógica se ejecute en web workers, no sé si pueden ser varios o solo 1, o no sé si se puede hacer en base a los recursos disponibles del navegador. Quiero que ese cálculo se haga para cada setup de la configuración. Quiero que el state con los datos calculados para poder hacer el raycasting se "hashee" y el resultado de la simulación anual se persista en el navegador, de tal forma que si se vuelve a calcular y los datos no han cambiado, no haya que repetir el cálculo y sea inmediato. Que solo se rehaga la simulación si tiene sentido: si algo que afecte a los cálculos haya cambiado (setup, densidad de muestreo, threshold para bypass de zona de panel, intervalo de tiempo para cálculo). Cada una de las simulaciones se podrían guardar con el hash, para poder tener varias, y así si se cambia la configuración y se vuelve a una ya pre-simulada, se pueda recuperar. Se tiene que mostrar el progreso, y lo mostraría en 2 barras: una para saber el setup que se está procesando (viendo su label, qué setup es sobre el total de setups), otra barra para ver el progreso del raycasting sobre el total que se tiene que calcular. Mientras se está haciendo una simulación, no se puede lanzar otra ni cambiar parámetros para la simulación, lo único que se podrá hacer es parar la simulación actual. Al parar la simulación actual se pedirá confirmación al usuario por si estuviera muy avanzada y le diera al botón de parar por error. No sé qué cálculos hacer ahora porque todavía no tengo muy claro cómo mostrar la información. Lo que he pensado hasta ahora es tener la producción estimada total anual y por meses. La total se visualizaría con un gráfico de barras para poder comparar setups, la que va por meses se podría visualizar con un radar/spider graph, de esta forma se podría comparar por meses cada setup. No sé si `Plotly` sería una librería adecuada para mostrar estas gráficas. No tengo claro cómo mostrar estas gráficas en la aplicación. También me gustaría tener una curva de producción diaria (por horas), mensual (por días y por horas), para esto utilizaría un diagrama de líneas que compare setups. Ahora mismo toda la web la ocupa el renderizado. Quizá habría que dividirlo en 2 zonas: una para renderizado y que tenga los controles de renderizado, otra zona (a la derecha o debajo, que sea adaptativo) para mostrar los reportes. También me gustaría tener un mapa de calor para cada panel y setup donde se vea cómo le afectan las sombras, no sé si tenerlo por año y también por meses, y para cada setup. Con este mapa de calor se podría analizar qué paneles necesitan optimizadores. Estos resultados de gráficos de alguna manera los quiero poder exportar, con la idea de poder consultarlos a posteriori (si fuese en pdf o png) o volver a cargarlos en la aplicación para poder interactuar con los gráficos. Otra cosa a tener en cuenta, ahora mismo se hace una estimación de la producción en condiciones ideales teniendo en cuenta la posición del sol y la inclinación con respecto al panel, me gustaría también tener la opción de que la simulación pueda tener una estimación de la radiación solar para ese instante de tiempo, no sé si esto se podría extraer de un tercero como PVGIS. Si esta información sobre la estimación de la radiación (o de si hay nubes, vamos teniendo en cuenta el clima) se puede obtener de algún API de terceros y de forma gratuita y cómoda (que no haya que hacer miles the requests) quiero dar la opción a incorporarlo en la simulación (con un toggle). Si hubiera varias fuentes que proporcionen esto además del toggle para incluirlo se daría a elegir la fuente a utilizar. Esta información se cachearía también en el navegador para no tener que pedirla de nuevo.

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
6. [2D geometry — normals, dot product, cross product](#2d-geometry--normals-dot-product-cross-product)
7. [Configuration reference](#configuration-reference)
8. [Solar production model](#solar-production-model)
9. [Shadow detection — Raycasting + BVH](#shadow-detection--raycasting--bvh)
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
- Validates the wall configuration and displays a prominent warning listing the exact config-space coordinate triples that form non-90° or non-180° angles.
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
│   ├── geometry.ts                # PointXZ, Vector3, Euler3, AngleWarning (renderer-agnostic)
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
│   ├── AngleWarningBanner.tsx     # Warning banner listing non-90° angle coordinate triples
│   └── DeveloperFooter.tsx        # Ko-fi link + personal site
│
└── utils/
    ├── PointXZUtils.ts            # computeLeftHandNormal, convexity, right-angle check, prev/next helpers
    ├── RailingUtils.ts            # Shared railing rail render data builder (used by WallFactory and WallIntersectionFactory)
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

If the configuration contains non-90° angles, `SiteFactory` populates `angleWarnings` with `AngleWarning` objects, each carrying the three config-space coordinates of the offending vertex and its two neighbours. The store exposes this list and `AngleWarningBanner` renders it as a human-readable list showing the actual coordinate values from config.json — not internal indices. Geometry is still constructed but may be visually incorrect.

### AngleWarning carries config-space coordinates, not indices

`AngleWarning` stores the three `[x, z]` coordinate pairs from the original `config.json` (`pointPrev`, `point`, `pointNext`). This design was chosen so that the warning banner can show the user the exact values they typed in the configuration file, making it immediately actionable ("find `[3.7, 6.6]` in your wallPoints array"). Internal indices are meaningless to the user and require them to count array positions to locate the problem.

Three points are needed (not two) because an angle is defined by three points: the vertex and its two neighbours. Showing only two points would not uniquely identify the angle.

### `RailingUtils` — shared railing render data builder

`WallFactory` and `WallIntersectionFactory` both need to build `RailingRailRenderData` for all three railing shapes. Previously each factory had its own copy of this logic (`buildRailRenderData` and `buildRailingConnect` respectively). The logic is now consolidated in `RailingUtils.buildRailRenderData(shape, wallHeight, heightOffset, length)`, which is imported by both factories. The connect piece in `WallIntersectionFactory` uses `wallThickness` as its length — `RailingUtils` is length-agnostic by design.

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

The adjustment is stored as `adjustStart` and `adjustEnd` on the `Wall` object. Both are always non-negative (shortening only).

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

The `angleWarning.tripletLabel` key uses i18next interpolation (`{{prev}}`, `{{point}}`, `{{next}}`) to format the three coordinate pairs. The format string can be adjusted per language without changing any component code.

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

These three operations are the building blocks for all wall geometry in this project. The implementation lives in `PointXZUtils.ts`. Understanding them makes the factory code readable without having to mentally re-derive the math.

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

`PointXZUtils.computeLeftHandNormal(pA, pB)` computes this for any segment. It is used by:
- `WallFactory` — to displace the wall body outward by `thickness/2`
- `WallIntersectionFactory` — to compute the corner post offset
- `PointXZUtils.pointAlignedWithPreviousAndNext` — to detect collinearity via the dot product

### Dot product

```
dot(a, b) = a.x·b.x + a.z·b.z = |a|·|b|·cos(θ)
```

For **unit vectors**: `dot(a, b) = cos(θ)` where θ is the angle between them.

| dot value | angle θ | meaning |
|---|---|---|
| +1 | 0° | same direction |
| 0 | 90° | perpendicular |
| −1 | 180° | opposite directions |

**Used for collinearity detection**: if two adjacent wall segments are collinear, their outward normals point in the same direction → `dot(normalPrev, normalNext) ≈ +1`.

```
── segment A ──►  ── segment B ──►
     normalA ↑        normalB ↑
     dot(normalA, normalB) ≈ +1  → collinear vertex (straight pass-through)
```

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

This is why `SiteFactory.computeAdjust` applies wall shortening when `isConvex = true` (interior recess in Three.js space), not when `isConvex = false`.

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

Each panel is divided into zones, each protected by a bypass diode. When a zone is shaded, its diode activates and that zone is electrically bypassed — the rest of the panel continues producing.

| Shaded zones | Without optimizer | With optimizer |
|---|---|---|
| 0 | `basePower` | `basePower` |
| k out of n | `basePower × (n−k)/n × 0.9` (−10% mismatch penalty) | `basePower × (n−k)/n` |
| all | 0 | 0 |

The 10% mismatch penalty for non-optimized panels models the voltage mismatch loss that occurs when some bypass diodes are active and the remaining cells must operate at a sub-optimal voltage to match the inverter.
 
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
Panel B:  50% efficient (1 zone shaded)
Panel C: 100% efficient

String efficiency = min(100%, 50%, 100%) = 50%
→ All three panels produce at 50%
Total = 3 × peakKw × 50% = 1.5 × peakKw
```

**Example with optimizer (same scenario):**
```
Panel A: 100% → produces peakKw
Panel B:  50% → produces 0.5 × peakKw
Panel C: 100% → produces peakKw
Total = 2.5 × peakKw
```
 
---
 
## Shadow detection — Raycasting + BVH
 
### Why BVH?
 
Without acceleration, `raycaster.intersectObjects` tests every ray against every triangle in the scene — O(rays × triangles). For a scene with hundreds of wall and panel faces, and thousands of sample points, this is too slow for interactive use.
 
`three-mesh-bvh` pre-organises each geometry into a **Bounding Volume Hierarchy**: a tree of axis-aligned bounding boxes where each leaf contains a small subset of triangles. A ray only needs to test O(log n) nodes instead of O(n) triangles, giving a dramatic speedup.

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
 
### The Problem

`dayjs(string)` and `dayjs()` create objects in the **browser's local timezone**. When the browser's timezone differs from that of the installation (remote user) or when there is a Daylight Saving Time (DST) shift, the time the user enters in inputs does not match the time shown in the date display.

### The Solution

`makeDateInTimezone(year, month, day, hour, minute, timezone)` uses `dayjs.tz(isoString, timezone)`, which interprets the components as local time in the specified timezone, not the browser's. This function is the **only** correct way to construct dates from user inputs in this application.

When the user changes timezones, `setTimezone` calls `date.tz(newTimezone)` on the current `Dayjs` object. This preserves the UTC instant (solar calculations do not change) and updates the local time shown in the controls to the equivalent in the new timezone.

### geo-tz — Discarded for Browser

`geo-tz` is the most accurate library for inferring timezones from GPS coordinates, but it reads geographic data from the disk at runtime and is **not compatible with browser bundlers**. Its data (~10 MB of GeoJSON) cannot be included in a static GitHub Pages bundle.

**Implemented Solution**: `Intl.supportedValuesOf('timeZone')` (a native ES2022 browser API, dependency-free) for the complete list of IANA timezones. The initial preset is `Intl.DateTimeFormat().resolvedOptions().timeZone` (the timezone detected by the browser). The user confirms or changes this via the UI selector.

### UTC in Calculations

`date.toDate()` (native JS `Date`) always represents a UTC instant. SunCalc receives this value. The timezone never affects the solar position or production calculations.

---
 
## Known limitations
 
- **90° wall angles only**: the wall and intersection geometry model is restricted to right-angle corners. Non-right angles produce incorrect post placement and wall overlaps. A validation warning is shown in the UI listing the exact coordinate triples from config.json when violations are detected.
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

### `AngleWarning` carries coordinates, not indices

Showing the user raw 0-based array indices when a wall angle is invalid forces them to count positions in their config file and reason about 0-based indexing. Storing the actual `[x, z]` coordinate pairs from `config.json` in the `AngleWarning` type makes the warning immediately actionable — the user can search for those exact values in their configuration file.

### Shared railing render data logic extracted to `RailingUtils`

`WallFactory` builds a full-length rail for each wall segment; `WallIntersectionFactory` builds a short connect piece of length `wallThickness` for each corner. Both operations produce `RailingRailRenderData` using identical Three.js geometry logic for all three railing shapes. Extracting this to `RailingUtils.buildRailRenderData` ensures that adding a new railing shape requires editing only one place, and that both call sites get the change automatically.

### i18n keys grouped by owning component

Flat top-level keys become hard to navigate as the translation file grows. Grouping keys under the component that owns them (`mainControls.*`, `simulationControls.*`, `angleWarning.*`) makes it immediately clear where each string is used and avoids naming collisions. Keys that are genuinely shared or application-level (`title`, `loading`, `coordinates.*`, `footer.*`) remain at the top level.

### `lib` vs `target` in tsconfig

`target` controls the JavaScript syntax that TypeScript emits (e.g. ES2020 arrow functions, optional chaining). `lib` tells the TypeScript compiler which runtime APIs to expect in the browser (e.g. `Promise`, `Intl.supportedValuesOf`). They are independent. Raising `lib` to ES2022 to unlock `Intl.supportedValuesOf` does not change the compiled output at all — it only adds type definitions. This is always preferable to `(value as any)` casts or local `declare namespace` workarounds, both of which lose type safety.

### `computeLeftHandNormal` — one implementation, used everywhere

The outward normal of a wall segment is computed exactly once, in `PointXZUtils.computeLeftHandNormal`. All factories import this function. There is no inline copy of the formula anywhere else in the codebase. When geometry behaviour needs to change (e.g. switching from outward to inward displacement), there is exactly one place to change it.

---
 
# My Documentation
 
## ☀️ Solar Production and Shadow Logic
 
### 1. The Zone Concept (Bypass Diodes)
 
A solar panel is not a single electrical component. It is an array of cells connected in series, typically divided into zones protected by bypass diodes.
 
* **No shade**: current flows through all cells.
* **Shade on one zone**: the diode for that zone activates, bypassing it so the rest of the panel continues producing.
  * *Result*: if 1 of 3 zones is shaded, the panel loses 1/3 of its output (produces 66.6%).
  * *Important*: if even a single sample point in a zone is shaded, the entire zone is considered electrically bypassed.

### 2. String behaviour without optimizers
 
In a string, all panels are connected in series. Current behaves like water in a pipe — the flow rate is set by the narrowest point.
 
* **Shade on 1 zone of 1 panel**: that panel drops to 66%. Because the string is in series, all panels in the string drop to 66% even if they receive full sunlight. This is the bottleneck effect.
* **Full shade on 1 panel**: the entire string drops to near 0%, unless the shaded panel's diodes allow it to be fully bypassed, but the voltage drop typically collapses the inverter's operating point.

### 3. Behaviour with optimizers
 
A DC/DC optimizer per panel isolates each panel's operating point from the rest of the string. With shade on one panel, the others continue at 100%.
 
* **Shade on 1 zone of 1 optimized panel**:
  * The affected panel produces 66%.
  * The rest of the string remains at 100%.
* **Full shade on 1 optimized panel**:
  * That panel produces 0%.
  * The rest of the string remains at 100%.

### 4. Combination matrix
 
| Scenario | Panel output | String output |
|---|---|---|
| No shade | 100% | 100% |
| 1 zone shaded (no optimizer) | free zones / total zones | All panels limited to that % |
| 1 zone shaded (with optimizer) | free zones / total zones | Rest of string at 100% |
| Multiple zones shaded (mixed) | Each panel calculates its own max % | Without optimizer: limited by worst panel |