import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { SimulationCache } from '../../db/SimulationCache';
import { SimulationGroup } from '../../types/results';
import { buildSimulationGroups } from '../../utils/SimulationGroupUtils';
import { appEvents } from '../../events/AppEvents';

type SimulationSummary = Awaited<ReturnType<typeof SimulationCache.listResults>>[number];

const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export const buildGroupLabel = (g: SimulationGroup, t: TFunction): string =>
  t('simulationResultsPanel.groupLabel', {
    year: g.year,
    interval: g.intervalMinutes,
    irradiance: t(`simulationResultsPanel.irradiance_${g.irradianceSource}` as any),
    samplingCode: `${g.density * g.density}p${g.threshold}t`,
    setups: g.setups.length,
  });

/**
 * Cache management sub-section for simulation results.
 * Groups entries by simulation parameters and allows deleting individual
 * setups, entire groups, or all results at once.
 */
export function SimulationCacheSection() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<SimulationGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    SimulationCache.listResults()
      .then((entries: SimulationSummary[]) => setGroups(buildSimulationGroups(entries)))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    appEvents.on('simulationResultsChanged', reload);
    return () => appEvents.off('simulationResultsChanged', reload);
  }, [reload]);

  const handleDeleteSetup = async (cacheKey: string) => {
    await SimulationCache.deleteResult(cacheKey).catch(() => null);
    reload();
    appEvents.emit('simulationResultsChanged', { autoSelect: false });
  };

  const handleDeleteGroup = async (group: SimulationGroup) => {
    await Promise.all(
      group.setups.map(s => SimulationCache.deleteResult(s.cacheKey).catch(() => null)),
    );
    reload();
    appEvents.emit('simulationResultsChanged', { autoSelect: false });
  };

  const handleClearAll = async () => {
    await SimulationCache.clearAllResults().catch(() => null);
    reload();
    appEvents.emit('simulationResultsChanged', { autoSelect: false });
  };

  const totalEntries = groups.reduce((sum, g) => sum + g.setups.length, 0);

  return (
    <div>
      <p className="settings-subsection__title">{t('settings.cache.simulationsTitle')}</p>
      {loading ? (
        <p className="cache-entry-list__empty">{t('settings.cache.loading')}</p>
      ) : groups.length === 0 ? (
        <p className="cache-entry-list__empty">{t('settings.cache.noSimulations')}</p>
      ) : (
        <div className="cache-entry-list">
          {groups.map(group => (
            <div key={group.groupKey} className="sim-group">
              <div className="sim-group__header">
                <span className="sim-group__label">{buildGroupLabel(group, t)}</span>
                <span className="sim-group__meta">{formatDate(group.computedAt)}</span>
                <button
                  className="sim-group__delete-btn"
                  onClick={() => handleDeleteGroup(group)}
                  title={t('settings.cache.deleteGroup')}
                >
                  🗑
                </button>
              </div>
              <div className="sim-group__setups">
                {group.setups.map(setup => (
                  <div key={setup.cacheKey} className="cache-entry">
                    <div className="cache-entry__info">
                      <span className="cache-entry__label">{setup.setupLabel}</span>
                    </div>
                    <span className="cache-entry__value">
                      {setup.annualTotalKwh.toFixed(1)} kWh
                    </span>
                    <button
                      className="cache-entry__delete-btn"
                      onClick={() => handleDeleteSetup(setup.cacheKey)}
                      title={t('settings.cache.deleteEntry')}
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        className="settings-danger-btn"
        onClick={handleClearAll}
        disabled={totalEntries === 0}
      >
        {t('settings.cache.clearAllSimulations')}
      </button>
    </div>
  );
}