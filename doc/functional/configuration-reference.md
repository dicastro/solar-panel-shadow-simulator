# Configuration Reference

Complete reference for every field in `config.json`. For a guided introduction with diagrams and examples, see the [Configuration Guide](../../public/docs/configuration-guide.html) served by the application.

## Top-level structure

```json
{
  "site": { ... },
  "setups": [ ... ]
}
```

## `site`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `location` | object | ✓ | — | GPS coordinates of the installation |
| `azimuth` | number (°) | ✓ | — | Site orientation. 0 = South, +East, −West |
| `timezone` | string | ✓ | — | IANA timezone identifier (e.g. `Europe/Madrid`) |
| `wallPoints` | `[number,number][]` | ✓ | — | Perimeter corner points (metres). Min 3 points. CCW walk from SW corner. +X = East, +Z = North |
| `wallDefaults` | object | ✓ | — | Default height and thickness for all walls |
| `railingDefaults` | object | ✓ | — | Default railing style for all walls |
| `wallsSettings` | object[] | — | `[]` | Per-wall overrides |
| `groundAlbedo` | number 0–1 | — | 0.20 | Fraction of GHI reflected toward panels |
| `inverterEfficiency` | number 0–1 | — | 0.97 | DC/AC inverter efficiency |
| `wiringLoss` | number 0–1 | — | 0.02 | DC wiring loss fraction |
| `floorColor` | string (CSS hex) | — | `'#cccccc'` | Colour of the terrace floor in the 3D view. Must be a 6-digit hex colour (e.g. `#b45d16` for terracotta). Has no effect on calculations. |

## `site.location`

| Field | Type | Range | Description |
|---|---|---|---|
| `latitude` | number | −90 to 90 | Decimal degrees. North = positive |
| `longitude` | number | −180 to 180 | Decimal degrees. East = positive |

## `site.wallDefaults`

| Field | Type | Description |
|---|---|---|
| `height` | number (m) | Wall height above floor. Must be > 0 |
| `thickness` | number (m) | Wall thickness. Must be > 0 |

## `site.railingDefaults`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `active` | boolean | ✓ | — | Render railing on all walls |
| `heightOffset` | number (m) | ✓ | — | Distance from wall top to rail centre |
| `shape` | RailingShape | — | — | Rail cross-section |
| `support` | RailingSupportConfiguration | — | — | Baluster configuration |
| `extendAtStart` | boolean | — | false | Rail extends over start corner post |
| `extendAtEnd` | boolean | — | false | Rail extends over end corner post |
| `extensionGap` | number (m) | — | 0 | Gap between two meeting extensions |

### RailingShape variants

```json
{ "kind": "cylinder", "radius": 0.025 }
{ "kind": "square", "width": 0.04, "height": 0.008 }
{ "kind": "half-cylinder", "radius": 0.03, "orientation": "up" }
```

`orientation` for half-cylinder: `"up"` (convex side up) or `"down"` (convex side down).

### RailingSupportConfiguration

| Field | Type | Required | Description |
|---|---|---|---|
| `shape` | RailingSupportShape | ✓ | Baluster cross-section |
| `count` | integer ≥ 0 | — | Number of balusters per wall. Min 2 if supports are needed |
| `edgeDistance` | number (m) | — | Distance from wall end to nearest baluster. If omitted: uniform distribution |

### RailingSupportShape variants

```json
{ "kind": "cylinder", "radius": 0.008 }
{ "kind": "square", "width": 0.05, "depth": 0.05 }
```

## `site.wallsSettings[]`

| Field | Type | Required | Description |
|---|---|---|---|
| `wall` | integer ≥ 0 | ✓ | 0-based index of the wall segment (index of start point in `wallPoints`) |
| `override.height` | number (m) | — | Overrides `wallDefaults.height` for this wall |
| `override.railing` | RailingOverride | — | Overrides railing settings for this wall |

### RailingOverride

All fields are optional. Present fields override the corresponding `railingDefaults` field.

