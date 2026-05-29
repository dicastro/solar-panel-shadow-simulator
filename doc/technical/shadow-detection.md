# Shadow Detection

## Raycasting

For each simulation time step where the sun is above the horizon, the simulator casts rays from sample points on each panel toward the sun. A panel zone is considered shaded when enough of its sample points are blocked.

The ray direction is the sun direction vector (computed by SunCalc). If any geometry (wall, railing, support post, or another panel) intersects the ray at a distance > 0.01 m from the origin, the sample point is considered shaded.

```
origin    = world-space position of the sample point (slightly above panel surface)
direction = sun direction vector
isShaded  = any hit at distance > 0.01 m
```

The 0.01 m minimum distance prevents self-intersection (the ray starting just below the panel surface would hit the panel itself).

## BVH acceleration

Without acceleration, raycasting tests every triangle in the scene for every ray — O(n) per ray, where n is the total triangle count. With a Bounding Volume Hierarchy (BVH), rays only test O(log n) triangles.

The library `three-mesh-bvh` pre-organises each mesh's geometry into a BVH at scene load time (and whenever the scene topology changes). The simulator patches `THREE.Mesh.prototype.raycast` with the accelerated version globally.

Two additional optimisations:

**`firstHitOnly = true`** — stops BVH traversal after the first intersection. Since we only need to know *whether* the path is blocked (not how many things are in the way), there is no reason to find all intersections.

**Mesh cache** — the list of shadow-casting meshes is built once by traversing the scene graph and stored. It is only rebuilt when the active setup or site changes (via `rebuildKey`).

**Scratch objects** — `Vector3`, `Matrix4`, and `Quaternion` instances are allocated once at module scope and reused for every ray, avoiding garbage collection pressure during the simulation loop.

## Sample points

Each bypass-diode zone has an N×N grid of sample points in local panel space. The density N is configurable (UI default: 4 → 16 points per zone). Sample points are placed at:

```
localX = posX + (col / (N−1) − 0.5) × zoneWidth
localZ = posZ + (row / (N−1) − 0.5) × zoneHeight
localY = 0.02   (2 cm above panel surface)
```

For the annual simulation, sample points are pre-transformed to world space by `SolarPanelConverter.toWorldSpaceSamplePoints()` so the worker only needs to apply the ray-cast, not a matrix multiplication, at every time step.

## Zone threshold

The zone shadow threshold T (configurable, default 1) determines how many sample points must be shaded before the entire zone is considered blocked:

```
isZoneShaded = shadedPointCount >= T
```

With density 4 (16 points per zone) and threshold 4, a zone is blocked only when at least 4 of its 16 points are shaded — roughly 25% of the zone area. Higher thresholds require denser shading before a zone activates its bypass diode.

## Worker serialisation

The annual simulation runs in a Web Worker. Three.js scene objects cannot be transferred directly to a worker. The geometry is serialised using:

1. `MeshBVH.serialize()` — produces plain typed arrays from the BVH
2. Panel frame meshes are built by `PanelMeshFactory` directly from `SimulationPanelData` for each setup, independently of the live scene
3. All typed array buffers are zero-copy transferred via `postMessage` with the `transfer` option

The worker reconstructs meshes from typed arrays using `MeshBVH.deserialize()` and standard Three.js math classes (`Vector3`, `Matrix4`, `Raycaster`), which have no DOM or WebGL dependencies.