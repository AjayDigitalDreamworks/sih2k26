import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MapContainer, Polyline, Marker, Popup, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Plus, Minus, Target, MapPin, CloudRain, ChevronDown, Crosshair, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ResilientTileLayer } from '../admin/common/ResilientTileLayer';
import { RiskHeatLayer } from '../admin/common/RiskHeatLayer';
import ApiClient from '../../lib/api';
import { subscribeToVehiclePositions, subscribeToEmergency, subscribeToEmergencyCancelled, subscribeToDynamicReroute } from '../../lib/socket';
import { DISTRICTS } from '../../data/geoMaster';
import { VehicleMarker } from '../admin/common/VehicleMarker';
import RainRadarOverlay from '../admin/common/RainRadarOverlay';

// Keyless Esri basemaps (no API key, no placeholder tiles).
const TILE_LAYERS = {
  streets: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', name: 'Streets', attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS User Community', maxNativeZoom: 16 },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', name: 'Satellite', attribution: '&copy; Esri, Maxar, Earthstar Geographics', maxNativeZoom: 17 },
  dark: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', name: 'Dark', attribution: '&copy; Esri — World Dark Gray Canvas', maxNativeZoom: 15 },
};

const RISK_COLORS = { critical: '#7F1D1D', high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
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

const districtIcon = (color) =>
  L.divIcon({
    className: '',
    html: `<div style="width:11px;height:11px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    iconSize: [11, 11],
    iconAnchor: [5.5, 5.5],
  });

const destIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#DC2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// One-time per-session caches (real data, just avoiding duplicate fetches)
const liveRouteCache = new Map(); // vehicleId -> { at, data }
const trafficCache = new Map();   // routeKey -> { at, data }

function MapEventsCoords({ onMove }) {
  useMapEvents({
    mousemove: (e) => onMove(e.latlng),
    mouseout: () => onMove(null),
  });
  return null;
}

function MapMinimap({ mapRef, tile }) {
  const divRef = useRef(null);
  const stateRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    let cleaned = false;
    const teardown = () => {
      if (cleaned) return;
      cleaned = true;
      const s = stateRef.current;
      stateRef.current = null;
      if (!s) return;
      s.main?.off('move zoom', s.sync);
      if (s.rect) s.rect.remove();
      if (s.mini) s.mini.remove();
    };
    const boot = () => {
      if (cancelled) return;
      const main = mapRef.current;
      const el = divRef.current;
      // Zero-size guard: never create the mini map until it has real pixels.
      if (!main || !el || !el.offsetWidth || !el.offsetHeight || stateRef.current) { if (!cancelled) setTimeout(boot, 200); return; }
      let mini;
      try {
        mini = L.map(el, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          dragging: false,
          doubleClickZoom: false,
          boxZoom: false,
          touchZoom: false,
          keyboard: false,
        });
      } catch { if (!cancelled) setTimeout(boot, 200); return; }
      L.tileLayer(tile.url, { attribution: '' }).addTo(mini);

      const rect = L.rectangle(main.getBounds(), {
        color: '#059669',
        weight: 1.5,
        opacity: 0.85,
        fillOpacity: 0.06,
      }).addTo(mini);

      let rafId = null;
      const sync = () => {
        if (!main || !mini || cancelled) return;
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          if (cancelled || !stateRef.current?.mini) return;
          try {
            const center = main.getCenter();
            const targetZoom = Math.max(1, Math.min(12, Math.round(main.getZoom()) - 5));
            mini.setView(center, targetZoom, { animate: false });
            if (stateRef.current?.rect) {
              stateRef.current.rect.setBounds(main.getBounds());
            }
          } catch {
            /* ignore transient leaflet transition states */
          }
        });
      };

      stateRef.current = { mini, rect, main, sync, teardown };
      main.on('move zoom', sync);
      mini.on('click', (e) => {
        if (main && e?.latlng) main.panTo(e.latlng);
      });
      sync();
    };
    boot();
    return () => { cancelled = true; teardown(); };
  }, [mapRef, tile.url]);
  return <div ref={divRef} style={{ position: 'absolute', top: 10, left: 10, zIndex: 980, width: 148, height: 108, borderRadius: 6, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.9)', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', background: '#E8EAED' }} />;
}

const ageStatus = (iso) => {
  if (!iso) return null;
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'LIVE';
  if (s < 300) return 'STALE';
  return 'OFFLINE';
};

const hhmm = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function FlyToSelected({ target, routeGeom }) {
  const map = useMap();
  const prevIdRef = useRef(null);
  const prevPosRef = useRef(null);
  const fittedRouteRef = useRef(null);

  useEffect(() => {
    if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lng)) {
      prevIdRef.current = null;
      fittedRouteRef.current = null;
      return;
    }
    const isNew = prevIdRef.current !== target.id;
    prevIdRef.current = target.id;

    if (routeGeom && routeGeom.length > 1 && fittedRouteRef.current !== routeGeom) {
      fittedRouteRef.current = routeGeom;
      try {
        const bounds = L.latLngBounds(routeGeom);
        bounds.extend([target.lat, target.lng]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14, animate: true, duration: 0.8 });
        prevPosRef.current = [target.lat, target.lng];
        return;
      } catch {}
    }

    if (isNew) {
      try {
        map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
        prevPosRef.current = [target.lat, target.lng];
      } catch {}
      return;
    }

    // Follow moving vehicle
    const prev = prevPosRef.current;
    if (!prev || Math.abs(prev[0] - target.lat) > 0.0001 || Math.abs(prev[1] - target.lng) > 0.0001) {
      prevPosRef.current = [target.lat, target.lng];
      try {
        map.panTo([target.lat, target.lng], { animate: true, duration: 0.5 });
      } catch {}
    }
  }, [target, target?.lat, target?.lng, routeGeom, map]);

  return null;
}

// Applies the zoom/center button ticks to the real Leaflet map (guarded so
// a zero-size or not-yet-ready map never crashes).
function MapControlsTicks({ zoomInTick, zoomOutTick, centerTick, centerPos }) {
  const map = useMap();
  useEffect(() => {
    if (zoomInTick <= 0) return;
    try { if (map.getSize().x >= 10) map.zoomIn(); } catch { /* noop */ }
  }, [zoomInTick, map]);
  useEffect(() => {
    if (zoomOutTick <= 0) return;
    try { if (map.getSize().x >= 10) map.zoomOut(); } catch { /* noop */ }
  }, [zoomOutTick, map]);
  useEffect(() => {
    if (centerTick <= 0) return;
    try {
      if (map.getSize().x < 10) return;
      if (Array.isArray(centerPos) && centerPos.length === 2 && Number.isFinite(centerPos[0]) && Number.isFinite(centerPos[1])) {
        map.flyTo(centerPos, Math.max(map.getZoom(), 8), { duration: 0.8 });
      }
    } catch { /* noop */ }
  }, [centerTick, map, centerPos]);
  return null;
}

export default function LiveTrackingMap({ embedded = false, selectedId, onSelect }) {
  const mapRef = useRef(null);
  const isControlled = selectedId !== undefined;
  const [localSel, setLocalSel] = useState(null);
  const selId = isControlled ? selectedId : localSel;
  const [zoomIn, setZoomIn] = useState(0);
  const [zoomOut, setZoomOut] = useState(0);
  const [centerT, setCenterT] = useState(0);
  const [activeLayer, setActiveLayer] = useState('streets');
  const [radarOn, setRadarOn] = useState(true);
  const [radarState, setRadarState] = useState('off'); // off | loading | live | unavailable
  const [radarMeta, setRadarMeta] = useState(null);
  const [heatMode, setHeatMode] = useState('off'); // off | rain | flood
  const [legendOpen, setLegendOpen] = useState(true);

  const [vehicles, setVehicles] = useState([]);   // real fleet rows (server live fields)
  const [live, setLive] = useState({});           // id -> latest socket fix
  const [weatherMap, setWeatherMap] = useState({});
  const [districtSummary, setDistrictSummary] = useState([]); // real rainfall/flood per district

  // Real rainfall/flood heat points from the district summary (real observations).
  const heatData = useMemo(() => {
    const rows = Array.isArray(districtSummary) ? districtSummary : [];
    const toPoint = (d) => {
      const c = d?.coordinates;
      if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') return null;
      return { lat: c.lat, lng: c.lng };
    };
    return {
      rain: rows
        .map((d) => ({ ...toPoint(d), intensity: Math.min(1, (Number(d?.rainfall_mm) || 0) / 80) }))
        .filter((p) => p.lat != null && (Number(p.intensity) || 0) > 0.05),
      flood: rows
        .map((d) => ({ ...toPoint(d), intensity: Math.min(1, (Number(d?.flood_risk_level) || 0) / 65) }))
        .filter((p) => p.lat != null && (Number(p.intensity) || 0) > 0.05),
    };
  }, [districtSummary]);
  const [liveRoutes, setLiveRoutes] = useState({}); // vehicleId -> { coords, destName, score, level, distanceKm }
  const [trafficByRoute, setTrafficByRoute] = useState({});
  const [cursorLatLng, setCursorLatLng] = useState(null);
  const [reroutingId, setReroutingId] = useState(null);

  const handleRecalculateRoute = async (vehicleId) => {
    if (!vehicleId) return;
    setReroutingId(vehicleId);
    try {
      const res = await ApiClient.rerouteVehicle(vehicleId, {
        reason: 'Operator triggered dynamic detour calculation',
        forceAlternative: true,
      });
      if (res?.success && res.data) {
        toast.success(`Dynamic detour recalculated for ${vehicleId}!`);
        const d = res.data;
        if (d.geometry && d.geometry.length > 1) {
          setLiveRoutes((prev) => ({
            ...prev,
            [vehicleId]: {
              ...(prev[vehicleId] || {}),
              coords: d.geometry,
              rerouted: true,
              rerouteReason: d.rerouteReason || 'Dynamic reroute: bypassing hazard via alternate corridor',
            },
          }));
        }
      } else {
        toast.error(res?.message || 'Could not recalculate route.');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to recalculate route.');
    } finally {
      setReroutingId(null);
    }
  };

  // Vehicles with an ACTIVE SOS (server-side truth, refreshed every 20s + live socket events).
  const [sosMap, setSosMap] = useState({});
  useEffect(() => {
    let alive = true;
    const apply = (list) => {
      if (!alive) return;
      const map = {};
      (list || []).forEach((e) => { if (e?.vehicleId) map[e.vehicleId] = e; });
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

  // Fleet (real rows with live_status / last_gps_at / heading / accuracy)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await ApiClient.getTransporterVehicles();
        if (mounted && res?.success) setVehicles(res.data || []);
      } catch (e) { console.warn('Fleet load failed:', e); }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // Live GPS fixes from the server socket (server is the source of truth)
  useEffect(() => {
    const unsub = subscribeToVehiclePositions((payload) => {
      const id = payload?.id || payload?.vehicleId;
      if (!id) return;
      setLive((prev) => ({ ...prev, [id]: payload }));
    });
    return () => unsub();
  }, []);

  // Weather + radar metadata refresh (3 min + tab visible)
  const fetchLayers = useCallback(async () => {
    const wx = await ApiClient.getAllWeather().catch(() => null);
    if (wx?.success && wx.data) setWeatherMap(wx.data);
    const sum = await ApiClient.getAllDistrictsSummary().catch(() => null);
    if (sum?.success && Array.isArray(sum.data)) setDistrictSummary(sum.data);
  }, []);
  useEffect(() => { fetchLayers(); }, [fetchLayers]);
  useEffect(() => {
    const i = setInterval(fetchLayers, 180000);
    const onVis = () => { if (document.visibilityState === 'visible') fetchLayers(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchLayers]);

  // Live routes: real OSRM road path from each vehicle's GPS to its trip destination
  const trackable = useMemo(
    () => vehicles.filter((v) => v.current_lat != null && v.current_lng != null && (v.current_trip_id || (v.tracking_active && v.current_route))),
    [vehicles]
  );
  useEffect(() => {
    if (!trackable.length) return undefined;
    let cancelled = false;
    const loadOne = async (v) => {
      const key = v.id;
      const cached = liveRouteCache.get(key);
      if (cached && Date.now() - cached.at < 60000) { if (!cancelled) setLiveRoutes((p) => ({ ...p, [key]: cached.data })); return; }
      try {
        const res = await ApiClient.getLiveRoute(v.id);
        const d = res?.data || {};
        if (d.hasRoute && Array.isArray(d.geometry) && d.geometry.length > 2) {
          const entry = {
            coords: d.geometry,
            destName: d.destination_district || d.destinationName || (d.destination && d.destination.name) || '',
            routeName: d.routeName || null,
            score: d.riskScore?.score ?? d.score ?? d.riskScore ?? null,
            level: d.riskScore?.level ?? d.riskLevel ?? null,
            distanceKm: d.distance_km ?? d.distanceKm ?? d.totalDistanceKm ?? null,
            legs: Array.isArray(d.legs) ? d.legs : [],
            provider: d.routingProvider || null,
            etaMinutes: d.etaMinutes ?? null,
            etaAt: d.etaAt ?? null,
            etaLabel: d.etaLabel ?? null,
            trafficDelayMinutes: d.trafficDelayMinutes ?? 0,
            rerouted: Boolean(d.rerouted),
            rerouteReason: d.rerouteReason || null,
            rerouteAlert: d.rerouteAlert || null,
          };
          liveRouteCache.set(key, { at: Date.now(), data: entry });
          if (!cancelled) setLiveRoutes((p) => ({ ...p, [key]: entry }));
        }
      } catch { /* keep previous */ }
    };
    trackable.forEach(loadOne);
    const iv = setInterval(() => trackable.forEach(loadOne), 60000);
    return () => { cancelled = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackable.length]);

  // Immediate route fetch for selected vehicle
  useEffect(() => {
    if (!selId) return;
    let alive = true;
    ApiClient.getLiveRoute(selId).then((res) => {
      if (!alive || !res?.data) return;
      const d = res.data;
      if (d.hasRoute && Array.isArray(d.geometry) && d.geometry.length > 1) {
        const entry = {
          coords: d.geometry,
          destName: d.destination_district || d.destinationName || (d.destination && d.destination.name) || '',
          routeName: d.routeName || null,
          score: d.riskScore?.score ?? d.score ?? d.riskScore ?? null,
          level: d.riskScore?.level ?? d.riskLevel ?? null,
          distanceKm: d.distance_km ?? d.distanceKm ?? d.totalDistanceKm ?? null,
          legs: Array.isArray(d.legs) ? d.legs : [],
          provider: d.routingProvider || null,
          etaMinutes: d.etaMinutes ?? null,
          etaAt: d.etaAt ?? null,
          etaLabel: d.etaLabel ?? null,
          trafficDelayMinutes: d.trafficDelayMinutes ?? 0,
          rerouted: Boolean(d.rerouted),
          rerouteReason: d.rerouteReason || null,
          rerouteAlert: d.rerouteAlert || null,
        };
        liveRouteCache.set(selId, { at: Date.now(), data: entry });
        setLiveRoutes((p) => ({ ...p, [selId]: entry }));
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [selId]);

  // Real-time Dynamic Reroute socket subscription (auto-updates when mid-transit hazard arises)
  useEffect(() => {
    const unsub = subscribeToDynamicReroute((data) => {
      if (!data || !data.vehicleId) return;
      if (Array.isArray(data.geometry) && data.geometry.length > 1) {
        const entry = {
          coords: data.geometry,
          destName: data.destinationName || '',
          routeName: data.routeName || 'Dynamic Safe Bypass',
          score: data.riskScore ?? null,
          level: data.riskLevel ?? null,
          distanceKm: data.totalDistanceKm ?? null,
          legs: Array.isArray(data.legs) ? data.legs : [],
          etaMinutes: data.etaMinutes ?? null,
          etaAt: data.etaAt ?? null,
          rerouted: true,
          rerouteReason: data.rerouteReason || null,
          rerouteAlert: data.rerouteAlert || null,
        };
        liveRouteCache.set(data.vehicleId, { at: Date.now(), data: entry });
        setLiveRoutes((p) => ({ ...p, [data.vehicleId]: entry }));
      }
    });
    return () => unsub();
  }, []);

  // Live traffic (TomTom) along each live route
  useEffect(() => {
    const routes = Object.values(liveRoutes);
    if (!routes.length) return undefined;
    let cancelled = false;
    const loadTraffic = async (key, coords) => {
      const cached = trafficCache.get(key);
      if (cached && Date.now() - cached.at < 240000) { if (!cancelled) setTrafficByRoute((p) => ({ ...p, [key]: cached.data })); return; }
      const a = coords[0]; const b = coords[coords.length - 1];
      try {
        const res = await ApiClient.getRouteTraffic({ origin_lat: a[0], origin_lng: a[1], dest_lat: b[0], dest_lng: b[1] });
        const data = res?.success ? res.data : { source: 'unavailable' };
        trafficCache.set(key, { at: Date.now(), data });
        if (!cancelled) setTrafficByRoute((p) => ({ ...p, [key]: data }));
      } catch { if (!cancelled) setTrafficByRoute((p) => ({ ...p, [key]: { source: 'unavailable' } })); }
    };
    routes.forEach((r, i) => loadTraffic(`route-${i}`, r.coords));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(liveRoutes).length]);

  // Markers: real fleet rows at their real coordinates
  const markers = useMemo(() => {
    return vehicles
      .map((v) => {
        const lp = live[v.id];
        const lat = lp?.lat ?? v.current_lat ?? null;
        const lng = lp?.lng ?? v.current_lng ?? null;
        if (lat == null || lng == null) return null;
        const liveStatus = lp?.liveStatus || v.live_status || ageStatus(v.last_gps_at) || 'OFFLINE';
        return {
          id: v.id,
          lat, lng,
          liveStatus,
          statusClass: String(liveStatus).toLowerCase(),
          heading: lp?.heading != null ? lp.heading : (v.current_heading > 0 ? v.current_heading : null),
          speedNum: lp?.speed != null ? lp.speed : (v.speed || 0),
          lastGpsAt: lp?.timestamp || v.last_gps_at || null,
          gpsSource: v.gps_source || (lp ? 'WEB_GPS' : null),
          model: v.model || '',
          driver: v.driver?.name || 'Unassigned',
          route: v.current_route || '',
          trackingActive: !!(v.tracking_active || lp),
        };
      })
      .filter(Boolean);
  }, [vehicles, live]);

  const selMarker = markers.find((m) => m.id === selId) || null;
  const handleSelect = (id) => {
    if (isControlled) { if (onSelect) onSelect(id); }
    else setLocalSel((prev) => (prev === id ? null : id));
  };

  const liveCount = markers.filter((m) => m.liveStatus === 'LIVE').length;
  const staleCount = markers.filter((m) => m.liveStatus === 'STALE').length;
  const offlineCount = markers.filter((m) => m.liveStatus === 'OFFLINE').length;
  const anyLiveTraffic = Object.values(trafficByRoute).some((t) => t?.source === 'tomtom');
  const weatherCount = Object.keys(weatherMap).length;
  const weatherSource = Object.values(weatherMap).find((w) => w && w.source)?.source || 'open-meteo';

  const tile = TILE_LAYERS[activeLayer];
  const centerPos = markers.length
    ? [markers.reduce((s, m) => s + m.lat, 0) / markers.length, markers.reduce((s, m) => s + m.lng, 0) / markers.length]
    : [26.3, 92.4];

  const radarLabel = radarState === 'live'
    ? `Rain radar: LIVE · observed ${radarMeta?.observedTime ? hhmm(radarMeta.observedTime) : '…'} · ${radarMeta?.frames || 0} frames`
    : radarState === 'loading' ? 'Rain radar: loading…'
    : 'Rain radar: UNAVAILABLE';

  const chip = (cls, txt) => (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs ${cls}`}>{txt}</span>
  );

  return (
    <div className={embedded ? '' : 'bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between h-full'}>
      {!embedded && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm sm:text-base font-extrabold text-[#0B1E36] tracking-tight">Live Tracking & GPS</h3>
          <span className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs">
            {markers.length} on map · {vehicles.length} in fleet
          </span>
        </div>
      )}

      <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-200/80 select-none bg-slate-100 z-0 ${embedded ? 'h-[520px] lg:h-[580px]' : 'h-[400px] sm:h-[450px] lg:h-[520px]'}`}>
        <MapContainer center={centerPos} zoom={7} maxZoom={19} zoomControl={false} scrollWheelZoom className="w-full h-full z-0" ref={mapRef}>
          <ResilientTileLayer key={activeLayer} url={tile.url} attribution={tile.attribution} maxNativeZoom={tile.maxNativeZoom || 16} maxZoom={19} />

          {/* Real precipitation coverage (RainViewer radar, keyless) */}
          {radarOn && <RainRadarOverlay onState={(s, meta) => { setRadarState(s); setRadarMeta(meta || null); }} opacity={0.5} />}

          {/* Rainfall / flood heatmap from real district observations */}
          {heatMode !== 'off' && (
            <RiskHeatLayer
              points={heatMode === 'rain' ? heatData.rain : heatData.flood}
              mode={heatMode}
            />
          )}

          <MapEventsCoords onMove={setCursorLatLng} />

          {/* District hubs (real coords, context) */}
          {DISTRICTS.map((d) => (
            <Marker key={d.id} position={[d.lat, d.lng]} icon={districtIcon(d.state === 'Assam' ? '#10B981' : '#8B5CF6')}>
              <Popup>
                <div className="text-xs min-w-[140px]">
                  <div className="font-black text-slate-900">{d.label}</div>
                  <p className="text-[10px] text-slate-500">{d.state} · {d.city}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Live routes: real OSRM road path from GPS to destination, colored by risk */}
          {Object.entries(liveRoutes).map(([vid, r], idx) => {
            const color = RISK_COLORS[r.level] || (r.score != null ? (r.score >= 60 ? '#EF4444' : r.score >= 30 ? '#F59E0B' : '#10B981') : '#2563EB');
            const showCasing = activeLayer === 'satellite' || activeLayer === 'dark';
            const traffic = trafficByRoute[`route-${idx}`];
            const mid = r.coords[Math.floor(r.coords.length / 2)];
            return (
              <React.Fragment key={`lr-${vid}`}>
                {showCasing && <Polyline positions={r.coords} pathOptions={{ color: 'rgba(255,255,255,0.85)', weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />}
                <Polyline
                  positions={r.coords}
                  pathOptions={{
                    color: r.rerouted ? '#D97706' : color,
                    weight: r.rerouted ? 5 : 4,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                    dashArray: r.rerouted ? '8, 6' : undefined,
                  }}
                >
                  <Popup>
                    <div className="text-xs min-w-[220px] max-w-[300px]">
                      <div className="font-black text-slate-900">{r.routeName || `${vid} live route`}</div>
                      {r.rerouted && (
                        <div className="mt-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1 border border-amber-300">
                          <span>⚠️ Dynamic Reroute: Safe Bypass Active</span>
                        </div>
                      )}
                      {r.rerouteReason && (
                        <p className="text-[10px] text-amber-700 font-semibold mt-0.5">{r.rerouteReason}</p>
                      )}
                      {r.destName && <p className="text-[10px] text-slate-600 font-semibold">→ {r.destName}</p>}
                      <p className="text-[10px] text-slate-500 mt-1">
                        Risk: <b style={{ color }}>{r.score != null ? `${r.score}/100 (${String(r.level || '').toUpperCase()})` : r.level ? String(r.level).toUpperCase() : '—'}</b>
                        {r.distanceKm != null && ` · ${Math.round(r.distanceKm)} km`}
                      </p>
                      {r.etaLabel && (
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          ETA: <b className="text-slate-900">{r.etaLabel}</b>
                          {r.etaMinutes != null && ` · in ${Math.round(r.etaMinutes)} min`}
                          {r.trafficDelayMinutes > 0 && <span className="text-amber-600"> · +{r.trafficDelayMinutes} min traffic</span>}
                        </p>
                      )}
                      {traffic?.source === 'tomtom' && (
                        <p className="text-[10px] text-slate-500">
                          Traffic: <b style={{ color: CONGESTION_COLORS[traffic.congestion_level] || '#6B7280' }}>{traffic.congestion_level}</b>
                          {traffic.traffic_delay_seconds != null && ` · delay ${Math.round(traffic.traffic_delay_seconds / 60)} min`}
                        </p>
                      )}
                      {r.legs.length > 0 && (
                        <div className="mt-1 border-t border-slate-200 pt-1">
                          <div className="flex items-center justify-between text-[9px] text-slate-400 font-extrabold uppercase tracking-wide mb-1">
                            <span>Leg-by-leg conditions</span>
                            <span>{r.legs.length} leg{r.legs.length === 1 ? '' : 's'}</span>
                          </div>
                          <div className="max-h-[190px] overflow-y-auto pr-1 space-y-1">
                            {r.legs.map((leg, i) => {
                              const lc = RISK_COLORS[leg.riskLevel] || (leg.riskScore != null ? (leg.riskScore >= 60 ? '#EF4444' : leg.riskScore >= 30 ? '#F59E0B' : '#10B981') : '#6B7280');
                              const rc = String(leg.roadCondition || 'good').toLowerCase();
                              const roadColor = rc === 'blocked' ? '#DC2626' : rc === 'damaged' ? '#F59E0B' : '#10B981';
                              // floodRisk may be a Google Flood Hub severity (0..4), a 0..100 risk
                              // score, or a label string — normalize via floodDisplay()
                              const flood = floodDisplay(leg.floodRisk);
                              const legTraffic = leg.traffic || {};
                              const lg = legTraffic.congestionLevel || leg.congestionLevel || null;
                              const lgDelay = legTraffic.delaySeconds != null ? legTraffic.delaySeconds : null;
                              const lgColor = CONGESTION_COLORS[lg] || (lg === 'blocked' ? '#DC2626' : lg === 'high' ? '#F97316' : lg === 'medium' ? '#F59E0B' : '#6B7280');
                              const lgTravel = legTraffic.travelTimeSeconds != null ? Math.round(legTraffic.travelTimeSeconds / 60) : null;
                              return (
                                <div key={i} className="text-[9px] text-slate-600 leading-tight border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                                  <div>
                                    <span style={{ color: lc }}>●</span> <span className="font-bold text-slate-700">{leg.label || leg.roadLabel}</span>
                                    <span className="text-slate-400"> · {leg.distanceKm != null ? `${leg.distanceKm} km` : '—'}</span>
                                    {leg.osrmDurationText && <span className="text-slate-400"> · ~{leg.osrmDurationText}</span>}
                                  </div>
                                  <div className="pl-3 text-slate-400">
                                    risk <span style={{ color: lc }}>{leg.riskScore != null ? `${leg.riskScore}/100` : '—'}</span>
                                    <span> · road <span style={{ color: roadColor }}>{String(leg.roadCondition || 'good').replace(/_/g, ' ')}</span></span>
                                    {flood && flood.label !== 'None' && flood.label !== 'No data' && <span> · flood <span style={{ color: flood.color }}>{flood.label}</span></span>}
                                    {leg.rainfallMm != null && <span> · <span className="text-sky-600">{leg.rainfallMm}mm rain</span></span>}
                                    {leg.landslideRisk && leg.landslideRisk !== 'Low' && leg.landslideRisk !== 'Very Low' && <span> · <span className="text-amber-600">landslide {leg.landslideRisk}</span></span>}
                                    {lg && (
                                      <span> · traffic <span style={{ color: lgColor }}>{lg}</span>
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
                      <p className="text-[9px] text-slate-400 mt-1">
                        Real {r.provider === 'tomtom' ? 'TomTom' : r.provider === 'mappls' ? 'Mappls' : 'OSRM'} road network · from live GPS
                      </p>
                    </div>
                  </Popup>
                </Polyline>
                {traffic?.source === 'tomtom' && (
                  <React.Fragment key={`t-${vid}`}>
                    <Polyline positions={r.coords} pathOptions={{ color: CONGESTION_COLORS[traffic.congestion_level] || '#9CA3AF', weight: 2.5, opacity: 0.85, dashArray: traffic.congestion_level === 'blocked' ? '4, 6' : undefined, lineCap: 'round', lineJoin: 'round' }} />
                    <CircleMarker center={mid} radius={6} pathOptions={{ color: 'white', weight: 2, fillColor: CONGESTION_COLORS[traffic.congestion_level] || '#9CA3AF', fillOpacity: 1 }}>
                      <Popup>
                        <div className="text-xs min-w-[160px]">
                          <div className="font-black text-slate-900">{vid} traffic</div>
                          <p className="text-[10px] text-slate-500">Congestion: <b style={{ color: CONGESTION_COLORS[traffic.congestion_level] }}>{traffic.congestion_level}</b></p>
                          <p className="text-[10px] text-slate-500">Delay: {Math.round((traffic.traffic_delay_seconds || 0) / 60)} min · Travel: {Math.round((traffic.travel_time_seconds || 0) / 60)} min</p>
                          <p className="text-[9px] text-slate-400 mt-1">Source: TomTom Traffic · live</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  </React.Fragment>
                )}
                {r.coords.length > 0 && (
                  <Marker position={r.coords[r.coords.length - 1]} icon={destIcon}>
                    <Popup>
                      <div className="text-xs min-w-[150px]">
                        <div className="font-black text-slate-900">{r.destName || 'Destination'}</div>
                        <p className="text-[10px] text-slate-500">Trip destination · real road route</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </React.Fragment>
            );
          })}

          {/* Real fleet vehicles (heading arrows, honest LIVE/STALE/OFFLINE) */}
          {markers.map((m) => (
            <VehicleMarker
              key={m.id}
              v={m}
              selected={m.id === selId}
              onSelect={() => handleSelect(m.id)}
              zIndexOffset={m.id === selId ? 1000 : m.liveStatus === 'LIVE' ? 800 : 500}
            />
          ))}

          {/* 🚨 Active SOS vehicles — big pulsing red markers on top of everything */}
          {Object.entries(sosMap).map(([vid, sos]) => {
            if (sos?.lat == null || sos?.lng == null) return null;
            return (
              <Marker
                key={'sos-' + vid}
                position={[Number(sos.lat), Number(sos.lng)]}
                zIndexOffset={3000}
                icon={L.divIcon({
                  className: '',
                  html: `<div style="position:relative;width:40px;height:40px">` +
                    `<span style="position:absolute;inset:-8px;border-radius:50%;background:rgba(220,38,38,0.35);animation:sosPing 1.4s ease-out infinite"></span>` +
                    `<span style="position:absolute;inset:0;border-radius:50%;background:#DC2626;border:3px solid #fff;box-shadow:0 0 16px rgba(220,38,38,0.95);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;animation:sosBlink 1.6s ease-in-out infinite">SOS</span>` +
                    `</div>`,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20],
                })}
              >
                <Popup maxWidth={300}>
                  <div className="text-xs" style={{ minWidth: 200 }}>
                    <div className="flex items-center gap-1.5 font-black text-red-700 text-sm mb-1">🚨 SOS ACTIVE</div>
                    <div className="text-slate-900 font-bold">{vid}{sos.model ? ` · ${sos.model}` : ''}</div>
                    <p className="text-[10px] text-slate-500">{sos.driver ? `Driver: ${sos.driver}` : 'Driver: unknown'}</p>
                    {sos.reason && <p className="text-[10px] text-red-700 font-semibold mt-1">Reason: {sos.reason}</p>}
                    {sos.since && <p className="text-[10px] text-slate-500 mt-1">Since {new Date(sos.since).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
                    {sos.route && <p className="text-[10px] text-slate-500 mt-0.5">Route: {sos.route}</p>}
                    <p className="text-[9px] text-slate-400 mt-1">Live coordinates · emergency alert sent to control room</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {selMarker && <FlyToSelected target={selMarker} routeGeom={liveRoutes[selId]?.coords} />}
          <MapControlsTicks zoomInTick={zoomIn} zoomOutTick={zoomOut} centerTick={centerT} centerPos={centerPos} />
          <MapMinimap mapRef={mapRef} tile={tile} />
        </MapContainer>

        {/* Chips row (top center) */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[900] flex items-center gap-1.5 flex-wrap justify-center max-w-[92%]">
          {weatherCount > 0 && chip('bg-emerald-50 text-emerald-700 border border-emerald-200', `Weather: LIVE (${weatherCount} districts · ${weatherSource})`)}
          {radarOn && (radarState === 'live' ? chip('bg-blue-50 text-blue-700 border border-blue-200', radarLabel) : radarState === 'loading' ? chip('bg-yellow-50 text-yellow-700 border border-yellow-200', radarLabel) : chip('bg-slate-100 text-slate-500 border border-slate-200', radarLabel))}
          {Object.keys(liveRoutes).length > 0 && (anyLiveTraffic ? chip('bg-orange-50 text-orange-600 border border-orange-200', 'Traffic: LIVE (TomTom)') : chip('bg-slate-100 text-slate-500 border border-slate-200', 'Traffic: estimating from ML risk'))}
          {markers.length > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs bg-slate-800/85 text-white border border-slate-700">
              {liveCount} LIVE · {staleCount} STALE · {offlineCount} OFFLINE
            </span>
          )}
          {Object.keys(sosMap).length > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs bg-red-600 text-white border border-red-400 animate-pulse">
              🚨 {Object.keys(sosMap).length} SOS ACTIVE
            </span>
          )}
          {Object.values(liveRoutes).some((r) => r?.rerouted) && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold shadow-xs bg-amber-500 text-slate-900 border border-amber-300 font-sans flex items-center gap-1 animate-pulse">
              ⚠️ DYNAMIC REROUTE ({Object.values(liveRoutes).filter((r) => r?.rerouted).length} ACTIVE)
            </span>
          )}
          {heatMode === 'rain' && chip('bg-blue-600/90 text-white border border-blue-400', `Rainfall heat: LIVE (${heatData.rain.length} districts)`)}
          {heatMode === 'flood' && chip('bg-orange-600/90 text-white border border-orange-400', `Flood heat: LIVE (${heatData.flood.length} districts)`)}
        </div>

        {/* Zoom / center controls */}
        <div className="absolute right-3 bottom-14 z-[800] flex flex-col gap-1.5">
          <button type="button" onClick={() => setZoomIn((c) => c + 1)} className="w-7 h-7 rounded-lg bg-white/95 shadow-xs border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 cursor-pointer" title="Zoom In"><Plus className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => setZoomOut((c) => c + 1)} className="w-7 h-7 rounded-lg bg-white/95 shadow-xs border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 cursor-pointer" title="Zoom Out"><Minus className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => setCenterT((c) => c + 1)} className="w-7 h-7 rounded-lg bg-white/95 shadow-xs border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 cursor-pointer" title="Center on fleet"><Target className="w-3.5 h-3.5" /></button>
        </div>

        {/* Basemap switcher */}
        <div className="absolute right-3 bottom-3 z-[800] flex gap-1">
          {Object.entries(TILE_LAYERS).map(([id, l]) => (
            <button key={id} type="button" onClick={() => setActiveLayer(id)}
              className={`px-2 py-1 rounded-md text-[9px] font-bold shadow-xs border cursor-pointer transition ${activeLayer === id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white/95 text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {l.name}
            </button>
          ))}
        </div>

        {/* Radar toggle */}
        <button type="button" onClick={() => setRadarOn((v) => !v)}
          className={`absolute right-3 top-3 z-[800] flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold shadow-xs border cursor-pointer ${radarOn ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/95 text-slate-500 border-slate-200'}`}
          title="Toggle rain radar">
          <CloudRain className="w-3 h-3" /> {radarOn ? 'Radar ON' : 'Radar OFF'}
        </button>

        {/* Heatmap toggle: Off → Rain → Flood */}
        <button
          type="button"
          onClick={() => setHeatMode((m) => (m === 'off' ? 'rain' : m === 'rain' ? 'flood' : 'off'))}
          className={`absolute left-3 top-3 z-[800] flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold shadow-xs border cursor-pointer ${heatMode === 'off' ? 'bg-white/95 text-slate-500 border-slate-200' : heatMode === 'rain' ? 'bg-blue-600 text-white border-blue-600' : 'bg-orange-600 text-white border-orange-600'}`}
          title="Rainfall / flood heatmap">
          <span className="w-3 h-3 rounded-full" style={{ background: heatMode === 'rain' ? '#2563EB' : heatMode === 'flood' ? '#EA580C' : 'linear-gradient(135deg,#38BDF8,#EA580C)' }} />
          Heat: {heatMode === 'off' ? 'OFF' : heatMode === 'rain' ? 'Rain' : 'Flood'}
        </button>

        {/* Coords readout */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[800] bg-white/95 rounded-lg px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-xs border border-slate-200">
          {cursorLatLng ? `${cursorLatLng.lat.toFixed(4)}, ${cursorLatLng.lng.toFixed(4)}` : '—'}
        </div>

        {/* Selected vehicle live-tracking card */}
        {selMarker && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[950] w-[min(92%,380px)] bg-white/97 backdrop-blur-md rounded-xl border border-slate-200 shadow-xl px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${selMarker.liveStatus === 'LIVE' ? 'bg-emerald-500 animate-pulse' : selMarker.liveStatus === 'STALE' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                <span className="font-black text-slate-900 text-xs">{selMarker.id}</span>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${selMarker.liveStatus === 'LIVE' ? 'bg-emerald-50 text-emerald-700' : selMarker.liveStatus === 'STALE' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{selMarker.liveStatus}</span>
                {selMarker.route && <span className="text-[9px] text-slate-500 font-semibold truncate">{selMarker.route}</span>}
              </div>
              <button type="button" onClick={() => handleSelect(selMarker.id)} className="text-slate-400 hover:text-slate-600 cursor-pointer flex-shrink-0" title="Deselect"><Crosshair className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[10px] text-slate-600">
              <span>Speed: <b>{Math.round(selMarker.speedNum)} km/h</b></span>
              <span>Heading: <b>{selMarker.heading != null ? `${Math.round(selMarker.heading)}°` : '—'}</b></span>
              <span>Driver: <b>{selMarker.driver}</b></span>
              <span>Last GPS: <b>{selMarker.lastGpsAt ? hhmm(selMarker.lastGpsAt) : '—'}</b></span>
              <span>Source: <b>{selMarker.gpsSource || '—'}</b></span>
              {liveRoutes[selMarker.id]?.etaLabel && (
                <span>ETA: <b className="text-emerald-700">{liveRoutes[selMarker.id].etaLabel}</b>
                  {liveRoutes[selMarker.id].trafficDelayMinutes > 0 && <span className="text-amber-600"> (+{liveRoutes[selMarker.id].trafficDelayMinutes} min)</span>}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-100">
              <span className="text-[9px] text-slate-400">Map centered · live heading</span>
              <button
                type="button"
                onClick={() => handleRecalculateRoute(selMarker.id)}
                disabled={reroutingId === selMarker.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                title="Trigger ML dynamic detour calculation"
              >
                <RefreshCw className={`w-3 h-3 text-amber-700 ${reroutingId === selMarker.id ? 'animate-spin' : ''}`} />
                <span>{reroutingId === selMarker.id ? 'Recalculating…' : 'Recalculate Route'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[800] bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 shadow-xs text-[10px] font-bold text-slate-600 overflow-hidden">
          <button type="button" onClick={() => setLegendOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
            <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-emerald-600" /> Legend</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${legendOpen ? '' : '-rotate-90'}`} />
          </button>
          {legendOpen && (
            <div className="px-3 pb-2 space-y-1.5">
              <div>
                <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Vehicles</div>
                <div className="flex flex-wrap gap-x-3 text-[9px] font-bold text-slate-600">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Live</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Stale</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Offline</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Routes (risk)</div>
                <div className="flex flex-wrap gap-x-3 text-[9px] font-bold text-slate-600">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Low</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Medium</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> High</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-900" /> Critical</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Traffic</div>
                <div className="flex flex-wrap gap-x-3 text-[9px] font-bold text-slate-600">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Free</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Moderate</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Congested</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-900" /> Blocked</span>
                </div>
              </div>
              <div className="text-[9px] text-slate-400">Blue overlay = live rain radar (RainViewer)</div>
              {Object.keys(sosMap).length > 0 && (
                <div className="pt-1 border-t border-red-100">
                  <div className="text-[9px] text-red-600 font-extrabold uppercase tracking-wide">Emergency</div>
                  <span className="flex items-center gap-1 text-[9px] font-bold text-red-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" /> SOS vehicle — tap marker for details
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes sosPing { 0%{transform:scale(0.7);opacity:0.9} 70%{transform:scale(1.45);opacity:0} 100%{transform:scale(1.45);opacity:0} }
        @keyframes sosBlink { 0%,100%{box-shadow:0 0 12px rgba(220,38,38,0.6)} 50%{box-shadow:0 0 22px rgba(220,38,38,1)} }
      `}</style>
    </div>
  );
}