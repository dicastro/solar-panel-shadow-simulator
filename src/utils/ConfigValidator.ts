import Ajv, { ErrorObject } from 'ajv';

/**
 * JSON Schema for the Config type, hand-maintained to match src/types/config.ts.
 *
 * Kept as a plain object rather than generated at build time to avoid adding
 * a Vite plugin dependency. The schema is stable; when Config changes, this
 * object must be updated in sync. All fields marked optional in the TypeScript
 * types are represented with the same optionality here.
 */
const CONFIG_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['site', 'setups'],
  additionalProperties: false,
  properties: {
    site: {
      type: 'object',
      required: ['location', 'azimuth', 'timezone', 'wallPoints', 'wallDefaults', 'railingDefaults'],
      additionalProperties: false,
      properties: {
        location: {
          type: 'object',
          required: ['latitude', 'longitude'],
          additionalProperties: false,
          properties: {
            latitude: { type: 'number', minimum: -90, maximum: 90 },
            longitude: { type: 'number', minimum: -180, maximum: 180 },
          },
        },
        azimuth: { type: 'number' },
        timezone: { type: 'string', minLength: 1 },
        groundAlbedo: { type: 'number', minimum: 0, maximum: 1 },
        floorColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        inverterEfficiency: { type: 'number', minimum: 0, maximum: 1 },
        wiringLoss: { type: 'number', minimum: 0, maximum: 1 },
        wallPoints: {
          type: 'array',
          minItems: 3,
          items: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: { type: 'number' },
          },
        },
        wallDefaults: {
          type: 'object',
          required: ['height', 'thickness'],
          additionalProperties: false,
          properties: {
            height: { type: 'number', exclusiveMinimum: 0 },
            thickness: { type: 'number', exclusiveMinimum: 0 },
          },
        },
        railingDefaults: {
          type: 'object',
          required: ['active', 'heightOffset'],
          additionalProperties: false,
          properties: {
            active: { type: 'boolean' },
            heightOffset: { type: 'number', minimum: 0 },
            shape: { $ref: '#/definitions/railingShape' },
            support: { $ref: '#/definitions/railingSupportConfiguration' },
            extendAtStart: { type: 'boolean' },
            extendAtEnd: { type: 'boolean' },
            extensionGap: { type: 'number', minimum: 0 },
          },
        },
        wallsSettings: {
          type: 'array',
          items: { $ref: '#/definitions/wallSettingsConfiguration' },
        },
      },
    },
    setups: {
      type: 'array',
      minItems: 1,
      items: { $ref: '#/definitions/panelSetupConfiguration' },
    },
  },
  definitions: {
    railingShape: {
      oneOf: [
        {
          type: 'object',
          required: ['kind', 'width', 'height'],
          additionalProperties: false,
          properties: {
            kind: { const: 'square' },
            width: { type: 'number', exclusiveMinimum: 0 },
            height: { type: 'number', exclusiveMinimum: 0 },
          },
        },
        {
          type: 'object',
          required: ['kind', 'radius'],
          additionalProperties: false,
          properties: {
            kind: { const: 'cylinder' },
            radius: { type: 'number', exclusiveMinimum: 0 },
          },
        },
        {
          type: 'object',
          required: ['kind', 'radius', 'orientation'],
          additionalProperties: false,
          properties: {
            kind: { const: 'half-cylinder' },
            radius: { type: 'number', exclusiveMinimum: 0 },
            orientation: { enum: ['up', 'down'] },
          },
        },
      ],
    },
    railingSupportShape: {
      oneOf: [
        {
          type: 'object',
          required: ['kind', 'width', 'depth'],
          additionalProperties: false,
          properties: {
            kind: { const: 'square' },
            width: { type: 'number', exclusiveMinimum: 0 },
            depth: { type: 'number', exclusiveMinimum: 0 },
          },
        },
        {
          type: 'object',
          required: ['kind', 'radius'],
          additionalProperties: false,
          properties: {
            kind: { const: 'cylinder' },
            radius: { type: 'number', exclusiveMinimum: 0 },
          },
        },
      ],
    },
    railingSupportConfiguration: {
      type: 'object',
      required: ['shape'],
      additionalProperties: false,
      properties: {
        shape: { $ref: '#/definitions/railingSupportShape' },
        count: { type: 'integer', minimum: 0 },
        edgeDistance: { type: 'number', minimum: 0 },
      },
    },
    railingOverrideConfiguration: {
      type: 'object',
      additionalProperties: false,
      properties: {
        active: { type: 'boolean' },
        heightOffset: { type: 'number', minimum: 0 },
        shape: { $ref: '#/definitions/railingShape' },
        support: {
          type: 'object',
          additionalProperties: false,
          properties: {
            shape: { $ref: '#/definitions/railingSupportShape' },
            count: { type: 'integer', minimum: 0 },
            edgeDistance: { type: 'number', minimum: 0 },
          },
        },
        extendAtStart: { type: 'boolean' },
        extendAtEnd: { type: 'boolean' },
        extensionGap: { type: 'number', minimum: 0 },
      },
    },
    wallSettingsConfiguration: {
      type: 'object',
      required: ['wall'],
      additionalProperties: false,
      properties: {
        wall: { type: 'integer', minimum: 0 },
        override: {
          type: 'object',
          additionalProperties: false,
          properties: {
            height: { type: 'number', exclusiveMinimum: 0 },
            railing: { $ref: '#/definitions/railingOverrideConfiguration' },
          },
        },
      },
    },
    panelDefinition: {
      type: 'object',
      required: ['width', 'height', 'peakPower', 'zones', 'zonesDisposition', 'hasOptimizer', 'string'],
      additionalProperties: false,
      properties: {
        width: { type: 'number', exclusiveMinimum: 0 },
        height: { type: 'number', exclusiveMinimum: 0 },
        peakPower: { type: 'number', exclusiveMinimum: 0 },
        zones: { type: 'integer', minimum: 1 },
        zonesDisposition: { enum: ['vertical', 'horizontal'] },
        hasOptimizer: { type: 'boolean' },
        string: { type: 'string', minLength: 1 },
        temperatureCoefficient: { type: 'number' },
        noct: { type: 'number', exclusiveMinimum: 0 },
      },
    },
    panelArrayConfiguration: {
      type: 'object',
      required: ['position', 'azimuth', 'elevation', 'inclination', 'rows', 'columns'],
      additionalProperties: false,
      properties: {
        position: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { type: 'number' },
        },
        azimuth: { type: 'number' },
        elevation: { type: 'number', minimum: 0 },
        inclination: { type: 'number', minimum: 0, maximum: 90 },
        rows: { type: 'integer', minimum: 1 },
        columns: { type: 'integer', minimum: 1 },
        spacing: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { type: 'number', minimum: 0 },
        },
        orientation: { enum: ['portrait', 'landscape'] },
        width: { type: 'number', exclusiveMinimum: 0 },
        height: { type: 'number', exclusiveMinimum: 0 },
        peakPower: { type: 'number', exclusiveMinimum: 0 },
        zones: { type: 'integer', minimum: 1 },
        zonesDisposition: { enum: ['vertical', 'horizontal'] },
        hasOptimizer: { type: 'boolean' },
        string: { type: 'string', minLength: 1 },
        temperatureCoefficient: { type: 'number' },
        noct: { type: 'number', exclusiveMinimum: 0 },
      },
    },
    panelSetupConfiguration: {
      type: 'object',
      required: ['label', 'panelDefaults', 'arrays'],
      additionalProperties: false,
      properties: {
        label: { type: 'string', minLength: 1 },
        panelDefaults: { $ref: '#/definitions/panelDefinition' },
        arrays: {
          type: 'array',
          minItems: 1,
          items: { $ref: '#/definitions/panelArrayConfiguration' },
        },
        arraysSettings: {
          type: 'array',
          items: {
            type: 'object',
            required: ['array', 'row', 'col'],
            additionalProperties: false,
            properties: {
              array: { type: 'integer', minimum: 0 },
              row: { type: 'integer', minimum: 0 },
              col: { type: 'integer', minimum: 0 },
              hasOptimizer: { type: 'boolean' },
              string: { type: 'string', minLength: 1 },
            },
          },
        },
        temperatureCoefficient: { type: 'number' },
        noct: { type: 'number', exclusiveMinimum: 0 },
      },
    },
  },
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(CONFIG_SCHEMA);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Converts a raw ajv ErrorObject into a human-readable message.
 *
 * The goal is to surface the field path and what was wrong in a form
 * understandable by a user editing JSON — not a developer reading ajv internals.
 */
