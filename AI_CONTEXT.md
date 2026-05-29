# AI Context — Solar Panel Shadow Simulator

This file provides context for AI assistants working on this project.

---

## How to work on this project

- The project is a browser-only React/TypeScript/Vite app deployed on GitHub Pages. There is no backend.
- You are working through the web chat interface. You cannot modify source files directly. Provide the modified files as output — the user will copy them into the repository.
- Before writing any code, read the existing relevant files from the context window to understand the current state.
- If you have doubts about something stated or asked, ask before proposing code changes.
- Once the user confirms the code changes are good, update `README.md` accordingly (it is heavy — do not update it before confirmation to avoid wasting tokens).
- If you cannot complete a full response due to message limits, the user will ask you to continue. Do not re-provide files already delivered in the same conversation unless they need a further change.
- Produce a concise git commit message at the end of every completed change set.

## Code standards

- High technical quality — all decisions must be defensible to an expert in the tech stack.
- Code comments must be explanatory (why, not what). Do not reference refactors or past states.
- Comments marking section starts (e.g. "// ── Classes ──") are discouraged — they go stale.
- All code, comments, and documentation in English.
- Follow existing patterns in the codebase rather than introducing new conventions.
- Semantic parameter grouping: place fields where they conceptually belong, not in catch-all objects.

## README and documentation updates

- `README.md` is the public-facing overview. It should be simple: what the app does, use cases, links to documentation, Ko-fi link.
- Technical documentation lives in `doc/technical/`. Functional documentation in `doc/functional/`.
- The interactive configuration guide is `public/docs/configuration-guide.html`.
- When updating `README.md`, merge with existing content — do not replace it wholesale. Only current/implemented features, never planned ones.

## Project overview

A browser-based 3D solar panel shadow simulator. The user defines their rooftop installation (terrace shape, walls, railings, solar panels) in a `config.json` edited via a settings sidebar. The app:

1. Renders the installation in 3D (Three.js/React Three Fiber)
2. Animates the sun for any date/time (SunCalc)
3. Casts shadow rays from panel sample points toward the sun (BVH raycasting via three-mesh-bvh)
4. Estimates instant power output (bypass diodes, string mismatch, DC optimizers)
5. Runs a full annual simulation in Web Workers, accumulating kWh per panel/month/day/hour
6. Fetches real weather data from Open-Meteo (hourly DNI, DHI, temperature) for POA irradiance and temperature correction
7. Displays results in a resizable overlay panel with Annual/Monthly/Daily tabs and per-panel shadow heat maps
8. Generates downloadable PDF reports (ECharts SSR + svg2pdf.js + jsPDF)
9. Manages configuration via a settings sidebar with cache management, backup export/import, and inline JSON editor with ajv validation
10. Persists configuration to Origin Private File System (OPFS)

## Key architectural decisions

- **No backend / no router**: single-page app, all routes are `{BASE_URL}` only; the configuration guide is a static HTML page in `public/docs/`
- **OPFS for config persistence**: `ConfigStorage` reads/writes `config.json` in the OPFS root; `checkOpfsAvailability()` gates the app at startup
- **Factory pattern**: all domain objects are plain immutable values produced by factory functions; React components only consume pre-computed `renderData`
- **Density changes do not rebuild geometry**: `PanelSetupFactory.rebuildSamplePoints` reuses panel geometry
- **Two independent density/threshold pairs**: `renderDensity/renderThreshold` for the 3D view; `simulationDensity/simulationThreshold` for annual simulation
- **Store slices**: `ConfigSlice`, `RenderSlice`, `SimulationSlice`, `SettingsSlice` composed behind `useAppStore`
- **Event bus**: `mitt`-based `appEvents` decouples IndexedDB mutations from UI reloads (`simulationResultsChanged`)
- **Results scoped to active config**: `useResultsPanel` filters by `setupId` derived from current config; results from previous configs are invisible but not deleted
- **Backup scoped to active config**: `BackupExporter` excludes results from previous configs
- **PDF module**: seven focused files under `src/pdf/`; ECharts SSR for charts, jsPDF rect primitives for heat maps; no html2canvas

## Key files to read before changing things

| Area | Files |
|---|---|
| Types | `src/types/config.ts`, `src/types/simulation.ts`, `src/types/installation.ts` |
| Factories | `src/factory/SiteFactory.ts`, `src/factory/SolarPanelFactory.ts`, `src/factory/PanelSetupFactory.ts` |
| Store | `src/store/AppStore.ts`, `src/store/slices/` |
| Annual simulation | `src/workers/AnnualSimulation.worker.ts`, `src/hooks/useAnnualSimulation.ts` |
| Results panel | `src/hooks/useResultsPanel.ts`, `src/components/SimulationResultsPanel.tsx` |
| Settings | `src/components/settings/ConfigurationSection.tsx`, `src/utils/ConfigStorage.ts` |
| Irradiance | `src/irradiance/IrradianceProvider.ts`, `src/irradiance/OpenMeteoIrradianceProvider.ts` |
| PDF | `src/pdf/PdfReportGenerator.ts` (public API only; internals in the other `src/pdf/` files) |