import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Route,
  MapPin,
  Navigation,
  IndianRupee,
  Gauge,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Layers,
  Activity,
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const consignmentIdParam = searchParams.get('consignmentId');
  const [activeConsignment, setActiveConsignment] = useState(null);
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

  // Route Optimization Engine & Blockage consideration controls
  const [preferMode, setPreferMode] = useState('safest');
  const [avoidLandslides, setAvoidLandslides] = useState(true);
  const [avoidFloods, setAvoidFloods] = useState(true);
  const [avoidRoadDamage, setAvoidRoadDamage] = useState(true);
  const [avoidCongestion, setAvoidCongestion] = useState(true);
  const [vehicleProfile, setVehicleProfile] = useState('heavy_multi_axle');
  const [showAdvancedBlockages, setShowAdvancedBlockages] = useState(false);

  // Auto-detect vehicle profile from selected fleet truck
  useEffect(() => {
    const selV = vehicles.find((v) => v.id === vehicleId);
    if (selV) {
      const model = String(selV.model || selV.type || '').toLowerCase();
      if (model.includes('tanker') || model.includes('hazardous') || commodity === 'hazardous') {
        setVehicleProfile('hazardous_tanker');
      } else if (model.includes('ace') || model.includes('bolero') || model.includes('light')) {
        setVehicleProfile('light_commercial');
      } else if (model.includes('407') || model.includes('eicher') || model.includes('medium')) {
        setVehicleProfile('medium_commercial');
      } else {
        setVehicleProfile('heavy_multi_axle');
      }
    }
  }, [vehicleId, vehicles, commodity]);

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
        const rawVehicles = vres.value.data || [];
        // Sort so available vehicles appear first
        const sorted = [...rawVehicles].sort((a, b) => {
          const aBusy = a.status === 'moving' || a.status === 'in_transit';
          const bBusy = b.status === 'moving' || b.status === 'in_transit';
          if (aBusy === bBusy) return 0;
          return aBusy ? 1 : -1;
        });
        setVehicles(sorted);
        // Auto-select first available vehicle
        const firstAvailable = sorted.find((v) => v.status !== 'moving' && v.status !== 'in_transit') || sorted[0];
        setVehicleId((prev) => prev || (firstAvailable?.id || ''));
        const pairedDriverId = firstAvailable?.assigned_driver_id || firstAvailable?.driver?.id;
        if (pairedDriverId) setDriverId(pairedDriverId);
      }
      if (dres.status === 'fulfilled' && dres.value?.success) {
        setDrivers(dres.value.data || []);
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

  // If a consignmentId was passed, auto-fetch details if origin/dest weren't in query params
  useEffect(() => {
    if (!consignmentIdParam) return;
    const fetchConsignment = async () => {
      try {
        const res = await ApiClient.getTransporterDeliveries();
        if (res?.success && Array.isArray(res.data)) {
          const match = res.data.find(
            (d) => d.id === consignmentIdParam || d.tracking_number === consignmentIdParam
          );
          if (match) {
            setActiveConsignment(match);
            if (match.origin_district_id && !searchParams.get('origin')) {
              setOriginId(match.origin_district_id);
            }
            if (match.dest_district_id && !searchParams.get('dest')) {
              setDestId(match.dest_district_id);
            }
            if (match.commodity_type && !searchParams.get('commodity')) {
              setCommodity(match.commodity_type);
            }
            if (match.weight_kg && !searchParams.get('weight')) {
              setWeightKg(String(match.weight_kg));
            }
          }
        }
      } catch (e) {
        console.warn('Could not auto-fetch consignment info:', e);
      }
    };
    fetchConsignment();
  }, [consignmentIdParam, searchParams]);

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
          costEstimate: alt.costEstimate || alt.transitCost || Math.round(dKm * 14.5),
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
          costEstimate: Math.round(dKm * 14.5),
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
      // Build corridor avoidance list based on selected blockage types
      const avoidCorridors = [];
      if (avoidLandslides) {
        avoidCorridors.push('cachar-aizawl', 'dimapur-imphal_west', 'dima_hasao-imphal_west');
      }
      if (avoidRoadDamage) {
        avoidCorridors.push('dima_hasao-dimapur', 'dima_hasao-cachar', 'sonitpur-kohima');
      }

      const [tripRes, roadRes] = await Promise.allSettled([
        ApiClient.planTrip({
          originDistrictId: originId,
          destDistrictId: destId,
          commodityType: commodity,
          weightKg: parseInt(String(weightKg).replace(/[^\d]/g, ''), 10) || 1000,
          prefer: preferMode,
          avoidCorridors,
          vehicleProfile,
        }),
        ApiClient.planRoute({
          originDistrictId: originId,
          destDistrictId: destId,
          prefer: preferMode,
          avoidCorridors,
          vehicleProfile,
          commodityType: commodity,
          weightKg: parseInt(String(weightKg).replace(/[^\d]/g, ''), 10) || 1000,
        }),
      ]);

      if (roadRes.status === 'fulfilled' && roadRes.value?.success && (roadRes.value.data?.success || roadRes.value.data?.recommended)) {
        setRoadPlan(roadRes.value.data);
      }

      if (tripRes.status === 'fulfilled' && tripRes.value?.success) {
        setPlan(tripRes.value.data);
        const preferredId = tripRes.value.data?.primary?.id || tripRes.value.data?.alternatives?.[0]?.id || 'safest';
        setActiveRouteId(preferredId);
        const detourMsg = tripRes.value.data?.rerouted
          ? ' · Dynamic safe bypass applied around active blockage!'
          : '';
        triggerToast(`Evaluated corridor options (${preferMode.toUpperCase()}). Recommended: ${tripRes.value.data?.primary?.name || 'Safest route'}${detourMsg}`);
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
      setPlanError('Select an available vehicle and driver from your fleet to assign the corridor.');
      return;
    }
    setStarting(true);
    setPlanError('');
    try {
      const originLabel = originD?.label || plan?.origin?.name || targetRoute.name?.split('→')?.[0]?.trim() || originId;
      const destLabel = destD?.label || plan?.destination?.name || targetRoute.name?.split('→')?.[1]?.trim() || destId;

      const res = await ApiClient.createTrip({
        consignmentId: consignmentIdParam || undefined,
        deliveryId: consignmentIdParam || undefined,
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
        const selV = vehicles.find((v) => v.id === vehicleId);
        const driverName = selD?.name || 'Driver';
        const vehiclePlate = selV?.registration_number || vehicleId;

        if (startImmediately) {
          triggerToast(`Trip dispatched! Route sent to driver ${driverName} on vehicle ${vehiclePlate}. Opening live map...`);
          setPlan(null);
          setRoadPlan(null);
          setRoadLoading(false);
          setTimeout(() => {
            navigate('/transporter/live-tracking');
          }, 800);
        } else {
          triggerToast(`Route sent to driver ${driverName} on vehicle ${vehiclePlate}! Driver can now view navigation and start trip.`);
          setPlan(null);
          setRoadPlan(null);
          setRoadLoading(false);
          setFocusedPoint(null);
          await loadFleet();
        }
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
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-700">
              <span>{trips.length} Active Trips</span>
            </div>
          </div>

          {/* Active Consignment Assignment Banner */}
          {consignmentIdParam && (
            <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Consignment Assignment
                    </span>
                    <span className="font-extrabold text-[#0B1E36]">{consignmentIdParam}</span>
                    {activeConsignment?.consignee_name && (
                      <span className="text-slate-600 font-medium">
                        · Consignee: <strong className="text-slate-800">{activeConsignment.consignee_name}</strong>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Consignment order linked. Select vehicle and driver, evaluate route corridor, and dispatch navigation directly to the driver.
                  </p>
                </div>
              </div>
            </div>
          )}

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
                        <option value="hazardous">Hazardous / Chemicals</option>
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
                        {vehicles.map((v) => {
                          const isBusy = v.status === 'moving' || v.status === 'in_transit';
                          return (
                            <option key={v.id} value={v.id}>
                              {isBusy ? '🟡' : '🟢'} {v.id} {v.driver?.name ? `(${v.driver.name})` : '(unassigned)'} {isBusy ? '— Busy / In Transit' : '— Ready'}
                            </option>
                          );
                        })}
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

                {/* Step 4: Route Optimization Engine & Blockage Considerations */}
                <div className="space-y-2.5 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                      Step 4: Optimization Engine & Blockages
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedBlockages((v) => !v)}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{showAdvancedBlockages ? 'Simple Mode' : 'Blockage Rules'}</span>
                    </button>
                  </div>

                  {/* Mode Selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'safest', label: 'Safest', desc: 'Zero-hazard detour' },
                      { id: 'shortest', label: 'Shortest', desc: 'Min distance' },
                      { id: 'balanced', label: 'Balanced', desc: 'Safe & Fast' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPreferMode(m.id)}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          preferMode === m.id
                            ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <span className="block text-xs font-black">{m.label}</span>
                        <span className="block text-[9px] text-slate-400 mt-0.5">{m.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Blockage Types Toggled by Engine */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      Active Obstruction & Risk Filters:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={avoidLandslides}
                          onChange={(e) => setAvoidLandslides(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                        />
                        <span className="text-[11px] font-bold">Landslides & Slopes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={avoidFloods}
                          onChange={(e) => setAvoidFloods(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                        />
                        <span className="text-[11px] font-bold">Floods & Waterlogging</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={avoidRoadDamage}
                          onChange={(e) => setAvoidRoadDamage(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                        />
                        <span className="text-[11px] font-bold">Road Damage & Closures</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                        <input
                          type="checkbox"
                          checked={avoidCongestion}
                          onChange={(e) => setAvoidCongestion(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                        />
                        <span className="text-[11px] font-bold">Heavy Traffic Choke Points</span>
                      </label>
                    </div>

                    {showAdvancedBlockages && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          Vehicle Physics Profile
                        </label>
                        <select
                          value={vehicleProfile}
                          onChange={(e) => setVehicleProfile(e.target.value)}
                          className={inputCls}
                        >
                          <option value="heavy_multi_axle">Heavy Multi-Axle (16T–28T · Max 10% Slope)</option>
                          <option value="hazardous_tanker">Hazardous / POL Tanker (Max 9% Slope · 32 km/h)</option>
                          <option value="medium_commercial">Medium Truck (Tata 407 / Eicher 11.10)</option>
                          <option value="light_commercial">Light Commercial (Tata Ace / Bolero Pickup)</option>
                        </select>
                      </div>
                    )}
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
                  {/* Dynamic Bypass Alert if hazard detour occurred */}
                  {(plan?.rerouted || roadPlan?.rerouted || (plan?.avoidedCorridors && plan.avoidedCorridors.length > 0)) && (
                    <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs shadow-2xs space-y-1.5">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span className="font-black uppercase tracking-wider text-[10px] bg-amber-200 px-2 py-0.5 rounded text-amber-900">
                          Active Hazard Avoidance
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 text-xs leading-snug">
                        {plan.rerouteReason || roadPlan?.rerouteReason || 'Corridor blockages detected. Route optimization engine calculated a safe bypass detour.'}
                      </p>
                      {plan.avoidedCorridors && plan.avoidedCorridors.length > 0 && (
                        <p className="text-[11px] text-slate-600 font-medium">
                          Bypassed high-risk corridor segments: <strong className="text-slate-800">{plan.avoidedCorridors.join(', ')}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Corridor Obstruction & Risk Assessment if alerts exist */}
                  {plan.alerts && plan.alerts.length > 0 && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          Corridor Obstruction & Risk Assessment ({plan.alerts.length})
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700">Live ML Evaluated</span>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                        {plan.alerts.map((a, i) => (
                          <div key={i} className="p-2 rounded-xl bg-white border border-slate-200 text-[11px] flex items-start gap-2 shadow-2xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-900">{a.title}</span>
                              <p className="text-slate-500 text-[10px] mt-0.5 leading-snug">{a.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Phase 2.3: Bridge Weight Capacity Enforcement Banner */}
                  {plan.bridgeWarning && (
                    <div className={`p-3.5 rounded-2xl border text-xs shadow-2xs space-y-1.5 ${
                      plan.bridgeWarning.overloaded
                        ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                        : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-1.5">
                        <div className="flex items-center gap-2">
                          {plan.bridgeWarning.overloaded ? (
                            <ShieldAlert className="w-4 h-4 text-rose-700 flex-shrink-0" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                          )}
                          <span className={`font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded ${
                            plan.bridgeWarning.overloaded
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-emerald-200 text-emerald-900'
                          }`}>
                            {plan.bridgeWarning.overloaded ? 'Bridge Load Violation' : 'Bridge Clearance Verified'}
                          </span>
                        </div>
                        {plan.bridgeWarning.surveyStale && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            Survey &gt;12mo Stale
                          </span>
                        )}
                        {!plan.bridgeWarning.bridgeDataAvailable && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            Unverified Route — No Survey Data
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 text-xs leading-snug">
                        {plan.bridgeWarning.overloaded
                          ? `Vehicle Gross Weight (${plan.bridgeWarning.vehicleGvwTons}T GVW) exceeds ${plan.bridgeWarning.bridgeName || 'Corridor Bailey Bridge'} capacity (${plan.bridgeWarning.capacityTons}T). Rerouting detour mandatory.`
                          : `Bridge load check passed: ${plan.bridgeWarning.bridgeName || 'Bailey Bridge'} capacity (${plan.bridgeWarning.capacityTons}T) safely accommodates vehicle (${plan.bridgeWarning.vehicleGvwTons}T GVW).`}
                      </p>
                    </div>
                  )}

                  {/* Official IMD Corridor Safety Advisory Banner */}
                  {((plan?.tradeoffMatrix?.weatherImpact && plan.tradeoffMatrix.weatherImpact !== 'NONE') ||
                    (roadPlan?.imdCorridorAdvisory && roadPlan.imdCorridorAdvisory.weather_impact !== 'NONE')) && (() => {
                    const impact = plan?.tradeoffMatrix?.weatherImpact || roadPlan?.imdCorridorAdvisory?.weather_impact || 'MODERATE';
                    const advisory = plan?.tradeoffMatrix?.imdAdvisory || roadPlan?.imdCorridorAdvisory?.recommendation || 'Official IMD Weather Warning active along corridor.';
                    const colors = plan?.tradeoffMatrix?.warningColors || roadPlan?.imdCorridorAdvisory?.warning_colors || [];
                    const maxRain = plan?.tradeoffMatrix?.maxRainfallMm || roadPlan?.imdCorridorAdvisory?.max_rainfall_mm || 0;
                    const isSevere = impact === 'SEVERE' || colors.includes('red');

                    return (
                      <div className={`p-3.5 rounded-2xl border text-xs shadow-sm space-y-2 ${
                        isSevere
                          ? 'bg-rose-50 border-rose-300 text-rose-950'
                          : 'bg-amber-50 border-amber-300 text-amber-950'
                      }`}>
                        <div className="flex items-center justify-between flex-wrap gap-1.5">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className={`w-4 h-4 flex-shrink-0 ${isSevere ? 'text-rose-600' : 'text-amber-600'}`} />
                            <span className="font-black tracking-wide uppercase text-[10px] px-2 py-0.5 rounded bg-white/80 border border-current shadow-xs">
                              IMD Mausam · Corridor Advisory
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {colors.map((c, idx) => (
                              <span key={idx} className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                c === 'red' ? 'bg-rose-600 text-white' : c === 'orange' ? 'bg-amber-500 text-white' : 'bg-yellow-400 text-slate-900'
                              }`}>
                                {c} Alert
                              </span>
                            ))}
                            {maxRain > 0 && (
                              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                                {maxRain} mm/24h Rain
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="font-extrabold text-slate-900 text-xs leading-snug">
                          {advisory}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold pt-1 border-t border-slate-200/60">
                          <span>India Meteorological Department · MoES</span>
                          <span>Advisory: {isSevere ? 'Speed <25 km/h · Detour Recommended' : 'Drive with caution'}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Phase 2.4: Cost vs. Safety Tradeoff Matrix Card */}
                  {plan.tradeoffMatrix && (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-slate-700 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" /> Commercial Tradeoff Matrix
                        </span>
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Primary vs. Detour
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Primary Route</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                              {plan.tradeoffMatrix.primary.hazardPct}% Hazard
                            </span>
                          </div>
                          <p className="text-sm font-black text-white">{plan.tradeoffMatrix.primary.distanceKm} km · {plan.tradeoffMatrix.primary.hours}h</p>
                          <p className="text-[11px] font-bold text-slate-300 mt-0.5">₹{plan.tradeoffMatrix.primary.dieselCost} Fuel</p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-emerald-500/40">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-emerald-400 uppercase">Detour Corridor</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                              {plan.tradeoffMatrix.detour.hazardPct}% Hazard
                            </span>
                          </div>
                          <p className="text-sm font-black text-white">{plan.tradeoffMatrix.detour.distanceKm} km · {plan.tradeoffMatrix.detour.hours}h</p>
                          <p className="text-[11px] font-bold text-slate-300 mt-0.5">₹{plan.tradeoffMatrix.detour.dieselCost} Fuel</p>
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="font-semibold leading-snug">{plan.tradeoffMatrix.recommendation}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> Evaluated Corridors ({availableAlternatives.length})
                      </h4>
                      <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                        Compare risk, distance & transit time — select any corridor to dispatch.
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
                                <IndianRupee className="w-2.5 h-2.5" /> Transit est.
                              </span>
                              <span className="text-xs font-black text-slate-800 block mt-0.5">₹{alt.costEstimate || Math.round(alt.distanceKm * 18)}</span>
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
                        className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>{starting ? 'Sending Route…' : 'Assign & Send to Driver'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartTrip(true)}
                        disabled={starting || vehicles.length === 0}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold shadow-sm shadow-emerald-700/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-300" />
                        <span>{starting ? 'Dispatching…' : 'Dispatch & Send Route to Driver'}</span>
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
                  <p className="text-[10px] text-slate-500 font-semibold mt-2">
                    Calculating road route (OSRM)...
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
