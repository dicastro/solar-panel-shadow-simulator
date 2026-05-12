import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/AppStore';

/**
 * Gear icon button fixed to the top-left of the screen, above the control panels.
 * Clicking it opens the settings sidebar. Only rendered when the sidebar is closed.
 */
export function SettingsSidebarButton() {
  const { t } = useTranslation();
  const openSidebar = useAppStore(s => s.openSidebar);

  return (
    <button
      className="settings-gear-btn"
      onClick={openSidebar}
      title={t('settings.openTitle')}
      aria-label={t('settings.openTitle')}
    >
      ⚙
    </button>
  );
}