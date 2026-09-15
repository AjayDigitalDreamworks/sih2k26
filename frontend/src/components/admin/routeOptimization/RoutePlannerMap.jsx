import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { MapZoomControls } from '@/components/admin/common/MapZoomControls';
import { ResilientTileLayer } from '@/components/admin/common/ResilientTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Sparkles, Loader2, AlertTriangle, ShieldCheck, Navigation, Gauge, RefreshCw, Route as RouteIcon, Search, Scale, AlertOctagon, Layers, Activity, ArrowLeftRight, Plus, Trash2, Truck, Fuel, Zap, DollarSign, CheckCircle2, Shield, User, UserPlus } from 'lucide-react';
import ApiClient from '@/lib/api';
import { DISTRICTS, districtById, findDistrictMatch } from '@/data/geoMaster';
import { useApp } from '@/contexts/AppContext';
import { MicroSegmentHeatmap } from './MicroSegmentHeatmap';
import AddDriverModal from '@/components/drivers/AddDriverModal';
import AddVehicleModal from '@/components/vehicles/AddVehicleModal';

const RISK_COLOR = { low: '#10B981', medium: '#F59E0B', high: '#F97316', critical: '#EF4444' };


function MapViewportSync({ points, fromD, toD, focusedPoint }) {
  const map = useMap();
  const lastFocusRef = useRef(null);

  useEffect(() => {
    if (focusedPoint && focusedPoint !== lastFocusRef.current) {
      lastFocusRef.current = focusedPoint;
      try {
        map.flyTo(focusedPoint, 14, { duration: 0.9 });
      } catch (_) {}
      return;
    }
    if (points && points.length > 1) {
      try {
        const bounds = L.latLngBounds(points);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          return;
        }
      } catch (_) {}
    }
    if (fromD && toD) {
      try {
        const bounds = L.latLngBounds([
          [fromD.lat, fromD.lng],
          [toD.lat, toD.lng],
        ]);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
      } catch (_) {}
    }
  }, [points, fromD, toD, focusedPoint, map]);
  return null;
}

const originIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#059669;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const destIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#DC2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const waypointIcon = (num) => L.divIcon({
  className: '',
  html: `<div style="width:24px;height:24px;border-radius:50%;background:#7C3AED;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(124,58,237,0.45);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1">${num}</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});
const vehicleGpsIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,0.4);display:flex;align-items:center;justify-content:center;font-size:14px">🚛</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export const RoutePlannerMap = ({
  plan: propPlan,
  onPlanChange,
  activeRouteId: propActiveRouteId,
  onSelectRoute: propOnSelectRoute,
  selectedDriverId: propSelectedDriverId,
  onSelectDriver: propOnSelectDriver,
  drivers: propDrivers,
  selectedVehicleId: propSelectedVehicleId,
  onSelectVehicle: propOnSelectVehicle,
  vehicles: propVehicles,
}) => {
  const { routePlannerInitialState, setRoutePlannerInitialState } = useApp() || {};
  const [fromId, setFromId] = useState('dabua_chowk');
  const [toId, setToId] = useState('aravali_college');
  const [stops, setStops] = useState([]); // [{ id, districtId, customAddress }]
  const [emergencyContext, setEmergencyContext] = useState(null);
  const [prefer, setPrefer] = useState('optimal');
  const [vehicleType, setVehicleType] = useState('heavy_multi_axle');
  const [cargoWeightKg, setCargoWeightKg] = useState(12000);
  const [searchMode, setSearchMode] = useState('hub'); // 'hub' | 'custom'
  const [customOrigin, setCustomOrigin] = useState('');
  const [customDest, setCustomDest] = useState('');
  const [reroutedBanner, setReroutedBanner] = useState(null);

  // Available Fleet Vehicle State
  const [vehicles, setVehicles] = useState(propVehicles || []);
  const [selectedVehicleId, setSelectedVehicleId] = useState(propSelectedVehicleId || '');
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);

  useEffect(() => {
    if (propVehicles && propVehicles.length > 0) {
      setVehicles(propVehicles);
    }
  }, [propVehicles]);

  useEffect(() => {
    if (propSelectedVehicleId !== undefined) {
      setSelectedVehicleId(propSelectedVehicleId);
    }
  }, [propSelectedVehicleId]);

  useEffect(() => {
    if (!propVehicles || propVehicles.length === 0) {
      const fetcher = typeof ApiClient.getVehicles === 'function'
        ? ApiClient.getVehicles()
        : typeof ApiClient.getTransporterVehicles === 'function'
          ? ApiClient.getTransporterVehicles()
          : Promise.resolve({ success: false, data: [] });

      fetcher
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            setVehicles(res.data);
          }
        })
        .catch(() => {});
    }
  }, [propVehicles]);

  const handleVehicleChange = (val) => {
    const foundVehicle = vehicles.find((v) => (v.id || v._id) === val);
    if (foundVehicle) {
      const vId = foundVehicle.id || foundVehicle._id;
      setSelectedVehicleId(vId);
      if (propOnSelectVehicle) propOnSelectVehicle(vId);

      const modelStr = `${foundVehicle.model || ''} ${foundVehicle.type || ''}`.toLowerCase();
      let mappedType = 'heavy_multi_axle';
      if (modelStr.includes('tanker') || modelStr.includes('pol') || modelStr.includes('chemical') || modelStr.includes('hazard')) {
        mappedType = 'hazardous_tanker';
      } else if (modelStr.includes('ace') || modelStr.includes('pickup') || modelStr.includes('light')) {
        mappedType = 'light_commercial';
      } else if (modelStr.includes('407') || modelStr.includes('eicher') || modelStr.includes('medium')) {
        mappedType = 'medium_commercial';
      } else {
        mappedType = 'heavy_multi_axle';
      }
      setVehicleType(mappedType);
      if (foundVehicle.capacity_kg && Number(foundVehicle.capacity_kg) > 0) {
        setCargoWeightKg(Number(foundVehicle.capacity_kg));
      }
      if (searchMode === 'hub') planRoute(fromId, toId, prefer, mappedType);
    } else {
      setVehicleType(val);
      setSelectedVehicleId('');
      if (propOnSelectVehicle) propOnSelectVehicle('');
      if (searchMode === 'hub') planRoute(fromId, toId, prefer, val);
    }
  };

  // Driver Assignment State
  const [drivers, setDrivers] = useState(propDrivers || []);
  const [selectedDriverId, setSelectedDriverId] = useState(propSelectedDriverId || '');
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);

  useEffect(() => {
    if (propDrivers && propDrivers.length > 0) {
      setDrivers(propDrivers);
    }
  }, [propDrivers]);

  useEffect(() => {
    if (propSelectedDriverId !== undefined) {
      setSelectedDriverId(propSelectedDriverId);
    }
  }, [propSelectedDriverId]);

  useEffect(() => {
    if (!propDrivers || propDrivers.length === 0) {
      const fetcher = typeof ApiClient.getDrivers === 'function'
        ? ApiClient.getDrivers()
        : typeof ApiClient.getTransporterDrivers === 'function'
          ? ApiClient.getTransporterDrivers()
          : Promise.resolve({ success: false, data: [] });

      fetcher
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            setDrivers(res.data);
          }
        })
        .catch(() => {});
    }
  }, [propDrivers]);

  const handleDriverChange = (val) => {
    setSelectedDriverId(val);
    if (propOnSelectDriver) propOnSelectDriver(val);
  };

  const [internalPlan, setInternalPlan] = useState(null);
  const [internalActiveRouteId, setInternalActiveRouteId] = useState('optimal');
  const [focusedPoint, setFocusedPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapKey, setMapKey] = useState(0);
  const [segmentationMode, setSegmentationMode] = useState('micro'); // 'micro' | 'corridor'
  const seq = useRef(0);

  const plan = propPlan !== undefined ? propPlan : internalPlan;
  const activeRouteId = propActiveRouteId !== undefined ? propActiveRouteId : internalActiveRouteId;

  const handleSelectRoute = useCallback((id) => {
    if (propOnSelectRoute) {
      propOnSelectRoute(id);
    } else {
      setInternalActiveRouteId(id);
    }
    setFocusedPoint(null);
  }, [propOnSelectRoute]);

  const parseLocation = (str) => {
    if (!str || typeof str !== 'string') return {};
    const parts = str.split(',').map(s => s.trim());
    if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      return { coords: { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) } };
    }
    return { address: str };
  };

  const handleAddStop = () => {
    const available = DISTRICTS.filter(d => d.id !== fromId && d.id !== toId && !stops.some(s => s.districtId === d.id));
    const nextId = available[0]?.id || 'dima_hasao';
    setStops(prev => [...prev, { id: 'stop_' + Date.now(), districtId: nextId, customAddress: '' }]);
  };

  const handleRemoveStop = (idx) => {
    setStops(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStopChange = (idx, field, val) => {
    setStops(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const planRoute = useCallback(async (from, to, pref, vType = vehicleType, silent = false, extra = {}) => {
    const isCustom = searchMode === 'custom' || extra.originAddress || extra.originCoords;
    if (!isCustom && (!from || !to || from === to)) return;
    const mySeq = ++seq.current;
    setLoading(true);
    if (!silent) setError('');
    try {
      const payloadStops = (extra.stops !== undefined 
        ? extra.stops 
        : stops.map(s => (searchMode === 'custom' ? (s.customAddress || s.districtId) : s.districtId))
      ).filter(Boolean);

      const payload = {
        prefer: pref,
        vehicleType: vType,
        cargoWeightKg: Number(cargoWeightKg) || 12000,
        ...extra,
      };
      if (from) payload.originDistrictId = from;
      if (to) payload.destDistrictId = to;
      if (payloadStops.length > 0) payload.stops = payloadStops;

      const res = await ApiClient.planRoute(payload);
      if (mySeq !== seq.current) return;
      if (res?.success && (res.data?.success || res.data?.recommended)) {
        const planData = res.data;
        if (onPlanChange) onPlanChange(planData);
        else setInternalPlan(planData);

        // Auto-select optimal or preferred
        const defaultId = planData.preferred || (planData.alternatives && planData.alternatives[0]?.id) || 'optimal';
        if (propOnSelectRoute) propOnSelectRoute(defaultId);
        else setInternalActiveRouteId(defaultId);

        setError('');
      } else {
        if (onPlanChange) onPlanChange(null);
        else setInternalPlan(null);
        setError(res?.data?.error || res?.message || 'Could not plan this route.');
      }
    } catch (e) {
      if (mySeq !== seq.current) return;
      console.warn('Route plan failed:', e);
      if (onPlanChange) onPlanChange(null);
      else setInternalPlan(null);
      setError('Route planner unreachable - real road routing needs the ML service (port 8010).');
    } finally {
      if (mySeq === seq.current) setLoading(false);
    }
  }, [cargoWeightKg, onPlanChange, propOnSelectRoute, searchMode, vehicleType, stops]);

  // Handle incoming emergency reroute navigation from GPS (e.g. from VehicleTrackingPage)
  // or incoming corridor selection from SafeBypassModal / AIPredictionsPage
  useEffect(() => {
    if (!routePlannerInitialState) return;

    // Case 1: Corridor specified from Safe Bypass Modal / Predictions / Emergency Mode
    if (
      routePlannerInitialState.fromDistrictId ||
      routePlannerInitialState.toDistrictId ||
      routePlannerInitialState.originName ||
      routePlannerInitialState.destName ||
      routePlannerInitialState.corridorName
    ) {
      const { fromDistrictId, toDistrictId, originName, destName, corridorName, prefer: initPrefer } = routePlannerInitialState;
      const fromMatch = findDistrictMatch(fromDistrictId || originName);
      const toMatch = findDistrictMatch(toDistrictId || destName);
      const newFrom = fromMatch?.id || 'dima_hasao';
      const newTo = toMatch?.id || 'imphal_west';

      setFromId(newFrom);
      setToId(newTo);
      const effectivePrefer = initPrefer || prefer || 'optimal';
      if (initPrefer) setPrefer(initPrefer);

      const fromLabel = fromMatch?.name || fromMatch?.city || originName || 'Origin';
      const toLabel = toMatch?.name || toMatch?.city || destName || 'Destination';
      setReroutedBanner(`🛡️ Safe Bypass Detour Loaded: ${corridorName || `${fromLabel} ➔ ${toLabel}`} (AI calculated safest detour avoiding active hazard zones)`);

      if (fromMatch?.lat && fromMatch?.lng) {
        setFocusedPoint([fromMatch.lat, fromMatch.lng]);
      }

      // Automatically plan the route for this exact corridor
      planRoute(newFrom, newTo, effectivePrefer, vehicleType, false);

      if (setRoutePlannerInitialState) setRoutePlannerInitialState(null);
      return;
    }

    // Case 2: Vehicle GPS live fix (from VehicleTrackingPage via Emergency Reroute)
    if (routePlannerInitialState.currentLat != null || routePlannerInitialState.vehicleId) {
      const {
        vehicleId,
        plateNumber,
        currentLat,
        currentLng,
        route,
        vehicleType: initVType,
        model,
        originDistrictId,
        originName,
        destDistrictId,
        destName,
        cargoWeightKg: initCargo,
        rerouteReason,
      } = routePlannerInitialState;

      if (initVType) setVehicleType(initVType);
      if (initCargo) setCargoWeightKg(initCargo);

      const fromMatch = findDistrictMatch(originDistrictId || (route && route.includes('→') ? route.split('→')[0].trim() : null));
      const toMatch = findDistrictMatch(destDistrictId || (route && route.includes('→') ? route.split('→')[1].trim() : null));
      const effectiveFrom = fromMatch?.id || 'kamrup';
      const effectiveTo = toMatch?.id || 'cachar';

      setFromId(effectiveFrom);
      setToId(effectiveTo);

      const ctx = {
        vehicleId,
        plateNumber: plateNumber || vehicleId,
        vehicleType: initVType || vehicleType,
        model,
        currentLat,
        currentLng,
        originName: originName || fromMatch?.name || 'Guwahati',
        destName: destName || toMatch?.name || 'Silchar',
        rerouteReason: rerouteReason || 'Emergency telematics detour: Bypassing active corridor hazard from live GPS fix',
      };
      setEmergencyContext(ctx);
      setReroutedBanner(`🚨 Emergency Telematics Detour: Vehicle ${ctx.plateNumber} dynamically rerouted from live GPS fix (${Number(currentLat).toFixed(4)}, ${Number(currentLng).toFixed(4)})`);

      if (currentLat != null && currentLng != null) {
        setFocusedPoint([currentLat, currentLng]);
      }

      // Execute comprehensive route plan: returns Optimal + Safest + Shortest + Economical
      planRoute(effectiveFrom, effectiveTo, 'optimal', initVType || vehicleType, false, {
        currentLat,
        currentLng,
        vehicleId,
        plateNumber: plateNumber || vehicleId,
      });

      if (setRoutePlannerInitialState) setRoutePlannerInitialState(null);
      return;
    }
  }, [routePlannerInitialState, cargoWeightKg, onPlanChange, propOnSelectRoute, setRoutePlannerInitialState, vehicleType, prefer, planRoute]);

  // Initial real plan on mount with Faridabad hubs (only if no incoming state)
  useEffect(() => {
    if (!routePlannerInitialState) {
      planRoute('dabua_chowk', 'aravali_college', 'safest', vehicleType, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFromChange = (newFrom) => {
    setFromId(newFrom);
    const d = districtById(newFrom);
    if (d) {
      setFocusedPoint([d.lat, d.lng]);
    }
    if (newFrom && toId && newFrom !== toId) {
      planRoute(newFrom, toId, prefer);
    }
  };

  const handleToChange = (newTo) => {
    setToId(newTo);
    const d = districtById(newTo);
    if (d) {
      setFocusedPoint([d.lat, d.lng]);
    }
    if (fromId && newTo && fromId !== newTo) {
      planRoute(fromId, newTo, prefer);
    }
  };

  const handleSwap = () => {
    if (searchMode === 'custom') {
      const oldO = customOrigin;
      setCustomOrigin(customDest);
      setCustomDest(oldO);
      return;
    }
    if (fromId === toId) return;
    const oldFrom = fromId;
    const oldTo = toId;
    setFromId(oldTo);
    setToId(oldFrom);
    const d = districtById(oldTo);
    if (d) setFocusedPoint([d.lat, d.lng]);
    planRoute(oldTo, oldFrom, prefer);
  };

  const handlePlan = async () => {
    setFocusedPoint(null);
    if (searchMode === 'custom') {
      if (!customOrigin || !customDest) {
        setError('Please enter both origin and destination addresses or coordinates.');
        return;
      }
      const oLoc = parseLocation(customOrigin);
      const dLoc = parseLocation(customDest);
      await planRoute(null, null, prefer, vehicleType, false, {
        originAddress: oLoc.address,
        originCoords: oLoc.coords,
        destAddress: dLoc.address,
        destCoords: dLoc.coords,
      });
    } else {
      if (fromId === toId) {
        setError('Origin and destination must be different locations.');
        return;
      }
      await planRoute(fromId, toId, prefer, vehicleType);
    }
  };

  // Determine active route
  const activeRoute = (plan?.alternatives || []).find((a) => a.id === activeRouteId) || plan?.recommended || null;
  const activeLegs = activeRoute?.legs || [];
  const activeMicroSegments = activeRoute?.microSegments || activeLegs.flatMap((l) => l.microSegments || []);
  const totalChunks = activeMicroSegments.length;
  const safeChunks = activeMicroSegments.filter((s) => (s.risk_score ?? s.riskScore ?? 15) <= 30).length;
  const modChunks = activeMicroSegments.filter((s) => {
    const sc = s.risk_score ?? s.riskScore ?? 15;
    return sc > 30 && sc <= 60;
  }).length;
  const criticalChunks = activeMicroSegments.filter((s) => (s.risk_score ?? s.riskScore ?? 15) >= 80);
  const alerts = plan?.alerts || [];
  const fromD = districtById(fromId);
  const toD = districtById(toId);

  const legColor = (leg) => RISK_COLOR[leg.riskLevel] || RISK_COLOR.low;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Search Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setSearchMode('hub')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              border: searchMode === 'hub' ? '2px solid #059669' : '1px solid #CBD5E1',
              background: searchMode === 'hub' ? '#ECFDF5' : '#FFFFFF',
              color: searchMode === 'hub' ? '#065F46' : '#64748B',
              transition: 'all 0.15s ease',
            }}
          >
            🏢 District Hubs
          </button>
          <button
            type="button"
            onClick={() => setSearchMode('custom')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              border: searchMode === 'custom' ? '2px solid #059669' : '1px solid #CBD5E1',
              background: searchMode === 'custom' ? '#ECFDF5' : '#FFFFFF',
              color: searchMode === 'custom' ? '#065F46' : '#64748B',
              transition: 'all 0.15s ease',
            }}
          >
            📍 Search Village / GPS Coords
          </button>
        </div>
      </div>

      {/* Emergency Telematics Context HUD */}
      {emergencyContext && (
        <div style={{
          background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF1F2 100%)',
          border: '1.5px solid #FECACA',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(220,38,38,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🚨</span>
              <div>
                <strong style={{ fontSize: '13.5px', color: '#991B1B' }}>
                  Emergency Telematics Detour Loaded: Vehicle {emergencyContext.plateNumber || emergencyContext.vehicleId}
                </strong>
                <div style={{ fontSize: '11.5px', color: '#B91C1C' }}>
                  {emergencyContext.rerouteReason || 'Dynamically routing from live GPS fix around active hazard zone'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmergencyContext(null);
                setReroutedBanner(null);
              }}
              style={{ background: 'transparent', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 800, fontSize: '14px' }}
            >
              ✕ Dismiss
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '11.5px', paddingTop: '6px', borderTop: '1px solid #FEE2E2' }}>
            <span style={{ background: '#FFFFFF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #FECACA', color: '#7F1D1D', fontWeight: 700 }}>
              🚛 Vehicle: {emergencyContext.plateNumber || emergencyContext.vehicleId}
            </span>
            <span style={{ background: '#FFFFFF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #FECACA', color: '#7F1D1D', fontWeight: 600 }}>
              🏷️ Type: {emergencyContext.vehicleType?.replace(/_/g, ' ')?.toUpperCase() || 'HEAVY TRUCK'}
            </span>
            {emergencyContext.currentLat != null && emergencyContext.currentLng != null && (
              <span style={{ background: '#FFFFFF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #FECACA', color: '#059669', fontWeight: 700 }}>
                📍 Live GPS Fix: {Number(emergencyContext.currentLat).toFixed(4)}, {Number(emergencyContext.currentLng).toFixed(4)}
              </span>
            )}
            <span style={{ background: '#FFFFFF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #FECACA', color: '#475569', fontWeight: 600 }}>
              🛣️ Corridor: {emergencyContext.originName || fromId} ➔ {emergencyContext.destName || toId}
            </span>
          </div>
        </div>
      )}

      {/* Emergency / Bypass Banner fallback */}
      {!emergencyContext && reroutedBanner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, fontWeight: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertOctagon size={18} color="#DC2626" />
            <span>{reroutedBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setReroutedBanner(null)}
            style={{ background: 'transparent', border: 'none', color: '#991B1B', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Side-by-Side Main Container: Controls on Left, Map on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4.5 items-stretch w-full">
        {/* Left Column: Route Setup, Profiles, Parameters & Metrics */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {/* Query bar - real districts or custom geocoding */}
          <div className="route-query-card" style={{ marginBottom: 0 }}>
        {/* Row 1: Endpoints (From, Swap, To) */}
        <div className="route-endpoints-row">
          {searchMode === 'custom' ? (
            <>
              <div className="query-field-group">
                <label className="query-field-label">From (Village / Address / GPS)</label>
                <div className="query-input-wrap">
                  <MapPin size={16} color="#059669" />
                  <input
                    type="text"
                    placeholder="e.g. Guwahati Airport or 26.14, 91.73"
                    value={customOrigin}
                    onChange={(e) => setCustomOrigin(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSwap}
                title="Swap origin and destination"
                className="route-swap-btn"
              >
                <ArrowLeftRight size={14} />
                <span>Swap</span>
              </button>

              <div className="query-field-group">
                <label className="query-field-label">To (Village / Address / GPS)</label>
                <div className="query-input-wrap">
                  <MapPin size={16} color="#DC2626" />
                  <input
                    type="text"
                    placeholder="e.g. Shillong Police Bazar or 25.57, 91.88"
                    value={customDest}
                    onChange={(e) => setCustomDest(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="query-field-group">
                <label className="query-field-label">From (Origin)</label>
                <div className="query-input-wrap">
                  <MapPin size={16} color="#059669" />
                  <select
                    value={fromId}
                    onChange={(e) => handleFromChange(e.target.value)}
                  >
                    {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSwap}
                title="Swap origin and destination"
                className="route-swap-btn"
              >
                <ArrowLeftRight size={14} />
                <span>Swap</span>
              </button>

              <div className="query-field-group">
                <label className="query-field-label">To (Destination)</label>
                <div className="query-input-wrap">
                  <MapPin size={16} color="#DC2626" />
                  <select
                    value={toId}
                    onChange={(e) => handleToChange(e.target.value)}
                  >
                    {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Intermediate Stops (Waypoints) in Between Journey */}
        {stops.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px', background: '#FAF5FF', borderRadius: '8px', border: '1.5px dashed #C084FC', margin: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B21A8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>🚩</span> Intermediate Stops Along Journey ({stops.length})
              </span>
              <button
                type="button"
                onClick={handleAddStop}
                style={{ fontSize: '11px', fontWeight: 700, color: '#7C3AED', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
              >
                <Plus size={12} /> Add Another Stop
              </button>
            </div>
            {stops.map((stop, idx) => (
              <div key={stop.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#7C3AED', color: '#fff', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {idx + 1}
                </span>
                {searchMode === 'custom' ? (
                  <div className="query-input-wrap" style={{ flex: 1 }}>
                    <MapPin size={14} color="#7C3AED" />
                    <input
                      type="text"
                      placeholder={`Stop #${idx + 1} village, address, or lat,lng`}
                      value={stop.customAddress || ''}
                      onChange={(e) => handleStopChange(idx, 'customAddress', e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="query-input-wrap" style={{ flex: 1 }}>
                    <MapPin size={14} color="#7C3AED" />
                    <select
                      value={stop.districtId || 'dima_hasao'}
                      onChange={(e) => handleStopChange(idx, 'districtId', e.target.value)}
                    >
                      {DISTRICTS.map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveStop(idx)}
                  title="Remove this stop"
                  style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Stop, Add Vehicle, and Add Driver Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0 4px 0', flexWrap: 'wrap' }}>
          {stops.length < 5 && (
            <button
              type="button"
              onClick={handleAddStop}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#FAF5FF',
                border: '1px dashed #C084FC',
                color: '#7C3AED',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={13} /> + Add Stop in Between Journey
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddVehicleModal(true)}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              background: '#EFF6FF',
              border: '1px dashed #93C5FD',
              color: '#1D4ED8',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <Truck size={13} /> + Add Vehicle
          </button>

          <button
            type="button"
            onClick={() => setShowAddDriverModal(true)}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              background: '#F0FDF4',
              border: '1px dashed #86EFAC',
              color: '#15803D',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <UserPlus size={13} /> + Add Driver
          </button>
        </div>

        {/* Row 2: Optimization Parameters & Fleet Assignment */}
        <div className="route-params-row" style={{ marginBottom: '10px' }}>
          <div className="query-field-group">
            <label className="query-field-label">Routing Profile</label>
            <div className="query-input-wrap">
              <ShieldCheck size={16} color="#3B82F6" />
              <select
                value={prefer}
                onChange={(e) => {
                  setPrefer(e.target.value);
                  if (searchMode === 'hub') planRoute(fromId, toId, e.target.value, vehicleType);
                }}
              >
                <option value="optimal">🌟 Optimal route (AI Multi-Objective)</option>
                <option value="safest">🛡️ Safest route (Lowest Hazard Risk)</option>
                <option value="shortest">⚡ Shortest route (Least Distance)</option>
                <option value="economical">💰 Economical route (Min Fuel & Wear)</option>
                <option value="balanced">⚖️ Balanced</option>
              </select>
            </div>
          </div>

          {/* Dedicated Available Vehicle Selector */}
          <div className="query-field-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label className="query-field-label" style={{ margin: 0 }}>Available Vehicle</label>
              <button
                type="button"
                onClick={() => setShowAddVehicleModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563EB',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: 0
                }}
              >
                <Plus size={11} /> + Add
              </button>
            </div>
            <div className="query-input-wrap">
              <Truck size={16} color="#2563EB" />
              <select
                value={selectedVehicleId}
                onChange={(e) => {
                  if (e.target.value === '__add_vehicle__') {
                    setShowAddVehicleModal(true);
                  } else {
                    handleVehicleChange(e.target.value);
                  }
                }}
              >
                <option value="">-- Assign Available Vehicle (Optional) --</option>
                {vehicles && vehicles.map((v) => (
                  <option key={v.id || v._id} value={v.id || v._id}>
                    {v.registration_number || v.model || v.id} ({v.type || v.model || 'Heavy'}) • {v.available_for_load || v.status === 'idle' ? 'Available' : (v.status || 'Active')}
                  </option>
                ))}
                <option value="__add_vehicle__">➕ + Register New Vehicle...</option>
              </select>
            </div>
          </div>

          {/* Driver Assignment */}
          <div className="query-field-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label className="query-field-label" style={{ margin: 0 }}>Driver Profile</label>
              <button
                type="button"
                onClick={() => setShowAddDriverModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#059669',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: 0
                }}
              >
                <UserPlus size={11} /> + Add
              </button>
            </div>
            <div className="query-input-wrap">
              <User size={16} color="#059669" />
              <select
                value={selectedDriverId}
                onChange={(e) => {
                  if (e.target.value === '__add_new__') {
                    setShowAddDriverModal(true);
                  } else {
                    handleDriverChange(e.target.value);
                  }
                }}
              >
                <option value="">-- Assign Driver (Optional) --</option>
                {drivers && drivers.map((d) => (
                  <option key={d.id || d._id} value={d.id || d._id}>
                    {d.name || d.full_name} {d.phone ? `(${d.phone})` : ''} {d.status ? `• ${d.status}` : ''}
                  </option>
                ))}
                <option value="__add_new__">➕ + Register New Driver...</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 3: Vehicle Specs, Cargo & Action */}
        <div className="route-params-row">
          <div className="query-field-group">
            <label className="query-field-label">Vehicle Profile (Physics Model)</label>
            <div className="query-input-wrap">
              <Gauge size={16} color="#10B981" />
              <select
                value={vehicleType}
                onChange={(e) => {
                  setVehicleType(e.target.value);
                  if (searchMode === 'hub') planRoute(fromId, toId, prefer, e.target.value);
                }}
              >
                <option value="heavy_multi_axle">Heavy Multi-Axle (16T-28T BharatBenz)</option>
                <option value="medium_commercial">Medium Truck (Tata 407 / Eicher)</option>
                <option value="light_commercial">Light Commercial (Tata Ace / Pickup)</option>
                <option value="hazardous_tanker">Hazardous Tanker (POL / Gas / Chemical)</option>
              </select>
            </div>
          </div>

          <div className="query-field-group query-field-cargo">
            <label className="query-field-label">Cargo (kg)</label>
            <div className="query-input-wrap">
              <Scale size={15} color="#6366F1" />
              <input
                type="number"
                min="0"
                max="50000"
                step="500"
                value={cargoWeightKg}
                onChange={(e) => setCargoWeightKg(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="query-action-group">
            <button
              className="route-plan-btn"
              onClick={handlePlan}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              <span>{loading ? 'Optimizing Routes...' : 'Calculate Routes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Data Ingestion & Real-Time Intelligence Transparency Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '7px 12px',
        borderRadius: '8px',
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        fontSize: '11px',
        color: '#475569',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#0F172A' }}>
          <Activity size={13} color="#059669" /> AI Routing Engine Consideration:
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          🌦️ <strong style={{ color: '#0369A1' }}>IMD Radar & Nowcast:</strong> Active Ingestion
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          📋 <strong style={{ color: '#059669' }}>Field & Incident Reports:</strong> Ingested
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          ⛰️ <strong style={{ color: '#D97706' }}>Gradient & Elevation:</strong> Factored
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          🛣️ <strong style={{ color: '#475569' }}>Road Network:</strong> OSRM Real Geometry
        </span>
      </div>

      {/* Interactive Alternative Route Selector Tabs (Optimal, Safest, Shortest, Economical, Detours) */}
      {plan && plan.alternatives && plan.alternatives.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
            Route Profiles:
          </span>
          {plan.alternatives.map((alt) => {
            const isSelected = alt.id === activeRouteId;
            const profileIcon = alt.id === 'optimal' || alt.type === 'optimal' 
              ? '🌟' 
              : alt.id === 'safest' || alt.type === 'safest' 
              ? '🛡️' 
              : alt.id === 'shortest' || alt.type === 'shortest' 
              ? '⚡' 
              : alt.id === 'economical' || alt.type === 'economical' 
              ? '💰' 
              : '🔀';

            const badgeText = alt.badge || (alt.id === 'optimal' ? 'AI Recommended' : alt.id === 'safest' ? 'Min Risk' : alt.id === 'shortest' ? 'Min Distance' : alt.id === 'economical' ? 'Min Cost' : null);

            return (
              <button
                key={alt.id}
                type="button"
                onClick={() => handleSelectRoute(alt.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #059669' : '1px solid #CBD5E1',
                  background: isSelected ? '#ECFDF5' : '#FFFFFF',
                  color: isSelected ? '#065F46' : '#334155',
                  boxShadow: isSelected ? '0 1px 3px rgba(5,150,105,0.2)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{profileIcon}</span>
                <span>{alt.name}</span>
                {badgeText && (
                  <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, background: isSelected ? '#059669' : '#E2E8F0', color: isSelected ? '#FFFFFF' : '#475569', fontWeight: 800, textTransform: 'uppercase' }}>
                    {badgeText}
                  </span>
                )}
                <span style={{ fontSize: 11, color: isSelected ? '#047857' : '#64748B', fontWeight: 600 }}>
                  {alt.totalDistanceKm || alt.distanceKm} km
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 6,
                    background: alt.riskScore > 50 ? '#FEE2E2' : '#E0F2FE',
                    color: alt.riskScore > 50 ? '#991B1B' : '#0369A1',
                    fontWeight: 700,
                  }}
                >
                  Risk {alt.riskScore}
                </span>
                {alt.fuelCost > 0 && (
                  <span style={{ fontSize: 10, color: '#166534', fontWeight: 600 }}>
                    ₹{alt.fuelCost}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Result summary chips for the active route */}
      {plan && activeRoute && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontWeight: 700 }}>
            <Navigation size={13} /> {activeRoute.totalDistanceKm || activeRoute.distanceKm || '--'} km | {activeLegs.length} leg{activeLegs.length === 1 ? '' : 's'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: RISK_COLOR[activeRoute.riskLevel] + '18', border: '1px solid ' + RISK_COLOR[activeRoute.riskLevel] + '60', color: RISK_COLOR[activeRoute.riskLevel], fontWeight: 700, textTransform: 'capitalize' }}>
            <Gauge size={13} /> Risk {activeRoute.riskScore ?? '--'}/100 | {activeRoute.riskLevel}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', fontWeight: 700 }}>
            <RouteIcon size={13} /> Active: {activeRoute.name}
          </span>
          {activeRoute.totalClimbM > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', fontWeight: 700 }}>
              ⛰️ Climb: +{Math.round(activeRoute.totalClimbM)} m {activeRoute.maxGradientPct ? `(${activeRoute.maxGradientPct}% slope)` : ''}
            </span>
          )}
          {(activeRoute.transitCost || activeRoute.totalDistanceKm) > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', fontWeight: 700 }}>
              💰 Est. Transit Cost: ₹{activeRoute.transitCost || Math.round((activeRoute.totalDistanceKm || 15) * 22)}
            </span>
          )}

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600 }}>
            Geometry: {plan.routingProvider === 'osrm' ? 'OSRM road network' : plan.routingProvider === 'tomtom' ? 'TomTom roads' : 'road network'}
          </span>
        </div>
      )}

      {/* Micro-Segmentation Mode Switcher & Real-time Chunk Health Bar */}
      {plan && activeRoute && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '8px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
              Visualization:
            </span>
            <div style={{ display: 'inline-flex', background: '#F1F5F9', padding: '3px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => setSegmentationMode('micro')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: segmentationMode === 'micro' ? '#059669' : 'transparent',
                  color: segmentationMode === 'micro' ? '#FFFFFF' : '#64748B',
                  boxShadow: segmentationMode === 'micro' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Layers size={13} />
                500m Micro-Segments (Gradient Heatmap)
              </button>
              <button
                type="button"
                onClick={() => setSegmentationMode('corridor')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: segmentationMode === 'corridor' ? '#059669' : 'transparent',
                  color: segmentationMode === 'corridor' ? '#FFFFFF' : '#64748B',
                  boxShadow: segmentationMode === 'corridor' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Whole Corridor
              </button>
            </div>
          </div>

          {/* Micro-Segment Distribution Status */}
          {totalChunks > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5 }}>
              <span style={{ color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                {safeChunks} Safe ({Math.round((safeChunks / totalChunks) * 100)}%)
              </span>
              {modChunks > 0 && (
                <span style={{ color: '#D97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                  {modChunks} Moderate
                </span>
              )}
              {criticalChunks.length > 0 && (
                <span
                  style={{
                    color: '#DC2626',
                    fontWeight: 800,
                    background: '#FEE2E2',
                    border: '1px solid #FECACA',
                    padding: '3px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  onClick={() => {
                    const firstHot = criticalChunks[0];
                    const coords = firstHot.coordinates || firstHot.geom?.coordinates || [];
                    if (coords.length > 0) {
                      const pt = coords[0];
                      const lat = pt[0] > 60 ? pt[1] : pt[0];
                      const lng = pt[0] > 60 ? pt[0] : pt[1];
                      setFocusedPoint([lat, lng]);
                    }
                  }}
                  title="Click to zoom to critical danger spot"
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
                  🔴 {criticalChunks.length} Hotspot ({criticalChunks[0].hazard_reason || `KM ${criticalChunks[0].start_chainage_km ?? criticalChunks[0].startChainageKm}`})
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Risk / hazard alerts */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.slice(0, 4).map((a, i) => {
            const hot = a.severity === 'critical' || a.severity === 'high';
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 8, background: hot ? '#FEF2F2' : '#FFFBEB', border: '1px solid ' + (hot ? '#FECACA' : '#FDE68A'), fontSize: 12 }}>
                <AlertTriangle size={14} color={hot ? '#DC2626' : '#D97706'} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong style={{ color: hot ? '#991B1B' : '#92400E' }}>{a.title}</strong>
                  <div style={{ color: '#6B7280' }}>{a.message}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}
        </div>

        {/* Right Column: Interactive Road Network Map */}
        <div className="lg:col-span-6 flex flex-col h-full">
          <div className="card" style={{ padding: '12px', position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '560px', borderRadius: '16px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {loading && !plan && (
              <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 2px 10px rgba(0,0,0,.15)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                <Loader2 size={14} className="spin" /> Fetching real road route...
              </div>
            )}
            <MapContainer
              key={mapKey}
              center={fromD ? [fromD.lat, fromD.lng] : [28.3842, 77.2878]}
              zoom={12}
              style={{ flex: 1, minHeight: '480px', width: '100%', borderRadius: 10 }}
          attributionControl={false}
          zoomControl={false}
          scrollWheelZoom={false}
        >
          <ResilientTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapZoomControls position="bottom-right" compact />
          <MapViewportSync
            points={activeRoute?.geometry}
            fromD={fromD}
            toD={toD}
            focusedPoint={focusedPoint}
          />

          {/* Alternative Routes (dashed, selectable by click) */}
          {plan?.alternatives && plan.alternatives
            .filter((a) => a.id !== activeRouteId && a.geometry && a.geometry.length > 1)
            .map((alt) => (
              <Polyline
                key={'alt-line-' + alt.id}
                positions={alt.geometry}
                pathOptions={{ color: '#64748B', weight: 3.5, opacity: 0.75, dashArray: '7, 6' }}
                eventHandlers={{
                  click: () => handleSelectRoute(alt.id),
                }}
              >
                <Tooltip sticky>
                  <strong>{alt.name}</strong> ({alt.totalDistanceKm || alt.distanceKm} km)
                  <br />
                  Risk: {alt.riskScore}/100 ({alt.riskLevel})
                  <br />
                  <span style={{ color: '#059669', fontWeight: 700 }}>Click to select this route</span>
                </Tooltip>
                <Popup>
                  <div style={{ minWidth: 200, fontSize: 12 }}>
                    <strong>{alt.name}</strong>
                    <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{alt.label}</div>
                    <div style={{ marginTop: 6, lineHeight: 1.6 }}>
                      Distance: <strong>{alt.totalDistanceKm || alt.distanceKm} km</strong>
                      <br />
                      Est. Time: <strong>{alt.timeText || (alt.avgTravelHours ? alt.avgTravelHours + ' hrs' : '--')}</strong>
                      <br />
                      Risk: <strong>{alt.riskScore}/100 ({alt.riskLevel})</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectRoute(alt.id)}
                      style={{ marginTop: 8, width: '100%', padding: '6px 10px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Select This Route
                    </button>
                  </div>
                </Popup>
              </Polyline>
            ))}

          {/* Active Route Rendering — Gradient Micro-Segment Heatmap or Whole Corridor */}
          {segmentationMode === 'micro' && activeMicroSegments.length > 0 ? (
            <MicroSegmentHeatmap
              segments={activeMicroSegments}
              onSegmentClick={(seg) => {
                const coords = seg.coordinates || seg.geom?.coordinates || [];
                if (coords.length > 0) {
                  const pt = coords[0];
                  const lat = pt[0] > 60 ? pt[1] : pt[0];
                  const lng = pt[0] > 60 ? pt[0] : pt[1];
                  setFocusedPoint([lat, lng]);
                }
              }}
            />
          ) : (
            activeLegs.map((leg, i) => {
              const pts = leg.geometry || [];
              if (pts.length < 2) return null;
              const color = legColor(leg);
              return (
                <Polyline
                  key={'active-leg-' + i}
                  positions={pts}
                  pathOptions={{ color, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
                >
                  <Tooltip sticky>
                    <strong>{leg.label}</strong><br />
                    {pts.length.toLocaleString()} road points | {leg.geometrySource === 'osrm' ? 'OSRM' : leg.geometrySource || 'road network'}
                  </Tooltip>
                  <Popup>
                    <div style={{ minWidth: 210, fontSize: 12 }}>
                      <strong>{leg.label}</strong>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{leg.fromName} to {leg.toName}</div>
                      <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
                        Distance: <strong>{leg.distanceKm} km</strong>
                        {leg.osrmDistanceKm != null && <span style={{ color: '#6B7280' }}> (road {leg.osrmDistanceKm} km{leg.osrmDurationText ? ' | ' + leg.osrmDurationText : ''})</span>}
                        <br />
                        Risk: <strong style={{ color }}>{leg.riskScore}/100 | {leg.riskLevel}</strong>
                        <br />
                        Road condition: <strong>{(leg.roadCondition || 'good').replace(/_/g, ' ')}</strong>
                        <br />
                        Rainfall: <strong>{leg.rainfallMm != null ? leg.rainfallMm + ' mm/24h' : 'n/a'}</strong>
                        <br />
                        Landslide: <strong>{leg.landslideRisk || 'n/a'}{leg.landslideProbability != null ? ' (' + Math.round(leg.landslideProbability) + '%)' : ''}</strong>
                        {leg.climbGainM != null && (
                          <>
                            <br />
                            Incline Climb: <strong>+{Math.round(leg.climbGainM)} m</strong> (Peak: {Math.round(leg.maxElevationM || 0)} m)
                          </>
                        )}
                        {leg.forecastAtArrival && (
                          <>
                            <br />
                            Weather @ ETA: <strong>{leg.forecastAtArrival.forecast_risk_level} ({leg.forecastAtArrival.forecast_precip_mm} mm/h rain)</strong>
                          </>
                        )}
                        <br />

                        Traffic: <strong>{leg.congestionLevel || 'n/a'}</strong>
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              );
            })
          )}

          {/* Intermediate Stops (Waypoints) Pin Markers */}
          {stops.map((stop, idx) => {
            const d = districtById(stop.districtId);
            const pos = d ? [d.lat, d.lng] : (stop.lat && stop.lng ? [stop.lat, stop.lng] : null);
            if (!pos) return null;
            return (
              <Marker key={stop.id || idx} position={pos} icon={waypointIcon(idx + 1)}>
                <Popup>
                  <strong>Stop #{idx + 1}: {d?.label || stop.customAddress || 'Intermediate Waypoint'}</strong>
                  <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600 }}>Intermediate Journey Stop</div>
                  <div style={{ fontSize: 10, color: '#6B7280' }}>{pos[0].toFixed(4)}, {pos[1].toFixed(4)}</div>
                </Popup>
              </Marker>
            );
          })}

          {/* Emergency Vehicle GPS Live Pin */}
          {emergencyContext?.currentLat != null && emergencyContext?.currentLng != null && (
            <Marker position={[emergencyContext.currentLat, emergencyContext.currentLng]} icon={vehicleGpsIcon}>
              <Popup>
                <strong>🚛 {emergencyContext.plateNumber || emergencyContext.vehicleId}</strong>
                <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 700 }}>Live Telematics GPS Position</div>
                <div style={{ fontSize: 10, color: '#6B7280' }}>
                  {Number(emergencyContext.currentLat).toFixed(4)}, {Number(emergencyContext.currentLng).toFixed(4)}
                </div>
                <div style={{ fontSize: 11, marginTop: 4, color: '#B91C1C', fontWeight: 500 }}>
                  {emergencyContext.rerouteReason}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Origin and Destination Pin Markers */}
          {fromD && (
            <Marker position={[fromD.lat, fromD.lng]} icon={originIcon}>
              <Popup>
                <strong>{fromD.label}</strong>
                <div style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>Origin Location</div>
                <div style={{ fontSize: 10, color: '#6B7280' }}>{fromD.lat.toFixed(4)}, {fromD.lng.toFixed(4)}</div>
              </Popup>
            </Marker>
          )}
          {toD && (
            <Marker position={[toD.lat, toD.lng]} icon={destIcon}>
              <Popup>
                <strong>{toD.label}</strong>
                <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>Destination Location</div>
                <div style={{ fontSize: 10, color: '#6B7280' }}>{toD.lat.toFixed(4)}, {toD.lng.toFixed(4)}</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px', fontSize: 11, color: 'var(--text-muted)', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 4, background: RISK_COLOR.low, borderRadius: 2, display: 'inline-block' }} /> Low risk</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 4, background: RISK_COLOR.medium, borderRadius: 2, display: 'inline-block' }} /> Medium</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 4, background: RISK_COLOR.high, borderRadius: 2, display: 'inline-block' }} /> High</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 4, background: RISK_COLOR.critical, borderRadius: 2, display: 'inline-block' }} /> Critical (&gt;80)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 3, background: '#64748B', display: 'inline-block', borderTop: '2px dashed #64748B' }} /> Selectable alternative</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={11} style={{ verticalAlign: 'middle' }} />
            {activeLegs.some((l) => ['osrm', 'mappls', 'tomtom', 'fossgis'].includes(l.geometrySource))
              ? 'Lines follow the real road network (OSRM/OpenStreetMap)'
              : 'Real corridor risk from route database'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => { setMapKey((k) => k + 1); }}
          title="Re-center map"
          style={{ position: 'absolute', top: 22, right: 22, zIndex: 1000, width: 30, height: 30, borderRadius: 6, background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <RefreshCw size={14} color="#374151" />
        </button>
      </div>
    </div>
  </div>

  {/* Add / Register Driver Modal */}
  <AddDriverModal
    isOpen={showAddDriverModal}
    onClose={() => setShowAddDriverModal(false)}
    onDriverAdded={(newDriver) => {
      if (newDriver) {
        const driverId = newDriver.id || newDriver._id;
        setDrivers((prev) => [newDriver, ...prev.filter((d) => (d.id || d._id) !== driverId)]);
        if (driverId) {
          handleDriverChange(driverId);
        }
      }
    }}
  />

  {/* Add / Register Vehicle Modal */}
  <AddVehicleModal
    isOpen={showAddVehicleModal}
    onClose={() => setShowAddVehicleModal(false)}
    onVehicleAdded={(msg, newVehicle) => {
      if (newVehicle && (newVehicle.id || newVehicle._id)) {
        const vId = newVehicle.id || newVehicle._id;
        setVehicles((prev) => [newVehicle, ...prev.filter((v) => (v.id || v._id) !== vId)]);
        handleVehicleChange(vId);
      } else {
        const fetcher = typeof ApiClient.getVehicles === 'function'
          ? ApiClient.getVehicles()
          : typeof ApiClient.getTransporterVehicles === 'function'
            ? ApiClient.getTransporterVehicles()
            : Promise.resolve({ success: false, data: [] });

        fetcher
          .then((res) => {
            if (res?.success && Array.isArray(res.data)) {
              setVehicles(res.data);
              if (res.data.length > 0) {
                handleVehicleChange(res.data[0].id);
              }
            }
          })
          .catch(() => {});
      }
    }}
  />
</div>
);
};
