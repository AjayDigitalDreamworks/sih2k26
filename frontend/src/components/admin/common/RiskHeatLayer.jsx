import React, { useEffect, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

// Smooth gradient heatmaps from REAL district observations (rainfall mm / flood
// risk level). Rainfall = cool blues, flood = warm amber→red. The layer only
// renders districts with actual data — no fabricated intensity.
const RAIN_GRADIENT = {
  0.0: '#E0F2FE',
  0.35: '#38BDF8',
  0.6: '#2563EB',
  0.85: '#1E3A8A',
  1.0: '#172554',
};

const FLOOD_GRADIENT = {
  0.0: '#FEF3C7',
  0.4: '#F59E0B',
  0.65: '#EA580C',
  0.85: '#DC2626',
  1.0: '#7F1D1D',
};

/**
 * points: [{ lat, lng, intensity (0..1) }]
 * mode: 'rain' | 'flood' | null/off
 */
export const RiskHeatLayer = ({ points, mode, radius = 36, blur = 22 }) => {
  const map = useMap();

  const layer = useMemo(() => {
    if (!mode || !points || points.length === 0) return null;
    const l = L.heatLayer(
      points.map((p) => [p.lat, p.lng, Math.max(0, Math.min(1, p.intensity))]),
      {
        radius,
        blur,
        maxZoom: 9,
        max: 0.9,
        minOpacity: 0.35,
        gradient: mode === 'flood' ? FLOOD_GRADIENT : RAIN_GRADIENT,
      }
    );
    l.addTo(map);
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mode, points, radius, blur]);

  useEffect(() => {
    return () => {
      if (layer) layer.remove();
    };
  }, [layer]);

  return null;
};

export default RiskHeatLayer;