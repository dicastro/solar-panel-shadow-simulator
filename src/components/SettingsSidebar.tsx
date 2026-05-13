import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { useAppStore } from '../store/AppStore';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { SimulationCache } from '../db/SimulationCache';
import { IrradianceCacheManager, IrradianceCacheEntryMeta } from '../db/IrradianceCacheManager';
import { SimulationGroup } from '../types/results';
import { buildSimulationGroups } from '../utils/SimulationGroupUtils';

const SIDEBAR_DEFAULT_WIDTH = 440;
const SIDEBAR_MIN_WIDTH = 300;

/**
 * Persists the sidebar width across open/close cycles within the same browser
 * session. The sidebar component unmounts when closed, so React state alone
 * cannot preserve the value. A module-level variable survives remounts but
 * resets on page refresh — the correct trade-off for UI preference state that
 * does not need to outlive the session.
 */
let persistedSidebarWidth = SIDEBAR_DEFAULT_WIDTH;

type SimulationSummary = Awaited<ReturnType<typeof SimulationCache.listResults>>[number];

const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

/**
 * Builds the short label used for a simulation group in the cache list,
 * matching the format shown in the results panel run selector.
 */
const buildGroupLabel = (g: SimulationGroup, t: TFunction): string =>
  t('simulationResultsPanel.groupLabel', {
    year: g.year,
    interval: g.intervalMinutes,
    irradiance: t(`simulationResultsPanel.irradiance_${g.irradianceSource}` as any),
    samplingCode: `${g.density * g.density}p${g.threshold}t`,
    setups: g.setups.length,
  });

/**
 * Collapsible section within the settings sidebar.
 * Starts open when `defaultOpen` is true.
 */
function SidebarSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="settings-section">
      <div className="settings-section__header" onClick={() => setOpen(o => !o)}>
        <span className="settings-section__title">{title}</span>
        <span className={`settings-section__chevron${open ? ' settings-section__chevron--open' : ''}`}>
          ▼
        </span>
      </div>
      {open && <div className="settings-section__body">{children}</div>}
    </div>
  );
}

/**
 * Cache management sub-section for simulation results.
 *
 * Entries are displayed in two levels:
 *  - Level 1: simulation group (year, interval, irradiance, density, threshold)
 *             with a button to delete the entire group.
 *  - Level 2: individual setup rows within that group, each with their own
 *             delete button.
 *
 * After any mutation the list is reloaded so the results panel group selector
 * stays in sync.
 */
function SimulationCacheSection() {
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

  const handleDeleteSetup = async (cacheKey: string) => {
    await SimulationCache.deleteResult(cacheKey).catch(() => null);
    reload();
  };

  const handleDeleteGroup = async (group: SimulationGroup) => {
    await Promise.all(
      group.setups.map(s => SimulationCache.deleteResult(s.cacheKey).catch(() => null)),
    );
    reload();
  };

  const handleClearAll = async () => {
    await SimulationCache.clearAllResults().catch(() => null);
    reload();
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

/**
 * Cache management sub-section for Open-Meteo irradiance data.
 * Each entry is a flat row (no grouping needed — entries are already
 * distinct by source, location, and year).
 */
function IrradianceCacheSection() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<IrradianceCacheEntryMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    IrradianceCacheManager.listEntries()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (key: string) => {
    await IrradianceCacheManager.deleteEntry(key).catch(() => null);
    reload();
  };

  const handleClearAll = async () => {
    await IrradianceCacheManager.clearAllEntries().catch(() => null);
    reload();
  };

  return (
    <div>
      <p className="settings-subsection__title">{t('settings.cache.irradianceTitle')}</p>
      {loading ? (
        <p className="cache-entry-list__empty">{t('settings.cache.loading')}</p>
      ) : (
        <div className="cache-entry-list">
          {entries.length === 0 ? (
            <p className="cache-entry-list__empty">{t('settings.cache.noIrradiance')}</p>
          ) : (
            entries.map(entry => (
              <div key={entry.key} className="cache-entry">
                <div className="cache-entry__info">
                  <span className="cache-entry__label">{entry.source}</span>
                  <span className="cache-entry__meta">
                    {entry.lat.toFixed(4)}, {entry.lon.toFixed(4)} · {entry.year}
                  </span>
                  <span className="cache-entry__meta">{formatDate(entry.fetchedAt)}</span>
                </div>
                <button
                  className="cache-entry__delete-btn"
                  onClick={() => handleDelete(entry.key)}
                  title={t('settings.cache.deleteEntry')}
                >
                  🗑
                </button>
              </div>
            ))
          )}
        </div>
      )}
      <button
        className="settings-danger-btn"
        onClick={handleClearAll}
        disabled={entries.length === 0}
      >
        {t('settings.cache.clearAllIrradiance')}
      </button>
    </div>
  );
}

/**
 * Full-height settings sidebar rendered as a fixed overlay on the left edge
 * of the viewport. The sidebar width is user-resizable by dragging the right
 * edge handle, and its body scrolls vertically when content exceeds the
 * viewport height.
 *
 * A semi-transparent backdrop covers the rest of the screen; clicking it
 * closes the sidebar. The gear button is hidden while the sidebar is open.
 *
 * Three collapsible sections:
 *  1. Cache management — simulation results (two-level) and irradiance data.
 *  2. Export / Import — placeholder for Phase 6b.
 *  3. Configuration — placeholder for Phase 6d.
 */
export function SettingsSidebar() {
  const { t } = useTranslation();
  const closeSidebar = useAppStore(s => s.closeSidebar);

  const { width, isDragging, dragHandleProps } = useResizablePanel({
    defaultWidth: persistedSidebarWidth,
    minWidth: SIDEBAR_MIN_WIDTH,
    dragDirection: 'right',
  });

  // Keep the module-level variable in sync so the next open restores this width.
  persistedSidebarWidth = width;

  return (
    <>
      <div className="settings-sidebar-backdrop" onClick={closeSidebar} />

      <div className="settings-sidebar-overlay" style={{ width }}>
        <div className="settings-sidebar">
          <div className="settings-sidebar__header">
            <span className="settings-sidebar__title">{t('settings.title')}</span>
            <button
              className="settings-sidebar__close-btn"
              onClick={closeSidebar}
              title={t('settings.close')}
            >
              ✕
            </button>
          </div>

          <div className="settings-sidebar__body">
            <SidebarSection title={t('settings.cache.sectionTitle')} defaultOpen>
              <SimulationCacheSection />
              <IrradianceCacheSection />
            </SidebarSection>

            <SidebarSection title={t('settings.exportImport.sectionTitle')}>
              <p className="settings-placeholder">{t('settings.exportImport.placeholder')}</p>
            </SidebarSection>

            <SidebarSection title={t('settings.configuration.sectionTitle')}>
              <p className="settings-placeholder">{t('settings.configuration.placeholder')}</p>
            </SidebarSection>
          </div>
        </div>

        {/* Drag handle on the right edge of the sidebar */}
        <div
          className={`settings-sidebar__drag-handle${isDragging ? ' settings-sidebar__drag-handle--dragging' : ''}`}
          {...dragHandleProps}
          title={t('resultsPanel.dragHint')}
        />
      </div>
    </>
  );
}