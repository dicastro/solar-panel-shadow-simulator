# TO REVIEW

* **No inter-panel shading within an array**: sample points only test against walls and railings, not other panels (relevant for steeply tilted rows). Is this true??? When I display points in the rendered model I see the sample points of some panels affected by the shadow of other panel. This is critical to have a trustable estimation of production
* In the last refactor it was included the possibility to setup railing supports, are those taken into consideration for the raycasting?
* The walls are not connected correctly so that functionality has not been correctly implemented. There was a refactor to avoid the user having to configure `trimStart` and `trimEnd` in the wall settings in order to avoid overlapping the wall with the wall intersections. This refactor is not correctly implemented and walls are not correctly connected to the interections. The intersections are correctly placed, but the walls are not connected to them.
* `trimStart` y `trimEnd` should be completely removed
* In `Scene.tsx` the argument `args` of `<cylinderGeometry>` for `case 'half-cylinder'` is marked as an error in the IDE because an array of 5 `number` (`[number, number, number, number, number]`) is passed and that is not expected by Three.js, that is not the correct way to configure a half cilinder
* The file `useAppStore.ts` could not be downloaded from your last proposal, so I inferred the content. For the method `makeDateInTimezone` I did not implement it correctly. Review the code using this method in order to implement it correctly. I also implemented the `setTimezone` and refactored `setDensity` to use `rebuildSamplePoints` and also implemented `rebuildSamplePoints`. Verify also that all of this is correct
* Why `Omit<Props, 'showPoints'> & { showPoints: boolean })` in `ShadowedScene`? Why keeping that attribute in the `Props` interface if then it is omited? Why not just removing it from the `Props`
* In `SiteFactory` this variable `const railing = resolveRailing(i);` is not used for the walls creation. Is that right? Something forgotten in the last refactor?
* In `SimulationControls` the calculation for the `totalRays` can be done by counting the total number of zones, instead of getting all panels in one side and then getting the max number of zones. Each panel array could have a different number of zones, but all the zones will have the same density. So it would be better to iterate over the arrays and then over the panels summing the zones. It should be simpler if the displayed information is changed, the important thing here is the total number of calculations (totalRays = density * totalZones * timeSteps). So instead of displaying the pointsPerPanel it should be displayed the total number of points in the installation, the total time steps, and the total number of calculations
* It is worthless to have an id+label for the setups. This is a technical thing, what the user should configure only is the label of the setup. The selection of the setup should be based in the positioning in the array of setups not in the id

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
- Detects which panel zones are shaded using raycasting against wall/railing geometry.
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
│   ├── WallIntersectionFactory.ts # Corner / straight-point posts
│   ├── PanelSetupFactory.ts       # PanelSetupConfiguration + Site → PanelSetup
│   ├── SolarPanelArrayFactory.ts  # Computes array origin, creates panels
│   ├── SolarPanelFactory.ts       # Single panel world position + render data
│   ├── SamplePointFactory.ts      # Sample points for raycasting per panel
│   ├── PointXZFactory.ts          # Safe PointXZ constructor
│   └── PanelSetupFactory.ts
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
│   └── SimulationControls.tsx     # Simulation settings UI panel
│   └── DeveloperFooter.tsx        # Ko-fi link + personal site
|
└── utils/
    ├── PointXZUtils.ts            # Normal vectors, prev/next point helpers
    └── ThreeConverter.ts          # Domain Vector3/Euler3 → THREE.Vector3/Euler
    └── timezoneUtils.ts           # getAllTimezones(), getBrowserTimezone(), resolveInitialTimezone()
