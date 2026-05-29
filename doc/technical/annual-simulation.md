# Annual Simulation

## Overview

The annual simulation steps through every N-minute interval of a full year, casts shadow rays at each step for all panels in a setup, and accumulates energy (kWh) and shadow fraction data. Results are stored in IndexedDB and displayed in the results panel.

## Web Worker architecture

The simulation runs in a dedicated Web Worker (`src/workers/AnnualSimulation.worker.ts`) to avoid blocking the main thread. Three.js math classes, SunCalc, and the BVH raycaster all work correctly in a worker context — they have no DOM or WebGL dependencies.

**Worker lifecycle per setup:**

1. Main thread checks IndexedDB for a cached result with the same cache key
2. If cached: result is loaded immediately, no worker spawned
3. If not cached: a worker is spawned and receives a `run` message with the serialised payload
4. Worker emits `progress` messages every 100 steps
5. Worker emits a `result` message when complete; main thread persists to IndexedDB
6. Worker is terminated

**Worker count:**

```
workerCount = max(1, hardwareConcurrency − 1)
```

One core is always kept free for the main thread. If there are more setups than workers, the remainder are queued and dispatched as workers become free.

## Irradiance providers

The `IrradianceProvider` interface abstracts the irradiance data source:

```typescript
interface IrradianceProvider {
  getHourlyWeatherData(lat, lon, year): Promise<HourlyWeatherData | null>
}
```

| Provider | Class | Behaviour |
|---|---|---|
| `geometric` | `GeometricIrradianceProvider` | Returns `null` → worker uses clear-sky model |
| `open-meteo` | `OpenMeteoIrradianceProvider` | Fetches hourly DNI, DHI, temperature from Open-Meteo API |

Weather data is fetched on the main thread before workers are spawned, so all workers for the same run receive the same data. Each worker receives its own copy of the typed arrays (transferred zero-copy).

**Open-Meteo API:**

```
GET https://archive-api.open-meteo.com/v1/archive
?latitude=40.62&longitude=-4.01
&start_date=2024-01-01&end_date=2024-12-31
&hourly=direct_normal_irradiance,diffuse_radiation,temperature_2m
&timezone=UTC
```

Returns 8760 (or 8784 on leap years) hourly values. Available only for completed past years.

## Cache strategy

A simulation result is a pure function of all its inputs. The cache key captures:

```typescript
interface SimulationCacheKey {
  setupId: string;
  setupHash: string;    // FNV-1a hash of panel geometry
  density: number;
  threshold: number;
  intervalMinutes: number;
  latitude: number;
  longitude: number;
  year: number;
  irradianceSource: string;
}
```

The final cache key is `FNV-1a(JSON.stringify(cacheKey))` — an 8-character hex string used as the IndexedDB record key.

**FNV-1a** (Fowler–Noll–Vo) was chosen because it fits in ~10 lines with no dependencies, is public domain, and 32-bit output produces compact 8-character hex strings.

Two simulation runs with identical inputs will always produce the same cache key and reuse the stored result instantly.

## Output data model

Results are stored per-panel, per-bucket:

```
energyKwh         [month 0-11][dayOfMonth 0-30][hourOfDay 0-23]   kWh
shadeFraction     [month][dayOfMonth][hourOfDay]                   0–1
zoneShadeFraction [zone][month][dayOfMonth][hourOfDay]             0–1
```

All buckets use UTC time. Days beyond the actual month length (e.g. index 30 in February) are always 0.

Monthly totals (`monthlyTotalKwh[0..11]`) and the annual total are pre-computed and stored alongside the per-bucket data to avoid recomputing them every time a chart renders.

## IndexedDB storage

| Database | Version | Store | Key |
|---|---|---|---|
| `solar-simulator` | 1 | `simulation-results` | `cacheKey` hash |
| `solar-simulator-irradiance` | 2 | `irradiance-cache` | `{source}:{lat4dp}:{lon4dp}:{year}` |

The irradiance database is version 2 because the original version 1 schema stored only DNI. Version 2 adds DHI and temperature columns. Old version-1 entries are automatically cleared on first access (the store is dropped and recreated in the `onupgradeneeded` handler).

Open-Meteo irradiance data covers completed past years with immutable reanalysis data, so cached entries never expire.

## Progress reporting

Each worker reports progress every 100 time steps. The main thread applies an exponential moving average (EMA, α = 0.2) to smooth the remaining-time estimate:

```
smoothedRemaining = 0.2 × rawRemaining + 0.8 × previousSmoothed
```

The ETA is displayed only after 5% completion to avoid wildly inaccurate early estimates.