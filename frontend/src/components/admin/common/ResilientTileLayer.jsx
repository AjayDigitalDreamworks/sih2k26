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
  url = OSM_FALLBACK,
  attribution = OSM_ATTR,
  maxZoom = 19,
  maxNativeZoom,
  fallbackUrl = OSM_FALLBACK,
  fallbackAttribution = OSM_ATTR,
}) => {
  const safeInitial = url || fallbackUrl || OSM_FALLBACK;
  const [current, setCurrent] = useState(safeInitial);
  const [failCount, setFailCount] = useState(0);

  // Sync state when parent changes url (layer switcher)
  React.useEffect(() => {
    const validUrl = url || fallbackUrl || OSM_FALLBACK;
    setCurrent(validUrl);
    setFailCount(0);
  }, [url, fallbackUrl]);

  // If the URL is an Esri service, ArcGIS tiles cap out at zoom 16 (or 17 for satellite, 15 for canvas) in North-East India.
  // Setting maxNativeZoom prevents Leaflet from requesting non-existent tiles
  // that return the "Map data not supported at this zoom level" watermark.
  const isEsri = Boolean(current && (current.includes('arcgisonline.com') || current.includes('esri')));
  const isSatellite = Boolean(isEsri && current.includes('World_Imagery'));
  const isCanvas = Boolean(isEsri && current.includes('Canvas'));
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

  const activeUrl = current || fallbackUrl || OSM_FALLBACK;
  const activeAttr = (activeUrl === fallbackUrl || !attribution) ? fallbackAttribution : attribution;

  return (
    <TileLayer
      key={`${activeUrl}-${effectiveMaxNativeZoom}`}
      url={activeUrl}
      attribution={activeAttr}
      maxZoom={maxZoom}
      maxNativeZoom={effectiveMaxNativeZoom}
      eventHandlers={{ tileerror: onTileError }}
    />
  );
};

export default ResilientTileLayer;