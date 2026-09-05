import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMap, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, Navigation, RefreshCw, Signal, Battery, Clock, MapPin, AlertTriangle } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { MapZoomControls } from '@/components/admin/common/MapZoomControls';
import { ResilientTileLayer } from '@/components/admin/common/ResilientTileLayer';
import { RiskHeatLayer } from '@/components/admin/common/RiskHeatLayer';
import { getSocket, subscribeToEmergency, subscribeToEmergencyCancelled } from '@/lib/socket';
import ApiClient from '@/lib/api';
import { useVehicleTracking } from '@/hooks/useVehicleTracking';

const DISTRICT_COORDS = {
  kamrup: { lat: 26.1445, lng: 91.7362, name: 'Guwahati' },
  sonitpur: { lat: 26.6528, lng: 92.7926, name: 'Tezpur' },
  cachar: { lat: 24.817, lng: 92.7985, name: 'Silchar' },
  dima_hasao: { lat: 25.1764, lng: 93.0232, name: 'Haflong' },
  east_khasi: { lat: 25.5788, lng: 91.8933, name: 'Shillong' },
  west_khasi: { lat: 25.5244, lng: 91.2662, name: 'Nongstoin' },
  dimapur: { lat: 25.906, lng: 93.727, name: 'Dimapur' },
  kohima: { lat: 25.6751, lng: 94.1086, name: 'Kohima' },
  imphal_west: { lat: 24.817, lng: 93.9368, name: 'Imphal' },
  aizawl: { lat: 23.7271, lng: 92.7176, name: 'Aizawl' },
  papum_pare: { lat: 27.0844, lng: 93.6053, name: 'Itanagar' },
  west_tripura: { lat: 23.8315, lng: 91.2868, name: 'Agartala' },
};

const TILE_LAYERS = {
  streets: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', name: 'Streets' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', name: 'Satellite' },
  terrain: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', name: 'Terrain' },
  dark: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', name: 'Dark' },
};

function getStatusColor(status) {
  switch (status) {
    case 'moving': return '#3B82F6';
    case 'stopped': return '#F59E0B';
    case 'prolonged_stop': return '#F97316';
    case 'delayed': return '#EF4444';
    case 'offline': return '#94A3B8';
    case 'stale': return '#A78BFA';
    case 'gps_error': return '#DC2626';
    default: return '#6B7280';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'moving': return 'Moving';
    case 'stopped': return 'Stopped';
    case 'prolonged_stop': return 'Prolonged Stop';
    case 'delayed': return 'Delayed';
    case 'offline': return 'Offline';
    case 'stale': return 'Stale GPS';
    case 'gps_error': return 'GPS Error';
    default: return status || 'Unknown';
  }
}

function getAccuracyBadge(rating) {
  switch (rating) {
    case 'high': return { color: '#059669', bg: '#ECFDF5', label: 'High' };
    case 'medium': return { color: '#2563EB', bg: '#EFF6FF', label: 'Med' };
    case 'low': return { color: '#D97706', bg: '#FFFBEB', label: 'Low' };
    case 'invalid': return { color: '#DC2626', bg: '#FEF2F2', label: 'Bad' };
    default: return { color: '#6B7280', bg: '#F9FAFB', label: 'N/A' };
  }
}

function MapCtrl({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 10, { duration: 0.8 }); }, [center, map]);
  return null;
}

function formatAge(timestamp) {
  if (!timestamp) return 'Unknown';
  const age = Date.now() - new Date(timestamp).getTime();
  if (age < 0) return 'Future';
  if (age < 60000) return `${Math.round(age / 1000)}s ago`;
  if (age < 3600000) return `${Math.round(age / 60000)}m ago`;
  if (age < 86400000) return `${Math.round(age / 3600000)}h ago`;
  return `${Math.round(age / 86400000)}d ago`;
}

const CONGESTION_COLORS = { low: '#10B981', moderate: '#F59E0B', high: '#EF4444', blocked: '#7F1D1D' };