```json
{
  "active": false,
  "heightOffset": 0.20,
  "shape": { "kind": "square", "width": 0.05, "height": 0.01 },
  "support": { "count": 0 },
  "extendAtStart": true,
  "extendAtEnd": false,
  "extensionGap": 0.02
}
```

## `setups[]`

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | string | ✓ | Display name shown in the UI and in PDF reports |
| `panelDefaults` | PanelDefinition | ✓ | Default panel properties for all arrays in this setup |
| `arrays` | PanelArrayConfiguration[] | ✓ | One or more panel arrays |
| `arraysSettings` | PanelArraySettings[] | — | Per-panel overrides |
| `temperatureCoefficient` | number (/°C) | — | Setup-level override for all panels' temperature coefficient |
| `noct` | number (°C) | — | Setup-level override for all panels' NOCT |

## `setups[].panelDefaults` (PanelDefinition)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `width` | number (m) | ✓ | — | Panel width per datasheet |
| `height` | number (m) | ✓ | — | Panel height per datasheet |
| `peakPower` | number (Wp) | ✓ | — | Peak power at STC |
| `zones` | integer ≥ 1 | ✓ | — | Number of bypass-diode zones |
| `zonesDisposition` | `horizontal`/`vertical` | ✓ | — | How zones split the panel face |
| `hasOptimizer` | boolean | ✓ | — | DC power optimizer fitted |
| `string` | string | ✓ | — | String identifier (e.g. `"S1"`). All panels sharing the same identifier are subject to the series current constraint. Each distinct string within a setup is rendered with a unique colour border in the 3D view, heat maps, and PDF reports (up to 10 colours; beyond that colours repeat). |
| `temperatureCoefficient` | number (/°C) | — | −0.004 | Pmax temperature coefficient from datasheet |
| `noct` | number (°C) | — | 45 | Nominal Operating Cell Temperature from datasheet |

## `setups[].arrays[]` (PanelArrayConfiguration)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `position` | `[number,number]` | ✓ | — | [East m, North m] from site SW corner |
| `azimuth` | number (°) | ✓ | — | Absolute panel azimuth. 0 = South |
| `elevation` | number (m) | ✓ | — | Height of bottom panel edge above floor |
| `inclination` | number (°) | ✓ | — | Tilt angle from horizontal. 0–90° |
| `rows` | integer ≥ 1 | ✓ | — | Number of rows. Row 0 = southernmost |
| `columns` | integer ≥ 1 | ✓ | — | Number of columns. Column 0 = westernmost |
| `spacing` | `[number,number]` | — | [0.02, 0.02] | [horizontal m, vertical m] gap between panels |
| `orientation` | `portrait`/`landscape` | — | `portrait` | Panel mounting orientation |
| `width` | number (m) | — | from panelDefaults | Override panel width |
| `height` | number (m) | — | from panelDefaults | Override panel height |
| `peakPower` | number (Wp) | — | from panelDefaults | Override peak power |
| `zones` | integer ≥ 1 | — | from panelDefaults | Override zone count |
| `zonesDisposition` | `horizontal`/`vertical` | — | from panelDefaults | Override zone layout |
| `hasOptimizer` | boolean | — | from panelDefaults | Override optimizer flag |
| `string` | string | — | from panelDefaults | Override string assignment |
| `temperatureCoefficient` | number (/°C) | — | from panelDefaults | Override temperature coefficient |
| `noct` | number (°C) | — | from panelDefaults | Override NOCT |

## `setups[].arraysSettings[]` (per-panel overrides)

| Field | Type | Required | Description |
|---|---|---|---|
| `array` | integer ≥ 0 | ✓ | 0-based array index |
| `row` | integer ≥ 0 | ✓ | 0-based row index within the array |
| `col` | integer ≥ 0 | ✓ | 0-based column index within the array |
| `hasOptimizer` | boolean | — | Override optimizer flag for this panel |
| `string` | string | — | Override string assignment for this panel |