import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import 'dayjs/locale/en';
import { useTranslation } from 'react-i18next';

import './i18n';
import './styles/index.css';
import { useAppStore } from './store/AppStore';
import { RenderControls } from './components/RenderControls';
import { SimulationControls } from './components/SimulationControls';
import { DeveloperFooter } from './components/DeveloperFooter';
import { AngleWarningBanner } from './components/AngleWarningBanner';
import { SimulationResultsPanel } from './components/SimulationResultsPanel';
import { SettingsSidebar } from './components/SettingsSidebar';
import { SettingsSidebarButton } from './components/SettingsSidebarButton';
import { Scene } from './components/Scene';
import { checkOpfsAvailability, ConfigStorage } from './utils/ConfigStorage';
import { DEFAULT_CONFIG } from './config/defaultConfig';

/**
 * Full-screen loading overlay shown during initialisation and before page
 * reloads (e.g. after a config reset). Covers all content and prevents
 * interaction while the app is not yet ready.
 */
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="loading-overlay">
      <div className="loading-overlay__box">
        <div className="loading-overlay__spinner" />
        <p className="loading-overlay__message">{message}</p>
      </div>
    </div>
  );
}

/**
 * Blocking error screen shown when OPFS is not available in the user's browser.
 * The application cannot persist configuration without OPFS, so this is a hard
 * requirement rather than a graceful degradation.
 */
function OpfsUnavailableScreen() {
  const { t } = useTranslation();
  return (
    <div className="opfs-error-screen">
      <div className="opfs-error-screen__box">
        <h1 className="opfs-error-screen__title">{t('opfsError.title')}</h1>
        <p className="opfs-error-screen__message">{t('opfsError.message')}</p>
        <table className="opfs-error-screen__table">
          <thead>
            <tr>
              <th>{t('opfsError.browser')}</th>
              <th>{t('opfsError.minVersion')}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Chrome / Edge</td><td>86</td></tr>
            <tr><td>Firefox</td><td>111</td></tr>
            <tr><td>Safari</td><td>15.2</td></tr>
            <tr><td>Chrome Android</td><td>86</td></tr>
            <tr><td>Safari iOS</td><td>15.2</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

type AppInitState = 'checking' | 'opfs-unavailable' | 'ready';

export default function App() {
  const { t, i18n } = useTranslation();

  const [initState, setInitState] = useState<AppInitState>('checking');
  /**
   * When true, a full-screen loading overlay is shown over the ready app.
   * Used to cover the UI during window.location.reload() calls so the user
   * sees feedback immediately rather than a moment of unresponsive UI.
   */
  const [isReloading, setIsReloading] = useState(false);

  const site = useAppStore(s => s.site);
  const activeSetup = useAppStore(s => s.activeSetup);
  const sun = useAppStore(s => s.sun);
  const date = useAppStore(s => s.date);
  const isPlaying = useAppStore(s => s.isPlaying);
  const showPoints = useAppStore(s => s.showPoints);
  const renderDensity = useAppStore(s => s.renderDensity);
  const renderThreshold = useAppStore(s => s.renderThreshold);
  const isSidebarOpen = useAppStore(s => s.isSidebarOpen);
  const setInstantProductionResult = useAppStore(s => s.setInstantProductionResult);
  const tickHour = useAppStore(s => s.tickHour);
  const loadConfig = useAppStore(s => s.loadConfig);
  const openSidebar = useAppStore(s => s.openSidebar);
  const setIsFirstLaunch = useAppStore(s => s.setIsFirstLaunch);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { dayjs.locale(i18n.language); }, [i18n.language]);

  useEffect(() => {
    const init = async () => {
      const opfsOk = await checkOpfsAvailability();
      if (!opfsOk) {
        setInitState('opfs-unavailable');
        return;
      }

      const saved = await ConfigStorage.load();
      if (saved) {
        loadConfig(saved);
      } else {
        // First launch: apply the built-in default, persist it, and open the
        // settings sidebar so the user is guided to configure their installation.
        await ConfigStorage.save(DEFAULT_CONFIG);
        loadConfig(DEFAULT_CONFIG);
        setIsFirstLaunch(true);
        openSidebar();
      }

      setInitState('ready');
    };

    init();
    // loadConfig, openSidebar and setIsFirstLaunch are stable store actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => tickHour(), 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, tickHour]);

  // The sidebar signals a page reload is needed (e.g. config reset) by emitting
  // this custom event. The app shows the loading overlay before the reload fires
  // so the user sees immediate feedback.
  useEffect(() => {
    const handler = () => {
      setIsReloading(true);
      // Small delay so React can paint the overlay before the reload triggers.
      setTimeout(() => window.location.reload(), 80);
    };
    window.addEventListener('app:reload', handler);
    return () => window.removeEventListener('app:reload', handler);
  }, []);

  if (initState === 'checking') {
    return <LoadingOverlay message={t('loading')} />;
  }

  if (initState === 'opfs-unavailable') {
    return <OpfsUnavailableScreen />;
  }

  if (!site || !activeSetup || !sun) {
    return <LoadingOverlay message={t('loading')} />;
  }

  const cameraDistance = site.boundingRadius * 4;
  const cameraHeight = site.boundingRadius * 3;

  return (
    <div className="app-container">
      {isReloading && <LoadingOverlay message={t('loading')} />}

      <AngleWarningBanner />

      {isSidebarOpen && <SettingsSidebar />}

      <div className="app-layout">
        <div className="app-layout__canvas-column">
          {!isSidebarOpen && <SettingsSidebarButton />}

          <RenderControls offsetTop={isSidebarOpen ? false : true} />
          <SimulationControls />
          <DeveloperFooter />

          <Canvas shadows camera={{ position: [0, cameraHeight, cameraDistance], fov: 40 }}>
            <Scene
              site={site}
              activeSetup={activeSetup}
              sun={sun}
              date={date.toDate()}
              showPoints={showPoints}
              renderDensity={renderDensity}
              renderThreshold={renderThreshold}
              onProductionUpdate={setInstantProductionResult}
            />
          </Canvas>
        </div>
      </div>

      <SimulationResultsPanel />
    </div>
  );
}