import { Config } from '../types/config';

export type ValidationSeverity = 'error' | 'warning';
export type ValidationType = 'angle' | 'railing-support-count' | 'string-count';

export interface AngleIssueData {
  readonly pointPrev: readonly [number, number];
  readonly point: readonly [number, number];
  readonly pointNext: readonly [number, number];
}

export type RailingSupportCountIssueData =
  | {
      readonly isDefault: true;
      readonly count: number;
    }
  | {
      readonly isDefault: false;
      readonly wallIndex: number;
      readonly count: number;
    };

export interface StringCountIssueData {
  readonly setupLabel: string;
  readonly stringCount: number;
  readonly maxColours: number;
}

export type FunctionalValidationIssue =
  | { readonly type: 'angle'; readonly severity: ValidationSeverity; readonly data: AngleIssueData }
  | { readonly type: 'railing-support-count'; readonly severity: ValidationSeverity; readonly data: RailingSupportCountIssueData }
  | { readonly type: 'string-count'; readonly severity: ValidationSeverity; readonly data: StringCountIssueData };

export interface FunctionalValidator {
  validate(config: Config): FunctionalValidationIssue[];
}