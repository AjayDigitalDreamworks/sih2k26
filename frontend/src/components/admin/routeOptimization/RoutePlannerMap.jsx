import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, Polyline, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { MapZoomControls } from '@/components/admin/common/MapZoomControls';
import { ResilientTileLayer } from '@/components/admin/common/ResilientTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Sparkles, Loader2, AlertTriangle, ShieldCheck, Navigation, Gauge, RefreshCw, Route as RouteIcon, Search, Scale, AlertOctagon } from 'lucide-react';
import ApiClient from '@/lib/api';
import { DISTRICTS, districtById } from '@/data/geoMaster';
import { useApp } from '@/contexts/AppContext';

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

export const RoutePlannerMap = ({
  plan: propPlan,
  onPlanChange,
  activeRouteId: propActiveRouteId,
  onSelectRoute: propOnSelectRoute,
}) => {
  const { routePlannerInitialState, setRoutePlannerInitialState } = useApp() || {};
  const [fromId, setFromId] = useState('dabua_chowk');
  const [toId, setToId] = useState('aravali_college');
  const [prefer, setPrefer] = useState('safest');
  const [vehicleType, setVehicleType] = useState('heavy_multi_axle');
  const [cargoWeightKg, setCargoWeightKg] = useState(12000);
  const [searchMode, setSearchMode] = useState('hub'); // 'hub' | 'custom'
  const [customOrigin, setCustomOrigin] = useState('');
  const [customDest, setCustomDest] = useState('');
  const [reroutedBanner, setReroutedBanner] = useState(null);

  const [internalPlan, setInternalPlan] = useState(null);
  const [internalActiveRouteId, setInternalActiveRouteId] = useState('safest');
  const [focusedPoint, setFocusedPoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapKey, setMapKey] = useState(0);
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

  const planRoute = useCallback(async (from, to, pref, vType = vehicleType, silent = false, extra = {}) => {
    const isCustom = searchMode === 'custom' || extra.originAddress || extra.originCoords;
    if (!isCustom && (!from || !to || from === to)) return;
    const mySeq = ++seq.current;
    setLoading(true);
    if (!silent) setError('');
    try {
      const payload = {
        prefer: pref,
        vehicleType: vType,
        cargoWeightKg: Number(cargoWeightKg) || 12000,
        ...extra,
      };
      if (from) payload.originDistrictId = from;
      if (to) payload.destDistrictId = to;

      const res = await ApiClient.planRoute(payload);
      if (mySeq !== seq.current) return;
      if (res?.success && (res.data?.success || res.data?.recommended)) {
        const planData = res.data;
        if (onPlanChange) onPlanChange(planData);
        else setInternalPlan(planData);

        // Auto-select safest or recommended
        const defaultId = planData.preferred || (planData.alternatives && planData.alternatives[0]?.id) || 'safest';
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
  }, [cargoWeightKg, onPlanChange, propOnSelectRoute, searchMode, vehicleType]);

  // Handle incoming emergency reroute navigation from GPS (e.g. from VehicleTrackingPage)
  useEffect(() => {
    if (routePlannerInitialState && (routePlannerInitialState.currentLat != null || routePlannerInitialState.vehicleId)) {
      const { vehicleId, currentLat, currentLng, route, vehicleType: initVType } = routePlannerInitialState;
      if (initVType) setVehicleType(initVType);
      const destCandidate = route && route.includes('→') ? route.split('→')[1].trim().toLowerCase() : 'cachar';
      const destMatched = DISTRICTS.find((d) => d.id === destCandidate || d.label.toLowerCase().includes(destCandidate))?.id || 'cachar';
      setToId(destMatched);
      setReroutedBanner(`🚨 Emergency Telematics Detour: Vehicle ${vehicleId || 'in transit'} dynamically rerouted from live GPS fix (${Number(currentLat).toFixed(4)}, ${Number(currentLng).toFixed(4)})`);
      if (currentLat != null && currentLng != null) {
        setFocusedPoint([currentLat, currentLng]);
      }

      // Execute immediate reroute from GPS
      const runGpsReroute = async () => {
        setLoading(true);
        setError('');
        try {
          const res = await ApiClient.rerouteVehicle({
            vehicleId,
            currentLat,
            currentLng,
            destDistrictId: destMatched,
            vehicleType: initVType || vehicleType,
            cargoWeightKg,
          });
          if (res?.success && (res.data?.success || res.data?.recommended)) {
            const planData = res.data;
            if (onPlanChange) onPlanChange(planData);
            else setInternalPlan(planData);
            const defId = planData.preferred || (planData.alternatives && planData.alternatives[0]?.id) || 'safest';
            if (propOnSelectRoute) propOnSelectRoute(defId);
            else setInternalActiveRouteId(defId);
          }
        } catch (err) {
          console.warn('GPS reroute failed:', err);
        } finally {
          setLoading(false);
          if (setRoutePlannerInitialState) setRoutePlannerInitialState(null);
        }
      };
      runGpsReroute();
    }
  }, [routePlannerInitialState, cargoWeightKg, onPlanChange, propOnSelectRoute, setRoutePlannerInitialState, vehicleType]);

  // Initial real plan on mount with Faridabad hubs
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

      {/* Emergency Rerouted Banner */}
      {reroutedBanner && (
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

      {/* Query bar - real districts or custom geocoding */}
      <div className="route-query-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
        {searchMode === 'custom' ? (
          <>
            <div className="query-field-group" style={{ flex: 1, minWidth: '170px' }}>
              <label className="query-field-label">From (Village / Address / GPS)</label>
              <div className="query-input-wrap">
                <MapPin size={16} color="#059669" />
                <input
                  type="text"
                  placeholder="e.g. Guwahati Airport or 26.14, 91.73"
                  value={customOrigin}
                  onChange={(e) => setCustomOrigin(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: '100%' }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSwap}
              title="Swap origin and destination"
              style={{ alignSelf: 'flex-end', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#374151' }}
            >
              Swap
            </button>

            <div className="query-field-group" style={{ flex: 1, minWidth: '170px' }}>
              <label className="query-field-label">To (Village / Address / GPS)</label>
              <div className="query-input-wrap">
                <MapPin size={16} color="#DC2626" />
                <input
                  type="text"
                  placeholder="e.g. Shillong Police Bazar or 25.57, 91.88"
                  value={customDest}
                  onChange={(e) => setCustomDest(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: '100%' }}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="query-field-group">
              <label className="query-field-label">From (origin)</label>
              <div className="query-input-wrap">
                <MapPin size={16} color="#059669" />
                <select
                  value={fromId}
                  onChange={(e) => handleFromChange(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', width: '100%' }}
                >
                  {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSwap}
              title="Swap origin and destination"
              style={{ alignSelf: 'flex-end', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#374151' }}
            >
              Swap
            </button>

            <div className="query-field-group">
              <label className="query-field-label">To (destination)</label>
              <div className="query-input-wrap">
                <MapPin size={16} color="#DC2626" />
                <select
                  value={toId}
                  onChange={(e) => handleToChange(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', width: '100%' }}
                >
                  {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        <div className="query-field-group">
          <label className="query-field-label">Preference</label>
          <div className="query-input-wrap">
            <ShieldCheck size={16} color="#3B82F6" />
            <select
              value={prefer}
              onChange={(e) => {
                setPrefer(e.target.value);
                if (searchMode === 'hub') planRoute(fromId, toId, e.target.value, vehicleType);
              }}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              <option value="safest">Safest route (lowest risk)</option>
              <option value="shortest">Shortest route (least km)</option>
              <option value="balanced">Balanced</option>
            </select>
          </div>
        </div>

        <div className="query-field-group">
          <label className="query-field-label">Vehicle Profile</label>
          <div className="query-input-wrap">
            <Gauge size={16} color="#10B981" />
            <select
              value={vehicleType}
              onChange={(e) => {
                setVehicleType(e.target.value);
                if (searchMode === 'hub') planRoute(fromId, toId, prefer, e.target.value);
              }}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              <option value="heavy_multi_axle">Heavy Multi-Axle (16T-28T BharatBenz)</option>
              <option value="medium_commercial">Medium Truck (Tata 407 / Eicher)</option>
              <option value="light_commercial">Light Commercial (Tata Ace / Pickup)</option>
              <option value="hazardous_tanker">Hazardous Tanker (POL / Gas)</option>
            </select>
          </div>
        </div>

        <div className="query-field-group" style={{ width: '105px' }}>
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
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handlePlan} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            <span>{loading ? 'Planning on roads...' : 'Plan Route'}</span>
          </button>
        </div>
      </div>



      {/* Interactive Alternative Route Selector Tabs */}
      {plan && plan.alternatives && plan.alternatives.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 12px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
            Routes:
          </span>
          {plan.alternatives.map((alt) => {
            const isSelected = alt.id === activeRouteId;
            return (
              <button
                key={alt.id}
                type="button"
                onClick={() => handleSelectRoute(alt.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
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
                {isSelected ? (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669' }} />
                ) : (
                  <RouteIcon size={12} color="#64748B" />
                )}
                <span>{alt.name}</span>
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
          {activeRoute.fuelLiters > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534', fontWeight: 700 }} title={`Base: ${activeRoute.baseFuelLiters || activeRoute.fuelLiters}L, Climb Surcharge: +${activeRoute.climbPenaltyLiters || 0}L`}>
              ⛽ Fuel: ~{activeRoute.fuelLiters} L (₹{activeRoute.fuelCost})
              {activeRoute.climbPenaltyLiters > 0 && <span style={{ fontSize: 10, color: '#047857', marginLeft: 2 }}> (+{activeRoute.climbPenaltyLiters}L climb)</span>}
            </span>
          )}

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600 }}>
            Geometry: {plan.routingProvider === 'osrm' ? 'OSRM road network' : plan.routingProvider === 'mappls' ? 'Mappls roads' : plan.routingProvider === 'tomtom' ? 'TomTom roads' : 'road network'}
          </span>
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

      {/* Map with real road geometry — always visible */}
      <div className="card" style={{ padding: '12px', position: 'relative' }}>
        {loading && !plan && (
          <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 2px 10px rgba(0,0,0,.15)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <Loader2 size={14} className="spin" /> Fetching real road route...
          </div>
        )}
        <MapContainer
          key={mapKey}
          center={fromD ? [fromD.lat, fromD.lng] : [28.3842, 77.2878]}
          zoom={12}
          style={{ height: '430px', width: '100%', borderRadius: 8 }}
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

          {/* Active Route Legs (thick, solid line with live condition details) */}
          {activeLegs.map((leg, i) => {
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
          })}

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
  );
};
