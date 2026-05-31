import { Config, RailingConfiguration, WallSettingsConfiguration } from '../types/config';
import { FunctionalValidator, FunctionalValidationIssue } from './FunctionalValidator';

const MIN_SUPPORT_COUNT = 2;

/**
 * Resolves the effective railing active state for a wall, applying
 * per-wall overrides on top of railingDefaults.
 */
const resolveRailingActive = (
  wallIndex: number,
  railingDefaults: RailingConfiguration,
  wallsSettings: WallSettingsConfiguration[] | undefined,
): boolean => {
  const override = wallsSettings?.find(s => s.wall === wallIndex)?.override?.railing;
  return override?.active ?? railingDefaults.active;
};

/**
 * Resolves the effective support count for a wall, applying per-wall
 * overrides on top of railingDefaults. Returns null when no support is
 * configured (shape absent), meaning no balusters are intended.
 */
const resolveEffectiveSupportCount = (
  wallIndex: number,
  railingDefaults: RailingConfiguration,
  wallsSettings: WallSettingsConfiguration[] | undefined,
): number | null => {
  const wallOverride = wallsSettings?.find(s => s.wall === wallIndex)?.override?.railing;

  // Resolve support: override takes precedence over defaults.
  const support = wallOverride?.support ?? railingDefaults.support;

  // No support configured means no balusters are intended — not a validation concern.
  if (!support?.shape) return null;

  return support.count ?? 0;
};

/**
 * Validates that railing support count is at least 2 whenever railings
 * with supports are active. Reports at the highest applicable level:
 * a single default-level issue when the problem comes from railingDefaults,
 * per-wall issues only for walls with explicit overrides that are invalid.
 */
export class RailingSupportCountValidator implements FunctionalValidator {
  validate(config: Config): FunctionalValidationIssue[] {
    const { wallPoints, railingDefaults, wallsSettings } = config.site;
    const wallCount = wallPoints.length;

    interface WallResolution {
      wallIndex: number;
      hasOverride: boolean;
      count: number;
    }

    // Resolve effective state for every wall that has active railings with supports.
    const invalidWalls: WallResolution[] = [];

    for (let i = 0; i < wallCount; i++) {
      const isActive = resolveRailingActive(i, railingDefaults, wallsSettings);
      if (!isActive) continue;

      const count = resolveEffectiveSupportCount(i, railingDefaults, wallsSettings);
      if (count === null || count >= MIN_SUPPORT_COUNT) continue;

      const hasOverride =
        wallsSettings?.some(
          s => s.wall === i && s.override?.railing?.support !== undefined,
        ) ?? false;

      invalidWalls.push({ wallIndex: i, hasOverride, count });
    }

    if (invalidWalls.length === 0) return [];

    const issues: FunctionalValidationIssue[] = [];

    // Walls inheriting the invalid default (no support override).
    const inheritingDefault = invalidWalls.filter(w => !w.hasOverride);

    if (inheritingDefault.length > 0) {
      // The root cause is railingDefaults — report once at that level.
      const defaultCount = railingDefaults.support?.count ?? 0;
      issues.push({
        type: 'railing-support-count',
        severity: 'warning',
        data: { isDefault: true, count: defaultCount },
      });
    }

    // Walls with an explicit override that is itself invalid.
    const invalidOverrides = invalidWalls.filter(w => w.hasOverride);
    for (const wall of invalidOverrides) {
      issues.push({
        type: 'railing-support-count',
        severity: 'warning',
        data: { isDefault: false, wallIndex: wall.wallIndex, count: wall.count },
      });
    }

    return issues;
  }
}