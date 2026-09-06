import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  Truck,
  Navigation,
  Gauge,
  Compass,
  Clock,
  User,
  ShieldCheck,
  AlertTriangle,
  Radio,
  MapPin,
} from 'lucide-react';

const STATUS_COLOR = {
  live: '#10B981',
  moving: '#06B6D4',
  in_transit: '#06B6D4',
  stopped: '#F59E0B',
  delayed: '#EA580C',
  stale: '#A855F7',
  offline: '#64748B',
  idle: '#64748B',
  emergency: '#EF4444',
};

function getCompassDir(deg) {
  if (deg == null) return '';
  const d = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return d[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
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

function isValidCoord(v) {
  return v != null && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180;
}

/**
 * AnimatedTacticalVehicleMarker
 * High-tech OSIRIS tactical vehicle marker:
 * - Smooth visual gliding animation along coordinates via requestAnimationFrame.
 * - Dynamic 360-degree heading bearing orientation.
 * - Concentric expanding radar wave pulse.
 * - OSIRIS Tactical Telemetry HUD popup card.
 */
export default function AnimatedTacticalVehicleMarker({
  vehicle,
  selected = false,
  onSelect,
  zIndexOffset,
}) {
  const targetLat = Number(vehicle?.lat || vehicle?.latitude);
  const targetLng = Number(vehicle?.lng || vehicle?.longitude);
  const targetHeading = typeof vehicle?.heading === 'number' ? vehicle.heading : 0;

  // Local state for smooth visual position and bearing
  const [currentPos, setCurrentPos] = useState({ lat: targetLat, lng: targetLng });
  const [currentBearing, setCurrentBearing] = useState(targetHeading);

  const prevTargetRef = useRef({ lat: targetLat, lng: targetLng, heading: targetHeading });
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return;

    const from = prevTargetRef.current;
    const to = { lat: targetLat, lng: targetLng, heading: targetHeading };
    prevTargetRef.current = to;

    const distM = haversineM(from.lat, from.lng, to.lat, to.lng);
    if (distM < 0.5) {
      setCurrentPos({ lat: targetLat, lng: targetLng });
      setCurrentBearing(targetHeading);
      return;
    }

    // Dynamic duration based on movement distance (min 400ms, max 1600ms)
    const duration = Math.max(400, Math.min(1600, distM * 20));
    const startTime = performance.now();

    // Shortest angular turn
    let diffHeading = (to.heading - from.heading) % 360;
    if (diffHeading > 180) diffHeading -= 360;
    if (diffHeading < -180) diffHeading += 360;

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth cubic out easing
      const ease = 1 - Math.pow(1 - progress, 3);

      const lat = from.lat + (to.lat - from.lat) * ease;
      const lng = from.lng + (to.lng - from.lng) * ease;
      const heading = ((from.heading + diffHeading * ease) % 360 + 360) % 360;

      setCurrentPos({ lat, lng });
      setCurrentBearing(heading);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [targetLat, targetLng, targetHeading]);

  if (!isValidCoord(currentPos)) return null;

  // Determine status & styling
  const rawStatus = (vehicle?.liveStatus || vehicle?.status || 'idle').toLowerCase();
  const isEmergency = rawStatus === 'emergency';
  const isLive = rawStatus === 'live' || rawStatus === 'moving' || rawStatus === 'in_transit';
  const color = isEmergency ? STATUS_COLOR.emergency : STATUS_COLOR[rawStatus] || STATUS_COLOR.live;

  const speedKmh = vehicle?.speedNum != null
    ? Math.round(vehicle.speedNum)
    : vehicle?.speed != null
      ? Math.round(vehicle.speed)
      : null;

  const compass = getCompassDir(currentBearing);
  const size = selected ? 38 : 32;

  // OSIRIS Tactical DivIcon
  const icon = useMemo(() => {
    const pulseKeyframe = `
      <style>
        @keyframes osirisPulse {
          0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        @keyframes osirisEmergency {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 10px #EF4444); }
          50% { opacity: 0.5; filter: drop-shadow(0 0 2px #EF4444); }
        }
      </style>
    `;

    const radarRings = isLive || isEmergency
      ? `
        <div style="position:absolute;top:50%;left:50%;width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${color};animation:osirisPulse 2s cubic-bezier(0.2,0.8,0.2,1) infinite;pointer-events:none;"></div>
        <div style="position:absolute;top:50%;left:50%;width:${size}px;height:${size}px;border-radius:50%;border:1.5px solid ${color};animation:osirisPulse 2s cubic-bezier(0.2,0.8,0.2,1) infinite 0.7s;pointer-events:none;"></div>
      `
      : '';

    const telemetryTag = speedKmh != null
      ? `<div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:#0B1E36;border:1px solid ${color}88;border-radius:6px;padding:1px 5px;color:#F8FAFC;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.5);letter-spacing:0.5px;">
           ${speedKmh} km/h ${compass ? `· ${compass}` : ''}
         </div>`
      : '';

    return L.divIcon({
      className: '',
      html: `
        ${pulseKeyframe}
        <div style="position:relative;width:${size}px;height:${size}px;cursor:pointer;">
          ${radarRings}
          <!-- Tactical Rotating Icon -->
          <div style="position:relative;width:${size}px;height:${size}px;transform:rotate(${Math.round(currentBearing)}deg);transition:transform 0.2s linear;filter:drop-shadow(0 0 ${isLive ? '8px' : '3px'} ${color}99);">
            <svg viewBox="0 0 40 40" width="${size}" height="${size}">
              <!-- Tactical Halo -->
              <circle cx="20" cy="20" r="18" fill="#0B1E36" stroke="${color}" stroke-width="2.5" />
              <!-- Tactical Direction Arrow / Truck Hull -->
              <path d="M20 7 L29 28 L20 23 L11 28 Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round" />
              <!-- Center beacon -->
              <circle cx="20" cy="20" r="3.5" fill="#FFFFFF" />
            </svg>
          </div>
          ${telemetryTag}
        </div>
      `,
      iconSize: [size, size + 20],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }, [size, color, isLive, isEmergency, currentBearing, speedKmh, compass]);

  const vehicleId = vehicle?.id || 'FLEET-VEHICLE';
  const modelName = vehicle?.model || vehicle?.type || 'Heavy Transport';
  const driverName = vehicle?.driver?.name || vehicle?.driver || 'Assigned Driver';
  const currentRoute = vehicle?.current_route || vehicle?.route || 'Corridor Transit';

  return (
    <Marker
      position={[currentPos.lat, currentPos.lng]}
      icon={icon}
      zIndexOffset={zIndexOffset != null ? zIndexOffset : isLive ? 800 : 400}
      eventHandlers={onSelect ? { click: () => onSelect(vehicle) } : undefined}
    >
      <Popup closeButton={true} className="osiris-tactical-popup">
        <div style={{
          minWidth: 260,
          padding: '12px',
          background: '#0B1E36',
          color: '#F8FAFC',
          borderRadius: 12,
          fontFamily: "'Inter', -apple-system, sans-serif",
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.6), 0 0 15px rgba(6,182,212,0.2)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.5px', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 6px ${color}` }} />
                {vehicleId}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: 600 }}>
                {modelName}
              </div>
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 6,
              background: `${color}22`,
              border: `1px solid ${color}66`,
              color,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginLeft: 'auto',
            }}>
              {isLive ? 'LIVE RADAR' : rawStatus}
            </span>
          </div>

          {vehicle?.enteringHighRiskCorridor && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #EF4444',
              color: '#FCA5A5',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              marginBottom: 8,
            }}>
              <span>⚠️</span>
              <span>HIGH-RISK CORRIDOR (Risk: {vehicle.corridorRisk || 60}+)</span>
            </div>
          )}

          {/* Tactical Telemetry Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px', borderRadius: 8, textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <Gauge size={11} color={color} /> SPEED
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#F8FAFC', marginTop: 2 }}>
                {speedKmh != null ? `${speedKmh} km/h` : '—'}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px', borderRadius: 8, textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <Compass size={11} color={color} /> HEADING
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#F8FAFC', marginTop: 2 }}>
                {Math.round(currentBearing)}° {compass}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '6px', borderRadius: 8, textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <Radio size={11} color={color} /> SIGNAL
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#10B981', marginTop: 2 }}>
                {isLive ? 'LOCKED' : 'OFFLINE'}
              </div>
            </div>
          </div>

          {/* Route & Driver Details */}
          <div style={{ fontSize: 11, color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Navigation size={12} color="#06B6D4" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentRoute}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={12} color="#A855F7" style={{ flexShrink: 0 }} />
              <span>Driver: <strong style={{ color: '#F1F5F9' }}>{driverName}</strong></span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={12} color="#F59E0B" style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>
                {currentPos.lat.toFixed(4)}° N, {currentPos.lng.toFixed(4)}° E
              </span>
            </div>
          </div>

          {/* Footer note */}
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 9, color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>OSIRIS Tactical Tracking</span>
            <span style={{ color: isLive ? '#10B981' : '#64748B' }}>● Live Stream</span>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

