import { Config, PanelSetupConfiguration } from '../types/config';
import { FunctionalValidator, FunctionalValidationIssue } from './FunctionalValidator';
import { PanelOverrideResolver } from '../factory/PanelOverrideResolver';
import { STRING_COLOURS } from '../utils/StringColourUtils';

const MAX_COLOURS = STRING_COLOURS.length;

/**
 * Counts the distinct string identifiers actually used in a setup by
 * simulating the same override resolution that PanelSetupFactory applies.
 * This ensures the count reflects real panel assignments, not just the
 * values present in the configuration at each level.
 */
const countDistinctStrings = (setupConfig: PanelSetupConfiguration): number => {
  const seen = new Set<string>();

  setupConfig.arrays.forEach((arrayConfig, arrayIndex) => {
    const arrayOverrides = (setupConfig.arraysSettings ?? []).filter(
      o => o.array === arrayIndex,
    );
    for (let row = 0; row < arrayConfig.rows; row++) {
      for (let col = 0; col < arrayConfig.columns; col++) {
        const panelOverride = arrayOverrides.find(
          o => o.row === row && o.col === col,
        );
        const resolved = PanelOverrideResolver.resolve(
          setupConfig.panelDefaults, arrayConfig, panelOverride,
        );
        seen.add(resolved.string);
      }
    }
  });

  return seen.size;
};

/**
 * Warns when a setup uses more distinct strings than available colours.
 * When this happens, string colours will repeat and the visual distinction
 * between strings is lost.
 */
export class StringCountValidator implements FunctionalValidator {
  validate(config: Config): FunctionalValidationIssue[] {
    const issues: FunctionalValidationIssue[] = [];

    for (const setup of config.setups) {
      const count = countDistinctStrings(setup);
      if (count > MAX_COLOURS) {
        issues.push({
          type: 'string-count',
          severity: 'warning',
          data: {
            setupLabel: setup.label,
            stringCount: count,
            maxColours: MAX_COLOURS,
          },
        });
      }
    }

    return issues;
  }
}