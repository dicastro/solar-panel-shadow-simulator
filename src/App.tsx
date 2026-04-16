import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Sphere, Text } from '@react-three/drei'
import { useState, useEffect, useRef, useMemo } from 'react'
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
import { calculateSunState } from './solarEngine';
import { Config, SunState } from './types'
import { PointWithShadow } from './components/PointWithShadow'

dayjs.extend(utc);
dayjs.extend(timezone);

const CURRENT_YEAR = dayjs().year();
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

function Sun({ config, date }: { config: Config, date: Date }) {
  // get sun position
  const sunPos = SunCalc.getPosition(date, config.geometry.latitude, config.geometry.longitude);

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
function SolarPanel({
  sun,
  width,
  height,
  zones,
  zonesDisposition,
  hasOptimizer,
  orientation,
  showPoints,
  density
}: any) {
  const shadedPointsMap = useRef<Map<string, boolean>>(new Map());

  const handlePointStatus = (pointId: string, isShaded: boolean) => {
    shadedPointsMap.current.set(pointId, isShaded);
    
    // TODO: Aquí es donde en el futuro llamaremos a una función 
    // que calcule la producción de este panel específico
    // basándose en el conteo de puntos en 'shadedPointsMap'
  };

  const gap = 0.01;
  
  const actualW = orientation === 'portrait' ? width : height;
  const actualH = orientation === 'portrait' ? height : width;

  const frameColor = hasOptimizer ? "#2ecc71" : "#121e36"; // Verde esmeralda si hay optimizador
  const emissiveColor = hasOptimizer ? "#0a2a16" : "#050a15";

  // Referencia para el Raycaster (instanciado una sola vez fuera para rendimiento)
  const raycaster = useRef(new THREE.Raycaster());

  return (
    <group>
      {/* frame and cristal */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[actualW, 0.03, actualH]} />
        <meshStandardMaterial 
          color={frameColor} 
          metalness={hasOptimizer ? 0.4 : 0.7}
          roughness={0.2} 
          emissive={emissiveColor}
        />
      </mesh>

      {/* diode zones */}
      {[...Array(zones)].map((_, zIdx) => {
        const isVert = zonesDisposition === 'vertical';
        const zWidth = isVert ? (actualW / zones) - gap : actualW - gap;
        const zHeight = isVert ? actualH - gap : (actualH / zones) - gap;
        
        const offset = (zIdx - (zones - 1) / 2) * (isVert ? actualW / zones : actualH / zones);
        const posX = isVert ? offset : 0;
        const posZ = isVert ? 0 : offset;

        return (
          <group key={zIdx}>
            <mesh position={[posX, 0.016, posZ]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[zWidth, zHeight]} />
              <meshStandardMaterial color="#1a3a6d" transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>

            {/* points per zone */}
            {showPoints && [...Array(density)].map((_, row) => 
              [...Array(density)].map((_, col) => {
                const pId = `${zIdx}-${row}-${col}`;

                const ratioCol = density > 1 ? col / (density - 1) - 0.5 : 0;
                const ratioRow = density > 1 ? row / (density - 1) - 0.5 : 0;
                
                const pX = posX + ratioCol * zWidth;
                const pZ = posZ + ratioRow * zHeight;
                
                return (
                  <PointWithShadow 
                    key={pId}
                    position={[pX, 0.02, pZ]}
                    sun={sun}
                    raycaster={raycaster.current}
                    onStatusChange={(isShaded: boolean) => handlePointStatus(pId, isShaded)}
                  />
                );
              })
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Solar Array Component
 * Manages the layout of multiple panels and handles the tilt/elevation math.
 */
function SolarArray({ sun, array, arrayIndex, defaults, settings, centerX, centerZ, showPoints, density }: any) {
  const { rows, columns, inclination, azimut, elevation, position } = array;
  
  const orientation = array.orientation ?? 'portrait';
  const spacing = array.spacing ?? [0.02, 0.02]; // [X, Z] default
  
  // Dimensiones base según orientación
  const baseW = array.width ?? defaults.width;
  const baseH = array.height ?? defaults.height;
  const pWidth = orientation === 'portrait' ? baseW : baseH;
  const pHeight = orientation === 'portrait' ? baseH : baseW;

  const radInc = (inclination * Math.PI) / 180;
  const radAzi = (azimut * Math.PI) / 180;

  // Tamaño total incluyendo los huecos (spacing)
  const totalArrayWidth = (columns * pWidth) + ((columns - 1) * spacing[0]);
  const totalArrayHeight = (rows * pHeight) + ((rows - 1) * spacing[1]);

  const yOffset = (Math.sin(radInc) * totalArrayHeight) / 2;
  const zVisualContraction = (Math.cos(radInc) * totalArrayHeight) / 2;

  return (
    <group 
      position={[
        (position[0] - centerX) + totalArrayWidth / 2,
        elevation + yOffset,
        (position[1] - centerZ) - zVisualContraction
      ]}
      rotation={[radInc, -radAzi, 0]}
    >
      {[...Array(rows)].map((_, r) => 
        [...Array(columns)].map((_, c) => {
          const hasOptimizer = settings?.find((s: any) => 
            s.array === arrayIndex && s.panel[0] === r && s.panel[1] === c
          )?.hasOptimizer ?? (array.hasOptimizer ?? defaults.hasOptimizer);

          // Posicionamiento local considerando el spacing
          const x = (c - (columns - 1) / 2) * (pWidth + spacing[0]);
          const z = (r - (rows - 1) / 2) * (pHeight + spacing[1]);

          return (
            <group key={`${r}-${c}`} position={[x, 0, z]}>
              <SolarPanel
                sun={sun}
                width={baseW} 
                height={baseH} 
                zones={array.zones ?? defaults.zones} 
                zonesDisposition={array.zonesDisposition ?? defaults.zonesDisposition}
                hasOptimizer={hasOptimizer}
                orientation={orientation}
                showPoints={showPoints}
                density={density}
              />
            </group>
          );
        })
      )}
    </group>
  );
}

function Scene({ config, sun, date, showPoints, density }: { config: Config; sun: SunState | null; date: Date, showPoints: boolean, density: number }) {
  const { points, wallDefaults, railingDefaults, segmentsSettings } = config.geometry;
  const { panelDefaults, arrays, arraysSettings } = config.panels;
  const wallThickness = wallDefaults.thickness;

  const centerX = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const centerZ = points.reduce((sum, p) => sum + p[1], 0) / points.length;

  const getSegmentConfig = (index: number) => 
    segmentsSettings?.find((s: any) => s.segment === index);

  const getNextPoint = (points: [number, number][], currentPos: number) =>
    points[(currentPos + 1) % points.length];

  const floorShape = new THREE.Shape();
  
  points.forEach((p, i) => {
    const x = p[0] - centerX;
    const z = p[1] - centerZ;

    if (i === 0) {
      floorShape.moveTo(x, z);
    } else {
      floorShape.lineTo(x, z);
    }
  });
  
  floorShape.closePath();

  return (
    <>
      <OrbitControls zoomSpeed={0.2} minDistance={2} maxDistance={ORBIT_MAX_DISTANCE} />
      <Grid infiniteGrid fadeDistance={50} cellColor="#444" sectionColor="#666" />
      <Compass />
      <Sun config={config} date={date} />

      {/* floor */}
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <extrudeGeometry args={[
          floorShape, 
          { depth: 0.02, bevelEnabled: false }
        ]} />
        <meshStandardMaterial color="#b45d16" side={THREE.DoubleSide} />
      </mesh>

      {/* wall intersections */}
      {points.map((p, i) => {
        const pX = p[0] - centerX;
        const pZ = p[1] - centerZ;

        const prevP = points[(i - 1 + points.length) % points.length];
        const nextP = getNextPoint(points, i);

        // normalize segment
        const getNormal = (pA: [number, number], pB: [number, number]) => {
          const dx = pB[0] - pA[0];
          const dz = pB[1] - pA[1];
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          return { nx: -dz / d, nz: dx / d };
        };

        const nPrev = getNormal(prevP, p);
        const nNext = getNormal(p, nextP);

        // determine if the point is part of a line or a corner
        // use dot product to see if they are parallel (dot product ≈ 1)
        const dot = nPrev.nx * nNext.nx + nPrev.nz * nNext.nz;
        const isStraight = dot > 0.999; 

        let offX, offZ;

        if (isStraight) {
          // case: point in the middle of line. Only offset in the common normal
          offX = nNext.nx * (wallThickness / 2);
          offZ = nNext.nz * (wallThickness / 2);
        } else {
          // case: corner. Sum both normal
          offX = (nPrev.nx + nNext.nx) * (wallThickness / 2);
          offZ = (nPrev.nz + nNext.nz) * (wallThickness / 2);
        }

        // limitation: only 90 degrees corners are supported

        const segmentConfig = getSegmentConfig(i);
        const h = segmentConfig?.height ?? wallDefaults.height;

        return (
          <mesh key={`post-${i}`} position={[pX + offX, h / 2, pZ + offZ]} castShadow>
            <boxGeometry args={[wallThickness, h, wallThickness]} />
            <meshStandardMaterial color="#777" />
          </mesh>
        );
      })}

      {/* walls (with trim) and offset */}
      {points.map((p, i) => {
        const p1 = [p[0] - centerX, p[1] - centerZ];
        const nextP = getNextPoint(points, i);
        const p2 = [nextP[0] - centerX, nextP[1] - centerZ];
        const dx = p2[0] - p1[0];
        const dz = p2[1] - p1[1];
        const fullDist = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);

        const segmentConfig = getSegmentConfig(i);
        const wallHeight = segmentConfig?.height ?? wallDefaults.height;
        const trimStart = segmentConfig?.trimStart ?? 0;
        const trimEnd = segmentConfig?.trimEnd ?? 0;

        const currentDist = fullDist - (trimStart * wallThickness) - (trimEnd * wallThickness);
        const offsetFromCenter = (trimStart * wallThickness / 2) - (trimEnd * wallThickness / 2);
        
        const ux = dx / fullDist;
        const uz = dz / fullDist;
        const nx = -uz;
        const nz = ux;

        const posX = (p1[0] + p2[0]) / 2 + (nx * wallThickness / 2) + (ux * offsetFromCenter);
        const posZ = (p1[1] + p2[1]) / 2 + (nz * wallThickness / 2) + (uz * offsetFromCenter);

        const railingActive = segmentConfig?.railing?.active ?? railingDefaults.active;
        const railingHeight = segmentConfig?.railing?.heightOffset ?? railingDefaults.heightOffset;
        const railingThickness = segmentConfig?.railing?.thickness ?? railingDefaults.thickness;
        const railingShape = segmentConfig?.railing?.shape ?? railingDefaults.shape;

        return (
          <group key={`wall-${i}`} position={[posX, 0, posZ]} rotation-y={angle}>
            <mesh position={[0, wallHeight / 2, 0]} castShadow>
              <boxGeometry args={[wallThickness, wallHeight, currentDist]} />
              <meshStandardMaterial color="#777" />
            </mesh>
            
            {/* railing adjusted to the trimmed wall */}
            {railingActive && (
              <mesh 
                position={[0, wallHeight + railingHeight, 0]} 
                rotation={railingShape === 'round' ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
                castShadow
              >
                {railingShape === 'round'
                  ? <cylinderGeometry args={[railingThickness, railingThickness, currentDist, 8]} />
                  : <boxGeometry args={[railingThickness, railingThickness, currentDist]} />
                }
                <meshStandardMaterial color="#333" />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Solar Arrays */}
      {arrays.map((array, index) => (
        <SolarArray
          sun={sun}
          key={`array-${index}`}
          array={array}
          arrayIndex={index}
          defaults={panelDefaults}
          settings={arraysSettings}
          centerX={centerX}
          centerZ={centerZ}
          showPoints={showPoints}
          density={density}
        />
      ))}
    </>
  );
}

function MainControls({ date, setDate, isPlaying, setIsPlaying, adjustDate, config }: any) {
  const { t, i18n } = useTranslation();
  const displayDate = config ? date.tz(config.geometry.timezone) : date;

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

function SimulationControls({ 
  onRun, onStop, isRunning, progress, 
  showPoints, setShowPoints, density, setDensity,
  threshold, setThreshold, config
}: any) {
  const [interval, setIntervalMins] = useState(60);

  const maxPointsPerZone = density * density;

  // points in scene
  const totalPanels = config.panels.arrays.reduce((acc: number, arr: any) => acc + (arr.rows * arr.columns), 0);
  const zonesPerPanel = config.panels.panelDefaults.zones;
  const pointsPerZone = density * density;
  const pointsInScene = totalPanels * zonesPerPanel * pointsPerZone;

  // time steps
  const timeSteps = Math.floor((365 * 24 * 60) / interval);

  // total calculation operations
  const totalRays = timeSteps * pointsInScene;

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
        {isRunning && <progress value={progress} max={100} style={{ width: '100%' }} />}
      </div>

      <div className="instant-results" style={{ marginTop: '10px', borderTop: '1px solid #444', paddingTop: '10px' }}>
         <p>Producción estimada instante: <span id="instant-prod">0.00</span> kW</p>
      </div>

      <div className="button-group">
        {!isRunning ? (
          <button className="play-btn" onClick={() => onRun({ interval, density })}>EJECUTAR CÁLCULO</button>
        ) : (
          <button className="pause-btn" onClick={onStop}>STOP</button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [config, setConfig] = useState<Config | null>(null);
  const [date, setDate] = useState(dayjs());
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // simulation status
  const [isRunning, setIsRunning] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [threshold, setThreshold] = useState(1);
  const [density, setDensity] = useState(4); // 4x4 por defecto

  const sun = useMemo(() => {
        if (!config) return null;
        return calculateSunState(date.toDate(), config.geometry.latitude, config.geometry.longitude);
  }, [date, config]);

  useEffect(() => {
    fetch('/config.json')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setDate(dayjs.tz(data.geometry.timezone).second(0))
      });
  }, []);

  useEffect(() => {
    dayjs.locale(i18n.language); }, [i18n.language]
  );

  // Play/Loop Logic
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setDate(prev => {
          let next = prev.add(1, 'hour');
          if (next.year() > CURRENT_YEAR) return next.year(CURRENT_YEAR).month(0).date(1);
          return next;
        });
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying]);

  const adjustDate = (amount: number, unit: dayjs.ManipulateType) => {
    setIsPlaying(false);
    setDate(prev => {
      let next = prev.add(amount, unit);
      if (next.year() > CURRENT_YEAR) return next.year(CURRENT_YEAR).month(0).date(1);
      if (next.year() < CURRENT_YEAR) return next.year(CURRENT_YEAR).month(11).date(31);
      return next;
    });
  };

  const handleRunSimulation = (params: any) => {
    console.log("Iniciando cálculo con:", params);
    setIsRunning(true);
    // Aquí irá la lógica de Raycasting
  };

  const handleStopSimulation = () => {
    setIsRunning(false);
  };

  if (!config) return <div style={{ color: 'white', padding: 20 }}>{t('loading')}</div>;

  return (
    <div className="main-container" style={{ width: '100vw', height: '100vh', background: '#050505', position: 'relative' }}>
      <MainControls 
        date={date}
        setDate={setDate}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying} 
        adjustDate={adjustDate}
        config={config} 
      />

      <SimulationControls 
        isRunning={isRunning} 
        progress={progress} 
        onRun={handleRunSimulation} 
        onStop={handleStopSimulation}
        showPoints={showPoints}
        setShowPoints={setShowPoints}
        density={density}
        setDensity={setDensity}
        threshold={threshold}
        setThreshold={setThreshold}
        config={config}
      />

      {/* Three.js Canvas */}
      <Canvas shadows camera={{ position: [0, ORBIT_MAX_DISTANCE, 70], fov: 40 }}>
        <Scene config={config} sun={sun} date={date.toDate()} showPoints={showPoints} density={density} />
      </Canvas>
    </div>
  )
}
