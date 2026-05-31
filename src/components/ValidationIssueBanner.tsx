import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/AppStore';
import { FunctionalValidationIssue } from '../validation';

/**
 * Renders validation issues grouped by severity (errors first, then warnings).
 * Within each severity group, issues are further grouped by type, each with
 * its own title and content layout. Renders nothing when there are no issues.
 */
export function ValidationIssueBanner() {
  const { t } = useTranslation();
  const validationIssues = useAppStore(s => s.validationIssues);

  if (validationIssues.length === 0) return null;

  const errors = validationIssues.filter(i => i.severity === 'error');
  const warnings = validationIssues.filter(i => i.severity === 'warning');

  return (
    <div className="validation-banner">
      {errors.length > 0 && (
        <SeverityGroup
          title={t('validationIssues.errorTitle')}
          issues={errors}
          modifier="error"
        />
      )}
      {warnings.length > 0 && (
        <SeverityGroup
          title={t('validationIssues.warningTitle')}
          issues={warnings}
          modifier="warning"
        />
      )}
    </div>
  );
}

function SeverityGroup({
  title,
  issues,
  modifier,
}: {
  title: string;
  issues: FunctionalValidationIssue[];
  modifier: 'error' | 'warning';
}) {
  const byType = issues.reduce<Map<string, FunctionalValidationIssue[]>>((acc, issue) => {
    const group = acc.get(issue.type) ?? [];
    group.push(issue);
    acc.set(issue.type, group);
    return acc;
  }, new Map());

  return (
    <div className={`validation-banner__group validation-banner__group--${modifier}`}>
      <div className="validation-banner__group-title">
        <span>{modifier === 'error' ? '✕' : '⚠'}</span>
        <span>{title}</span>
      </div>
      {Array.from(byType.entries()).map(([type, typeIssues]) => (
        <TypeBlock key={type} type={type} issues={typeIssues} />
      ))}
    </div>
  );
}

function TypeBlock({
  type,
  issues,
}: {
  type: string;
  issues: FunctionalValidationIssue[];
}) {
  const { t } = useTranslation();

  return (
    <div className="validation-banner__type-block">
      <div className="validation-banner__type-title">
        {t(`validationIssues.${type}.title` as any)}
      </div>
      <TypeBlockContent type={type} issues={issues} />
    </div>
  );
}

/**
 * Renders the content for a specific issue type. Each type owns its layout:
 * angle issues show a single explanatory message followed by a list of
 * coordinate triplets; railing-support-count issues show a flat list of
 * messages, one per issue.
 *
 * Adding a new ValidationType means adding a case here.
 */
function TypeBlockContent({
  type,
  issues,
}: {
  type: string;
  issues: FunctionalValidationIssue[];
}) {
  const { t } = useTranslation();

  switch (type) {
    case 'angle': {
      const formatPoint = (p: readonly [number, number]) => `[${p[0]}, ${p[1]}]`;
      return (
        <>
          <p className="validation-banner__type-message">
            {t('validationIssues.angle.message')}
          </p>
          <ul className="validation-banner__list">
            {issues.map((issue, idx) => {
              if (issue.type !== 'angle') return null;
              return (
                <li key={idx} className="validation-banner__list-item">
                  {t('validationIssues.angle.tripletLabel', {
                    prev: formatPoint(issue.data.pointPrev),
                    point: formatPoint(issue.data.point),
                    next: formatPoint(issue.data.pointNext),
                  })}
                </li>
              );
            })}
          </ul>
        </>
      );
    }
    case 'railing-support-count': {
      return (
        <ul className="validation-banner__list">
          {issues.map((issue, idx) => {
            if (issue.type !== 'railing-support-count') return null;
            return (
              <li key={idx} className="validation-banner__list-item">
                {issue.data.isDefault
                  ? t('validationIssues.railing-support-count.defaultMessage', { count: issue.data.count })
                  : t('validationIssues.railing-support-count.wallMessage', { wall: issue.data.wallIndex, count: issue.data.count })
                }
              </li>
            );
          })}
        </ul>
      );
    }
    default:
      return null;
  }
}