# Instructions
 
* Quiero que revises el apartado "To Review" de este mismo fichero donde están los puntos que quiero que revises antes de continuar con las tareas de Open Tasks. Tras procesar todo el apartado "To Review" inspecciona el código para comprender mejor lo que se dice antes de ponerte a cambiar código. Si tras hacer esto tienes alguna duda o no entiendes algo de lo que se dice o no coincide lo que se dice con el código, pregúntame antes de proponer ningún cambio de código.
* Quiero una solución de alta calidad técnica y que lo que haya programado tenga su sentido y que sea defendible ante cualquier programador/desarrollador/arquitecto experto en el stack tecnológico del proyecto.
* Tras los cambios de código que se hagan debería de actualizarse el README en consecuencia para reflejar las decisiones tomadas, cambios de configuración, cambios de arquitectura, etc. cualquier cosa que sea relevante y que encaje con lo que se escribe en el README
* El criterio para actualizar el README es siempre con la idea de complementar lo existente (o adaptarlo si es necesario). La idea no es que el README refleje únicamente los cambios que se están realizando. Se tiene que hacer un ejercicio de "merge" entre el contenido existente en el README y los cambios que se han realizado. Todo el contenido del README tiene que estar en inglés.
* El criterio para actualizar los comentarios del código. Los comentarios del código tienen que ser explicativos, no tienen que hacer referencia al refactor que se está haciendo, incluyendo frases como: introducido para..., antes del refactor se hacía..., ahora se hace... Y si ya hay comentarios previos en el código que siguen teniendo sentido tras los cambios que se hagan hay que dejarlos. No quiero comentarios que sirvan para marcar inicios de secciones, por ejemplo en las definiciones de clases, un comentario que simplemente diga que debajo de esta línea hay clases de cierto ámbito, esto con el tiempo no se respeta y deja de tener sentido el comentario
* Estas instrucciones están en en español, y puede que la sección "To Review" o la de "Open Tasks" tenga mezcla de inglés o de español. A la hora de programar código y comentarlo y actualizar el README será siempre en inglés todo.
* Al actualizar el README deja las secciones iniciales "Instructions", "To Review" y "Open Tasks" intactas, ya me encargo yo de poner esto al día. Actualiza a partir de la sección "Solar Panel Shadow Simulator"

# To Review

* En `WallIntersectionFactory` he tenido que invertir la lógica de `isRendered` en `const isRendered = !isStraight && isConvex;`, y lo he dejado como `const isRendered = !isStraight && !isConvex;`. Se estaban renderizando únicamente los WallIntersection que no debían.
* `WallIntersection` ahora tiene un atributo `isRendered`. Es cierto que hay veces que el `WallIntersection` se tiene que "omitir" y no renderizarlo, pero para qué tener la instancia del objeto en la memoria con un atributo `isRendered` e ignorarlo cuando es `true`? Por qué no directamente no tener esa instancia de `WallIntersection` y tener en memoria únicamente las instancias de `WallIntersection` que se tienen que renderizar y que por tanto se tienen que tener en cuenta para el raycasting? Si no tiene sentido mantener esas instancias, refactoriza el código para que no estén en memoria y tampoco tendría sentido tener ese atributo, así que refactoriza para quitarlo. Si por algún motivo tiene sentido mantenerlas en memoria con ese atributo para poder filtrarlas, entonces no hagas nada y déjalo como está.
* En `SiteFactory`, donde se hace el cálculo de `autoTrims` he tenido que comentar la línea `//return [trimStart, trimEnd];` y cambiarla por `return [0, 0];`. Como estaba originalmente (con la línea `return [trimStart, trimEnd];`) el renderizado no era correcto, se hacían trim o extend de forma incorrecta. Con la línea que he dejado `return [0, 0]` el renderizado final es casi correcto, aunque hay casos en los que hay muros que se solapan entre si, visualmente parecería que está bien, pero es incorrecto, ya que las barandillas de estos muros se chocan.
* En `Wall` hay atributos `trimStart` y `trimEnd` que son de uso interno y que creo que tiene sentido que existant, pero según veo en los comentario pueden tener valores positivos o negativos según se quiera acortar o extender el `Wall`. Si se puede acortar o extender, igual el prefijo `trim` no es el más adecuado no? `trim` en inglés no hace referencia únicamente a acortar? Se te ocurre un prefijo mejor para esto? Si no hay uno mejor, mantenemos trim.
* En los ficheros de traducciones, todas las propiedades de `SimulationControls` están agrupadas bajo `simulationControls`. Quiero lo mismo para las que se refieran a `MainControls`.
* Voy a intentar aclarar las situaciones que se pueden dar sobre los muros y sus acortados/extensiones. Diría que sólo haciendo acortados sería suficiente. Voy a dibujar en ASCII unos diagramas para apoyarme en ellos. En los diagramas escribiré los puntos cardinales (N-Norte, S-Sur, E-Este, O-Oeste) como referencia. Usaré `-` para muros horizontales, `|` para verticales, `S` para marcar suelo, `V` para marcar el vacío, `x`, `X`, `y`, `Y`, `z`, `Z` para marcar wall intersections a los que me quiera referir, `a`, `A`, `b`, `B`, `c` `C` para muros a los que me quiera referir

