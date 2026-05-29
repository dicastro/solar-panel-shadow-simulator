# Coordinate System

## Config space vs Three.js scene space

The application uses two coordinate systems that must be clearly distinguished.

**Config space** (what you write in `config.json`):

```
          North (+Z)
          ↑
West ─────┼───── East (+X)
          ↓
          South (−Z)
```

**Three.js scene space** (how the 3D renderer works):

```
          North (−Z)
          ↑
West ─────┼───── East (+X)
          ↓
          South (+Z)
```

The Z axis is flipped between the two systems. When `SiteFactory` converts wall points from config space to Three.js space it negates Z: `threeZ = -(configZ - centerZ)`.

## Azimuth convention

Both the site azimuth and the panel array azimuth follow the same convention:

| Value | Direction |
|---|---|
| 0° | South-facing |
| +45° | South-East facing |
| +90° | East-facing |
| −45° | South-West facing |
| −90° | West-facing |
| ±180° | North-facing |

The site group in Three.js applies `rotation-y = azimuthRad`. Three.js rotation-y positive = anticlockwise from above = rotation toward West, which matches the config convention (positive azimuth = toward East requires negating the rotation). `SiteFactory` stores `azimuthRad = (azimuth * π) / 180` and `Scene.tsx` applies `-site.azimuthRad` as the Three.js rotation-y.

**Panel array azimuth is absolute, not relative to the site azimuth.** Both are measured from South using the same convention. A panel array with `azimuth: 0` always faces South regardless of the site azimuth.

## Three.js rotation-y matrix

Three.js applies `Ry(θ)` as:

```
x' =  cos(θ)·x + sin(θ)·z
z' = −sin(θ)·x + cos(θ)·z
```

Note the positive sign on `sin(θ)` in the x' row. This is used to derive world-space positions in `SolarPanelArrayFactory`.

## SW corner reference point

The South-West corner is defined as the minimum X and minimum Z across all wall points in config space:

```typescript
swCornerX = Math.min(...wallPoints.map(p => p[0]));
swCornerZ = Math.min(...wallPoints.map(p => p[1]));
```

Panel array positions (`arrays[].position = [configX, configZ]`) are measured from this corner in the site's rotated frame:

- `+configX` = East along the rotated site axis
- `+configZ` = North along the rotated site axis

The conversion to world space accounts for the site rotation:

```
offsetWorld.x =  cos(siteAz)·configX − sin(siteAz)·configZ
offsetWorld.z = −sin(siteAz)·configX − cos(siteAz)·configZ
```

## Panel rotation order

Panel rotations use Euler order `'YXZ'`:

1. **Y rotation** = azimuth (applied first — rotates the panel to face the correct compass direction)
2. **X rotation** = inclination (applied second — tilts the panel up around its own East-West axis)

With `'YXZ'` order, the X rotation always tilts around the panel's own East-West axis regardless of azimuth, keeping panel edges parallel to the ground.

## Panel normal

A flat panel (zero rotation) has normal `(0, 1, 0)` — pointing straight up. Applying the panel's world rotation to this vector gives the world-space normal used for Lambert's cosine law:

```typescript
const normal = new THREE.Vector3(0, 1, 0).applyEuler(worldRotation);
```

## Panel indexing within an array

| Index | 0 = … | Increases toward… |
|---|---|---|
| `row` | Southernmost row (bottom of slope) | North |
| `col` | Westernmost column | East |

This is the physical order on a South-facing tilted array: row 0 is at the bottom of the slope, the last row is at the top.