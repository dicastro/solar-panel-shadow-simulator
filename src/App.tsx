import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Sphere, Text } from '@react-three/drei'
import { useEffect, useRef, useMemo } from 'react'
import SunCalc from 'suncalc'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import 'dayjs/locale/es';
import 'dayjs/locale/en';
import { useTranslation } from 'react-i18next'
import * as THREE from 'three';

import './i18n'
import './App.css'
import { PointWithShadow } from './components/PointWithShadow'
import { useAppStore } from './store/useAppStore'
import {
  Config,
  Site,
  PanelSetup,
  SunState,
  ZonesDisposition,
  PanelRenderData,
  SamplePoint
} from './types'

dayjs.extend(utc);
dayjs.extend(timezone);

const ORBIT_MAX_DISTANCE = 80;

function Compass() {
  const { t } = useTranslation();
  const size = 12;

  return (
    <group position={[0, 0.05, 0]}>
      {/* North is -Z */}
      <Text position={[0, 0, -size]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.2} color="#ff4444">
        {t('coordinates.north')}
      </Text>
      {/* South is +Z */}
      <Text position={[0, 0, size]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.2} color="white">
        {t('coordinates.south')}
      </Text>
      {/* East is +X */}
      <Text position={[size, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.2} color="white">
        {t('coordinates.east')}
      </Text>
      {/* West is -X */}
      <Text position={[-size, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.2} color="white">
        {t('coordinates.west')}
      </Text>
    </group>
  );
}

function Sun({ date }: { date: Date }) {
  const site = useAppStore(s => s.site);
  if (!site) return null;

  // get sun position
  const sunPos = SunCalc.getPosition(date, site.location.latitude, site.location.longitude);

  // conver spherical coordinates (returned by SunCalc) to cartesian coordinates (required by Three.js)
  // In Three.js: Y is UP, X es EAST/WEST, Z es NORTH/SOUTH
  // Azimut is adjusted by adding PI because SunCalc meassures from South
  const distance = 30; // Visual distance of the sun in the scene
  const x = distance * Math.cos(sunPos.altitude) * Math.sin(-sunPos.azimuth);
  const y = distance * Math.sin(sunPos.altitude);
  const z = distance * Math.cos(sunPos.altitude) * Math.cos(sunPos.azimuth);

  const isDaylight = y > 0;

  return (
    <group>
      {/* Sphere representing the sun */}
      <Sphere args={[0.8, 32, 32]} position={[x, y, z]}>
        <meshBasicMaterial color={isDaylight ? "#ffdd00" : "#111"} />
      </Sphere>

      {isDaylight && (/* Directional light that generates shadows */
        <directionalLight
          position={[x, y, z]}
          intensity={2.5}
          castShadow
          shadow-mapSize={[4096, 4096]} // Shadow resolution
          shadow-bias={0.0001}
        >
          {/* Adjust the area that captures the shadow in order to cover the geometry */}
          <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30, 0.1, 200]} />
        </directionalLight>
      )}
    </group>
  );
}

/**
 * Individual Solar Panel Component
 * Represents the glass surface and diode zones.
 */
