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
  sos: '#EF4444',
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

function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function isValidCoord(v) {
  return v != null && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180;
}

/**
 * AnimatedTacticalVehicleMarker
 * High-tech OSIRIS tactical vehicle marker:
 * - Direct 60 FPS hardware-accelerated gliding along coordinates via requestAnimationFrame (no React re-render lag).
 * - Live dynamic bearing calculation based on GPS direction of travel with shortest-arc rotational interpolation.
 * - Smooth vehicle rotation aligning marker hull with real movement.
 * - Concentric expanding radar wave pulse.
 * - OSIRIS Tactical Telemetry HUD popup card.
 */
export default function AnimatedTacticalVehicleMarker({
  vehicle,
  selected = false,
  onSelect,
  zIndexOffset,
}) {
  const targetLat = Number(vehicle?.lat ?? vehicle?.latitude ?? vehicle?.current_lat);
  const targetLng = Number(vehicle?.lng ?? vehicle?.longitude ?? vehicle?.current_lng);

  const explicitHeading = typeof vehicle?.heading === 'number' && vehicle.heading !== 0
    ? vehicle.heading
    : typeof vehicle?.bearing === 'number' && vehicle.bearing !== 0
      ? vehicle.bearing
      : typeof vehicle?.current_heading === 'number' && vehicle.current_heading !== 0
        ? vehicle.current_heading
        : null;

  const rawStatus = (vehicle?.liveStatus || vehicle?.status || 'idle').toLowerCase();
  const isEmergency = rawStatus === 'emergency' || rawStatus === 'sos' || Boolean(vehicle?.sos);
  const isSos = Boolean(vehicle?.sos || vehicle?.is_sos || isEmergency);
  const isLive = rawStatus === 'live' || rawStatus === 'moving' || rawStatus === 'in_transit';
  const color = isSos ? STATUS_COLOR.emergency : STATUS_COLOR[rawStatus] || STATUS_COLOR.live;

  const speedKmh = vehicle?.speedNum != null
    ? Math.round(vehicle.speedNum)
    : vehicle?.speed != null
      ? Math.round(vehicle.speed)
      : null;

  const markerRef = useRef(null);
  const currentPosRef = useRef({ lat: targetLat, lng: targetLng });
  const currentBearingRef = useRef(explicitHeading || 0);
  const animFrameRef = useRef(null);

  // Local state for popup telemetry and initial render position
  const [displayPos, setDisplayPos] = useState({ lat: targetLat, lng: targetLng });
  const [displayBearing, setDisplayBearing] = useState(explicitHeading || 0);

  useEffect(() => {
    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return;

    const from = { ...currentPosRef.current };
    const to = { lat: targetLat, lng: targetLng };
    const distM = haversineM(from.lat, from.lng, to.lat, to.lng);

    // Initial fix or extreme teleport (> 50 km) - jump directly
    if (distM > 50000) {
      currentPosRef.current = to;
      if (markerRef.current) markerRef.current.setLatLng([to.lat, to.lng]);
      setDisplayPos(to);
      return;
    }

    // Determine target heading: explicit GPS heading or live coordinate bearing
    let toHeading = explicitHeading;
    if (toHeading == null) {
      if (distM >= 0.5) {
        toHeading = calculateBearing(from.lat, from.lng, to.lat, to.lng);
      } else {
        toHeading = currentBearingRef.current; // Keep last orientation when stationary
      }
    }

    const fromHeading = currentBearingRef.current;

    // Stationary with minimal change
    if (distM < 0.3 && Math.abs(toHeading - fromHeading) < 1) {
      return;
    }

    // Dynamic duration based on movement distance (min 350ms, max 1800ms)
    const duration = Math.max(350, Math.min(1800, distM * 18));
    const startTime = performance.now();

    // Shortest angular turn across 360 degrees
    let diffHeading = (toHeading - fromHeading) % 360;
    if (diffHeading > 180) diffHeading -= 360;
    if (diffHeading < -180) diffHeading += 360;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth cubic out easing
      const ease = 1 - Math.pow(1 - progress, 3);

      const lat = from.lat + (to.lat - from.lat) * ease;
      const lng = from.lng + (to.lng - from.lng) * ease;
      const heading = ((fromHeading + diffHeading * ease) % 360 + 360) % 360;

      currentPosRef.current = { lat, lng };
      currentBearingRef.current = heading;

      // Direct Leaflet Marker position update (60 FPS, GPU-accelerated)
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        const el = markerRef.current.getElement();
        if (el) {
          const rotator = el.querySelector('.tactical-rotator');
          if (rotator) {
            rotator.style.transform = `rotate(${Math.round(heading)}deg)`;
          }
          const telemetryTag = el.querySelector('.tactical-telemetry-tag');
          if (telemetryTag && speedKmh != null) {
            const comp = getCompassDir(heading);
            telemetryTag.textContent = `${speedKmh} km/h ${comp ? `· ${comp}` : ''}`;
          }
        }
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        // Animation finished: sync state for open popups
        setDisplayPos({ lat: to.lat, lng: to.lng });
        setDisplayBearing(toHeading);
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [targetLat, targetLng, explicitHeading, speedKmh]);

  if (!isValidCoord({ lat: targetLat, lng: targetLng })) return null;

  const size = selected ? 38 : 32;
  const initialBearing = currentBearingRef.current;
  const compass = getCompassDir(displayBearing);

  // OSIRIS Tactical DivIcon
  const icon = useMemo(() => {
    const pulseKeyframe = `
      <style>
        @keyframes osirisPulse {
          0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        @keyframes osirisEmergency {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 12px #EF4444); }
          50% { opacity: 0.4; filter: drop-shadow(0 0 3px #EF4444); }
        }
      </style>
    `;

    const radarRings = isLive || isEmergency || isSos
      ? `
        <div style="position:absolute;top:50%;left:50%;width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${color};animation:osirisPulse 2s cubic-bezier(0.2,0.8,0.2,1) infinite;pointer-events:none;"></div>
        <div style="position:absolute;top:50%;left:50%;width:${size}px;height:${size}px;border-radius:50%;border:1.5px solid ${color};animation:osirisPulse 2s cubic-bezier(0.2,0.8,0.2,1) infinite 0.7s;pointer-events:none;"></div>
      `
      : '';

    const telemetryTag = speedKmh != null
      ? `<div class="tactical-telemetry-tag" style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:#0B1E36;border:1px solid ${color}88;border-radius:6px;padding:1px 5px;color:#F8FAFC;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.5);letter-spacing:0.5px;">
           ${speedKmh} km/h ${compass ? `· ${compass}` : ''}
         </div>`
      : '';

    const sosBadge = isSos
      ? `<div style="position:absolute;top:-8px;right:-8px;background:#DC2626;color:#fff;font-size:9px;font-weight:900;padding:1px 4px;border-radius:4px;border:1.5px solid #fff;box-shadow:0 0 8px rgba(220,38,38,0.9);animation:osirisEmergency 1.5s infinite;">SOS</div>`
      : '';

    return L.divIcon({
      className: '',
      html: `
        ${pulseKeyframe}
        <div style="position:relative;width:${size}px;height:${size}px;cursor:pointer;">
          ${radarRings}
          <!-- Tactical Rotating Vehicle Hull (No CSS transition to ensure 60fps RAF synchronization) -->
          <div class="tactical-rotator" style="position:relative;width:${size}px;height:${size}px;transform:rotate(${Math.round(initialBearing)}deg);filter:drop-shadow(0 0 ${isLive ? '8px' : '3px'} ${color}99);">
            <svg viewBox="0 0 40 40" width="${size}" height="${size}">
              <!-- Tactical Halo -->
              <circle cx="20" cy="20" r="18" fill="#0B1E36" stroke="${color}" stroke-width="2.5" />
              <!-- Directional Chevron / Vehicle Hull -->
              <path d="M20 7 L29 28 L20 23 L11 28 Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round" />
              <!-- Center beacon -->
              <circle cx="20" cy="20" r="3.5" fill="#FFFFFF" />
            </svg>
          </div>
          ${sosBadge}
          ${telemetryTag}
        </div>
      `,
      iconSize: [size, size + 20],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }, [size, color, isLive, isEmergency, isSos, speedKmh]);

  const vehicleId = vehicle?.id || 'FLEET-VEHICLE';
  const modelName = vehicle?.model || vehicle?.type || 'Heavy Transport';
  const driverName = vehicle?.driver?.name || vehicle?.driver || 'Assigned Driver';
  const currentRoute = vehicle?.current_route || vehicle?.route || 'Corridor Transit';

  return (
    <Marker
      ref={markerRef}
      position={[targetLat, targetLng]}
      icon={icon}
      zIndexOffset={zIndexOffset != null ? zIndexOffset : isSos ? 2000 : isLive ? 800 : 400}
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
          {/* SOS Banner if active */}
          {(isSos || vehicle?.sosData) && (
            <div style={{
              marginBottom: 8,
              padding: '6px 10px',
              borderRadius: 6,
              background: '#FEF2F2',
              border: '1.5px solid #DC2626',
              animation: 'osirisEmergency 1.6s ease-in-out infinite',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12, color: '#991B1B' }}>
                <AlertTriangle size={13} color="#DC2626" />
                <span>🚨 EMERGENCY SOS ACTIVE</span>
              </div>
              {vehicle?.sosData?.reason && (
                <div style={{ fontSize: 10, color: '#7F1D1D', marginTop: 2 }}>
                  Reason: {vehicle.sosData.reason}
                </div>
              )}
            </div>
          )}

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
              {isSos ? 'EMERGENCY' : isLive ? 'LIVE RADAR' : rawStatus}
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
                {Math.round(displayBearing)}° {compass}
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
                {displayPos.lat.toFixed(4)}° N, {displayPos.lng.toFixed(4)}° E
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

