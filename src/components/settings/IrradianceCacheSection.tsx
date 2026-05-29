import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { IrradianceCacheManager, IrradianceCacheEntryMeta } from '../../db/IrradianceCacheManager';

const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

/**
 * Cache management sub-section for Open-Meteo irradiance data.
 * Each entry is a flat row identified by source, location, and year.
 */
export function IrradianceCacheSection() {
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