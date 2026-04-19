import { Sphere } from '@react-three/drei';
import SunCalc from 'suncalc';
import { useAppStore } from '../store/useAppStore';

interface SunProps {
  date: Date;
}

/**
 * Renders a sphere at the sun's current position and attaches a directional
 * light to it so shadows track the sun in real time.
 *
 * Coordinate mapping:
 *   SunCalc returns altitude (elevation above horizon) and azimuth (measured
 *   clockwise from South in radians).  We convert to Three.js cartesian:
 *     x =  cos(alt) * sin(-az)   → East/West
 *     y =  sin(alt)              → Up
 *     z =  cos(alt) * cos(az)    → North/South  (South = +Z in Three.js)
 */
export function Sun({ date }: SunProps) {
  const site = useAppStore(s => s.site);
  if (!site) return null;

  const sunPos = SunCalc.getPosition(date, site.location.latitude, site.location.longitude);
  const distance = 30;

  const x = distance * Math.cos(sunPos.altitude) * Math.sin(-sunPos.azimuth);
  const y = distance * Math.sin(sunPos.altitude);
  const z = distance * Math.cos(sunPos.altitude) * Math.cos(sunPos.azimuth);

  const isDaylight = y > 0;

  return (
    <group>
      <Sphere args={[0.8, 32, 32]} position={[x, y, z]}>
        <meshBasicMaterial color={isDaylight ? '#ffdd00' : '#111'} />
      </Sphere>

      {isDaylight && (
        <directionalLight
          position={[x, y, z]}
          intensity={2.5}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-bias={0.0001}
        >
          <orthographicCamera attach="shadow-camera" args={[-30, 30, 30, -30, 0.1, 200]} />
        </directionalLight>
      )}
    </group>
  );
}