Caso 1

```
       N
  
       V
     x---x
O  V | S | V  E
     x---x
       V
  
       S
```

En este caso no habría que hacer nada (ni extender ni acortar) con ningún muro (`-` y `|`) y todas las intersecciones (`x`) tendrían que existir y renderizarse

Caso 2

```
       N
  
       V
     y---y
     |   a
O  V | S a V  E
     |   a
     |   x
     |   b
     y---y
       V
  
       S
```

En este caso tenemos 2 muros `a` y `b` que están en la misma línea. Esto es así porque tendrán diferentes atributos, por ejemplo el `a` podría ser más alto y sin barandilla y el `b` más bajo y con barandilla. La intersección entre ambos `x` no tendría sentido que existiese ni que se renderizase. Con los muros no habría que hacer nada (ni acortar ni extender). El resto de intersecciones (`y`) sí que tienen que existir. Con el resto de muros (`-` y `|`) tampoco hay que hacer nada (ni acortar ni extender).

Caso 3

```
         N
  
         V
     x-------x
     |       |
     xaaay   |
         b   |
         b   |
     xcccy   |
     |       |
O  V |   S   | V  E
     |       |
     |       |
     |       |
     x-------x
         V
  
         S
```

Este es el caso más interesante por su complejidad. Los muros `a`, `b` y `c` al ser desplazados hacia afuera (la mitad de su thickness), para que no ocupen el suelo, se van a solapar entre sí y también con las intersecciones `y`. Aquí diría que hay varias aproximaciones para resolverlo

Caso 3 - Aproximación 1

Podría acortarse cada uno de los muros `a`, `b` y `c` por el final y las intersecciones `y` dejarían de renderizarse. Esta aproximación no me gusta, porque complica la parte de las barandillas para que queden bien y habría una lógica de que en ciertas esquinas de cierto tipo las intersecciones no se renderizan (además de en las rectas) y en otras esquinas sí. Lo del principio y final es asumiendo que el orden de definición es contrario a las agujas del reloj.

Caso 3 - Aproximación 2

Podría acortarse el muro `a` por el final, el muro `b` por el principio y el final y el muro `c` por el principio. De esta forma las intersecciones `y` sí que tendría sentido que se renderizen. De esta forma todos los muros quedan centrados entre las intersecciones y las barandillas no se ven afectadas, ocupan toda la longitud del muro una vez acortado. Solo hay la acción de acortar, no hay extensión de muro. Esta aproximación la veo mejor. Lo del principio y final es asumiendo que el orden de definición es contrario a las agujas del reloj.

* Se supone que la aplicación soporta ahora ángulos que no son rectos. Pero tras probarlo las intersecciones y muros no se están renderizando correctamente. Pongo un mapa en ASCII de la misma forma que los anteriores para ilustrarlo

```
       N
  
       V
     ----z
     |   a
O  V | S  a V  E
     |     a
     |     x
     |     b
     |    b
     ----y
       V
  
       S
```

En este caso en las intersecciones `x`, `y` y `z` no son a 90º (ángulo recto). Por tanto tanto el final de los muros como las intesecciones de los muros se tienen que adaptar para tener el ángulo y forma adecuada. El final de los muros `a` y `b` no debería acabar en ángulo recto. Las intersecciones `x`, `y` y `z` no son de base rectangular. En este caso la intersección `x` sí tiene sentido que exista, porque no están los muros `a` y `b` en la misma línea. En este caso el muro `b` tendría que acortarse por el final y el muro `a` por el principio. Lo del principio y final es asumiendo que el orden de definición es contrario a las agujas del reloj.

