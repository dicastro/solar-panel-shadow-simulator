import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/AppStore';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { SimulationCacheSection } from './settings/SimulationCacheSection';
import { IrradianceCacheSection } from './settings/IrradianceCacheSection';
import { ExportImportSection } from './settings/ExportImportSection';
import { ConfigurationSection } from './settings/ConfigurationSection';

const SIDEBAR_DEFAULT_WIDTH = 440;
const SIDEBAR_MIN_WIDTH = 300;

/**
 * Persists the sidebar width across open/close cycles within the same browser
 * session. The sidebar component unmounts when closed, so React state alone
 * cannot preserve the value.
 */
let persistedSidebarWidth = SIDEBAR_DEFAULT_WIDTH;

/**
 * Collapsible section within the settings sidebar.
 */
export function SidebarSection({
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
 * Full-height settings sidebar rendered as a fixed overlay on the left edge
 * of the viewport. The sidebar width is user-resizable by dragging the right
 * edge handle. Contains three collapsible sections: cache management,
 * backup export/import, and configuration editing.
 */
export function SettingsSidebar() {
  const { t } = useTranslation();
  const closeSidebar = useAppStore(s => s.closeSidebar);
  const isFirstLaunch = useAppStore(s => s.isFirstLaunch);

  const { width, isDragging, dragHandleProps } = useResizablePanel({
    defaultWidth: persistedSidebarWidth,
    minWidth: SIDEBAR_MIN_WIDTH,
    dragDirection: 'right',
  });

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
            <SidebarSection title={t('settings.cache.sectionTitle')}>
              <SimulationCacheSection />
              <IrradianceCacheSection />
            </SidebarSection>

            <SidebarSection title={t('settings.exportImport.sectionTitle')}>
              <ExportImportSection />
            </SidebarSection>

            {/* Configuration section opens automatically on first launch
                so the user is guided to edit their installation details. */}
            <SidebarSection
              title={t('settings.configuration.sectionTitle')}
              defaultOpen={isFirstLaunch}
            >
              <ConfigurationSection />
            </SidebarSection>
          </div>
        </div>

        <div
          className={`settings-sidebar__drag-handle${isDragging ? ' settings-sidebar__drag-handle--dragging' : ''}`}
          {...dragHandleProps}
          title={t('resultsPanel.dragHint')}
        />
      </div>
    </>
  );
}