const formatError = (err: ErrorObject): string => {
  const path = err.instancePath
    ? err.instancePath.replace(/^\//, '').replace(/\//g, '.')
    : '(root)';

  switch (err.keyword) {
    case 'required': {
      const missing = (err.params as { missingProperty: string }).missingProperty;
      return `${path ? path + ': ' : ''}missing required field "${missing}"`;
    }
    case 'additionalProperties': {
      const extra = (err.params as { additionalProperty: string }).additionalProperty;
      return `${path}: unknown field "${extra}"`;
    }
    case 'type': {
      const expected = (err.params as { type: string }).type;
      return `${path}: expected ${expected}`;
    }
    case 'enum':
      return `${path}: value must be one of ${JSON.stringify((err.params as { allowedValues: unknown[] }).allowedValues)}`;
    case 'const':
      return `${path}: ${err.message ?? 'invalid value'}`;
    case 'minimum':
    case 'maximum':
    case 'exclusiveMinimum':
    case 'exclusiveMaximum':
      return `${path}: ${err.message}`;
    case 'minItems':
      return `${path}: must have at least ${(err.params as { limit: number }).limit} item(s)`;
    case 'minLength':
      return `${path}: must not be empty`;
    default:
      return `${path}: ${err.message ?? JSON.stringify(err)}`;
  }
};

/**
 * Validates a parsed JSON value against the full Config schema using ajv.
 *
 * Returns all validation errors formatted as human-readable strings so they
 * can be displayed directly in the configuration editor without exposing
 * ajv internals to the user.
 */
export const validateConfig = (data: unknown): ValidationResult => {
  const valid = validate(data) as boolean;
  if (valid) return { valid: true, errors: [] };

  const errors = (validate.errors ?? []).map(formatError);
  return { valid: false, errors };
};