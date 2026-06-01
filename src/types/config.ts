export type ZonesDisposition = 'vertical' | 'horizontal';
export type PanelOrientation = 'portrait' | 'landscape';

export type RailingShapeSquare = {
  readonly kind: 'square';
  readonly width: number;
  readonly height: number;
};

export type RailingShapeCylinder = {
  readonly kind: 'cylinder';
  readonly radius: number;
};

export type RailingShapeHalfCylinder = {
  readonly kind: 'half-cylinder';
  readonly radius: number;
  readonly orientation: 'up' | 'down';
};

export type RailingShape =
  | RailingShapeSquare
  | RailingShapeCylinder
  | RailingShapeHalfCylinder;

export type RailingSupportShapeSquare = {
  readonly kind: 'square';
  readonly width: number;
  readonly depth: number;
};

export type RailingSupportShapeCylinder = {
  readonly kind: 'cylinder';
  readonly radius: number;
};

export type RailingSupportShape =
  | RailingSupportShapeSquare
  | RailingSupportShapeCylinder;

export interface RailingSupportConfiguration {
  readonly shape: RailingSupportShape;
  /**
   * Number of supports along the wall. Must be at least 2 (a single support
   * cannot hold the railing on its own).
   *
   * With exactly 2 supports, each one is placed at `edgeDistance` from its
   * respective wall end. With more than 2, the two outermost supports sit at
   * `edgeDistance` and the remaining ones are distributed evenly in the space
   * between them.
   *
   * Defaults to 0 (no supports rendered).
   */
  readonly count?: number;
  /**
   * Distance in metres from each wall end to the nearest support.
   *
   * When omitted, supports are distributed homogeneously along the full wall
   * length, matching the legacy behaviour.
   */
  readonly edgeDistance?: number;
}

export interface LocationConfiguration {
  readonly latitude: number;
  readonly longitude: number;
}

export interface WallConfiguration {
  readonly height: number;
  readonly thickness: number;
}

export interface RailingConfiguration {
  readonly active: boolean;
  readonly heightOffset: number;
  readonly shape?: RailingShape;
  readonly support?: RailingSupportConfiguration;
  /**
   * Whether the railing rail extends past the wall end over the intersection
   * post at the start (p1) of this wall segment.
   *
   * The extension length is `wallThickness / 2 − extensionGap / 2`, so that
   * when both the incoming and outgoing rails extend toward the same corner
   * post they meet without overlap (or leave a gap of `extensionGap`).
   */
  readonly extendAtStart?: boolean;
  /**
   * Whether the railing rail extends past the wall end over the intersection
   * post at the end (p2) of this wall segment.
   */
  readonly extendAtEnd?: boolean;
  /**
   * Gap in metres left between the tips of two meeting rail extensions at a
   * corner post. Each extension is shortened by half this value.
   *
   * Defaults to 0 (extensions meet flush).
   */
  readonly extensionGap?: number;
}

export interface RailingSupportOverrideConfiguration {
  readonly shape?: RailingSupportShape;
  readonly count?: number;
  readonly edgeDistance?: number;
}

export interface RailingOverrideConfiguration {
  readonly active?: boolean;
  readonly heightOffset?: number;
  readonly shape?: RailingShape;
  readonly support?: RailingSupportOverrideConfiguration;
  readonly extendAtStart?: boolean;
  readonly extendAtEnd?: boolean;
  readonly extensionGap?: number;
}

export interface WallOverrideConfiguration {
  readonly height?: number;
  readonly railing?: RailingOverrideConfiguration;
}

export interface WallSettingsConfiguration {
  readonly wall: number;
  readonly override?: WallOverrideConfiguration;
}

