import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ResilientTileLayer } from '../admin/common/ResilientTileLayer';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// CartoDB Dark Matter / Voyager tiles
const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

const isValid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

function AnimatedTacticalDriverMarker({ target, heading }) {
  const [pos, setPos] = useState(target);
  const [rot, setRot] = useState(heading || 0);
  const fromRef = useRef(target);
  const fromHeadingRef = useRef(heading || 0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isValid(target)) { fromRef.current = target; setPos(target); return undefined; }
    const from = isValid(fromRef.current) ? fromRef.current : target;
    const startT = performance.now();
    const dur = 800;

    let diffRot = ((heading || 0) - fromHeadingRef.current) % 360;
    if (diffRot > 180) diffRot -= 360;
    if (diffRot < -180) diffRot += 360;
    const startHeading = fromHeadingRef.current;

    const step = (now) => {
      const k = Math.min(1, (now - startT) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const cur = {
        lat: from.lat + (target.lat - from.lat) * eased,
        lng: from.lng + (target.lng - from.lng) * eased,
      };
      if (!isValid(cur)) { setPos(target); fromRef.current = target; return; }
      setPos(cur);
      setRot(((startHeading + diffRot * eased) % 360 + 360) % 360);

      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
        fromHeadingRef.current = heading || 0;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target?.lat, target?.lng, heading]);

  if (!isValid(pos)) return null;

  const icon = L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:36px;height:36px;">
        <!-- Radar Pulse Ring -->
        <div style="position:absolute;top:50%;left:50%;width:36px;height:36px;border-radius:50%;border:2px solid #10B981;animation:driverPing 2s cubic-bezier(0,0,0.2,1) infinite;transform:translate(-50%,-50%);pointer-events:none;"></div>
        <!-- Directional Vector Icon -->
        <div style="position:relative;width:36px;height:36px;transform:rotate(${Math.round(rot)}deg);filter:drop-shadow(0 0 6px rgba(16,185,129,0.8));">
          <svg viewBox="0 0 40 40" width="36" height="36">
            <circle cx="20" cy="20" r="17" fill="#0B1E36" stroke="#10B981" stroke-width="2.5" />
            <path d="M20 7 L29 28 L20 23 L11 28 Z" fill="#10B981" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round" />
            <circle cx="20" cy="20" r="3" fill="#FFFFFF" />
          </svg>
        </div>
      </div>
      <style>
        @keyframes driverPing {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }
      </style>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  return <Marker position={[pos.lat, pos.lng]} icon={icon} zIndexOffset={1000} />;
}

export default function DriverLiveMap({ marker, route, trail, height = 280 }) {
  const [map, setMap] = useState(null);

  const routeLatLngs = Array.isArray(route)
    ? route.filter((c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])).map((c) => [c[1], c[0]])
    : [];
  const trailLatLngs = Array.isArray(trail) && trail.length > 1
    ? trail.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => [p.lat, p.lng])
    : [];

  useEffect(() => {
    if (!map) return;
    const pts = [];
    if (marker) pts.push([marker.lat, marker.lng]);
    if (routeLatLngs.length) pts.push(...routeLatLngs);
    if (trailLatLngs.length) pts.push(...trailLatLngs);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(pts.map((p) => L.latLng(p[0], p[1]))), { padding: [28, 28], maxZoom: 15 });
  }, [map, marker?.lat, marker?.lng, routeLatLngs.length, trailLatLngs.length]);

  const destPoint = routeLatLngs.length > 0 ? routeLatLngs[routeLatLngs.length - 1] : null;
  const destIcon = L.divIcon({
    className: '',
    html: `
      <div style="width:24px;height:24px;border-radius:50%;background:#EF4444;border:3px solid #fff;box-shadow:0 0 10px rgba(239,68,68,0.7);display:flex;align-items:center;justify-content:center;">
        <div style="width:6px;height:6px;border-radius:50%;background:#fff;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const hasAnything = marker || routeLatLngs.length || trailLatLngs.length;

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid #CBD5E1', height, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
      {hasAnything ? (
        <MapContainer
          ref={setMap}
          center={marker ? [marker.lat, marker.lng] : [26.14, 91.73]}
          zoom={10}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <ResilientTileLayer url={TILES} attribution={TILE_ATTR} maxZoom={19} maxNativeZoom={18} />

          {/* Glowing Outer Polyline */}
          {routeLatLngs.length > 1 && (
            <Polyline
              positions={routeLatLngs}
              pathOptions={{ color: '#06B6D4', weight: 7, opacity: 0.35, lineCap: 'round', lineJoin: 'round' }}
            />
          )}
          {/* Inner Sharp Polyline */}
          {routeLatLngs.length > 1 && (
            <Polyline
              positions={routeLatLngs}
              pathOptions={{ color: '#0284C7', weight: 3.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
            />
          )}

          {/* Breadcrumb Trail */}
          {trailLatLngs.length > 1 && (
            <Polyline
              positions={trailLatLngs}
              pathOptions={{ color: '#10B981', weight: 2.5, opacity: 0.8, dashArray: '4, 6' }}
            />
          )}

          {/* Destination Marker */}
          {destPoint && <Marker position={destPoint} icon={destIcon} />}

          {/* Moving Vehicle */}
          {marker && <AnimatedTacticalDriverMarker target={{ lat: marker.lat, lng: marker.lng }} heading={marker.heading} />}
          <ScaleControl imperial={false} position="bottomleft" />
        </MapContainer>
      ) : (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', color: '#64748B', fontSize: 13, fontWeight: 600, textAlign: 'center', padding: 16 }}>
          No real GPS data yet — the map shows only verified positions.
        </div>
      )}
    </div>
  );
}