// floodRisk arrives as EITHER a Google Flood Hub severity (0..4) OR a 0..100
// risk score (10=Very Low, 30=Low, 45=Medium, 65=High) OR a label string.
// Normalize all three to { label, color } so no scale is ever misread.
const floodDisplay = (fr) => {
  const s = String(fr ?? '').toLowerCase();
  if (s === 'high' || s === 'extreme' || s === 'critical') return { label: s === 'high' ? 'High' : 'Extreme', color: '#DC2626' };
  if (s === 'medium' || s === 'moderate') return { label: 'Medium', color: '#F59E0B' };
  if (s === 'low' || s === 'very low' || s === 'none' || s === 'no data') return { label: s === 'no data' ? 'No data' : s === 'very low' ? 'Very Low' : s === 'low' ? 'Low' : 'None', color: s === 'no data' ? '#6B7280' : '#10B981' };
  if (typeof fr === 'number') {
    if (fr > 4) {
      // 0..100 risk score
      if (fr >= 65) return { label: 'High', color: '#DC2626' };
      if (fr >= 45) return { label: 'Medium', color: '#F59E0B' };
      if (fr >= 30) return { label: 'Low', color: '#10B981' };
      return { label: 'Very Low', color: '#10B981' };
    }
    // 0..4 Google Flood Hub severity
    if (fr >= 3) return { label: ['None', 'Low', 'Medium', 'High', 'Extreme'][Math.min(4, Math.round(fr))], color: '#DC2626' };
    if (fr === 2) return { label: 'Medium', color: '#F59E0B' };
    if (fr === 1) return { label: 'Low', color: '#10B981' };
    return { label: 'None', color: '#10B981' };
  }
  return null;
};

