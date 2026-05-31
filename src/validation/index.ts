import { Config } from '../types/config';
import { FunctionalValidationIssue } from './FunctionalValidator';
import { AngleValidator } from './AngleValidator';
import { RailingSupportCountValidator } from './RailingSupportCountValidator';

/**
 * All registered functional validators. Adding a new validation means
 * implementing FunctionalValidator and adding an instance here.
 */
const validators = [
  new AngleValidator(),
  new RailingSupportCountValidator(),
];

/**
 * Runs all registered functional validators against the given config and
 * returns the aggregated list of issues, errors before warnings.
 */
export const runAllValidators = (config: Config): FunctionalValidationIssue[] => {
  const all = validators.flatMap(v => v.validate(config));
  return [
    ...all.filter(i => i.severity === 'error'),
    ...all.filter(i => i.severity === 'warning'),
  ];
};

export type { FunctionalValidationIssue, ValidationSeverity, ValidationType } from './FunctionalValidator';