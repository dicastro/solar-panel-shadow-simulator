import { Config } from '../types/config';
import { PointXZFactory } from '../factory/PointXZFactory';
import { PointXZUtils } from '../utils/PointXZUtils';
import { FunctionalValidator, FunctionalValidationIssue } from './FunctionalValidator';

/**
 * Validates that all wall corner angles are 90° or 180°.
 * Non-right angles produce incorrect wall geometry.
 */
export class AngleValidator implements FunctionalValidator {
  validate(config: Config): FunctionalValidationIssue[] {
    const { wallPoints } = config.site;
    const n = wallPoints.length;

    const centerX = wallPoints.reduce((s, p) => s + p[0], 0) / n;
    const centerZ = wallPoints.reduce((s, p) => s + p[1], 0) / n;

    const centeredPoints = wallPoints.map(p =>
      PointXZFactory.create(p[0] - centerX, -(p[1] - centerZ)),
    );

    const issues: FunctionalValidationIssue[] = [];

    centeredPoints.forEach((p, i) => {
      const pPrev = PointXZUtils.getPreviousPoint(i, centeredPoints);
      const pNext = PointXZUtils.getNextPoint(i, centeredPoints);
      const info = PointXZUtils.pointAlignedWithPreviousAndNext(p, pPrev, pNext);

      if (!info.isStraight && !PointXZUtils.isRightAngle(p, pPrev, pNext)) {
        const prevIdx = (i - 1 + n) % n;
        const nextIdx = (i + 1) % n;
        issues.push({
          type: 'angle',
          severity: 'error',
          data: {
            pointPrev: wallPoints[prevIdx],
            point: wallPoints[i],
            pointNext: wallPoints[nextIdx],
          },
        });
      }
    });

    return issues;
  }
}