function SolarPanelComponent({ sun, zones, zonesDisposition, hasOptimizer, showPoints, density, renderData, samplePoints }: {
  sun: SunState,
  zones: number,
  zonesDisposition: ZonesDisposition,
  hasOptimizer: boolean,
  showPoints: boolean,
  density: number,
  renderData: PanelRenderData,
  samplePoints: readonly SamplePoint[]
}) {
  const shadedPointsMap = useRef<Map<string, boolean>>(new Map());
  const raycaster = useRef(new THREE.Raycaster());
  const gap = 0.01;
  const { actualWidth, actualHeight, frameColor, emissiveColor } = renderData;

  const handlePointStatus = (pointId: string, isShaded: boolean) => {
    shadedPointsMap.current.set(pointId, isShaded);
  };

  return (
    <group>
      {/* frame and cristal */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[actualWidth, 0.03, actualHeight]} />
        <meshStandardMaterial color={frameColor} metalness={hasOptimizer ? 0.4 : 0.7} roughness={0.2} emissive={emissiveColor} />
      </mesh>

      {/* diode zones */}
      {[...Array(zones)].map((_, zoneIndex) => {
        const isVert = zonesDisposition === 'vertical';
        const zWidth = isVert ? (actualWidth / zones) - gap : actualWidth - gap;
        const zHeight = isVert ? actualHeight - gap : (actualHeight / zones) - gap;
        
        const offset = (zoneIndex - (zones - 1) / 2) * (isVert ? actualWidth / zones : actualHeight / zones);
        const posX = isVert ? offset : 0;
        const posZ = isVert ? 0 : offset;

        const zonePoints = showPoints
          ? samplePoints.filter((sp: SamplePoint) => sp.zoneIndex === zoneIndex)
          : [];

        return (
          <group key={zoneIndex}>
            <mesh position={[posX, 0.016, posZ]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[zWidth, zHeight]} />
              <meshStandardMaterial color="#1a3a6d" transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>

            {/* points per zone */}
            {zonePoints.map((sp: SamplePoint) => (
              <PointWithShadow
                key={sp.id}
                position={[sp.localPosition.x, sp.localPosition.y, sp.localPosition.z]}
                sun={sun}
                raycaster={raycaster.current}
                onStatusChange={(isShaded: boolean) => handlePointStatus(sp.id, isShaded)}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

function Scene({ site, activeSetup, sun, date, showPoints, density }: {
  site: Site,
  activeSetup: PanelSetup,
  sun: SunState,
  date: Date,
  showPoints: boolean,
  density: number
}) {
  const floorShape = useMemo(() => {
    const shape = new THREE.Shape();

    site.wallIntersections.forEach((wi, i) => {
      if (i === 0) {
        shape.moveTo(wi.position.x, wi.position.z);
      } else {
        shape.lineTo(wi.position.x, wi.position.z);
      }
    });
    
    return shape.closePath();
  }, [site.wallIntersections]);

  return (
    <>
      <OrbitControls zoomSpeed={0.2} minDistance={2} maxDistance={ORBIT_MAX_DISTANCE} />
      <Grid infiniteGrid fadeDistance={50} cellColor="#444" sectionColor="#666" />
      <Compass />
      <Sun date={date} />

      <group rotation-y={site.azimutRad}>
        {/* floor */}
        <mesh receiveShadow position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <extrudeGeometry args={[
            floorShape, 
            { depth: 0.02, bevelEnabled: false }
          ]} />
          <meshStandardMaterial color="#b45d16" side={THREE.DoubleSide} />
        </mesh>

        {/* wall intersections */}
        {site.wallIntersections.map((wi) => {
          return (
            <mesh key={`post-${wi.index}`} position={[wi.worldPosition.x, wi.worldPosition.y, wi.worldPosition.z]} castShadow>
              <boxGeometry args={wi.renderData.boxArgs} />
              <meshStandardMaterial color={wi.renderData.color} />
            </mesh>
          );
        })}

        {/* walls (with trim) and offset */}
        {site.walls.map((wall) => {
          return (
            <group key={`wall-${wall.index}`} position={[wall.worldPosition.x, wall.worldPosition.y, wall.worldPosition.z]} rotation-y={wall.worldRotation.y}>
              <mesh position={wall.renderData.meshLocalPosition} castShadow>
                <boxGeometry args={wall.renderData.boxArgs} />
                <meshStandardMaterial color={wall.renderData.color} />
              </mesh>
              
              {wall.railing && (
                <mesh position={wall.railing.renderData.localPosition} rotation={wall.railing.renderData.localRotation} castShadow>
                  {wall.railing.shape === 'round'
                    ? <cylinderGeometry args={wall.railing.renderData.boxArgs as [number, number, number, number]} />
                    : <boxGeometry args={wall.railing.renderData.boxArgs as [number, number, number]} />
                  }
                  <meshStandardMaterial color={wall.railing.renderData.color} />
                </mesh>
              )}
            </group>
          );
        })}
      </group>
      
      {/* Panels - outsite site group, use their own absolute azimut */}
      {activeSetup.panelArrays.map((panelArray) => 
        panelArray.panels.map((panel) => (
          <group
            key={panel.id}
            position={[panel.worldPosition.x, panel.worldPosition.y, panel.worldPosition.z]}
            rotation={[panel.worldRotation.x, panel.worldRotation.y, panel.worldRotation.z]}
          >
            <SolarPanelComponent
              sun={sun}
              zones={panel.zones}
              zonesDisposition={panel.zonesDisposition}
              hasOptimizer={panel.hasOptimizer}
              showPoints={showPoints}
              density={density}
              renderData={panel.renderData}
              samplePoints={panel.samplePoints}
            />
          </group>
        ))
      )}
    </>
  );
}

function MainControls() {
  const { t, i18n } = useTranslation();

  const date         = useAppStore(s => s.date);
  const isPlaying    = useAppStore(s => s.isPlaying);
  const config       = useAppStore(s => s.config);
  const setDate      = useAppStore(s => s.setDate);
  const setIsPlaying = useAppStore(s => s.setIsPlaying);
  const adjustDate   = useAppStore(s => s.adjustDate);

  const displayDate = config ? date.tz(config.site.timezone) : date;
  const CURRENT_YEAR = dayjs().year();

  return (
    <div className="controls-panel main-controls">
      <div className="control-row">
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{t('title')}</h2>
        <select value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
      </div>

      <div className="control-row">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.7rem' }}>{t('date_label')}</label>
          <input type="date" value={date.format('YYYY-MM-DD')} 
            min={`${CURRENT_YEAR}-01-01`} max={`${CURRENT_YEAR}-12-31`}
            onChange={(e) => setDate(dayjs(e.target.value).hour(date.hour()).minute(date.minute()).second(0))} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.7rem' }}>{t('time_label')}</label>
          <input type="time" value={date.format('HH:mm')} 
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number);
              setDate(date.hour(h).minute(m).second(0));
            }} />
        </div>
      </div>

      <div className="button-group">
        <button onClick={() => adjustDate(-1, 'month')}>-1M</button>
        <button onClick={() => adjustDate(-1, 'day')}>-1D</button>
        <button onClick={() => adjustDate(-1, 'hour')}>-1H</button>
        <button className={isPlaying ? 'pause-btn' : 'play-btn'} onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? '❙❙' : '▶'}
        </button>
        <button onClick={() => adjustDate(1, 'hour')}>+1H</button>
        <button onClick={() => adjustDate(1, 'day')}>+1D</button>
        <button onClick={() => adjustDate(1, 'month')}>+1M</button>
      </div>
      
      <div className="date-display">
        {displayDate.locale(i18n.language).format('DD MMM YYYY - HH:mm')}
      </div>
    </div>
  );
}

function SimulationControls() {
  const showPoints   = useAppStore(s => s.showPoints);
  const setShowPoints= useAppStore(s => s.setShowPoints);
  const density      = useAppStore(s => s.density);
  const setDensity   = useAppStore(s => s.setDensity);
  const threshold    = useAppStore(s => s.threshold);
  const setThreshold = useAppStore(s => s.setThreshold);
  const isRunning    = useAppStore(s => s.isRunning);
  const setIsRunning = useAppStore(s => s.setIsRunning);
  const config       = useAppStore(s => s.config);

  const [interval, setIntervalMins] = [60, (_: number) => {}];

  const maxPointsPerZone = density * density;

  // points in scene
  const totalPanels = config?.setups[0].arrays.reduce((acc, arr) => acc + (arr.rows * arr.columns), 0) ?? 0;
  const zonesPerPanel = config?.setups[0].panelDefaults.zones ?? 0;
  const pointsPerZone = density * density;
  
  // time steps
  const timeSteps = Math.floor((365 * 24 * 60) / interval);

  // total calculation operations
  const totalRays = timeSteps * totalPanels * zonesPerPanel * pointsPerZone;

  return (
    <div className="controls-panel simulation-panel" style={{ top: 'auto', bottom: '20px' }}>
      <h3>Simulación Anual</h3>
      
      <div className="control-row">
        <label>Intervalo:</label>
        <select value={interval} onChange={e => setIntervalMins(Number(e.target.value))} disabled={isRunning}>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>1 hora</option>
        </select>
      </div>

      <div className="control-row">
        <label>Puntos NxN por zona:</label>
        <input type="number" value={density} min={2} max={16} 
               onChange={e => setDensity(Number(e.target.value))} disabled={isRunning} />
      </div>

      <div className="control-row checkbox-row">
        <label>Visualizar puntos:</label>
        <input type="checkbox" checked={showPoints} onChange={e => setShowPoints(e.target.checked)} />
      </div>

      <div className="control-row">
        <label title="Número de puntos en sombra para anular una zona">
          Umbral sombra zona:
        </label>
        <input 
          type="number" 
          value={threshold} 
          min={1} 
          max={maxPointsPerZone} 
          onChange={e => setThreshold(Math.max(1, Math.min(maxPointsPerZone, Number(e.target.value))))}
          disabled={isRunning} 
        />
        <span style={{ fontSize: '0.7rem' }}>/ {maxPointsPerZone}</span>
      </div>

      <div className="status-info" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
        <p>Puntos por panel: {zonesPerPanel * pointsPerZone}</p>
        <p>Pasos de tiempo: {timeSteps.toLocaleString()}</p>
        <p><strong>Total rayos: {totalRays.toLocaleString()}</strong></p>
        {isRunning && <progress value={0} max={100} style={{ width: '100%' }} />}
      </div>

      <div className="instant-results" style={{ marginTop: '10px', borderTop: '1px solid #444', paddingTop: '10px' }}>
         <p>Producción estimada instante: <span id="instant-prod">0.00</span> kW</p>
      </div>

      <div className="button-group">
        {!isRunning
          ? <button className="play-btn" onClick={() => setIsRunning(true)}>EJECUTAR CÁLCULO</button>
          : <button className="pause-btn" onClick={() => setIsRunning(false)}>STOP</button>
        }
      </div>
    </div>
  );
}

export default function App() {
  const { t, i18n } = useTranslation();

  const site         = useAppStore(s => s.site);
  const activeSetup  = useAppStore(s => s.activeSetup);
  const sun          = useAppStore(s => s.sun);
  const date         = useAppStore(s => s.date);
  const isPlaying    = useAppStore(s => s.isPlaying);
  const showPoints   = useAppStore(s => s.showPoints);
  const density      = useAppStore(s => s.density);
  const tickHour     = useAppStore(s => s.tickHour);
  const loadConfig   = useAppStore(s => s.loadConfig);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { dayjs.locale(i18n.language); }, [i18n.language]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config.json`)
      .then(res => res.json())
      .then(data => loadConfig(data));
  }, []);

  // Play/Loop Logic
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => tickHour(), 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying]);

  if (!site || !activeSetup || !sun) return <div style={{ color: 'white', padding: 20 }}>{t('loading')}</div>;

  console.log('App render:', {site: !!site, activeSetup: !!activeSetup, sun: !!sun});

  return (
    <div className="main-container" style={{ width: '100vw', height: '100vh', background: '#050505', position: 'relative' }}>
      <MainControls />

      <SimulationControls />

      {/* Three.js Canvas */}
      <Canvas shadows camera={{ position: [0, ORBIT_MAX_DISTANCE, 70], fov: 40 }}>
        <Scene site={site} activeSetup={activeSetup} sun={sun} date={date.toDate()} showPoints={showPoints} density={density} />
      </Canvas>
    </div>
  )
}
