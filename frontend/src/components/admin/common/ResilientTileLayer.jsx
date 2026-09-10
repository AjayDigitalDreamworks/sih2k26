import React, { useState, useCallback } from 'react';
import { TileLayer } from 'react-leaflet';
import {
  CARTO_VOYAGER_URL,
  CARTO_ATTRIBUTION,
  OSM_URL,
  OSM_ATTRIBUTION,
} from '../../../config/mapConfig';

/**
 * ResilientTileLayer — renders a tile provider (Carto, Esri, OSM) and, if that
 * provider fails to serve tiles, seamlessly falls back to Carto Voyager / OSM
 * so the map is always 100% resilient and never blank.
 */
export const ResilientTileLayer = ({
  url = CARTO_VOYAGER_URL,
  attribution = CARTO_ATTRIBUTION,
  maxZoom = 20,
  maxNativeZoom,
  fallbackUrl = OSM_URL,
  fallbackAttribution = OSM_ATTRIBUTION,
}) => {
  const safeInitial = url || fallbackUrl || OSM_URL;
  const [current, setCurrent] = useState(safeInitial);
  const [failCount, setFailCount] = useState(0);

  // Sync state when parent changes url (layer switcher)
  React.useEffect(() => {
    const validUrl = url || fallbackUrl || OSM_FALLBACK;
    setCurrent(validUrl);
    setFailCount(0);
  }, [url, fallbackUrl]);

  const isCarto = Boolean(current && current.includes('cartocdn'));
  const isEsri = Boolean(current && (current.includes('arcgisonline.com') || current.includes('esri')));
  const isSatellite = Boolean(isEsri && current.includes('World_Imagery'));
  const isCanvas = Boolean(isEsri && current.includes('Canvas'));
  const defaultEsriNativeZoom = isSatellite ? 17 : isCanvas ? 15 : 16;
  const effectiveMaxNativeZoom = maxNativeZoom !== undefined
    ? maxNativeZoom
    : (isCarto ? 19 : isEsri ? defaultEsriNativeZoom : 18);

  const onTileError = useCallback(() => {
    setFailCount((n) => {
      const next = n + 1;
      if (next >= 3 && current !== fallbackUrl) {
        setCurrent(fallbackUrl || OSM_URL);
      }
      return next;
    });
  }, [current, fallbackUrl]);

  const activeUrl = current || fallbackUrl || OSM_URL;
  const activeAttr = (activeUrl === fallbackUrl || !attribution) ? fallbackAttribution : attribution;
  const subdomains = activeUrl.includes('cartocdn') ? 'abcd' : 'abc';

  return (
    <TileLayer
      key={`${activeUrl}-${effectiveMaxNativeZoom}`}
      url={activeUrl}
      attribution={activeAttr}
      maxZoom={maxZoom}
      maxNativeZoom={effectiveMaxNativeZoom}
      subdomains={subdomains}
      eventHandlers={{ tileerror: onTileError }}
    />
  );
};

export default ResilientTileLayer;