* En base a los 2 puntos anteriores, extrapola una implementación genérica. Quizá no se hayan expuesto todos los casos que se puedan dar a la hora de definir los muros. Analiza si hay algún otro caso evidente que no se haya mencionado. Si el caso que encuentras es muy "edge", y complica mucho la solución, lo documentamos como limitación. Pero los casos expuestos y variantes de los mismos son lo mínimo que me gustaría que la aplicación soportase e implementase de forma correcta. En obras de edificios es raro que haya esquinas realmente a 90º. A la hora de introducirlo en la aplicación se puede simplificar y poner a 90º cosas que no lo sean realmente, pero quiero dar la opción a tener un mínimo de precisión, porque puede que por centímetros entre una placa más o lo contrario y sobre alguna.

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
│   ├── SiteFactory.ts             # Config → Site (walls, intersections, bounding radius)
│   ├── WallFactory.ts             # Wall segment geometry + railing
│   ├── WallIntersectionFactory.ts # Corner posts (convex vertices only)
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
│   └── DeveloperFooter.tsx        # Ko-fi link + personal site
│
└── utils/
    ├── PointXZUtils.ts            # Normal vectors, convexity, prev/next point helpers
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
 
### Wall geometry — three vertex categories
 
The wall perimeter is analysed vertex by vertex. Each vertex falls into one of three categories, detected in `PointXZUtils.pointAlignedWithPreviousAndNext` using the 2D cross product of the incoming and outgoing edge directions:
 
| Category | Cross product | Interior angle | Post rendered | Trim |
|---|---|---|---|---|
| Convex (exterior corner) | > 0 | < 180° | Yes | Positive (shorten) |
| Collinear | ≈ 0 | ≈ 180° | No | 0 |
| Concave (interior corner) | < 0 | > 180° | No | Negative (extend) |
 
Posts are only rendered at convex vertices. At collinear vertices a post would overlap both adjacent walls. At concave vertices the bisector offset points outside the terrace perimeter, which is geometrically incorrect.
 
### Wall auto-trim — unified formula covering all angle types
 
The trim at each wall end is computed by `computeAutoTrim` in `SiteFactory`:
 
```
trim = (wallThickness / 2) / tan(θ / 2)
```
 
where θ is the angle between the two wall direction vectors at the shared vertex, and the sign is determined by the 2D cross product:
 
- Convex (cross > 0): positive trim → wall is shortened so it does not enter the intersection post volume.
- Concave (cross < 0): negative trim → wall is extended beyond the vertex to fill the interior corner gap.
- Collinear (cosHalf ≈ 0): trim → 0.
The previous implementation computed `|sin(θ)|` instead of `tan(θ/2)`, which happened to be correct only for 90° angles.
 
### WallIntersection corner offset — bisector formula
 
The intersection post offset uses:
```
d = wallThickness / (2 * sin(θ/2))
```
where sin(θ/2) is the dot product of one wall normal with the normalised bisector of the two normals. A clamp of 0.1 prevents division by zero for very acute angles.
 
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
 
Each panel is divided into `zones` diode zones.  A NxN grid of sample points is cast toward the sun via raycasting.  A zone is considered **shaded** if the number of shaded sample points reaches the configured `threshold`. Raycasting tests against all shadow-casting geometry in the scene, including other solar panels.
 
### 4. Panel output with bypass diodes
 
| Shaded zones | Without optimizer | With optimizer |
|---|---|---|
| 0 | `basePower` | `basePower` |
| k out of n | `basePower × (n−k)/n × 0.9` (−10% mismatch penalty) | `basePower × (n−k)/n` |
| all | 0 | 0 |
 
### 5. String mismatch
 
Panels in the same string without optimizers are connected in series.  The string output is limited by the least-efficient panel (bottleneck effect):
 
```
stringEfficiency = min(individualEfficiency for each panel in string)
each panel output = peakKw × stringEfficiency
```
 
Strings where every panel has an optimizer are treated as independent — each panel produces at its own efficiency.
 
---
 
## Shadow detection — Raycasting + BVH
 
### Why BVH?
 
Without acceleration, `raycaster.intersectObjects` tests every ray against every triangle in the scene — O(rays × triangles).  For a scene with hundreds of wall and panel faces, and thousands of sample points, this is too slow for interactive use.
 
`three-mesh-bvh` pre-organises each geometry into a **Bounding Volume Hierarchy**: a tree of axis-aligned bounding boxes where each leaf contains a small subset of triangles.  A ray only needs to test O(log n) nodes instead of O(n) triangles, giving a dramatic speedup.
 
### How it is set up
 
1. **Patch Three.js once** (`useBVH.ts`):
   ```ts
   THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
   THREE.Mesh.prototype.raycast = acceleratedRaycast;
   ```
   After this, every `Mesh.raycast` call automatically uses BVH if a bounds tree exists.
