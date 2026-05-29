import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/AppStore';
import { SimulationCache } from '../../db/SimulationCache';
import { ConfigStorage } from '../../utils/ConfigStorage';
import { Config } from '../../types/config';
import { validateConfig } from '../../utils/ConfigValidator';
import { appEvents } from '../../events/AppEvents';

type ConfigEditorMode = 'view' | 'edit';

// ── Line-numbered editor ──────────────────────────────────────────────────────

/**
 * JSON editor with a line-number gutter.
 *
 * Layout: flex row with a fixed-width <pre> gutter on the left and a
 * <textarea> on the right. Both elements share identical font metrics so
 * numbers always align with textarea rows. The wrapper has a fixed height
 * (matching the read-only <pre>) so the textarea is clipped and scrollable
 * rather than expanding to fit all content. The user can resize the wrapper
 * vertically by dragging its bottom-right corner.
 *
 * Scroll synchronisation: the gutter follows the textarea's scrollTop via
 * an onScroll handler; it never scrolls independently.
 */
function LineNumberedEditor({
  value,
  onChange,
  hasError,
  height,
}: {
  value: string;
  onChange: (v: string) => void;
  hasError: boolean;
  height: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLPreElement>(null);

  const lineCount = value.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

  const syncScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div
      className={`config-editor-wrapper${hasError ? ' config-editor-wrapper--error' : ''}`}
      style={{ height }}
    >
      <pre
        ref={lineNumbersRef}
        className="config-editor__line-numbers"
        aria-hidden="true"
      >
        {lineNumbers}
      </pre>
      <textarea
        ref={textareaRef}
        className="config-editor__textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}

// ── Confirmation dialog ───────────────────────────────────────────────────────

function ConfigChangeConfirmDialog({
  onDeleteAndContinue,
  onKeepAndContinue,
  onCancel,
}: {
  onDeleteAndContinue: () => void;
  onKeepAndContinue: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="config-confirm-backdrop">
      <div className="config-confirm-dialog">
        <p className="config-confirm-dialog__message">
          {t('settings.configuration.changeWarning')}
        </p>
        <div className="config-confirm-dialog__actions">
          <button
            className="settings-danger-btn"
            style={{ alignSelf: 'stretch', marginTop: 0 }}
            onClick={onDeleteAndContinue}
          >
            {t('settings.configuration.changeDeleteAndContinue')}
          </button>
          <button className="settings-action-btn" onClick={onKeepAndContinue}>
            {t('settings.configuration.changeKeepAndContinue')}
          </button>
          <button className="settings-action-btn" onClick={onCancel}>
            {t('settings.configuration.changeCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Documentation link ────────────────────────────────────────────────────────

function DocLink() {
  const { t } = useTranslation();
  return (
    <a
      href="#"
      target="_blank"
      rel="noopener noreferrer"
      className="config-first-launch-banner__link"
    >
      {t('settings.configuration.firstLaunchDocLink')}
    </a>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const applyValidatedConfig = async (
  config: Config,
  deleteSimulations: boolean,
  loadConfig: (c: Config) => void,
  setIsFirstLaunch: (v: boolean) => void,
): Promise<void> => {
  if (deleteSimulations) {
    await SimulationCache.clearAllResults();
    appEvents.emit('simulationResultsChanged', { autoSelect: false });
  }
  await ConfigStorage.save(config);
  loadConfig(config);
  setIsFirstLaunch(false);
};

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Configuration section of the settings sidebar.
 *
 * Shows a first-launch banner when the app is running with the built-in
 * default configuration, or a regular documentation link banner otherwise.
 *
 * Three capabilities:
 * 1. Inline JSON editor with line numbers and two-level validation
 *    (JSON syntax + ajv schema). The editor opens at the same height as the
 *    read-only view and can be resized vertically by the user.
 * 2. Export the current config as a plain config.json file.
 * 3. Load a config.json file from disk.
 *
 * Any config change triggers a confirmation dialog warning that existing
 * simulations will become inaccessible in the results panel.
 */
export function ConfigurationSection() {
  const { t } = useTranslation();
  const config = useAppStore(s => s.config);
  const loadConfig = useAppStore(s => s.loadConfig);
  const isFirstLaunch = useAppStore(s => s.isFirstLaunch);
  const setIsFirstLaunch = useAppStore(s => s.setIsFirstLaunch);

  const [mode, setMode] = useState<ConfigEditorMode>('view');
  const [editorText, setEditorText] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [applyStatus, setApplyStatus] = useState<'idle' | 'success'>('idle');

  const [pendingConfig, setPendingConfig] = useState<Config | null>(null);

  const [fileImportStatus, setFileImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [fileImportMessage, setFileImportMessage] = useState('');
  const [exportStatus, setExportStatus] = useState<'idle' | 'success'>('idle');

  // Tracks the pixel height of the read-only <pre> so the editor opens at
  // exactly the same height without a layout jump.
  const readonlyRef = useRef<HTMLPreElement>(null);
  const [editorHeight, setEditorHeight] = useState(320);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const prettyConfig = config ? JSON.stringify(config, null, 2) : '';

  const handleEdit = () => {
    // Capture the current rendered height of the read-only view so the editor
    // opens at the same size — no layout shift on mode switch.
    if (readonlyRef.current) {
      setEditorHeight(readonlyRef.current.getBoundingClientRect().height);
    }
    setEditorText(prettyConfig);
    setValidationErrors([]);
    setApplyStatus('idle');
    setMode('edit');
  };

  const handleCancel = () => {
    setMode('view');
    setValidationErrors([]);
    setApplyStatus('idle');
  };

  const parseAndValidate = (text: string): Config | null => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setValidationErrors([
        t('settings.configuration.syntaxError', {
          message: err instanceof Error ? err.message : String(err),
        }),
      ]);
      return null;
    }

    const result = validateConfig(parsed);
    if (!result.valid) {
      setValidationErrors(result.errors);
      return null;
    }

    setValidationErrors([]);
    return parsed as Config;
  };

  const handleApply = () => {
    const newConfig = parseAndValidate(editorText);
    if (!newConfig) return;
    setPendingConfig(newConfig);
  };

  const handleConfirmDeleteAndContinue = async () => {
    if (!pendingConfig) return;
    await applyValidatedConfig(pendingConfig, true, loadConfig, setIsFirstLaunch);
    setPendingConfig(null);
    setMode('view');
    setApplyStatus('success');
    setFileImportStatus('idle');
    setTimeout(() => setApplyStatus('idle'), 3000);
  };

  const handleConfirmKeepAndContinue = async () => {
    if (!pendingConfig) return;
    await applyValidatedConfig(pendingConfig, false, loadConfig, setIsFirstLaunch);
    setPendingConfig(null);
    setMode('view');
    setApplyStatus('success');
    setFileImportStatus('idle');
    setTimeout(() => setApplyStatus('idle'), 3000);
  };

  const handleConfirmCancel = () => {
    setPendingConfig(null);
  };

  const handleExportFile = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportStatus('success');
    setTimeout(() => setExportStatus('idle'), 3000);
  };

  const handleLoadFileClick = () => {
    setFileImportStatus('idle');
    setFileImportMessage('');
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    file.text().then(text => {
      const newConfig = parseAndValidate(text);
      if (!newConfig) {
        setFileImportStatus('error');
        setFileImportMessage(
          validationErrors[0] ?? t('settings.configuration.invalidConfig'),
        );
        return;
      }
      setPendingConfig(newConfig);
    }).catch(err => {
      setFileImportStatus('error');
      setFileImportMessage(err instanceof Error ? err.message : String(err));
    });
  };

  const handleReset = async () => {
    if (!window.confirm(t('settings.configuration.resetConfirm'))) return;
    await ConfigStorage.clear();
    window.dispatchEvent(new CustomEvent('app:reload'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {pendingConfig && (
        <ConfigChangeConfirmDialog
          onDeleteAndContinue={handleConfirmDeleteAndContinue}
          onKeepAndContinue={handleConfirmKeepAndContinue}
          onCancel={handleConfirmCancel}
        />
      )}

      {/* Documentation banner — always visible */}
      <div className="config-first-launch-banner">
        {isFirstLaunch ? (
          <>
            <p>{t('settings.configuration.firstLaunchMessage')}</p>
            <DocLink />
          </>
        ) : (
          <>
            <p>{t('settings.configuration.docLinkMessage')}</p>
            <DocLink />
          </>
        )}
      </div>

      {/* ── Inline editor ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p className="settings-subsection__title" style={{ marginBottom: 0 }}>
          {t('settings.configuration.editorTitle')}
        </p>

        {mode === 'view' ? (
          <>
            <pre ref={readonlyRef} className="config-editor config-editor--readonly">
              {prettyConfig}
            </pre>
            <button className="settings-action-btn" onClick={handleEdit}>
              {t('settings.configuration.editBtn')}
            </button>
            {applyStatus === 'success' && (
              <p className="settings-feedback settings-feedback--success">
                {t('settings.configuration.applySuccess')}
              </p>
            )}
          </>
        ) : (
          <>
            <LineNumberedEditor
              value={editorText}
              onChange={v => { setEditorText(v); setValidationErrors([]); }}
              hasError={validationErrors.length > 0}
              height={editorHeight}
            />
            {validationErrors.length > 0 && (
              <div className="config-validation-errors">
                {validationErrors.map((err, i) => (
                  <p key={i} className="settings-feedback settings-feedback--error">
                    {err}
                  </p>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="settings-action-btn"
                style={{ flex: 1 }}
                onClick={handleApply}
              >
                {t('settings.configuration.applyBtn')}
              </button>
              <button
                className="settings-action-btn"
                style={{ flex: 1 }}
                onClick={handleCancel}
              >
                {t('settings.configuration.cancelBtn')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Export / load from file ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p className="settings-subsection__title" style={{ marginBottom: 0 }}>
          {t('settings.configuration.fileTitle')}
        </p>

        <button
          className="settings-action-btn"
          onClick={handleExportFile}
          disabled={!config}
          title={t('settings.configuration.exportFileTitle')}
        >
          {t('settings.configuration.exportFileBtn')}
        </button>
        {exportStatus === 'success' && (
          <p className="settings-feedback settings-feedback--success">
            {t('settings.configuration.exportFileSuccess')}
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
        <button
          className="settings-action-btn"
          onClick={handleLoadFileClick}
          title={t('settings.configuration.importFileTitle')}
        >
          {t('settings.configuration.importFileBtn')}
        </button>
        {fileImportStatus === 'success' && (
          <p className="settings-feedback settings-feedback--success">
            {fileImportMessage}
          </p>
        )}
        {fileImportStatus === 'error' && (
          <p className="settings-feedback settings-feedback--error">
            {fileImportMessage}
          </p>
        )}
      </div>

      {/* ── Reset ── */}
      <button
        className="settings-danger-btn"
        onClick={handleReset}
        title={t('settings.configuration.resetTitle')}
      >
        {t('settings.configuration.resetBtn')}
      </button>
    </div>
  );
}