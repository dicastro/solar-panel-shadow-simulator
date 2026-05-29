# Documentation

This folder contains technical and functional documentation for the Solar Panel Shadow Simulator.

## Technical documentation

- [Coordinate system](technical/coordinate-system.md) — 3D scene coordinates, azimuth convention, SW corner reference point, rotation order
- [Solar production model](technical/solar-production-model.md) — geometric model, POA irradiance decomposition, temperature correction, bypass diodes, string mismatch, system losses
- [Shadow detection](technical/shadow-detection.md) — raycasting technique, BVH acceleration, sample points, zone threshold
- [Annual simulation](technical/annual-simulation.md) — web worker architecture, irradiance providers, cache strategy, output data model

## Functional documentation

- [Configuration reference](functional/configuration-reference.md) — complete field-by-field reference for `config.json`

## Configuration guide

An interactive [Configuration Guide](../public/docs/configuration-guide.html) with diagrams and examples is served by the application itself and accessible from **Settings → Configuration**.