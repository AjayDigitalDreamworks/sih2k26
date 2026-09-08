import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);

  const [originId, setOriginId] = useState('dabua_chowk');
  const [destId, setDestId] = useState('aravali_college');
  const [focusedPoint, setFocusedPoint] = useState(null);
  const [activeRouteId, setActiveRouteId] = useState('safest');
  const [commodity, setCommodity] = useState('general');
  const [weightKg, setWeightKg] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');

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
    const d = districtById(newOrigin);
    if (d) setFocusedPoint([d.lat, d.lng]);
  };

  const handleDestChange = (newDest) => {
    setDestId(newDest);
    const d = districtById(newDest);
    if (d) setFocusedPoint([d.lat, d.lng]);
  };

  // Real road geometry (OSRM via ML planner) for the selected pair - debounced with 150ms
  const [roadPlan, setRoadPlan] = useState(null);
  const [roadLoading, setRoadLoading] = useState(false);
  const roadSeq = useRef(0);
  useEffect(() => {
    if (!originId || !destId || originId === destId) {
      setRoadPlan(null);
      return;
    }
    const mySeq = ++roadSeq.current;
    const t = setTimeout(async () => {
      setRoadLoading(true);
      try {
        const res = await ApiClient.planRoute({ originDistrictId: originId, destDistrictId: destId, prefer: 'safest' });
        if (mySeq !== roadSeq.current) return;
        if (res?.success && (res.data?.success || res.data?.recommended)) {
          setRoadPlan(res.data);
          setActiveRouteId(res.data.preferred || res.data.alternatives?.[0]?.id || 'safest');
        } else {
          setRoadPlan(null);
        }
      } catch (e) {
        if (mySeq === roadSeq.current) setRoadPlan(null);
      } finally {
        if (mySeq === roadSeq.current) setRoadLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [originId, destId]);

  const activeRoadRoute = (roadPlan?.alternatives || []).find((a) => a.id === activeRouteId) || roadPlan?.recommended || null;
  const roadLegs = activeRoadRoute?.legs || [];
  const roadPoints = activeRoadRoute?.geometry || [];

  const handlePlan = async (e) => {
    e.preventDefault();
    if (originId === destId) {
      setPlanError('Origin and destination must be different districts.');
      return;
    }
    setPlanning(true);
    setPlanError('');
    setPlan(null);
    try {
      const res = await ApiClient.planTrip({
        originDistrictId: originId,
        destDistrictId: destId,
        commodityType: commodity,
        weightKg: parseInt(String(weightKg).replace(/[^\d]/g, ''), 10) || 1000,
      });
      if (!res?.success) {
        setPlanError(res?.message || 'Could not plan this route.');
      } else {
        setPlan(res.data);
      }
    } catch (err) {
      console.error(err);
      setPlanError('Server error while planning the route.');
    } finally {
      setPlanning(false);
    }
  };

  const handleStartTrip = async () => {
    if (!plan?.primary?.routeId) return;
    if (!vehicleId || !driverId) {
      setPlanError('Select a real vehicle and driver from your fleet to start the trip.');
      return;
    }
    setStarting(true);
    try {
      const res = await ApiClient.createTrip({
        routeId: plan.primary.routeId,
        vehicleId,
        driverId,
        origin: plan.primary.name.split('→')[0]?.trim(),
        destination: plan.primary.name.split('→')[1]?.trim(),
      });
      if (!res?.success) {
        setPlanError(res?.message || 'Could not start trip.');
      } else {
        triggerToast(`Trip ${res.data.id} started — vehicle on the corridor.`);
        setPlan(null);
        await loadFleet();
      }
    } catch (err) {
      console.error(err);
      setPlanError('Server error while starting the trip.');
    } finally {
      setStarting(false);
    }
  };

  const riskMeta = (risk) => (risk != null && risk > 60 ? { label: 'High risk', cls: 'text-rose-600 bg-rose-50 border-rose-200' } : { label: 'Low risk', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' });

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      <TransporterSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TransporterHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isDashboard={false} />

        <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0B1E36] tracking-tight leading-tight">Route Planning</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                Plan trips over real NER corridors with live risk evaluation.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Corridors live · {trips.length} trips
            </div>
          </div>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Plan form */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-4">
                <Route className="w-4 h-4 text-emerald-600" /> Plan a New Trip
              </h3>
              <form onSubmit={handlePlan} className="space-y-4">
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

                {vehicles.length === 0 && (
                  <p className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Add a vehicle (and driver) from My Vehicles first — trips run on real fleet assets.
                  </p>
                )}

                {planError && (
                  <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{planError}</p>
                )}

                <button
                  type="submit"
                  disabled={planning || vehicles.length === 0}
                  className="w-full py-3 rounded-full bg-[#087f4d] hover:bg-[#06663e] text-xs font-bold text-white shadow-sm shadow-emerald-700/25 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {planning ? 'Evaluating corridor…' : 'Evaluate Route'}
                </button>
              </form>

              {/* Plan result */}
              {plan && (
                <div className="mt-4 space-y-3">
                  <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-slate-800">{plan.primary.name}</p>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Route {plan.primary.routeId} · real corridor</p>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${riskMeta(plan.primary.riskScore).cls}`}>
                        {riskMeta(plan.primary.riskScore).label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                        <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400"><Navigation className="w-3 h-3" /> Distance</span>
                        <span className="text-xs font-black text-slate-800 block mt-0.5">{plan.primary.distanceKm} km</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                        <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400"><Clock className="w-3 h-3" /> Travel</span>
                        <span className="text-xs font-black text-slate-800 block mt-0.5">{plan.primary.estimatedHours} hrs</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                        <span className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400"><Fuel className="w-3 h-3" /> Fuel est.</span>
                        <span className="text-xs font-black text-slate-800 block mt-0.5">₹{plan.primary.fuelCostEstimate}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartTrip}
                      disabled={starting}
                      className="mt-3 w-full py-3 rounded-full bg-[#087f4d] hover:bg-[#06663e] text-white text-xs font-bold shadow-sm shadow-emerald-700/25 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {starting ? 'Starting trip…' : `Start Trip on ${plan.primary.routeId}`}
                    </button>
                  </div>

                  {plan.alternates.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Other real corridors from origin</p>
                      {plan.alternates.map((alt) => (
                        <div key={alt.routeId} className="flex items-center justify-between text-[11px] py-1.5 border-b border-slate-100 last:border-0">
                          <span className="font-bold text-slate-700 truncate">{alt.name}</span>
                          <span className="text-slate-400 font-semibold flex-shrink-0 ml-2">{alt.distanceKm} km · {alt.estimatedHours} hrs</span>
                        </div>
                      ))}
                    </div>
                  )}
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

                {roadPlan?.alternatives && roadPlan.alternatives.length > 1 && (
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span className="text-[10px] font-black text-slate-500 uppercase">Routes:</span>
                    {roadPlan.alternatives.map((alt) => {
                      const isSelected = alt.id === activeRouteId;
                      return (
                        <button
                          key={alt.id}
                          type="button"
                          onClick={() => setActiveRouteId(alt.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {alt.name} ({alt.totalDistanceKm || alt.distanceKm} km · risk {alt.riskScore})
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
                    {roadPlan?.alternatives &&
                      roadPlan.alternatives
                        .filter((a) => a.id !== activeRouteId && a.geometry && a.geometry.length > 1)
                        .map((alt) => (
                          <Polyline
                            key={'trans-alt-' + alt.id}
                            positions={alt.geometry}
                            pathOptions={{ color: '#64748B', weight: 3.5, opacity: 0.75, dashArray: '6, 5' }}
                            eventHandlers={{ click: () => setActiveRouteId(alt.id) }}
                          >
                            <Popup>
                              <div className="text-xs">
                                <strong>{alt.name}</strong>
                                <p className="text-[10px] text-slate-500">
                                  {alt.totalDistanceKm || alt.distanceKm} km | Risk {alt.riskScore}/100
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setActiveRouteId(alt.id)}
                                  className="mt-1 px-2.5 py-1 bg-emerald-600 text-white rounded-md text-[10px] font-bold cursor-pointer"
                                >
                                  Activate Route
                                </button>
                              </div>
                            </Popup>
                          </Polyline>
                        ))}

                    {/* Active Route */}
                    {roadPoints.length > 1 && (
                      <Polyline positions={roadPoints} pathOptions={{ color: '#0D7A48', weight: 4.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}>
                        <Popup>
                          <div className="text-xs">
                            <strong>{activeRoadRoute?.name || 'Real road route (OSRM)'}</strong>
                            <p className="text-[10px] text-slate-500">
                              {activeRoadRoute?.totalDistanceKm || activeRoadRoute?.distanceKm} km | risk {activeRoadRoute?.riskScore}/100 ({activeRoadRoute?.riskLevel})
                              {' | '}{roadLegs.length} road segment{roadLegs.length === 1 ? '' : 's'}
                            </p>
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
                    {roadLegs.slice(0, 4).map((leg, i) => (
                      <span key={i} className="text-[9px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                        {leg.label}
                        <span className="ml-1 text-slate-400">{leg.distanceKm} km</span>
                        {leg.riskLevel === 'high' || leg.riskLevel === 'critical'
                          ? <span className="ml-1 text-rose-600">risk {leg.riskScore}</span>
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
