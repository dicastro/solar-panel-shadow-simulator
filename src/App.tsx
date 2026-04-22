import { Canvas } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import 'dayjs/locale/en';
import { useTranslation } from 'react-i18next';

import './i18n';
import './App.css';
import { useAppStore } from './store/useAppStore';
import { MainControls } from './components/MainControls';
import { SimulationControls } from './components/SimulationControls';
import { DeveloperFooter } from './components/DeveloperFooter';
import { AngleWarningBanner } from './components/AngleWarningBanner';
import { Scene } from './components/Scene';

export default function App() {
  const { t, i18n } = useTranslation();

  const site = useAppStore(s => s.site);
  const activeSetup = useAppStore(s => s.activeSetup);
  const sun = useAppStore(s => s.sun);
  const date = useAppStore(s => s.date);
  const isPlaying = useAppStore(s => s.isPlaying);
  const showPoints = useAppStore(s => s.showPoints);
  const density = useAppStore(s => s.density);
  const threshold = useAppStore(s => s.threshold);
  const setSimulationResult = useAppStore(s => s.setSimulationResult);
  const tickHour = useAppStore(s => s.tickHour);
  const loadConfig = useAppStore(s => s.loadConfig);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep dayjs locale in sync with i18next
  useEffect(() => { dayjs.locale(i18n.language); }, [i18n.language]);

  // Load configuration on mount
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config.json`)
      .then(res => res.json())
      .then(data => loadConfig(data));
  }, [loadConfig]);

  // Advance time by 1 hour every 100 ms while playing
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => tickHour(), 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, tickHour]);

  if (!site || !activeSetup || !sun) {
    return <div style={{ color: 'white', padding: 20 }}>{t('loading')}</div>;
  }

  const cameraDistance = site.boundingRadius * 4;
  const cameraHeight = site.boundingRadius * 3;

  return (
    <div
      className="main-container"
      style={{ width: '100vw', height: '100vh', background: '#050505', position: 'relative' }}
    >
      <MainControls />
      <SimulationControls />
      <DeveloperFooter />
      <AngleWarningBanner />

      <Canvas shadows camera={{ position: [0, cameraHeight, cameraDistance], fov: 40 }}>
        <Scene
          site={site}
          activeSetup={activeSetup}
          sun={sun}
          date={date.toDate()}
          showPoints={showPoints}
          density={density}
          threshold={threshold}
          onProductionUpdate={setSimulationResult}
        />
      </Canvas>
    </div>
  );
}