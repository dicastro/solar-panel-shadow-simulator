import { Canvas } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
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
import { Scene } from './components/Scene';

export default function App() {
  const { t, i18n } = useTranslation();

  const site = useAppStore(s => s.site);
  const activeSetup = useAppStore(s => s.activeSetup);
  const sun = useAppStore(s => s.sun);
  const date = useAppStore(s => s.date);
  const isPlaying = useAppStore(s => s.isPlaying);
  const showPoints = useAppStore(s => s.showPoints);
  const renderDensity = useAppStore(s => s.renderDensity);
  const renderThreshold = useAppStore(s => s.renderThreshold);
  const setInstantProductionResult = useAppStore(s => s.setInstantProductionResult);
  const tickHour = useAppStore(s => s.tickHour);
  const loadConfig = useAppStore(s => s.loadConfig);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { dayjs.locale(i18n.language); }, [i18n.language]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config.json`)
      .then(res => res.json())
      .then(data => loadConfig(data));
  }, [loadConfig]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => tickHour(), 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, tickHour]);

  if (!site || !activeSetup || !sun) {
    return <div className="app-loading">{t('loading')}</div>;
  }

  const cameraDistance = site.boundingRadius * 4;
  const cameraHeight = site.boundingRadius * 3;

  return (
    <div className="app-container">
      <AngleWarningBanner />

      {/*
       * Single full-viewport canvas column. The results panel and render/
       * simulation controls are all fixed/absolute overlays on top of it.
       */}
      <div className="app-layout">
        <div className="app-layout__canvas-column">
          <RenderControls />
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

      {/* Results panel — fixed overlay, independent of the canvas column */}
      <SimulationResultsPanel />
    </div>
  );
}