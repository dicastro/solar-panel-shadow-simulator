import { Config } from '../types/config';
import { FunctionalValidationIssue } from './FunctionalValidator';
import { AngleValidator } from './AngleValidator';
import { RailingSupportCountValidator } from './RailingSupportCountValidator';
import { StringCountValidator } from './StringCountValidator';

const validators = [
  new AngleValidator(),
  new RailingSupportCountValidator(),
  new StringCountValidator(),
];

export const runAllValidators = (config: Config): FunctionalValidationIssue[] => {
  const all = validators.flatMap(v => v.validate(config));
  return [
    ...all.filter(i => i.severity === 'error'),
    ...all.filter(i => i.severity === 'warning'),
  ];
};

export type { FunctionalValidationIssue, ValidationSeverity, ValidationType } from './FunctionalValidator';