export interface InstallationConfiguration {
  readonly location: LocationConfiguration;
  /**
   * Site azimuth in degrees. Reference: South = 0.
   * Positive values = rotated towards West.
   * Negative values = rotated towards East.
   */
  readonly azimuth: number;
  readonly timezone: string;
  /**
   * Wall corner points in site-local coordinates (metres).
   *
   * Coordinate system:
   *   +X → East,  +Z → North  (before site azimuth rotation)
   *
   * Walk the perimeter counter-clockwise when viewed from above, starting
   * from the South-West corner.  The segment index (used in wallsSettings)
   * is the index of the point that *starts* that segment, so segment 0 goes
   * from wallPoints[0] to wallPoints[1], and so on.
   *
   * Example walk order: SW → S → SE → E → NE → N → NW → W → (back to SW)
   */
  readonly wallPoints: [number, number][];
  readonly wallDefaults: WallConfiguration;
  readonly railingDefaults: RailingConfiguration;
  readonly wallsSettings?: WallSettingsConfiguration[];
  /**
   * Fraction of incoming light reflected by the ground surface toward the
   * panels (dimensionless, 0–1). Used to compute the albedo component of
   * plane-of-array irradiance. Typical values: 0.20 for concrete/asphalt,
   * 0.25 for light-coloured gravel, 0.10 for dark roofing membrane.
   * Defaults to 0.20 when omitted.
   */
  readonly groundAlbedo?: number;
  /**
   * Rated efficiency of the DC/AC inverter (dimensionless, 0–1).
   * Applied as a multiplier to the DC power output of each time step.
   * Typical modern string inverters: 0.96–0.98. Defaults to 0.97 when omitted.
   */
  readonly inverterEfficiency?: number;
  /**
   * Fraction of DC power lost in wiring between panels and inverter
   * (dimensionless, 0–1). Applied as an additional loss factor on top of
   * inverter efficiency. Typical residential installations: 0.01–0.03.
   * Defaults to 0.02 when omitted.
   */
  readonly wiringLoss?: number;
  /**
   * CSS hex colour of the terrace floor surface rendered in the 3D view.
   * Defaults to '#cccccc' (light grey) when omitted.
   */
  readonly floorColor?: string;
}

export interface PanelDefinition {
  readonly width: number;
  readonly height: number;
  readonly peakPower: number;
  readonly zones: number;
  readonly zonesDisposition: ZonesDisposition;
  readonly hasOptimizer: boolean;
  readonly string: string;
  /**
   * Temperature coefficient of maximum power (per °C, typically negative).
   * Represents the relative change in panel output per degree Celsius above
   * the Standard Test Condition temperature of 25°C.
   * Typical monocrystalline silicon panels: −0.004 /°C (−0.4 %/°C).
   * Available in the panel datasheet as Pmax temperature coefficient.
   * Defaults to −0.004 when omitted.
   */
  readonly temperatureCoefficient?: number;
  /**
   * Nominal Operating Cell Temperature in °C. The cell temperature reached
   * under reference conditions: 800 W/m² irradiance, 20°C ambient, 1 m/s wind.
   * Used to estimate actual cell temperature from ambient temperature and POA:
   *   T_cell = T_ambient + (NOCT − 20) / 800 × POA
   * Typical value: 45°C. Available in the panel datasheet. Defaults to 45
   * when omitted.
   */
  readonly noct?: number;
}

export interface PanelArrayConfiguration {
  readonly position: [number, number];
  /**
   * Panel array azimuth in degrees. Reference: South = 0.
   * Positive values = panels facing West.
   * Negative values = panels facing East.
   * This is an absolute angle, independent of the site azimuth.
   */
  readonly azimuth: number;
  readonly elevation: number;
  readonly inclination: number;
  readonly rows: number;
  readonly columns: number;
  readonly spacing?: [number, number];
  readonly orientation?: PanelOrientation;
  readonly width?: number;
  readonly height?: number;
  readonly peakPower?: number;
  readonly zones?: number;
  readonly zonesDisposition?: ZonesDisposition;
  readonly hasOptimizer?: boolean;
  readonly string?: string;
  readonly temperatureCoefficient?: number;
  readonly noct?: number;
}

export interface PanelArraySettings {
  /**
   * 0-based index of the array within the setup's `arrays` list.
   */
  readonly array: number;
  /**
   * 0-based row index of the target panel within the array.
   * Row 0 is the northernmost row; the last row is the southernmost.
   */
  readonly row: number;
  /**
   * 0-based column index of the target panel within the array.
   * Column 0 is the westernmost column.
   */
  readonly col: number;
  readonly hasOptimizer?: boolean;
  readonly string?: string;
}

export interface PanelSetupConfiguration {
  readonly label: string;
  readonly panelDefaults: PanelDefinition;
  readonly arrays: PanelArrayConfiguration[];
  /**
   * Per-panel overrides applied after the array geometry is built.
   * Each entry targets one specific panel by its array/row/col address.
   * Multiple entries can target different panels within the same setup.
   */
  readonly arraysSettings?: PanelArraySettings[];
  /**
   * Setup-level override for the panel temperature coefficient (per °C).
   * When provided, takes precedence over the value in panelDefaults for all
   * panels in this setup. Useful when comparing setups with panels of
   * different technologies or generations.
   */
  readonly temperatureCoefficient?: number;
  /**
   * Setup-level override for the panel NOCT (°C).
   * When provided, takes precedence over the value in panelDefaults for all
   * panels in this setup.
   */
  readonly noct?: number;
}

export interface Config {
  readonly site: InstallationConfiguration;
  readonly setups: PanelSetupConfiguration[];
}