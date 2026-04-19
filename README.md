# Improvements

* I think that the `overrides` of `three-mesh-bvh` has to remain in the `package.json`. It was added because there is a conflict with a transient version of `three-mesh-bvh` coming from `@react-three/drei` or `@react-three/fiber`
* There is a discrepancy between the time selected in the maincontrols ui component and the time displayed. This issue happens in months where there is a time saving change in the hour. For example, in Europe/Madrid this discrepancy happens in january, february, begining of march, end of october, november and december. The timezone should be extracted from config.json and be translated to a field in main controls, initialized with a preset of supported timezones. A change in the timezone should not affect any calculation as it is only a way of displaying the date/time in the ui, all the calculations should be done in UTC to do not be affected by this. The time introduced in the form field should be always interpreted as the local time in the selected timezone, so if the timezone changes, the value of the time field does not have to be changed

# Open tasks

- [ ] Add setup selector in the UI to switch between configured setups
- [ ] Implement annual simulation loop (step through year at configured interval, accumulate kWh per panel/setup)
- [ ] Display a graph with the total annual production and production per month (use a radar/spider graph)
- [ ] Implement daily simulation loop (step through year at configured interval, accumulate kWh per panel/setup)
- [ ] Display a grapth with the curve representing the accumulated hourly production
- [ ] Investigate to get the estimated sun irradiation taking into account climate from a third party (PVGis??) and be able to choose to activate it for the simulation
- [ ] Cache the estimated sun irradiation taking into account climate from a third party (PVGis??)
- [ ] Export graphs (or calculated data) in some way (pending to decide if png, pdf, csv)
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
9. [Known limitations](#known-limitations)
10. [Open tasks](#open-tasks)

---

## What it does

- Renders a rooftop installation in 3D (walls, railings, solar panels) using Three.js.
- Animates the sun's trajectory across the sky for any date and time.
- Detects which panel zones are shaded using raycasting against wall/railing geometry.
- Estimates instantaneous power output in kW, applying bypass-diode, string-mismatch and optimizers logic.
- Supports multiple installation layouts ("setups") defined in a JSON config file.
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
│   ├── config.ts                  # JSON config shapes (InstallationConfiguration, …)
│   ├── geometry.ts                # PointXZ, Vector3, Euler3 (renderer-agnostic)
│   ├── installation.ts            # Domain models: Site, Wall, SolarPanel, …
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
│
└── utils/
    ├── PointXZUtils.ts            # Normal vectors, prev/next point helpers
    └── ThreeConverter.ts          # Domain Vector3/Euler3 → THREE.Vector3/Euler
```

---

## Architecture decisions

### Factory pattern for domain models

All domain objects (`Site`, `SolarPanel`, `Wall`, …) are plain immutable value objects created by dedicated factory functions.  React components never construct domain objects — they only consume them.

This separation means:
- Factories can be unit-tested without a browser or a canvas.
- React components are purely presentational: they receive pre-computed `renderData` and render it.
- Changing a calculation (e.g. panel world position) only touches one factory, not the component tree.

### Pre-computed render data

`SolarPanelFactory` embeds a `renderData` object into every `SolarPanel`.  This includes:
- `actualWidth` / `actualHeight` — orientation-adjusted dimensions.
- `frameColor` / `emissiveColor` — derived from `hasOptimizer`.
- `zones: ZoneRenderData[]` — pre-computed position and size of every diode zone.

`SolarPanelComponent` is therefore a pure render function: it loops over `renderData.zones` and draws, with zero geometry calculation.

### Why `ArrayOrigin` lives in `SolarPanelArrayFactory`

A panel's world position depends on the array's tilt, elevation, and total size.  Previously, `SolarPanelFactory` recomputed the array-level geometry (`totalArrayWidth`, `yOffset`, `zVisualContraction`) for every single panel — O(rows × columns) redundant calculations.  Now `SolarPanelArrayFactory` computes an `ArrayOrigin` once and passes it to each `SolarPanelFactory.create` call.

### Zustand store

The store holds all application state.  Components subscribe to individual slices via selectors (`useAppStore(s => s.date)`) so a time change only re-renders time-sensitive components, not the whole tree.

The store is the only place that calls factories.  `loadConfig` builds `Site` and `PanelSetup`; `setDensity` rebuilds only `PanelSetup`; `setActiveSetupId` switches layouts without touching the `Site`.

### Dirty-flag raycasting in `ShadowedScene`

Raycasting is expensive. `ShadowedScene` uses a `needsUpdate` ref as a dirty flag: shadow rays are only cast when one of the relevant inputs changes (sun position, active setup, density, threshold).  Between frames where nothing changes, `useFrame` returns immediately.

---

## Coordinate system

### Config space (what you write in `config.json`)

```
      North (+Z)
          ↑
          |
West ─────┼───── East (+X)
          |
          ↓
      South (−Z)
```

- `wallPoints` use `[x, z]` pairs where `+X = East` and `+Z = North`.
- `position` in panel arrays follows the same convention.
- Positive Z values go **towards North** (intuitive for the person editing the file).

### Three.js scene space (internal)

```
      North (−Z)
          ↑
          |
West ─────┼───── East (+X)
          |
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

```jsonc
{
  "site": {
    "location": { "latitude": 40.62, "longitude": -4.01 },
    "azimuth": 0,           // degrees, South=0, positive=West
    "timezone": "Europe/Madrid",
    "wallPoints": [[0,0], [3.7,0], ...],  // metres, +X=East, +Z=North
    "wallDefaults": { "height": 0.7, "thickness": 0.2 },
    "railingDefaults": { "active": true, "heightOffset": 0.18, "thickness": 0.05, "shape": "round" },
    "wallsSettings": [
      // Override per-segment. wall = segment index (see numbering above)
      { "wall": 2, "trimStart": 0.5, "override": { "height": 1.8, "railing": { "active": false } } }
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

### `zonesDisposition` explained

| Value | Visual layout | Split axis |
|---|---|---|
| `"horizontal"` | Zones are horizontal bands (top half / bottom half) | Z axis (height) |
| `"vertical"` | Zones are vertical columns (left / right) | X axis (width) |

Most residential panels use `"horizontal"` because bypass diodes are wired across rows of cells that run across the panel width.

---

## Solar production model

### 1. Sun position

`suncalc.getPosition(date, lat, lon)` returns altitude (elevation above horizon in radians) and azimuth (clockwise from South in radians). These are converted to a Three.js direction vector:

```ts
x =  cos(altitude) * sin(-azimuth)   // East (+) / West (−)
y =  sin(altitude)                    // Up
z =  cos(altitude) * cos(azimuth)    // South (+) / North (−) in Three.js
```

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

---

## Known limitations

- **90° corners only**: wall intersection offset logic assumes right-angle corners. Acute or obtuse angles will produce visually incorrect post positions.
- **No inter-panel shading within an array**: sample points only test against walls and railings, not against other panels in the same array (relevant for steeply tilted rows).
- **Single year**: the time controls are constrained to the current year. Multi-year comparison is not supported.
- **No diffuse irradiance**: the model uses only direct (beam) irradiance. Overcast production is not modelled.
- **Annual simulation not yet implemented**: the UI has a "Run Calculation" button but the year-loop logic is not yet wired up.

---

# My Documentation

## ☀️ Lógica de Producción y Sombras

### 1. El Concepto de Zonas (Diodos de Bypass)

Un panel solar no es una única pieza eléctrica, sino un conjunto de celdas conectadas en serie. Habitualmente, los paneles se dividen en **3 zonas verticales** (o según tu config) protegidas por **diodos de bypass**.

* **Sin Sombra**: La corriente fluye por todas las celdas
* **Con Sombra en una zona**: El diodo de esa zona "se activa" y hace que la corriente salte esa zona para que el resto del panel siga funcionando
  * *Resultado*: Si 1 de 3 zonas tiene sombra, el panel pierde **1/3** de su producción (produce el 66.6%)
  * *Importante*: Si la sombra toca aunque sea un solo punto de una zona, esa zona entera se considera "anulada" eléctricamente

### 2. Comportamiento del String (Sin Optimizadores)

En un string, todos los paneles están conectados en serie. La corriente es como el agua en una tubería: **el caudal lo marca el punto más estrecho**.

* **Caso A (Sombra en 1 zona de 1 panel)**: Ese panel baja al 66%. Como el string es una serie "pura", **todos los paneles del string bajan su producción al 66%**, aunque les esté dando el sol plenamente. Es el efecto "cuello de botella"
* **Caso B (Sombra total en 1 panel)**: Si un panel se sombrea por completo (todas sus zonas), el string entero cae a **0%** (o a un valor residual ínfimo), a menos que los diodos del panel sombreado permitan puentearlo por completo, pero la pérdida de voltaje suele desplomar la eficiencia del inversor

### 3. Comportamiento con Optimizadores

Un optimizador es un convertidor DC/DC que se instala en cada panel. Su función es "aislar" el rendimiento de ese panel del resto del string.

* **¿Cómo funciona?**: El optimizador ajusta el voltaje y la corriente de su panel para que el "cuello de botella" no afecte a los demás
* **Caso A (Sombra en 1 zona de 1 panel optimizado)**:
  * El panel afectado pierde **1/3** de su producción (produce el 66%)
  * **¡El resto de paneles del string siguen produciendo al 100%!**
* **Caso B (Sombra total en 1 panel optimizado)**:
  * Ese panel produce **0%**
  * El resto del string sigue produciendo al **100%**

## 📋 Matriz de Combinaciones para el Algoritmo

Para tu simulación, el cálculo debe seguir este orden jerárquico:

| Escenario | Afectación Individual (Panel) | Afectación Global (String) |
|-----------|-------------------------------|----------------------------|
| Sin Sombras | 100% | 100% |
| Sombra en 1 Zona (Sin Optimizador) | Produce: (`Zonas Libres / Zonas Totales`) | **Todos** los paneles del string limitados a ese mismo % |
| Sombra en 1 Zona (Con Optimizador) | Produce: (`Zonas Libres / Zonas Totales`) | El resto del string produce al **100%** |
| Sombra en Varias Zonas (Mezcla) | Cada panel calcula su % máximo posible. | El string sin optimizadores se queda con el **% del panel más afectado**. |

### Variables adicionales a programar:

* **Incidencia Solar (Coseno)**: Antes de aplicar sombras, la producción base depende del ángulo. Si el sol no está perpendicular, el panel produce `PeakPower * cos(θ)`.
* **Umbral de Zona**: Debes decidir en tu código: ¿Cuántos puntos rojos hacen que una zona caiga?
  * *Lógica estricta*: 1 punto rojo = zona al 0%
  * *Lógica permisiva*: Si > 20% de los puntos de la zona son rojos = zona al 0%. (Es más realista, ya que sombras muy pequeñas a veces no activan el diodo)

## Hooks

* **useBVH hook**: construye el BVH una sola vez cuando cambia la escena (muros/paneles), y lo reconstruye solo si cambia `activeSetup` o `site`. El BVH es una estructura de aceleración sobre la geometría estática — los muros no se mueven, así que el BVH de los muros se construye una vez y nunca se recalcula
* **useShadowSampler hook**: en cada frame (o cada N ms), lanza todos los rayos de todos los sample points en una sola pasada usando el BVH. Devuelve un `Map<pointId, isShaded>`