# Solar Panel Shadow Simulator

A browser-based 3D tool for analysing shadow impact on rooftop photovoltaic installations and estimating annual energy production. No backend required — everything runs in the browser and can be deployed as a static site on GitHub Pages.

**[→ Open the app](https://diegocastroviadero.com/projects/solar-simulator)**

---

## What it does

Define your rooftop installation in a JSON configuration file — terrace shape, walls, railings, solar panel arrays, strings, and bypass-diode zones. The simulator then:

- Renders the installation in 3D with accurate sun position for any date and time
- Detects shaded panel zones using raycasting against all geometry
- Estimates instantaneous power output considering bypass diodes, string mismatch, and DC optimizers
- Runs a full annual simulation across all defined setups, optionally using real historical weather data (Open-Meteo)
- Compares setups side by side in charts (annual totals, monthly distribution, daily curves, per-panel shadow heat maps)
- Generates downloadable PDF reports

## Use cases

- Compare different panel orientations or layouts before installation
- Estimate the impact of shading from chimneys, water tanks, neighbouring structures, or other panels
- Decide whether DC power optimizers are worth it for your specific shading pattern
- Produce a documented annual production estimate for a planning application

## Documentation

- [Configuration guide](public/docs/configuration-guide.html) — interactive guide with diagrams and examples
- [Configuration reference](doc/functional/configuration-reference.md) — complete field reference
- [Coordinate system](doc/technical/coordinate-system.md) — 3D coordinates, azimuth convention, panel indexing
- [Solar production model](doc/technical/solar-production-model.md) — geometric model, POA irradiance, temperature correction, bypass diodes, string mismatch
- [Shadow detection](doc/technical/shadow-detection.md) — raycasting, BVH, sample points, zone threshold
- [Annual simulation](doc/technical/annual-simulation.md) — web worker, irradiance providers, cache strategy, data model

## Support the project

If this tool saves you time or helps with your installation, consider [buying me a coffee on Ko-fi](https://ko-fi.com/pending_to_be_created).

## Tech stack

React 18 + TypeScript · Three.js · @react-three/fiber · three-mesh-bvh · SunCalc · dayjs · Zustand · ECharts · jsPDF · ajv · Vite