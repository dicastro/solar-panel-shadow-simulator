import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/AppStore';
import { SimulationCache } from '../db/SimulationCache';
import { IrradianceCacheManager, IrradianceCacheEntryMeta } from '../db/IrradianceCacheManager';

type SimulationSummary = Awaited<ReturnType<typeof SimulationCache.listResults>>[number];

/**
 * Formats a Unix timestamp as a short locale date string.
 */
const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
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
 * Exposes per-entry deletion and a clear-all action. After any deletion the
 * results panel group list is reloaded so stale entries never appear in the selector.
 */
function SimulationCacheSection() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<SimulationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    SimulationCache.listResults()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (cacheKey: string) => {
    await SimulationCache.deleteResult(cacheKey).catch(() => null);
    reload();
  };

  const handleClearAll = async () => {
    await SimulationCache.clearAllResults().catch(() => null);
    reload();
  };

  return (
    <div>
      <p className="settings-subsection__title">{t('settings.cache.simulationsTitle')}</p>
      {loading ? (
        <p className="cache-entry-list__empty">{t('settings.cache.loading')}</p>
      ) : (
        <div className="cache-entry-list">
          {entries.length === 0 ? (
            <p className="cache-entry-list__empty">{t('settings.cache.noSimulations')}</p>
          ) : (
            entries.map(entry => (
              <div key={entry.cacheKey} className="cache-entry">
                <div className="cache-entry__info">
                  <span className="cache-entry__label">{entry.setupLabel}</span>
                  <span className="cache-entry__meta">
                    {entry.year} · {entry.intervalMinutes} min · {entry.irradianceSource} · {entry.density}×{entry.density} / {entry.threshold}t
                  </span>
                  <span className="cache-entry__meta">{formatDate(entry.computedAt)}</span>
                </div>
                <span className="cache-entry__value">
                  {entry.annualTotalKwh.toFixed(1)} kWh
                </span>
                <button
                  className="cache-entry__delete-btn"
                  onClick={() => handleDelete(entry.cacheKey)}
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
        {t('settings.cache.clearAllSimulations')}
      </button>
    </div>
  );
}

/**
 * Cache management sub-section for Open-Meteo irradiance data.
 * Exposes per-entry deletion and a clear-all action.
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
 * of the viewport. A semi-transparent backdrop covers the rest of the screen;
 * clicking it closes the sidebar.
 *
 * The sidebar is divided into three collapsible sections:
 *  1. Cache management — lists and allows deletion of simulation results and
 *     irradiance data cached in IndexedDB.
 *  2. Export / Import — placeholder for Phase 6b.
 *  3. Configuration — placeholder for Phase 6d.
 */
export function SettingsSidebar() {
  const { t } = useTranslation();
  const closeSidebar = useAppStore(s => s.closeSidebar);

  return (
    <>
      {/* Backdrop — closes sidebar on click */}
      <div className="settings-sidebar-backdrop" onClick={closeSidebar} />

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
    </>
  );
}