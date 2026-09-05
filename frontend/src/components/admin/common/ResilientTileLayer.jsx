import React, { useState, useCallback } from 'react';
import { TileLayer } from 'react-leaflet';

const OSM_FALLBACK = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * ResilientTileLayer — renders a keyless tile provider and, if that provider
 * fails to serve tiles (blocked network, placeholder tiles, errors), falls
 * back to OpenStreetMap standard tiles so the map is never blank.
 */
export const ResilientTileLayer = ({ url, attribution, maxZoom = 19, fallbackUrl = OSM_FALLBACK, fallbackAttribution = OSM_ATTR }) => {
  const [current, setCurrent] = useState(url);
  const [failCount, setFailCount] = useState(0);

  const onTileError = useCallback(() => {
    setFailCount((n) => {
      const next = n + 1;
      if (next >= 4 && current !== fallbackUrl) setCurrent(fallbackUrl);
      return next;
    });
  }, [current, fallbackUrl]);

  return (
    <TileLayer
      key={current}
      url={current}
      attribution={current === fallbackUrl ? fallbackAttribution : attribution}
      maxZoom={maxZoom}
      eventHandlers={{ tileerror: onTileError }}
    />
  );
};

export default ResilientTileLayer;