```

---

## Architecture decisions

### Factory pattern for domain models

All domain objects are plain immutable value objects created by dedicated factory functions. React components never construct domain objects — they only consume pre-computed `renderData`.

### Pre-computed render data with discriminated unions

Railing shapes use a discriminated union (`kind: 'square' | 'cylinder' | 'half-cylinder'`). The factory computes the exact Three.js geometry args for each shape and stores them in the render data. `Scene.tsx` switches on `kind` to render the correct geometry without any cast. TypeScript will error if a new shape is added to the union but not handled in the switch — this is the primary benefit of discriminated unions over string enums.

### Density changes do not rebuild panel geometry

`PanelSetupFactory.rebuildSamplePoints(existing, density)` reuses all panel geometry and only regenerates the NxN sample point grids. `setDensity` in the store calls this instead of a full `create()`. See [Lessons learned](#lessons-learned).

### Two distinct tick mechanisms

- **Interactive playback** (`tickHour`): advances 1 hour per 100 ms interval. Unit fixed at 1 hour.
- **Annual simulation** (planned): will use `simulationInterval` (15/30/60 min) in its own loop, separate from interactive playback.

### `showPoints` excluded from shadow dirty flag

`showPoints` only controls rendering of sample point spheres. It does not affect shadow computation. Including it in the `useEffect` dependency array would trigger a full raycasting pass on every toggle — intentionally excluded with a comment.

### Shadow mesh cache in `useShadowSampler`

The list of shadow-casting meshes is built via `scene.traverse` once and stored in a `useRef`, invalidated only when `rebuildKey` changes. This avoids O(scene nodes) traversal on every raycasting pass.

### Timezone as store state, not Site geometry

`timezone` is absent from the `Site` type. It lives in `useAppStore.timezone` as UI/display state because:
1. The user can change it at runtime without reloading geometry.
2. All solar calculations use `date.toDate()` (native `Date`, always UTC). Timezone never affects calculations.
3. `SiteFactory` only deals with geometry — injecting a display concern would violate separation of concerns.

### Wall auto-connect replaces manual trimStart/trimEnd

`SiteFactory` now calculates the trim for each wall end automatically using:
```
trim = wallThickness / (2 * tan(θ/2))
```
where θ is the interior angle at the intersection. This is exact for any angle. The deprecated `trimStart`/`trimEnd` config fields are ignored. Users no longer need to know the geometry to configure walls correctly.

### WallIntersection corner offset — bisector formula

The previous sum-of-normals approach was only correct for 90° corners. The correct formula for any angle uses the normalised bisector of the two adjacent normals, with distance:
```
d = wallThickness / (2 * sin(θ/2))
```
sin(θ/2) is computed as the dot product of one normal with the normalised bisector. A clamp of 0.1 prevents division by zero for angles below ~11°.

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
    "id": "my-layout",
    "label": "Human-readable name",
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
| `half-cylinder` | `radius`, `orientation: 'up'\|'down'` | `CylinderGeometry` with `thetaStart`/`thetaLength = π` |

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

Each panel is divided into `zones` diode zones.  A NxN grid of sample points is cast toward the sun via raycasting.  A zone is considered **shaded** if the number of shaded sample points reaches the configured `threshold`.

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

`ShadowedScene` only runs the full raycasting pass when a `needsUpdate` ref is `true`.  The flag is set by a `useEffect` that watches `[sun, activeSetup, showPoints, density, threshold]`.  Between frames where nothing changes, `useFrame` is a no-op.

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

### geo-tz — descartado para browser

`geo-tz` es la librería más precisa para inferir timezone desde coordenadas GPS, pero lee datos geográficos desde disco en runtime y **no es compatible con bundlers de browser**. Sus datos (~10 MB de GeoJSON) no pueden incluirse en un bundle estático de GitHub Pages.

**Solución usada**: `Intl.supportedValuesOf('timeZone')` (API nativa del navegador, sin dependencias) para la lista completa de timezones IANA. El preset inicial es `Intl.DateTimeFormat().resolvedOptions().timeZone` (timezone detectada por el navegador). El usuario confirma o cambia mediante el selector en la UI.

### UTC en los cálculos

`date.toDate()` (nativo `Date` de JS) siempre representa un instante UTC. SunCalc recibe este valor. La timezone nunca afecta a los cálculos de posición solar ni de producción.

---

## Known limitations

- **No inter-panel shading within an array**: sample points only test against walls and railings, not other panels (relevant for steeply tilted rows).
- **Single year**: time controls are constrained to the current year.
- **No diffuse irradiance**: only direct (beam) irradiance is modelled.
- **Annual simulation not yet implemented**.
- **Very acute wall angles (< ~11°)**: the bisector formula clamps sin(θ/2) to 0.1, which produces a slightly incorrect post position. Not a realistic scenario for terrace walls.
- **Railing connect piece for mismatched shapes**: when the two walls meeting at a corner have different railing shapes, the connect piece uses the shape of the incoming wall. A small visual mismatch may be visible at the corner.

---

## Lessons learned

### `useEffect` dependency arrays must reflect semantic intent

A dependency should be included if its change logically invalidates the effect's output — not merely because it is read inside the effect. `showPoints` was in the shadow dirty-flag effect but does not affect shadow computation; removing it prevents expensive raycasts on every visibility toggle. Always document intentional omissions with a comment.

### Separating factory methods by what changes

`PanelSetupFactory.rebuildSamplePoints` vs `create`: sample point density is the only input that changes interactively. Panel geometry (positions, rotations, zone layouts) is stable between density changes. Separate entry points make the intent explicit at the call site and avoid redundant computation.

### Caching scene traversal in hooks

`scene.traverse` is O(scene nodes). Running it on every raycasting pass wastes CPU when the scene is stable. Cache the result in a `useRef` and invalidate with the same key used to rebuild the BVH — they share the same invalidation signal.

### The three-mesh-bvh override

npm `overrides` are appropriate when a package patches a shared global (a prototype) and two instances would mean only one gets patched — silently. This is not a hack; it is the semantically correct declaration that this package must have exactly one instance in the dependency tree.

### Discriminated unions over string enums for geometry variants

A `kind: 'square' | 'cylinder' | 'half-cylinder'` discriminated union carries its own shape-specific parameters with no casts needed. A switch on `kind` is exhaustively checked by TypeScript — adding a new shape without handling it in the renderer is a compile error, not a runtime surprise. Compare with the previous `shape: 'round' | 'square'` string + separate dimension fields, where any consumer had to know which fields existed for which shape.

### Bisector formula vs sum-of-normals

The sum of two unit normals gives the bisector direction but not the correct magnitude for a corner offset. The magnitude depends on the angle: `wallThickness / (2 * sin(θ/2))`. For 90° the two approaches coincidentally agree; for other angles the error grows. Always derive geometry from trigonometric first principles rather than geometric shortcuts whose domain of validity is not obvious.

### Timezone as UI state, not domain state

`timezone` was initially stored on the `Site` object (a domain model). Moving it to the store as independent UI state clarifies the separation: `Site` is geometric data computed once from the config; timezone is a display preference the user can change at runtime without recomputing any geometry. The `makeDateInTimezone` function exported from the store is the boundary between "what the user typed" and "what UTC instant the store holds".

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
* **¿Cómo funciona?**: El optimizador ajusta el voltaje y la corriente de su panel para que el "cuello de botella" no afecte a los demás
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