2. **Build the BVH** (`useBVH` hook): walks the scene, calls `geometry.computeBoundsTree()` on every shadow-casting mesh.  Rebuilt only when `rebuildKey` changes (site or setup change), not on every frame.
3. **Cast rays** (`useShadowSampler` hook): for each sample point, transforms its local position to world space using the panel's pre-computed world matrix, sets the ray origin, and calls `intersectObjects`.  `firstHitOnly = true` stops BVH traversal after the first hit, saving further work.
4. **Avoid GC pressure**: all `THREE.Vector3`, `THREE.Matrix4`, `THREE.Quaternion` scratch objects are allocated **once at module scope** and reused for every ray, avoiding garbage collector pauses.

### Dirty flag
 
`ShadowedScene` only runs the full raycasting pass when a `needsUpdate` ref is `true`.  The flag is set by a `useEffect` that watches `[sun, activeSetup, density, threshold]`.  Between frames where nothing changes, `useFrame` is a no-op.
 
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
 
**Solución usada**: `Intl.supportedValuesOf('timeZone')` (API nativa del navegador, sin dependencias) para la lista completa de timezones IANA. El preset inicial es `Intl.DateTimeFormat().resolvedOptions().timeZone` (timezone detectada por el navegador). El usuario confirma o cambia mediante el selector en la UI.
 
### UTC en los cálculos
 
`date.toDate()` (nativo `Date` de JS) siempre representa un instante UTC. SunCalc recibe este valor. La timezone nunca afecta a los cálculos de posición solar ni de producción.
 
---
 
## Known limitations
 
- **Single year**: time controls are constrained to the current year.
- **No diffuse irradiance**: only direct (beam) irradiance is modelled.
- **Annual simulation not yet implemented**.
- **Very acute wall angles (< ~11°)**: the bisector formula clamps sin(θ/2) to 0.1, which produces a slightly incorrect post position. Not a realistic scenario for terrace walls.
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
 
The 2D cross product of the incoming and outgoing edge directions at a vertex cleanly separates the three geometrically distinct cases (convex, collinear, concave) in a single operation. The sign encodes the turn direction for a counter-clockwise polygon: positive = left turn = convex, negative = right turn = concave. This is more robust than comparing angles and handles degenerate cases gracefully.
 
### Auto-trim formula — tan(θ/2) not sin(θ)
 
The correct formula for the trim at a wall end is `(wallThickness/2) / tan(θ/2)`. The half-angle is computed from the dot product of the two wall direction vectors using the identities `sin(θ/2) = sqrt((1−cosθ)/2)` and `cos(θ/2) = sqrt((1+cosθ)/2)`. The previous implementation computed `|sin(θ)|` instead, which coincidentally gave the right answer at 90° but diverged for all other angles. The correct formula also naturally handles concave corners: `tan(θ/2)` is negative for θ > 180°, yielding a negative trim (extension) without any special-casing.
 
### Bisector formula vs sum-of-normals
 
The sum of two unit normals gives the bisector direction but not the correct magnitude for a corner offset. The magnitude depends on the angle: `wallThickness / (2 * sin(θ/2))`. For 90° the two approaches coincidentally agree; for other angles the error grows. Always derive geometry from trigonometric first principles rather than geometric shortcuts whose domain of validity is not obvious.
 
### Timezone as UI state, not domain state
 
`timezone` was initially stored on the `Site` object (a domain model). Moving it to the store as independent UI state clarifies the separation: `Site` is geometric data computed once from the config; timezone is a display preference the user can change at runtime without recomputing any geometry. The `makeDateInTimezone` function exported from the store is the boundary between "what the user typed" and "what UTC instant the store holds".
 
### Setup id derived, not configured
 
Requiring users to provide a unique `id` alongside a human-readable `label` is redundant and error-prone. The internal id is derived deterministically from the label (normalised) plus the array index, which guarantees uniqueness. Users only see and configure `label`.
 
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
## Geometría de Muros — Tres Tipos de Vértice
 
Al analizar el perímetro de la terraza vértice a vértice, cada punto cae en una de tres categorías detectadas mediante el producto vectorial 2D de las direcciones de entrada y salida:
 
* **Vértice convexo** (esquina exterior, ángulo interior < 180°): se renderiza un post de intersección. Los muros se recortan para no penetrar en el post.
* **Vértice colineal** (ángulo ≈ 180°): no se renderiza post. Sin recorte.
* **Vértice cóncavo** (esquina interior, ángulo interior > 180°): no se renderiza post (el offset del bisector apuntaría fuera de la terraza). Los muros se **extienden** más allá del vértice para cubrir la esquina interior.
La fórmula unificada `trim = (thickness/2) / tan(θ/2)` cubre los tres casos automáticamente: positiva para convexos (recorte), cero para colineales, negativa para cóncavos (extensión).
