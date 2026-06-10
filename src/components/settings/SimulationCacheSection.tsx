import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { SimulationCache } from '../../db/SimulationCache';
import { SimulationGroup } from '../../types/results';
import { buildSimulationGroups } from '../../utils/SimulationGroupUtils';
import { appEvents } from '../../events/AppEvents';

const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const buildGroupLabel = (g: SimulationGroup, t: TFunction): string =>
  t('simulationResultsPanel.groupLabel', {
    year: g.year,
    interval: g.intervalMinutes,
    irradiance: t(`simulationResultsPanel.irradiance_${g.irradianceSource}` as any),
    samplingCode: `${g.density * g.density}p${g.threshold}t`,
  });

/**
 * Cache management sub-section for simulation results.
 *
 * Each entry represents a complete simulation run (all setups together).
 * Deletion always removes the entire run — there is no per-setup deletion.
 */
export function SimulationCacheSection() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<SimulationGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    SimulationCache.listResults()
      .then(summaries => setGroups(buildSimulationGroups(summaries)))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    appEvents.on('simulationResultsChanged', reload);
    return () => appEvents.off('simulationResultsChanged', reload);
  }, [reload]);

  const handleDeleteRun = async (cacheKey: string) => {
    await SimulationCache.deleteResult(cacheKey).catch(() => null);
    reload();
    appEvents.emit('simulationResultsChanged', { autoSelect: false });
  };

  const handleClearAll = async () => {
    await SimulationCache.clearAllResults().catch(() => null);
    reload();
    appEvents.emit('simulationResultsChanged', { autoSelect: false });
  };

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
            <div key={group.cacheKey} className="sim-group">
              <div className="sim-group__header">
                <div className="sim-group__header-info">
                  <span className="sim-group__label">{buildGroupLabel(group, t)}</span>
                  <span className="sim-group__meta">{formatDate(group.computedAt)}</span>
                </div>
                <button
                  className="sim-group__delete-btn"
                  onClick={() => handleDeleteRun(group.cacheKey)}
                  title={t('settings.cache.deleteRun')}
                >
                  🗑
                </button>
              </div>
              <div className="sim-group__setups">
                {group.setups.map(setup => (
                  <div key={setup.setupId} className="cache-entry">
                    <div className="cache-entry__info">
                      <span className="cache-entry__label">{setup.setupLabel}</span>
                    </div>
                    <span className="cache-entry__value">
                      {setup.annualTotalKwh.toFixed(1)} kWh
                    </span>
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
        disabled={groups.length === 0}
      >
        {t('settings.cache.clearAllSimulations')}
      </button>
    </div>
  );
}