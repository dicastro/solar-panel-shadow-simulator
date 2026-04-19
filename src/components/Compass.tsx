import { Text } from '@react-three/drei';
import { useTranslation } from 'react-i18next';

/**
 * Cardinal direction labels rendered in 3D space.
 * North is -Z in Three.js (standard convention used throughout this project).
 */
export function Compass() {
  const { t } = useTranslation();
  const size = 12;

  return (
    <group position={[0, 0.05, 0]}>
      <Text position={[0, 0, -size]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.2} color="#ff4444">
        {t('coordinates.north')}
      </Text>
      <Text position={[0, 0, size]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.2} color="white">
        {t('coordinates.south')}
      </Text>
      <Text position={[size, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.2} color="white">
        {t('coordinates.east')}
      </Text>
      <Text position={[-size, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={1.2} color="white">
        {t('coordinates.west')}
      </Text>
    </group>
  );
}