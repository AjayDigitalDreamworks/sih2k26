import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, ScaleControl, Circle, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ResilientTileLayer } from '../admin/common/ResilientTileLayer';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const CARTO_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const isValid = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function AnimatedTacticalDriverMarker({ target, heading }) {
  const markerRef = useRef(null);
  const currentPosRef = useRef(target);
  const currentBearingRef = useRef(heading || 0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isValid(target)) return;

    const from = { ...currentPosRef.current };
    const distM = haversineM(from.lat, from.lng, target.lat, target.lng);

    let toHeading = heading;
    if (toHeading == null || toHeading === 0) {
      if (distM >= 0.5) {
        toHeading = calculateBearing(from.lat, from.lng, target.lat, target.lng);
      } else {
        toHeading = currentBearingRef.current;
      }
    }

    const fromHeading = currentBearingRef.current;
    let diffRot = (toHeading - fromHeading) % 360;
    if (diffRot > 180) diffRot -= 360;
    if (diffRot < -180) diffRot += 360;

    const startT = performance.now();
    const dur = Math.max(350, Math.min(1800, distM * 18));

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const step = (now) => {
      const k = Math.min(1, (now - startT) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const curLat = from.lat + (target.lat - from.lat) * eased;
      const curLng = from.lng + (target.lng - from.lng) * eased;
      const curRot = ((fromHeading + diffRot * eased) % 360 + 360) % 360;

      currentPosRef.current = { lat: curLat, lng: curLng };
      currentBearingRef.current = curRot;

      if (markerRef.current) {
        markerRef.current.setLatLng([curLat, curLng]);
        const el = markerRef.current.getElement();
        if (el) {
          const rotator = el.querySelector('.driver-rotator');
          if (rotator) rotator.style.transform = `rotate(${Math.round(curRot)}deg)`;
        }
      }

      if (k < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target?.lat, target?.lng, heading]);

  if (!isValid(target)) return null;

  const initialRot = currentBearingRef.current;

  const icon = L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:36px;height:36px;">
        <!-- Radar Pulse Ring -->
        <div style="position:absolute;top:50%;left:50%;width:36px;height:36px;border-radius:50%;border:2px solid #10B981;animation:driverPing 2s cubic-bezier(0,0,0.2,1) infinite;transform:translate(-50%,-50%);pointer-events:none;"></div>
        <!-- Directional Vector Icon -->
        <div class="driver-rotator" style="position:relative;width:36px;height:36px;transform:rotate(${Math.round(initialRot)}deg);filter:drop-shadow(0 0 6px rgba(16,185,129,0.8));">
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

  return <Marker ref={markerRef} position={[target.lat, target.lng]} icon={icon} zIndexOffset={1000} />;
}

export default function DriverLiveMap({ marker, route, trail, height = 280, hazard = null }) {
  const [map, setMap] = useState(null);

  const routeLatLngs = Array.isArray(route)
    ? route.filter((c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])).map((c) => {
        if (c[0] > 70 && c[1] < 40) return [c[1], c[0]];
        return [c[0], c[1]];
      })
    : [];
  const trailLatLngs = Array.isArray(trail) && trail.length > 1
    ? trail.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => [p.lat, p.lng])
    : [];

  const hasFittedRef = useRef(false);

  // Initial fit to route corridor
  useEffect(() => {
    if (!map) return;
    if (routeLatLngs.length > 1 && !hasFittedRef.current) {
      hasFittedRef.current = true;
      try {
        map.fitBounds(L.latLngBounds(routeLatLngs), { padding: [35, 35], maxZoom: 15 });
      } catch {}
      return;
    }
  }, [map, routeLatLngs.length]);

  // Google Maps turn-by-turn smooth vehicle camera follow
  useEffect(() => {
    if (!map || !marker || !Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) return;
    try {
      if (!hasFittedRef.current && routeLatLngs.length === 0) {
        map.setView([marker.lat, marker.lng], 15);
        hasFittedRef.current = true;
      } else {
        map.panTo([marker.lat, marker.lng], { animate: true, duration: 1.0 });
      }
    } catch {}
  }, [map, marker?.lat, marker?.lng, routeLatLngs.length]);

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

  const hazardCoords = Array.isArray(hazard?.hazardCoordinates) && hazard.hazardCoordinates.length >= 2
    ? [hazard.hazardCoordinates[0], hazard.hazardCoordinates[1]]
    : null;

  const hazardIcon = L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(239,68,68,0.45);animation:driverPing 1.4s infinite;"></div>
        <div style="width:26px;height:26px;border-radius:50%;background:#DC2626;border:2px solid #fff;box-shadow:0 0 10px rgba(220,38,38,0.9);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:900;">
          ⚠️
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

  const hasAnything = marker || routeLatLngs.length || trailLatLngs.length || hazardCoords;

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid #CBD5E1', height, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
      {hasAnything ? (
        <MapContainer
          ref={setMap}
          center={marker ? [marker.lat, marker.lng] : [28.38, 77.28]}
          zoom={14}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <ResilientTileLayer url={CARTO_TILES} fallbackUrl={OSM_TILES} attribution={TILE_ATTR} maxZoom={19} maxNativeZoom={19} />

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

          {/* Upcoming Micro-Segment Hazard Hotspot */}
          {hazardCoords && (
            <>
              <Circle
                center={hazardCoords}
                radius={260}
                pathOptions={{
                  color: '#EF4444',
                  fillColor: '#DC2626',
                  fillOpacity: 0.45,
                  weight: 2,
                  dashArray: '4, 4',
                }}
              />
              <Marker position={hazardCoords} icon={hazardIcon}>
                <Popup>
                  <div style={{ padding: '4px 6px', maxWidth: 220, fontSize: 12 }}>
                    <div style={{ fontWeight: 800, color: '#DC2626', marginBottom: 2 }}>
                      ⚠️ {hazard.hazardReason || 'Hazard Zone Ahead'}
                    </div>
                    <div style={{ color: '#334155', fontSize: 11, lineHeight: 1.3 }}>
                      KM {hazard.startChainageKm}–{hazard.endChainageKm} • Risk: <b>{hazard.riskScore}/100</b>
                    </div>
                    <div style={{ color: '#059669', fontWeight: 700, marginTop: 4 }}>
                      Advisory Speed: &lt; {hazard.speedAdvisoryKmh || 25} km/h
                    </div>
                  </div>
                </Popup>
              </Marker>
            </>
          )}

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
