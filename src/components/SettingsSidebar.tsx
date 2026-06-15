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

let persistedSidebarWidth = SIDEBAR_DEFAULT_WIDTH;

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
            {/* Configuration opens automatically on first launch */}
            <SidebarSection
              title={t('settings.configuration.sectionTitle')}
              defaultOpen={isFirstLaunch}
            >
              <ConfigurationSection />
            </SidebarSection>

            <SidebarSection title={t('settings.exportImport.sectionTitle')}>
              <ExportImportSection />
            </SidebarSection>

            <SidebarSection title={t('settings.cache.sectionTitle')}>
              <SimulationCacheSection />
              <IrradianceCacheSection />
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