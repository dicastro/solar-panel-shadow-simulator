import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/AppStore';
import { SimulationCache } from '../../db/SimulationCache';
import { BackupExporter } from '../../backup/BackupExporter';
import { BackupImporter } from '../../backup/BackupImporter';
import { BACKUP_FILE_EXTENSION } from '../../backup/BackupConstants';
import { appEvents } from '../../events/AppEvents';
import { ConfigStorage } from '../../utils/ConfigStorage';

/**
 * Export/Import sub-section: full backup including configuration and all
 * simulation run results.
 *
 * Export triggers a download of a gzip-compressed .solarsim file.
 * Import replaces the current config and all simulation results, then
 * persists the imported config to OPFS so it survives reload.
 */
export function ExportImportSection() {
  const { t } = useTranslation();
  const config = useAppStore(s => s.config);
  const loadConfig = useAppStore(s => s.loadConfig);
  const setIsFirstLaunch = useAppStore(s => s.setIsFirstLaunch);

  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [exportError, setExportError] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!config) return;
    setExportStatus('exporting');
    setExportError('');
    try {
      await BackupExporter.export(config);
      setExportStatus('success');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
      setExportStatus('error');
    }
  };

  const handleImportClick = () => {
    setImportStatus('idle');
    setImportMessage('');
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const { config: importedConfig, simulationResults } = await BackupImporter.parse(file);

      await SimulationCache.replaceAllResults(simulationResults);
      await ConfigStorage.save(importedConfig);
      loadConfig(importedConfig);
      setIsFirstLaunch(false);

      appEvents.emit('simulationResultsChanged', { autoSelect: true });

      setImportStatus('success');
      setImportMessage(
        t('settings.exportImport.importSuccess', { count: simulationResults.length }),
      );
    } catch (err) {
      setImportStatus('error');
      setImportMessage(
        t('settings.exportImport.importError', {
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="settings-placeholder" style={{ fontStyle: 'normal', color: '#aaa' }}>
        {t('settings.exportImport.importDescription')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          className="settings-action-btn"
          onClick={handleExport}
          disabled={!config || exportStatus === 'exporting'}
          title={t('settings.exportImport.exportTitle')}
        >
          {exportStatus === 'exporting'
            ? t('settings.exportImport.exportingBtn')
            : t('settings.exportImport.exportBtn')}
        </button>
        {exportStatus === 'success' && (
          <p className="settings-feedback settings-feedback--success">
            {t('settings.exportImport.exportSuccess')}
          </p>
        )}
        {exportStatus === 'error' && (
          <p className="settings-feedback settings-feedback--error">
            {t('settings.exportImport.exportError', { message: exportError })}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={BACKUP_FILE_EXTENSION}
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
        <button
          className="settings-action-btn"
          onClick={handleImportClick}
          title={t('settings.exportImport.importTitle')}
        >
          {t('settings.exportImport.importBtn')}
        </button>
        {importStatus === 'success' && (
          <p className="settings-feedback settings-feedback--success">{importMessage}</p>
        )}
        {importStatus === 'error' && (
          <p className="settings-feedback settings-feedback--error">{importMessage}</p>
        )}
      </div>
    </div>
  );
}