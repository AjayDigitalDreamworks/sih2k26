import React, { useState, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { Plus, Minus } from 'lucide-react';

/**
 * MapZoomControls — consistent zoom in/out buttons for every Leaflet map.
 * Renders inside the MapContainer (uses useMap). Position via `position`.
 * Also exposes the current zoom level (used by tests).
 */
const POSITIONS = {
  'top-right': { top: 10, right: 10 },
  'bottom-right': { bottom: 34, right: 10 },
  'top-left': { top: 10, left: 10 },
  'bottom-left': { bottom: 34, left: 10 },
};

export const MapZoomControls = ({ position = 'top-right', compact = false }) => {
  const map = useMap();
  const [zoom, setZoom] = useState(() => (map ? map.getZoom() : 7));

  useEffect(() => {
    if (!map) return undefined;
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [map]);

  const pos = POSITIONS[position] || POSITIONS['top-right'];
  const size = compact ? 30 : 34;

  return (
    <div
      data-testid="map-zoom-controls"
      data-zoom={zoom}
      style={{
        position: 'absolute', zIndex: 850, display: 'flex', flexDirection: 'column', gap: 6, ...pos,
      }}
    >
      <button
        type="button"
        title="Zoom In"
        aria-label="Zoom In"
        onClick={() => map?.zoomIn()}
        style={{
          width: size, height: size, borderRadius: 8, background: 'rgba(255,255,255,0.96)',
          border: '1px solid #E2E5E9', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#374151', cursor: 'pointer', fontSize: 16, lineHeight: 1,
        }}
      >
        <Plus size={compact ? 14 : 16} />
      </button>
      <button
        type="button"
        title="Zoom Out"
        aria-label="Zoom Out"
        onClick={() => map?.zoomOut()}
        style={{
          width: size, height: size, borderRadius: 8, background: 'rgba(255,255,255,0.96)',
          border: '1px solid #E2E5E9', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#374151', cursor: 'pointer', fontSize: 16, lineHeight: 1,
        }}
      >
        <Minus size={compact ? 14 : 16} />
      </button>
    </div>
  );
};

export default MapZoomControls;