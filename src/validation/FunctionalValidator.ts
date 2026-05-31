import { Config } from '../types/config';

export type ValidationSeverity = 'error' | 'warning';
export type ValidationType = 'angle' | 'railing-support-count';

export interface AngleIssueData {
  readonly pointPrev: readonly [number, number];
  readonly point: readonly [number, number];
  readonly pointNext: readonly [number, number];
}

export type RailingSupportCountIssueData =
  | {
      /** Issue originates from railingDefaults. Fix is in one place. */
      readonly isDefault: true;
      readonly count: number;
    }
  | {
      /** Issue originates from a per-wall override. */
      readonly isDefault: false;
      readonly wallIndex: number;
      readonly count: number;
    };

export type FunctionalValidationIssue =
  | { readonly type: 'angle'; readonly severity: ValidationSeverity; readonly data: AngleIssueData }
  | { readonly type: 'railing-support-count'; readonly severity: ValidationSeverity; readonly data: RailingSupportCountIssueData };

export interface FunctionalValidator {
  validate(config: Config): FunctionalValidationIssue[];
}