export const FleetTrackingMap = ({ selectedVehicleId, onSelectVehicle }) => {
  const { vehicles, allDistrictsSummary } = useApp();
  const socket = getSocket();
  const { positions, trails } = useVehicleTracking(socket);
  const [activeLayer, setActiveLayer] = useState('streets');
  const [layerOpen, setLayerOpen] = useState(false);
  const [heatMode, setHeatMode] = useState('off'); // off | rain | flood

  // Real rainfall/flood heat points from the district summary (real observations).
  const heatData = React.useMemo(() => {
    const rows = Array.isArray(allDistrictsSummary) ? allDistrictsSummary : [];
    const toPoint = (d) => {
      const c = d?.coordinates;
      if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') return null;
      return { lat: c.lat, lng: c.lng };
    };
    return {
      rain: rows.map((d) => ({ ...toPoint(d), intensity: Math.min(1, (Number(d?.rainfall_mm) || 0) / 80) })).filter((p) => p.lat != null && (Number(p.intensity) || 0) > 0.05),
      flood: rows.map((d) => ({ ...toPoint(d), intensity: Math.min(1, (Number(d?.flood_risk_level) || 0) / 65) })).filter((p) => p.lat != null && (Number(p.intensity) || 0) > 0.05),
    };
  }, [allDistrictsSummary]);
  const [mapCenter, setMapCenter] = useState([25.5, 93.0]);
  const [liveRoute, setLiveRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const vehicleList = vehicles || [];
  const vehiclePositions = positions || {};
  const vehicleTrails = trails || {};

  // Vehicles with an ACTIVE SOS (server-side truth, refreshed every 20s + live socket events).
  const [sosMap, setSosMap] = useState({});
  useEffect(() => {
    let alive = true;
    const apply = (list) => {
      if (!alive) return;
      const map = {};
      (list || []).forEach((e) => {
        if (e?.vehicleId) map[e.vehicleId] = e;
      });
      setSosMap(map);
    };
    const load = async () => {
      try {
        const res = await ApiClient.getAllActiveSos();
        if (res?.success) apply(res.data?.vehicles);
      } catch { /* keep last known */ }
    };
    load();
    const iv = setInterval(load, 20000);
    const offSos = subscribeToEmergency((e) => {
      if (e?.vehicleId) setSosMap((p) => ({ ...p, [e.vehicleId]: { vehicleId: e.vehicleId, lat: e.lat ?? null, lng: e.lng ?? null, driver: e.driver || null, reason: e.reason || null, since: e.timestamp || null } }));
    });
    const offCancel = subscribeToEmergencyCancelled((e) => {
      if (e?.vehicleId) setSosMap((p) => {
        const n = { ...p };
        delete n[e.vehicleId];
        return n;
      });
    });
    return () => { alive = false; clearInterval(iv); offSos(); offCancel(); };
  }, []);

  // Route from the selected vehicle's REAL GPS position to its active trip
  // destination - drawn over the actual road network by the ML planner.
  useEffect(() => {
    if (!selectedVehicleId) {
      setLiveRoute(null);
      return;
    }
    let alive = true;
    const load = async () => {
      setRouteLoading(true);
      try {
        const res = await ApiClient.getLiveRoute(selectedVehicleId);
        if (!alive) return;
        if (res?.success && res.data) setLiveRoute(res.data);
        else setLiveRoute(null);
      } catch (e) {
        if (alive) setLiveRoute(null);
      } finally {
        if (alive) setRouteLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 90000);
    return () => { alive = false; clearInterval(iv); };
  }, [selectedVehicleId]);

  const liveRouteGeom = liveRoute?.hasRoute && (liveRoute.geometry || []).length > 1 ? liveRoute.geometry : null;
  const liveRisk = liveRoute?.riskScore != null ? liveRoute.riskScore : null;
  const liveRiskColor = liveRisk == null ? '#10B981' : liveRisk > 80 ? '#EF4444' : liveRisk > 60 ? '#F97316' : liveRisk > 30 ? '#F59E0B' : '#10B981';

  // Use animated positions if available, fall back to DB positions
  const getVehicleDisplayData = useCallback((v) => {
    const animated = vehiclePositions[v.id];
    if (animated && animated.lat && animated.lng) {
      return {
        lat: animated.lat, lng: animated.lng,
        bearing: animated.bearing || 0,
        speed: animated.speed || v.speed || 0,
        status: animated.status || v.statusClass || 'offline',
        direction: animated.direction || '',
        eta: animated.eta || null,
        etaMinutes: animated.etaMinutes || null,
        route: animated.route || v.route || '',
        timestamp: animated.timestamp || null,
        animating: animated.animating || false,
        batteryLevel: animated.batteryLevel || v.fuel || null,
        accuracyRating: animated.accuracyRating || 'unknown',
        distanceRemaining: animated.distanceRemaining || null,
        currentRoute: animated.currentRoute || v.route || '',
      };
    }
    return {
      lat: v.lat, lng: v.lng, bearing: 0, speed: v.speed || 0,
      status: v.statusClass || 'offline', direction: '', route: v.route || '',
      eta: null, accuracyRating: 'unknown',
    };
  }, [vehiclePositions]);

  const createVehicleMarkerIcon = useCallback((status, bearing, selected, sos) => {
    if (sos) {
      const size = selected ? 40 : 34;
      return L.divIcon({
        className: '',
        html: `<div style="position:relative;width:${size}px;height:${size}px">` +
          `<span style="position:absolute;inset:-6px;border-radius:50%;background:rgba(220,38,38,0.35);animation:sosPing 1.4s ease-out infinite"></span>` +
          `<span style="position:absolute;inset:0;border-radius:50%;background:#DC2626;border:3px solid #fff;box-shadow:0 0 14px rgba(220,38,38,0.9);display:flex;align-items:center;justify-content:center;font-size:${selected ? 14 : 12}px;font-weight:900;color:#fff">SOS</span>` +
          `</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    }
    const color = getStatusColor(status);
    const size = selected ? 32 : 24;
    const isOffline = status === 'offline' || status === 'stale';
    return L.divIcon({
      className: '',
      html: `<div style="position:relative;width:${size}px;height:${size}px;opacity:${isOffline ? 0.5 : 1}">` +
        `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="transform:rotate(${bearing}deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));transition:transform 0.3s ease">` +
        `<path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="${color}" stroke="white" stroke-width="1.5"/>` +
        `</svg>` +
        (selected ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:10px;height:10px;background:white;border-radius:50%;box-shadow:0 0 4px ${color}"></div>` : '') +
        (status === 'moving' ? `<div style="position:absolute;top:-4px;right:-4px;width:8px;height:8px;background:${color};border-radius:50%;border:1.5px solid white;animation:pulse 2s infinite"></div>` : '') +
        `</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }, []);

  const tile = TILE_LAYERS[activeLayer];

  const sosCount = Object.keys(sosMap).length;

  return (
    <div style={{ height: '100%', minHeight: 400, position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #DADCE0', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
      {/* GPS Source Status */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: '6px 12px', background: Object.keys(vehiclePositions).length > 0 ? 'rgba(236,253,245,0.95)' : 'rgba(255,251,235,0.95)',
        borderBottom: '1px solid ' + (Object.keys(vehiclePositions).length > 0 ? '#A7F3D0' : '#FDE68A'),
        fontSize: 11, fontFamily: "'Roboto', sans-serif", color: Object.keys(vehiclePositions).length > 0 ? '#059669' : '#B45309',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: Object.keys(vehiclePositions).length > 0 ? '#10B981' : '#F59E0B', animation: Object.keys(vehiclePositions).length > 0 ? 'pulse 2s infinite' : 'none' }} />
        {Object.keys(vehiclePositions).length > 0
          ? `LIVE tracking active — ${Object.keys(vehiclePositions).length} vehicle(s) streaming real GPS over WebSocket`
          : 'No live GPS stream right now — markers show the last verified GPS fix (STALE/OFFLINE by age), never presented as live'
        }
      </div>

      <MapContainer center={mapCenter} zoom={7} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
        <ResilientTileLayer url={tile.url} attribution="&copy; OpenStreetMap" key={activeLayer} />

        {/* Rainfall / flood heatmap from real district observations */}
        {heatMode !== 'off' && (
          <RiskHeatLayer
            points={heatMode === 'rain' ? heatData.rain : heatData.flood}
            mode={heatMode}
          />
        )}
        <MapZoomControls position="top-right" compact />
        <ScaleControl position="bottomright" imperial={false} />
        <MapCtrl center={mapCenter} />

        {/* GPS Trails */}
        {Object.entries(vehicleTrails).map(([vid, trail]) => {
          if (trail.length < 2) return null;
          const v = vehicleList.find(v => v.id === vid);
          const color = getStatusColor(v?.statusClass || 'offline');
          return (
            <Polyline
              key={'trail-' + vid}
              positions={trail.map(p => [p.lat, p.lng])}
              pathOptions={{ color, weight: 2, opacity: 0.4, dashArray: '6, 4', lineCap: 'round' }}
            />
          );
        })}

        {/* Planned road route for the SELECTED vehicle: live GPS → destination */}
        {liveRouteGeom && (
          <>
            <Polyline
              positions={liveRouteGeom}
              pathOptions={{ color: liveRiskColor, weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round', className: 'raahi-route-flow' }}
            >
              <Tooltip sticky>
                <span style={{ fontSize: 10, fontWeight: 600 }}>
                  Route to {liveRoute?.destination?.name || liveRoute?.trip?.destination || 'destination'}
                  {' | '}{liveRoute?.totalDistanceKm ?? '--'} km | risk {liveRisk ?? '--'}/100
                </span>
              </Tooltip>
            </Polyline>
            {liveRoute?.destination && liveRoute.destination.lat != null && liveRoute.destination.lng != null && (
              <Marker
                position={[liveRoute.destination.lat, liveRoute.destination.lng]}
                icon={L.divIcon({ className: '', html: '<div style="width:20px;height:20px;border-radius:50%;background:#DC2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })}
              >
                <Popup>
                  <div style={{ fontFamily: "'Roboto', sans-serif", minWidth: 200, fontSize: 11 }}>
                    <strong>{liveRoute.destination.name || 'Destination'}</strong>
                    <div style={{ color: '#6B7280', marginTop: 2 }}>
                      Trip {liveRoute?.trip?.id || ''} · {liveRoute?.trip?.status || ''}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      Distance to go: <strong>{liveRoute?.totalDistanceKm ?? '--'} km</strong><br />
                      Route risk: <strong style={{ color: liveRiskColor }}>{liveRisk ?? '--'}/100</strong>
                      {liveRoute?.etaLabel && (
                        <div style={{ marginTop: 2 }}>
                          ETA: <strong>{liveRoute.etaLabel}</strong>
                          {liveRoute.trafficDelayMinutes > 0 && <span style={{ color: '#B45309' }}> (+{liveRoute.trafficDelayMinutes} min traffic)</span>}
                        </div>
                      )}
                      <div style={{ color: '#6B7280', fontSize: 9, marginTop: 4 }}>
                        {liveRoute?.routingProvider === 'osrm' ? 'via OSRM road network' : liveRoute?.routingProvider === 'tomtom' ? 'via TomTom road network' : liveRoute?.routingProvider === 'mappls' ? 'via Mappls roads' : liveRoute?.routingProvider ? 'via ' + liveRoute.routingProvider : ''}
                      </div>
                      {(liveRoute?.legs || []).length > 0 && (
                        <div style={{ marginTop: 6, borderTop: '1px solid #E5E7EB', paddingTop: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                            <span>Leg-by-leg conditions</span>
                            <span>{liveRoute.legs.length} leg{liveRoute.legs.length === 1 ? '' : 's'}</span>
                          </div>
                          <div style={{ maxHeight: 190, overflowY: 'auto', paddingRight: 2 }}>
                            {liveRoute.legs.map((leg, i) => {
                              const lc = leg.riskLevel === 'critical' ? '#EF4444' : leg.riskLevel === 'high' ? '#F97316' : leg.riskLevel === 'medium' ? '#F59E0B' : '#10B981';
                              const rc = String(leg.roadCondition || 'good').toLowerCase();
                              const roadColor = rc === 'blocked' ? '#DC2626' : rc === 'damaged' ? '#F59E0B' : '#10B981';
                              const flood = floodDisplay(leg.floodRisk);
                              const legTraffic = leg.traffic || {};
                              const lg = legTraffic.congestionLevel || leg.congestionLevel || null;
                              const lgDelay = legTraffic.delaySeconds != null ? legTraffic.delaySeconds : null;
                              const lgTravel = legTraffic.travelTimeSeconds != null ? Math.round(legTraffic.travelTimeSeconds / 60) : null;
                              const lgColor = CONGESTION_COLORS[lg] || (lg === 'blocked' ? '#DC2626' : lg === 'high' ? '#F97316' : lg === 'medium' ? '#F59E0B' : '#6B7280');
                              return (
                                <div key={i} style={{ borderBottom: '1px solid #F3F4F6', padding: '3px 0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 9 }}>
                                    <span style={{ color: '#374151', fontWeight: 700 }}>{leg.label}</span>
                                    <span style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>
                                      {leg.distanceKm != null ? `${leg.distanceKm} km` : '—'}
                                      {leg.osrmDurationText ? ` · ~${leg.osrmDurationText}` : ''}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 8.5, color: '#6B7280', paddingLeft: 2, lineHeight: 1.5 }}>
                                    risk <span style={{ color: lc, fontWeight: 700 }}>{leg.riskScore}/100</span>
                                    <span> · road <span style={{ color: roadColor, fontWeight: 700 }}>{String(leg.roadCondition || 'good').replace(/_/g, ' ')}</span></span>
                                    {flood && flood.label !== 'None' && flood.label !== 'No data' && (
                                      <span> · flood <span style={{ color: flood.color, fontWeight: 700 }}>{flood.label}</span></span>
                                    )}
                                    {leg.rainfallMm != null && <span> · <span style={{ color: '#0284C7', fontWeight: 700 }}>{leg.rainfallMm}mm rain</span></span>}
                                    {leg.landslideRisk && leg.landslideRisk !== 'Low' && leg.landslideRisk !== 'Very Low' && (
                                      <span> · <span style={{ color: '#D97706', fontWeight: 700 }}>landslide {leg.landslideRisk}</span></span>
                                    )}
                                    {lg && (
                                      <span> · traffic <span style={{ color: lgColor, fontWeight: 700 }}>{lg}</span>
                                        {lgDelay != null && lgDelay > 0 && <span> (+{Math.round(lgDelay / 60)} min)</span>}
                                        {lgTravel != null && <span> · ~{lgTravel} min travel</span>}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </>
        )}

        {/* Vehicle Markers with Smooth Animation */}
        {vehicleList.filter(v => v.lat && v.lng).map(v => {
          const display = getVehicleDisplayData(v);
          const isSelected = selectedVehicleId === v.id;
          const color = getStatusColor(display.status);
          const accuracyBadge = getAccuracyBadge(display.accuracyRating);
          const ageLabel = formatAge(display.timestamp);
          const sos = sosMap[v.id];

          return (
            <React.Fragment key={v.id}>
              {isSelected && (
                <CircleMarker
                  center={[display.lat, display.lng]}
                  radius={24}
                  fillColor={color}
                  fillOpacity={0.08}
                  color={color}
                  weight={1.5}
                  dashArray="4, 4"
                />
              )}
              <Marker
                position={[display.lat, display.lng]}
                icon={createVehicleMarkerIcon(display.status, display.bearing, isSelected, sos)}
                zIndexOffset={sos ? 2000 : isSelected ? 1000 : 500}
                eventHandlers={{
                  click: () => onSelectVehicle && onSelectVehicle(v.id),
                }}
              >
                <Popup maxWidth={320} minWidth={260}>
                  <div style={{ fontFamily: "'Roboto', sans-serif", padding: '4px 0' }}>
                    {sos && (
                      <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 6, background: '#FEF2F2', border: '1.5px solid #DC2626', animation: 'sosBlink 1.6s ease-in-out infinite' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 12, color: '#991B1B' }}>
                          <AlertTriangle size={13} />
                          🚨 SOS ACTIVE — {sos.driver || 'Driver'} ({v.id})
                        </div>
                        {sos.reason && <div style={{ fontSize: 11, color: '#7F1D1D', marginTop: 3 }}>Reason: {sos.reason}</div>}
                        <div style={{ fontSize: 10, color: '#B91C1C', marginTop: 3 }}>
                          {sos.since ? `Since ${new Date(sos.since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          {sos.lat != null && ` · ${Number(sos.lat).toFixed(5)}, ${Number(sos.lng).toFixed(5)}`}
                        </div>
                      </div>
                    )}
                    {/* Header with status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1F2937' }}>
                          {v.id}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                          {v.model || ''} • {v.driver || 'Unassigned'}
                        </div>
                      </div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                        background: getStatusColor(display.status) + '18',
                        color: getStatusColor(display.status),
                        border: `1px solid ${getStatusColor(display.status)}40`,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: getStatusColor(display.status) }} />
                        {getStatusLabel(display.status)}
                      </span>
                    </div>

                    {/* GPS Quality Badge */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                        background: accuracyBadge.bg, color: accuracyBadge.color,
                        border: `1px solid ${accuracyBadge.color}30`,
                      }}>
                        <Signal size={10} />
                        GPS: {accuracyBadge.label}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                        background: '#F3F4F6', color: '#374151',
                      }}>
                        <Clock size={10} />
                        {ageLabel}
                      </span>
                    </div>

                    {/* Vehicle Data Grid */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px',
                      padding: '8px', background: '#F9FAFB', borderRadius: 6, border: '1px solid #E5E7EB',
                      fontSize: 11,
                    }}>
                      <div>
                        <span style={{ color: '#9CA3AF', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Speed</span>
                        <div style={{ fontWeight: 600, color: '#1F2937' }}>{Math.round(display.speed)} km/h</div>
                      </div>
                      <div>
                        <span style={{ color: '#9CA3AF', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Heading</span>
                        <div style={{ fontWeight: 600, color: '#1F2937' }}>
                          {display.direction || '—'} ({Math.round(display.bearing || 0)}°)
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#9CA3AF', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ETA</span>
                        <div style={{ fontWeight: 600, color: display.eta ? '#059669' : '#9CA3AF' }}>
                          {display.eta || 'N/A'}
                          {display.etaMinutes ? ` (${display.etaMinutes} min)` : ''}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: '#9CA3AF', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fuel</span>
                        <div style={{ fontWeight: 600, color: '#1F2937' }}>{display.batteryLevel || v.fuel || '—'}</div>
                      </div>
                      {display.distanceRemaining != null && (
                        <div>
                          <span style={{ color: '#9CA3AF', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distance Left</span>
                          <div style={{ fontWeight: 600, color: '#1F2937' }}>{display.distanceRemaining} km</div>
                        </div>
                      )}
                      <div>
                        <span style={{ color: '#9CA3AF', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coordinates</span>
                        <div style={{ fontWeight: 500, color: '#6B7280', fontSize: 10 }}>
                          {display.lat.toFixed(4)}, {display.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>

                    {/* Route Info */}
                    {(display.route || display.currentRoute) && (
                      <div style={{
                        marginTop: 8, padding: '6px 8px', background: '#EFF6FF', borderRadius: 4,
                        fontSize: 10, color: '#1E40AF', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <MapPin size={12} />
                        Route: {display.route || display.currentRoute}
                      </div>
                    )}

                    {/* Animation indicator */}
                    {display.animating && (
                      <div style={{
                        marginTop: 6, fontSize: 9, color: '#6B7280',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3B82F6', animation: 'pulse 1s infinite' }} />
                        Smooth animation in progress
                      </div>
                    )}
                  </div>
                </Popup>
                <Tooltip permanent={isSelected} direction="top" offset={[0, -14]}>
                  <span style={{ fontSize: 9, fontWeight: 600, background: color, color: 'white', padding: '1px 5px', borderRadius: 3 }}>
                    {v.id} | {Math.round(display.speed)} km/h
                  </span>
                </Tooltip>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Layer Control */}
      <div style={{ position: 'absolute', top: 36, right: 10, zIndex: 1000 }}>
        <button onClick={() => setLayerOpen(!layerOpen)} style={{ width: 36, height: 36, background: 'white', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layers size={18} color="#333" />
        </button>
        {layerOpen && (
          <div style={{ position: 'absolute', top: 42, right: 0, width: 130, background: 'white', borderRadius: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            {Object.entries(TILE_LAYERS).map(([key, layer]) => (
              <button key={key} onClick={() => { setActiveLayer(key); setLayerOpen(false); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: activeLayer === key ? '#E8F0FE' : 'white', cursor: 'pointer', fontSize: 12, color: activeLayer === key ? '#1A73E8' : '#333', fontWeight: activeLayer === key ? 600 : 400, borderBottom: '1px solid #F1F3F4' }}>
                {layer.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Heat toggle: Off → Rain → Flood */}
      <div style={{ position: 'absolute', top: 78, right: 10, zIndex: 1000 }}>
        <button onClick={() => setHeatMode((m) => (m === 'off' ? 'rain' : m === 'rain' ? 'flood' : 'off'))}
          style={{ height: 36, background: heatMode === 'off' ? 'white' : heatMode === 'rain' ? '#2563EB' : '#EA580C', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer', padding: '0 10px', fontSize: 11, fontWeight: 700, color: heatMode === 'off' ? '#333' : 'white', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: heatMode === 'rain' ? '#93C5FD' : heatMode === 'flood' ? '#FED7AA' : 'linear-gradient(135deg,#38BDF8,#EA580C)' }} />
          Heat: {heatMode === 'off' ? 'OFF' : heatMode === 'rain' ? 'Rain' : 'Flood'}
        </button>
      </div>

      {/* Selected vehicle: planned road route panel */}
      {selectedVehicleId && (routeLoading || liveRoute) && (
        <div style={{ position: 'absolute', top: 44, left: 10, zIndex: 1000, background: 'rgba(255,255,255,0.97)', borderRadius: 6, boxShadow: '0 1px 5px rgba(0,0,0,0.25)', padding: '8px 12px', fontSize: 11, maxWidth: 260, fontFamily: "'Roboto', sans-serif" }}>
          {routeLoading && !liveRoute ? (
            <span style={{ color: '#059669', fontWeight: 600 }}>Planning route to destination...</span>
          ) : liveRoute?.hasRoute ? (
            <div>
              <div style={{ fontWeight: 700, color: '#1F2937', marginBottom: 2 }}>
                {liveRoute?.destination?.name || 'Destination'}
              </div>
              <div style={{ color: '#6B7280', lineHeight: 1.6 }}>
                <span style={{ fontWeight: 600 }}>{liveRoute?.totalDistanceKm ?? '--'} km to go</span>
                {' | risk '}<span style={{ fontWeight: 700, color: liveRiskColor }}>{liveRisk ?? '--'}/100</span>
                {liveRoute?.etaLabel && (
                  <div>ETA: <span style={{ fontWeight: 700, color: '#1F2937' }}>{liveRoute.etaLabel}</span>
                    {liveRoute.etaMinutes != null && ` (in ${Math.round(liveRoute.etaMinutes)} min)`}
                    {liveRoute.trafficDelayMinutes > 0 && <span style={{ color: '#B45309' }}> · +{liveRoute.trafficDelayMinutes} min traffic</span>}
                  </div>
                )}
                {liveRoute?.trip?.id && <div>Trip {liveRoute.trip.id} · {liveRoute.trip.status}</div>}
                {liveRoute?.gpsStart && <div style={{ fontSize: 9, color: '#059669' }}>starts at live GPS position</div>}
              </div>
              {(liveRoute?.alerts || []).slice(0, 2).map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'flex-start', marginTop: 4, padding: '4px 6px', borderRadius: 4, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 10, color: '#991B1B' }}>
                  <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{a.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <span style={{ color: '#6B7280' }}>
              {liveRoute?.reason === 'NO_ACTIVE_TRIP'
                ? 'No active trip for this vehicle - route will appear once a trip is in transit.'
                : 'No road route available for this vehicle right now.'}
            </span>
          )}
        </div>
      )}

      {/* Status Legend */}
      <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 1000, background: 'rgba(255,255,255,0.95)', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.3)', padding: '6px 10px', fontSize: 10 }}>
        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vehicle Status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
          {[{ s: 'moving', l: 'Moving' }, { s: 'stopped', l: 'Stopped' }, { s: 'delayed', l: 'Delayed' }, { s: 'offline', l: 'Offline' }, { s: 'stale', l: 'Stale GPS' }].map(item => (
            <span key={item.s} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(item.s), display: 'inline-block' }} />
              {item.l}
            </span>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 4, paddingTop: 4, display: 'flex', gap: '2px 10px' }}>
          {[{ r: 'high', l: 'High' }, { r: 'medium', l: 'Med' }, { r: 'low', l: 'Low' }].map(item => (
            <span key={item.r} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Signal size={8} color={getAccuracyBadge(item.r).color} />
              GPS: {item.l}
            </span>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 4, paddingTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 3, borderRadius: 2, background: liveRiskColor, display: 'inline-block' }} />
          Planned route (selected vehicle, colored by risk)
        </div>
        {sosCount > 0 && (
          <div style={{ borderTop: '1px solid #FECACA', marginTop: 4, paddingTop: 4, display: 'flex', alignItems: 'center', gap: 5, color: '#991B1B', fontWeight: 700 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#DC2626', display: 'inline-block', animation: 'pulse 1.4s infinite' }} />
            {sosCount} vehicle{sosCount === 1 ? '' : 's'} in SOS — tap marker for details
          </div>
        )}
      </div>

      {/* SOS count badge */}
      {sosCount > 0 && (
        <div style={{ position: 'absolute', top: 36, left: 10, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 6, background: '#DC2626', color: '#fff', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 10px rgba(220,38,38,0.5)', animation: 'sosBlink 1.6s ease-in-out infinite' }}>
          <AlertTriangle size={13} />
          🚨 {sosCount} SOS ACTIVE
        </div>
      )}

      {/* Vehicle Count */}
      <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 1000, background: 'rgba(255,255,255,0.95)', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.3)', padding: '6px 10px', fontSize: 10, color: '#5F6368' }}>
        {vehicleList.length} vehicles | {Object.keys(vehiclePositions).length} with live tracking
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes sosPing { 0%{transform:scale(0.7);opacity:0.9} 70%{transform:scale(1.4);opacity:0} 100%{transform:scale(1.4);opacity:0} }
        @keyframes sosBlink { 0%,100%{box-shadow:0 2px 10px rgba(220,38,38,0.5)} 50%{box-shadow:0 2px 18px rgba(220,38,38,0.95)} }
        .leaflet-popup-content-wrapper { border-radius: 8px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important; }
        .leaflet-popup-content { margin: 12px 16px !important; line-height: 1.4 !important; }
        .leaflet-popup-tip { background: white !important; box-shadow: none !important; }
        .leaflet-bar { box-shadow: 0 1px 4px rgba(0,0,0,0.3) !important; border: none !important; }
        .leaflet-bar a { border: none !important; color: #333 !important; width: 30px !important; height: 30px !important; line-height: 30px !important; }
        .leaflet-bar a:hover { background-color: #f1f3f4 !important; }
        .leaflet-control-scale-line { background: rgba(255,255,255,0.9) !important; border-color: #999 !important; font-size: 10px !important; }
      `}</style>
    </div>
  );
};
