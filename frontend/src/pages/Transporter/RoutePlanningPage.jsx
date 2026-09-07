import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Route,
  MapPin,
  Navigation,
  Fuel,
  Gauge,
  ShieldCheck,
  AlertTriangle,
  Truck,
  User,
  Package,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { MapContainer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { MapZoomControls } from '../../components/admin/common/MapZoomControls';
import { ResilientTileLayer } from '../../components/admin/common/ResilientTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import ApiClient from '../../lib/api';
import { DISTRICTS, districtById, districtLabel } from '../../data/geoMaster';

function MapViewportSync({ points, originD, destD, focusedPoint }) {
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
          map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
          return;
        }
      } catch (_) {}
    }
    if (originD && destD) {
      try {
        const bounds = L.latLngBounds([
          [originD.lat, originD.lng],
          [destD.lat, destD.lng],
        ]);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
        }
      } catch (_) {}
    }
  }, [points, originD, destD, focusedPoint, map]);
  return null;
}

const dotIcon = (color) =>
  L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white';

export default function RoutePlanningPage() {
  const [searchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);

  const [originId, setOriginId] = useState(searchParams.get('origin') || 'dabua_chowk');
  const [destId, setDestId] = useState(searchParams.get('dest') || 'aravali_college');
  const [focusedPoint, setFocusedPoint] = useState(null);
  const [activeRouteId, setActiveRouteId] = useState('safest');
  const [commodity, setCommodity] = useState(searchParams.get('commodity') || 'general');
  const [weightKg, setWeightKg] = useState(searchParams.get('weight') || '');
  const [vehicleId, setVehicleId] = useState(searchParams.get('vehicle') || '');
  const [driverId, setDriverId] = useState(searchParams.get('driver') || '');

  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState('');
  const [planning, setPlanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const triggerToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 3200);
  };

  const loadFleet = useCallback(async () => {
    try {
      const [vres, dres, tres] = await Promise.allSettled([
        ApiClient.getTransporterVehicles(),
        ApiClient.getTransporterDrivers(),
        ApiClient.request('/transporter/trips'),
      ]);
      if (vres.status === 'fulfilled' && vres.value?.success) {
        setVehicles(vres.value.data || []);
        setVehicleId((prev) => prev || ((vres.value.data && vres.value.data[0] && vres.value.data[0].id) || ''));
      }
      if (dres.status === 'fulfilled' && dres.value?.success) {
        setDrivers(dres.value.data || []);
        setDriverId((prev) => prev || ((dres.value.data && dres.value.data[0] && dres.value.data[0].id) || ''));
      }
      if (tres.status === 'fulfilled' && tres.value?.success) setTrips(tres.value.data || []);
    } catch (e) {
      console.warn('Fleet load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  const originD = districtById(originId);
  const destD = districtById(destId);

  const handleOriginChange = (newOrigin) => {
    setOriginId(newOrigin);
    setPlan(null);
    setRoadPlan(null);
    const d = districtById(newOrigin);
    if (d) setFocusedPoint([d.lat, d.lng]);
  };

  const handleDestChange = (newDest) => {
    setDestId(newDest);
    setPlan(null);
    setRoadPlan(null);
    const d = districtById(newDest);
    if (d) setFocusedPoint([d.lat, d.lng]);
  };

  const [roadPlan, setRoadPlan] = useState(null);
  const [roadLoading, setRoadLoading] = useState(false);

  const handleClearRoute = () => {
    setPlan(null);
    setRoadPlan(null);
    setRoadLoading(false);
    setFocusedPoint(null);
    setPlanError('');
    triggerToast('Route corridors cleared. Ready to plan new route.');
  };

  // Synchronized available alternatives across ML / OSRM and backend trip evaluations
  const availableAlternatives = useMemo(() => {
    if (plan?.alternatives && plan.alternatives.length > 0) {
      return plan.alternatives.map((alt) => {
        const roadMatch = roadPlan?.alternatives?.find((r) => r.id === alt.id);
        const dKm = alt.distanceKm || alt.totalDistanceKm || roadMatch?.totalDistanceKm || roadMatch?.distanceKm || 0;
        const hrs = alt.estimatedHours || alt.avgTravelHours || Math.round((dKm / 45) * 10) / 10;
        return {
          ...alt,
          distanceKm: dKm,
          totalDistanceKm: dKm,
          estimatedHours: hrs,
          fuelCostEstimate: alt.fuelCostEstimate || Math.round(dKm * 14.5),
          geometry: alt.geometry && alt.geometry.length > 1 ? alt.geometry : roadMatch?.geometry || [],
          legs: alt.legs && alt.legs.length > 0 ? alt.legs : roadMatch?.legs || [],
        };
      });
    }
    if (roadPlan?.alternatives && roadPlan.alternatives.length > 0) {
      return roadPlan.alternatives.map((alt) => {
        const dKm = alt.totalDistanceKm || alt.distanceKm || 0;
        const hours = alt.avgTravelHours || Math.round((dKm / 45) * 10) / 10;
        return {
          id: alt.id,
          routeId: roadPlan.routeId || 'RT-CORRIDOR',
          name: alt.name || (alt.id === 'safest' ? 'Safest Highway Corridor' : 'Shortest Direct Corridor'),
          type: alt.id,
          distanceKm: dKm,
          totalDistanceKm: dKm,
          estimatedHours: hours,
          avgTravelHours: hours,
          fuelCostEstimate: Math.round(dKm * 14.5),
          riskScore: alt.riskScore ?? 25,
          riskLevel: alt.riskLevel || (alt.riskScore > 60 ? 'high' : alt.riskScore > 30 ? 'medium' : 'low'),
          geometry: alt.geometry || [],
          legs: alt.legs || [],
          roadCondition: alt.legs?.[0]?.roadCondition || 'good',
          isRecommended: alt.id === 'safest',
        };
      });
    }
    if (plan?.primary) {
      return [plan.primary];
    }
    return [];
  }, [plan, roadPlan]);

  const currentSelectedRoute = useMemo(() => {
    if (availableAlternatives.length > 0) {
      return availableAlternatives.find((a) => a.id === activeRouteId) || availableAlternatives[0];
    }
    if (plan?.primary) return plan.primary;
    return (roadPlan?.alternatives || []).find((a) => a.id === activeRouteId) || roadPlan?.recommended || null;
  }, [availableAlternatives, activeRouteId, plan, roadPlan]);

  const activeRoadRoute = currentSelectedRoute || (roadPlan?.alternatives || []).find((a) => a.id === activeRouteId) || roadPlan?.recommended || null;
  const roadLegs = currentSelectedRoute?.legs && currentSelectedRoute.legs.length > 0 ? currentSelectedRoute.legs : (activeRoadRoute?.legs || []);
  const roadPoints = currentSelectedRoute?.geometry && currentSelectedRoute.geometry.length > 1 ? currentSelectedRoute.geometry : (activeRoadRoute?.geometry || []);

  const mapAlternatives = useMemo(() => {
    if (availableAlternatives.length > 0) {
      return availableAlternatives.filter((a) => a.id !== currentSelectedRoute?.id && a.geometry && a.geometry.length > 1);
    }
    return (roadPlan?.alternatives || []).filter((a) => a.id !== activeRouteId && a.geometry && a.geometry.length > 1);
  }, [availableAlternatives, currentSelectedRoute, roadPlan, activeRouteId]);

  const handlePlan = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (originId === destId) {
      setPlanError('Origin and destination must be different districts.');
      return;
    }
    setPlanning(true);
    setRoadLoading(true);
    setPlanError('');
    setPlan(null);
    setRoadPlan(null);
    try {
      const [tripRes, roadRes] = await Promise.allSettled([
        ApiClient.planTrip({
          originDistrictId: originId,
          destDistrictId: destId,
          commodityType: commodity,
          weightKg: parseInt(String(weightKg).replace(/[^\d]/g, ''), 10) || 1000,
        }),
        ApiClient.planRoute({ originDistrictId: originId, destDistrictId: destId, prefer: 'safest' }),
      ]);

      if (roadRes.status === 'fulfilled' && roadRes.value?.success && (roadRes.value.data?.success || roadRes.value.data?.recommended)) {
        setRoadPlan(roadRes.value.data);
      }

      if (tripRes.status === 'fulfilled' && tripRes.value?.success) {
        setPlan(tripRes.value.data);
        const preferredId = tripRes.value.data?.primary?.id || tripRes.value.data?.alternatives?.[0]?.id || 'safest';
        setActiveRouteId(preferredId);
        triggerToast(`Evaluated corridor options. Recommended: ${tripRes.value.data?.primary?.name || 'Safest route'}`);
      } else if (roadRes.status === 'fulfilled' && roadRes.value?.success) {
        const preferredId = roadRes.value.data?.preferred || roadRes.value.data?.alternatives?.[0]?.id || 'safest';
        setActiveRouteId(preferredId);
        triggerToast('Evaluated corridor geometry and risk options.');
      } else {
        setPlanError(tripRes.status === 'fulfilled' ? tripRes.value?.message : 'Could not plan this route.');
      }
    } catch (err) {
      console.error(err);
      setPlanError('Server error while planning the route.');
    } finally {
      setPlanning(false);
      setRoadLoading(false);
    }
  };

  const handleStartTrip = async (startImmediately = false) => {
    const targetRoute = currentSelectedRoute || plan?.primary;
    if (!targetRoute) {
      setPlanError('Please evaluate and select a route corridor first.');
      return;
    }
    if (!vehicleId || !driverId) {
      setPlanError('Select a real vehicle and driver from your fleet to assign the corridor.');
      return;
    }
    setStarting(true);
    setPlanError('');
    try {
      const originLabel = originD?.label || plan?.origin?.name || targetRoute.name?.split('→')?.[0]?.trim() || originId;
      const destLabel = destD?.label || plan?.destination?.name || targetRoute.name?.split('→')?.[1]?.trim() || destId;

      const res = await ApiClient.createTrip({
        routeId: targetRoute.routeId || plan?.routeId || plan?.primary?.routeId,
        selectedRouteId: targetRoute.id,
        routeName: targetRoute.name,
        originDistrictId: originId,
        destDistrictId: destId,
        origin: originLabel,
        destination: destLabel,
        distanceKm: targetRoute.distanceKm || targetRoute.totalDistanceKm,
        estimatedHours: targetRoute.estimatedHours || targetRoute.avgTravelHours,
        riskScore: targetRoute.riskScore,
        geometry: targetRoute.geometry || [],
        commodityType: commodity,
        weightKg: parseInt(String(weightKg).replace(/[^\d]/g, ''), 10) || 1200,
        vehicleId,
        driverId,
        startImmediately: !!startImmediately,
      });
      if (!res?.success) {
        setPlanError(res?.message || 'Could not assign trip.');
      } else {
        const selD = drivers.find((d) => d.id === driverId);
        if (startImmediately) {
          triggerToast(`Trip ${res.data.id} dispatched immediately on "${targetRoute.name}" — live tracking active!`);
        } else {
          triggerToast(`Corridor "${targetRoute.name}" assigned to driver ${selD?.name || driverId}. Driver can now start the trip!`);
        }
        // Completely clear old evaluated routes after assigning
        setPlan(null);
        setRoadPlan(null);
        setRoadLoading(false);
        setFocusedPoint(null);
        await loadFleet();
      }
    } catch (err) {
      console.error(err);
      setPlanError(err?.message || 'Server error while assigning the trip.');
    } finally {
      setStarting(false);
    }
  };

  const riskMeta = (risk) => {
    const r = Number(risk) || 0;
    if (r > 60) return { label: 'High risk', badge: 'HIGH', cls: 'text-rose-700 bg-rose-50 border-rose-200' };
    if (r > 30) return { label: 'Medium risk', badge: 'MED', cls: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Low risk', badge: 'LOW', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      <TransporterSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TransporterHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isDashboard={false} />

        <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0B1E36] tracking-tight leading-tight">Route Planning & Dispatch</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                Stage 3 & 4 of Transporter Lifecycle · Assign fleet assets, evaluate ML risk, and dispatch.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Corridors live · {trips.length} trips
            </div>
          </div>

          {/* Operational Lifecycle Stepper Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3.5 flex items-center justify-between gap-2 overflow-x-auto text-xs select-none">
            <div className="flex items-center gap-2 min-w-max">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-[10px]">1</span>
              <span className="font-bold text-slate-700">Fleet & Drivers ({vehicles.length}V / {drivers.length}D)</span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-2 min-w-max">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-black flex items-center justify-center text-[10px]">2</span>
              <span className="font-bold text-blue-800">Trip & Cargo</span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-2 min-w-max">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-[10px]">3</span>
              <span className="font-extrabold text-emerald-800">Route Evaluation & Risk</span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-2 min-w-max">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">4</span>
              <span className="font-medium text-slate-500">Live GPS Tracking</span>
            </div>
          </div>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Plan form */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
              <h3 className="text-sm font-black text-slate-800 flex items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
                <span className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-emerald-600" /> Plan Corridor & Assign Fleet
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  Step 1 → 3
                </span>
              </h3>
              <form onSubmit={handlePlan} className="space-y-4">
                {/* Step 1: Origin & Destination */}
                <div className="space-y-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                    Step 1: Origin & Destination Corridor
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Origin District</label>
                      <select value={originId} onChange={(e) => handleOriginChange(e.target.value)} className={inputCls}>
                        {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Destination District</label>
                      <select value={destId} onChange={(e) => handleDestChange(e.target.value)} className={inputCls}>
                        {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Step 2: Cargo Details */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                    Step 2: Consignment Cargo
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Commodity</label>
                      <select value={commodity} onChange={(e) => setCommodity(e.target.value)} className={inputCls}>
                        <option value="medicine">Medicine / Relief</option>
                        <option value="food">Food / Supplies</option>
                        <option value="agri">Agricultural</option>
                        <option value="fuel">Fuel</option>
                        <option value="construction">Construction</option>
                        <option value="general">General Cargo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Weight (kg)</label>
                      <input type="number" min="0" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="e.g. 1500" className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Step 3: Vehicle & Driver Assignment */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                    Step 3: Vehicle + Driver Assign
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle</label>
                      <select
                        value={vehicleId}
                        onChange={(e) => {
                          const vId = e.target.value;
                          setVehicleId(vId);
                          const selV = vehicles.find((v) => v.id === vId);
                          const pairedDriverId = selV?.assigned_driver_id || selV?.driver?.id;
                          if (pairedDriverId) setDriverId(pairedDriverId);
                        }}
                        className={inputCls}
                      >
                        {vehicles.length === 0 && <option value="">No vehicles registered</option>}
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.id} {v.driver?.name ? `(${v.driver.name})` : '(unassigned)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Driver</label>
                      <select
                        value={driverId}
                        onChange={(e) => {
                          const dId = e.target.value;
                          setDriverId(dId);
                          const selD = drivers.find((d) => d.id === dId);
                          if (selD?.vehicle_id) setVehicleId(selD.vehicle_id);
                        }}
                        className={inputCls}
                      >
                        {drivers.length === 0 && <option value="">No drivers onboarded</option>}
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} {d.vehicle_id ? `(${d.vehicle_id})` : '(no vehicle)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {vehicles.length === 0 && (
                  <p className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Add a vehicle (and driver) from My Vehicles first — trips run on real fleet assets.
                  </p>
                )}

                {planError && (
                  <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{planError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={planning || vehicles.length === 0}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm shadow-emerald-600/25 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Route className="w-4 h-4" />
                    <span>{planning ? 'Evaluating corridor options…' : 'Evaluate Route Corridors'}</span>
                  </button>
                  {(plan || roadPlan) && (
                    <button
                      type="button"
                      onClick={handleClearRoute}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
                      title="Clear plotted routes from map"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>

              {/* Plan result */}
              {plan && (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> Evaluated Corridors ({availableAlternatives.length})
                      </h4>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        Compare risk, distance & fuel — select any corridor to dispatch.
                      </p>
                    </div>
                  </div>

                  {/* Route Options List */}
                  <div className="space-y-2.5">
                    {availableAlternatives.map((alt) => {
                      const isSelected = alt.id === currentSelectedRoute?.id;
                      const meta = riskMeta(alt.riskScore);
                      return (
                        <div
                          key={alt.id}
                          onClick={() => setActiveRouteId(alt.id)}
                          className={`p-3.5 rounded-2xl transition-all cursor-pointer border ${
                            isSelected
                              ? 'border-2 border-emerald-600 bg-emerald-50/40 shadow-xs'
                              : 'border-slate-200/90 hover:border-emerald-300 bg-white hover:bg-slate-50/70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-black text-slate-900 truncate">{alt.name}</p>
                                {alt.isRecommended && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    RECOMMENDED
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                {alt.id === 'safest'
                                  ? 'Safety prioritized corridor'
                                  : alt.id === 'shortest'
                                  ? 'Direct shortest corridor'
                                  : 'Alternative bypass corridor'}
                              </p>
                            </div>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border flex-shrink-0 ${meta.cls}`}>
                              Risk {alt.riskScore}/100 · {meta.badge}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                            <div className="p-1.5 rounded-xl bg-white border border-slate-200/80">
                              <span className="flex items-center justify-center gap-1 text-[9px] font-bold text-slate-400">
                                <Navigation className="w-2.5 h-2.5" /> Distance
                              </span>
                              <span className="text-xs font-black text-slate-800 block mt-0.5">{alt.distanceKm} km</span>
                            </div>
                            <div className="p-1.5 rounded-xl bg-white border border-slate-200/80">
                              <span className="flex items-center justify-center gap-1 text-[9px] font-bold text-slate-400">
                                <Clock className="w-2.5 h-2.5" /> Travel
                              </span>
                              <span className="text-xs font-black text-slate-800 block mt-0.5">{alt.estimatedHours} hrs</span>
                            </div>
                            <div className="p-1.5 rounded-xl bg-white border border-slate-200/80">
                              <span className="flex items-center justify-center gap-1 text-[9px] font-bold text-slate-400">
                                <Fuel className="w-2.5 h-2.5" /> Fuel est.
                              </span>
                              <span className="text-xs font-black text-slate-800 block mt-0.5">₹{alt.fuelCostEstimate}</span>
                            </div>
                          </div>

                          {alt.legs && alt.legs.length > 0 && (
                            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-medium px-0.5">
                              <span>Road condition: <strong className="text-slate-700 capitalize">{alt.roadCondition || alt.legs[0]?.roadCondition || 'Good'}</strong></span>
                              <span>{alt.legs.length} segment{alt.legs.length === 1 ? '' : 's'}</span>
                            </div>
                          )}

                          {isSelected ? (
                            <div className="mt-2.5 py-1.5 px-2 rounded-xl bg-emerald-100/70 text-emerald-800 text-[11px] font-black flex items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Selected for Dispatch
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveRouteId(alt.id);
                              }}
                              className="mt-2.5 w-full py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Select This Route
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Ready to dispatch card */}
                  <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 mt-3 space-y-2.5">
                    <div className="flex items-center justify-between pb-1 border-b border-emerald-200/60">
                      <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-emerald-600" /> Selected Corridor:
                      </span>
                      <span className="text-xs font-black text-slate-900 truncate max-w-[200px] text-right">
                        {currentSelectedRoute?.name || 'Selected Route'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-medium">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Assigned Vehicle:</span>
                        <span className="font-bold text-slate-800">{vehicleId || 'None'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Assigned Driver:</span>
                        <span className="font-bold text-slate-800">{drivers.find((d) => d.id === driverId)?.name || driverId || 'None'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleStartTrip(false)}
                        disabled={starting || vehicles.length === 0}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold shadow-sm shadow-emerald-700/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{starting ? 'Assigning…' : 'Assign to Driver'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartTrip(true)}
                        disabled={starting || vehicles.length === 0}
                        className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-emerald-600 text-emerald-800 text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{starting ? 'Dispatching…' : 'Dispatch & Start Now'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Map */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Corridor Map</h3>
                  <span className="text-[10px] font-bold text-slate-500">
                    {originD?.label} → {destD?.label}
                  </span>
                </div>

                {availableAlternatives.length > 1 && (
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Routes:</span>
                    {availableAlternatives.map((alt) => {
                      const isSelected = alt.id === currentSelectedRoute?.id;
                      return (
                        <button
                          key={alt.id}
                          type="button"
                          onClick={() => setActiveRouteId(alt.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {alt.name} ({alt.distanceKm} km · risk {alt.riskScore})
                          {isSelected && <CheckCircle2 className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="relative w-full h-[380px] sm:h-[430px] rounded-xl overflow-hidden border border-slate-200/80 z-0">
                  <MapContainer center={originD ? [originD.lat, originD.lng] : [28.3842, 77.2878]} zoom={12} zoomControl={false} scrollWheelZoom className="w-full h-full">
                    <ResilientTileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapZoomControls position="top-right" compact />
                    <MapViewportSync points={roadPoints} originD={originD} destD={destD} focusedPoint={focusedPoint} />

                    {/* Alternative Routes (dashed line, clickable) */}
                    {mapAlternatives.map((alt) => (
                      <Polyline
                        key={'trans-alt-' + alt.id}
                        positions={alt.geometry}
                        pathOptions={{ color: '#64748B', weight: 3.5, opacity: 0.75, dashArray: '6, 5' }}
                        eventHandlers={{ click: () => setActiveRouteId(alt.id) }}
                      >
                        <Popup>
                          <div className="text-xs p-1">
                            <strong className="text-slate-900">{alt.name}</strong>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {alt.distanceKm} km · {alt.estimatedHours} hrs | Risk {alt.riskScore}/100 ({alt.riskLevel})
                            </p>
                            <button
                              type="button"
                              onClick={() => setActiveRouteId(alt.id)}
                              className="mt-2 w-full px-2.5 py-1 bg-emerald-600 text-white rounded-md text-[10px] font-bold cursor-pointer hover:bg-emerald-700"
                            >
                              Select & Activate Route
                            </button>
                          </div>
                        </Popup>
                      </Polyline>
                    ))}

                    {/* Active Route */}
                    {roadPoints.length > 1 && (
                      <Polyline positions={roadPoints} pathOptions={{ color: '#0D7A48', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}>
                        <Popup>
                          <div className="text-xs p-1">
                            <strong className="text-emerald-800">{currentSelectedRoute?.name || 'Active Corridor (OSRM)'}</strong>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {currentSelectedRoute?.distanceKm || currentSelectedRoute?.totalDistanceKm} km | risk {currentSelectedRoute?.riskScore}/100 ({currentSelectedRoute?.riskLevel})
                              {' | '}{roadLegs.length} road segment{roadLegs.length === 1 ? '' : 's'}
                            </p>
                            <span className="inline-block mt-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Selected Corridor
                            </span>
                          </div>
                        </Popup>
                      </Polyline>
                    )}
                    {originD && (
                      <Marker position={[originD.lat, originD.lng]} icon={dotIcon('#059669')}>
                        <Popup><div className="text-xs font-bold">{originD.label}<p className="text-[10px] text-slate-500">Origin</p></div></Popup>
                      </Marker>
                    )}
                    {destD && (
                      <Marker position={[destD.lat, destD.lng]} icon={dotIcon('#EF4444')}>
                        <Popup><div className="text-xs font-bold">{destD.label}<p className="text-[10px] text-slate-500">Destination</p></div></Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
                {roadLoading && roadPoints.length === 0 && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Fetching real road route (OSRM)...
                  </p>
                )}
                {roadLegs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {roadLegs.slice(0, 5).map((leg, i) => (
                      <span key={i} className="text-[9px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                        {leg.label || leg.roadLabel || `Segment ${i + 1}`}
                        <span className="ml-1 text-slate-400">{leg.distanceKm} km</span>
                        {leg.riskLevel === 'high' || leg.riskLevel === 'critical' || leg.riskScore > 60
                          ? <span className="ml-1 text-rose-600">risk {leg.riskScore}</span>
                          : leg.riskScore > 30
                          ? <span className="ml-1 text-amber-600">risk {leg.riskScore}</span>
                          : <span className="ml-1 text-emerald-600">risk {leg.riskScore}</span>}
                        {leg.rainfallMm != null && <span className="ml-1 text-sky-600">{leg.rainfallMm}mm rain</span>}
                        {leg.landslideRisk && leg.landslideRisk !== 'Low' && leg.landslideRisk !== 'Very Low' && <span className="ml-1 text-amber-600">landslide {leg.landslideRisk}</span>}
                        {leg.congestionLevel && leg.congestionLevel !== 'low' && <span className="ml-1 text-orange-600">traffic {leg.congestionLevel}</span>}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-2">
                  {roadPoints.length > 1
                    ? 'Route line follows the real OSRM road network between the selected districts. Conditions per road segment are live.'
                    : 'Select both districts - the road-following route will be drawn here. A corridor must exist in the route network to start a trip.'}
                </p>
              </div>
            </div>
          </section>

          {/* Trips */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2"><Truck className="w-4 h-4 text-emerald-600" /> Scheduled Trips</h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">FROM YOUR FLEET</span>
            </div>
            {loading ? (
              <div className="p-10 text-center text-slate-400 text-sm font-medium">Loading trips…</div>
            ) : trips.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs font-medium">
                No trips yet — evaluate a corridor above and start your first trip.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {trips.slice(0, 8).map((tp) => {
                  const st = (tp.status || 'planned').toLowerCase();
                  const statusCls = st === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : st === 'in_transit' ? 'bg-blue-50 text-blue-700 border-blue-200' : st === 'delayed' ? 'bg-amber-50 text-amber-700 border-amber-200' : st === 'canceled' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200';
                  return (
                    <div key={tp.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3 hover:bg-slate-50/60 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
                        <Navigation className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900 truncate">{tp.id} · {tp.origin} → {tp.destination}</p>
                        <p className="text-[11px] text-slate-500 truncate flex items-center gap-2 mt-0.5">
                          <Truck className="w-3 h-3" /> {tp.vehicle?.id || '—'}
                          <User className="w-3 h-3" /> {tp.driver?.name || '—'}
                          <Clock className="w-3 h-3" /> ETA {tp.eta ? new Date(tp.eta).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </p>
                      </div>
                      {tp.progress_percent > 0 && (
                        <div className="w-24 flex-shrink-0">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(tp.progress_percent, 100)}%` }} />
                          </div>
                          <span className="text-[9px] text-slate-400 font-bold">{tp.progress_percent}%</span>
                        </div>
                      )}
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border capitalize flex-shrink-0 ${statusCls}`}>{st.replace('_', ' ')}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[9999] bg-[#0B1E36] text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700/80 flex items-center gap-2.5 text-xs font-bold"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
