# Solar Production Model

## Overview

The simulator uses two irradiance models selectable in the annual simulation controls:

| Model | Requires network | Interval options | Year support |
|---|---|---|---|
| Geometric (clear-sky) | No | 15, 30, 60 min | Current + past 5 years |
| Open-Meteo (real weather) | Yes | 60 min only | Past 5 years |

## 1. Sun position

Sun altitude and azimuth are computed using [SunCalc](https://github.com/mourner/suncalc) from the installation's GPS coordinates and the UTC timestamp of each simulation step. Steps where `altitude ≤ 0` (sun below the horizon) produce zero power and skip raycasting entirely.

The sun direction vector in Three.js space:

```
x =  cos(altitude) × sin(−azimuth)
y =  sin(altitude)
z =  cos(altitude) × cos(azimuth)
```

## 2. Geometric model (clear-sky)

When no weather data is available, power is estimated from geometry alone:

```
incidenceFactor = max(0, dot(sunDirection, panelNormal))
basePower (kW)  = peakPower (Wp) / 1000 × incidenceFactor
```

`incidenceFactor` is Lambert's cosine law — it equals 1 when the sun is perpendicular to the panel and 0 when the sun is parallel to or behind the panel.

This model assumes constant clear-sky irradiance of 1000 W/m² (Standard Test Conditions). It overestimates production on cloudy days and ignores diffuse sky radiation.

## 3. Plane-of-Array (POA) irradiance model (Open-Meteo)

When real hourly weather data is available, the simulation computes full POA irradiance by decomposing into three components:

### Direct component

```
POA_direct = DNI × cos(angle_of_incidence)
= DNI × incidenceFactor
```

DNI (Direct Normal Irradiance) is the beam radiation on a surface perpendicular to the sun.

### Diffuse component — isotropic sky model

```
POA_diffuse = DHI × (1 + cos(tilt)) / 2
```

DHI (Diffuse Horizontal Irradiance) is scattered sky radiation on a horizontal surface. The factor `(1 + cos(tilt)) / 2` is the **sky view factor** — the fraction of the sky hemisphere visible from a tilted surface. At 0° tilt (flat) it equals 1; at 90° (vertical) it equals 0.5.

The isotropic sky model assumes uniform sky radiance. This slightly underestimates diffuse on clear days (when the circumsolar region is brighter) and overestimates on partly cloudy days, but is accurate enough for residential comparison purposes.

### Albedo component (ground reflection)

```
GHI         = DNI × cos(solar_zenith) + DHI
= DNI × sin(altitude) + DHI
POA_albedo  = GHI × groundAlbedo × (1 − cos(tilt)) / 2
```

The factor `(1 − cos(tilt)) / 2` is the **ground view factor** — the fraction of the ground hemisphere visible from the tilted surface. At 0° tilt it equals 0 (panel does not see the ground); at 90° tilt it equals 0.5.

`groundAlbedo` is configurable in `site` (default 0.20, typical for concrete/asphalt).

### Total POA and base power

```
POA       = max(0, POA_direct + POA_diffuse + POA_albedo)
basePower = peakPower / 1000 × (POA / 1000)
```

The division by 1000 normalises against the STC reference irradiance of 1000 W/m².

## 4. Temperature correction

Cell temperature rises above ambient due to solar heating. This reduces efficiency because silicon PV cells have a negative temperature coefficient.

### NOCT model

```
T_cell = T_ambient + (NOCT − 20) / 800 × POA
```

Where:
- `T_ambient` is the hourly ambient temperature from Open-Meteo (°C)
- `NOCT` is the Nominal Operating Cell Temperature from the panel datasheet (typically 44–48°C)
- 20°C and 800 W/m² are the NOCT reference conditions
- POA is in W/m²

### Temperature factor

```
temperatureFactor = max(0, 1 + γ × (T_cell − 25))
```

Where `γ` is the temperature coefficient (typically −0.004 /°C for monocrystalline silicon). At 25°C the factor is 1 (no correction). At 50°C with γ = −0.004 the factor is 0.90 (10% reduction).

### Corrected base power

```
basePower_corrected = basePower × temperatureFactor
```

Temperature correction is only applied when ambient temperature data is available (Open-Meteo). With the geometric model a fixed 20°C is assumed (no correction).

## 5. Panel output — bypass diodes

Each panel is divided into bypass-diode zones. A zone is considered shaded when the number of shaded sample points in it meets or exceeds the zone shadow threshold.

```
shadedCount = number of shaded zones out of total zones n
efficiency  = (n − shadedCount) / n
```

**Without optimizer:**

```
panelPower = basePower × efficiency × 0.9
```

The 10% mismatch penalty models the voltage mismatch when bypass diodes are active — remaining cells must operate at a sub-optimal voltage set by the string.

**With optimizer:**

```
panelPower = basePower × efficiency
```

The optimizer isolates the panel's operating point from the string, so only proportional loss applies.

If all zones are shaded: `panelPower = 0`.
If no zones are shaded: `panelPower = basePower`.

## 6. String mismatch

Panels are connected in series within strings. Without optimizers, the string current is limited by the weakest panel:

```
worstEfficiency = min(power / basePower) across all panels in the string
stringPanelPower[i] = basePower[i] × worstEfficiency
```

If any panel in the string has an optimizer, all panels in that string are treated as independent (no mismatch constraint).

## 7. System losses

Applied once to the total power after string mismatch:

```
systemLossFactor = inverterEfficiency × (1 − wiringLoss)
effectivePower   = stringPower × systemLossFactor
```

`inverterEfficiency` (default 0.97) and `wiringLoss` (default 0.02) are configurable at the `site` level.

## 8. Energy accumulation

Each simulation time step produces a power value (kW) per panel. It is integrated to energy:

```
energyKwh = powerKw × (intervalMinutes / 60)
```

Results are accumulated per panel in a `[month][dayOfMonth][hourOfDay]` bucket indexed by UTC time. The results panel converts UTC hours to local time for display.