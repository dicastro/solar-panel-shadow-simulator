import SunCalc from 'suncalc';
import * as THREE from 'three';
import { SunState } from './types';

export const calculateSunState = (date: Date, lat: number, lon: number): SunState => {
    const sunPos = SunCalc.getPosition(date, lat, lon);
    const isDaylight = sunPos.altitude > 0;
    
    const direction = new THREE.Vector3(
        Math.cos(sunPos.altitude) * Math.sin(-sunPos.azimuth),
        Math.sin(sunPos.altitude),
        Math.cos(sunPos.altitude) * Math.cos(sunPos.azimuth)
    ).normalize();

    return {
        altitude: sunPos.altitude,
        azimuth: sunPos.azimuth,
        isDaylight,
        direction
    };
};

/**
 * Calculates panel efficiency based uniquely in sun angle
 */
export const calculateIncidenceFactor = (sunDir: THREE.Vector3, panelNormal: THREE.Vector3): number => {
    const dot = panelNormal.dot(sunDir);
    return Math.max(0, dot); // if it is negative, the sun is behind the panel
};

/**
 * Calcula la potencia de un panel basándose en sus zonas sombreadas
 * @param basePower Potencia pico ajustada por el factor de incidencia (W)
 * @param shadedZones Array de booleanos (true = zona sombreada)
 * @param hasOptimizer Si el panel tiene optimizador independiente
 */
export const calculatePanelOutput = (
    basePower: number, 
    shadedZones: boolean[], 
    hasOptimizer: boolean
): number => {
    const zonesCount = shadedZones.length;
    const shadedCount = shadedZones.filter(z => z).length;

    if (shadedCount === 0) return basePower;
    if (shadedCount === zonesCount) return 0;

    if (hasOptimizer) {
        // ESCENARIO A: Con Optimizador
        // La pérdida es puramente proporcional. 
        // Si tienes 3 zonas y falla 1, produces exactamente el 66.6%.
        const efficiency = (zonesCount - shadedCount) / zonesCount;
        return basePower * efficiency;
    } else {
        // ESCENARIO B: Sin Optimizador (Diodos de Bypass tradicionales)
        // En muchos paneles reales, si una zona entra en sombra, el diodo 
        // "salta" y la producción de esa zona cae a 0, pero además suele haber 
        // una pequeña penalización por desajuste de voltaje (mismatch).
        // Para nuestra simulación, aplicaremos una penalización extra del 10% 
        // sobre la capacidad restante por no tener optimización activa.
        
        const efficiency = (zonesCount - shadedCount) / zonesCount;
        const mismatchLoss = 0.9; // Penalización del 10% por falta de optimizador
        return basePower * efficiency * mismatchLoss;
    }
};