import React, { useState, useCallback } from 'react';
import { TileLayer } from 'react-leaflet';

const OSM_FALLBACK = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * ResilientTileLayer — renders a keyless tile provider and, if that provider
 * fails to serve tiles (blocked network, placeholder tiles, errors), falls
 * back to OpenStreetMap standard tiles so the map is never blank.
 */
export const ResilientTileLayer = ({
  url,
  attribution,
  maxZoom = 19,
  maxNativeZoom,
  fallbackUrl = OSM_FALLBACK,
  fallbackAttribution = OSM_ATTR,
}) => {
  const [current, setCurrent] = useState(url);
  const [failCount, setFailCount] = useState(0);

  // Sync state when parent changes url (layer switcher)
  React.useEffect(() => {
    setCurrent(url);
    setFailCount(0);
  }, [url]);

  // If the URL is an Esri service, ArcGIS tiles cap out at zoom 16 (or 17 for satellite, 15 for canvas) in North-East India.
  // Setting maxNativeZoom prevents Leaflet from requesting non-existent tiles
  // that return the "Map data not supported at this zoom level" watermark.
  const isEsri = current && (current.includes('arcgisonline.com') || current.includes('esri'));
  const isSatellite = isEsri && current.includes('World_Imagery');
  const isCanvas = isEsri && current.includes('Canvas');
  const defaultEsriNativeZoom = isSatellite ? 17 : isCanvas ? 15 : 16;
  const effectiveMaxNativeZoom = maxNativeZoom !== undefined
    ? maxNativeZoom
    : (isEsri ? defaultEsriNativeZoom : 18);

  const onTileError = useCallback(() => {
    setFailCount((n) => {
      const next = n + 1;
      if (next >= 4 && current !== fallbackUrl) setCurrent(fallbackUrl);
      return next;
    });
  }, [current, fallbackUrl]);

  return (
    <TileLayer
      key={`${current}-${effectiveMaxNativeZoom}`}
      url={current}
      attribution={current === fallbackUrl ? fallbackAttribution : attribution}
      maxZoom={maxZoom}
      maxNativeZoom={effectiveMaxNativeZoom}
      eventHandlers={{ tileerror: onTileError }}
    />
  );
};

export default ResilientTileLayer;