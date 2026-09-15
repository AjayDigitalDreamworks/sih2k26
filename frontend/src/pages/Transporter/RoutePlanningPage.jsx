import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Route,
  Calendar,
  CloudSun,
  Navigation,
  Truck,
  User,
  Package,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Download,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';

import { RoutePlannerMap } from '@/components/admin/routeOptimization/RoutePlannerMap';
import { RouteSequenceTimeline } from '@/components/admin/routeOptimization/RouteSequenceTimeline';
import { DistanceComparisonChart } from '@/components/admin/routeOptimization/DistanceComparisonChart';
import { CostBreakdownChart } from '@/components/admin/routeOptimization/CostBreakdownChart';
import { RouteEfficiencyGauge } from '@/components/admin/routeOptimization/RouteEfficiencyGauge';
import { AlternativeRoutesTable } from '@/components/admin/routeOptimization/AlternativeRoutesTable';
import { RouteInsightsCard } from '@/components/admin/routeOptimization/RouteInsightsCard';
import { CorridorsRequiringReroute } from '@/components/admin/routeOptimization/CorridorsRequiringReroute';
import { SafeBypassModal } from '@/components/admin/modals/SafeBypassModal';
import AddVehicleModal from '@/components/vehicles/AddVehicleModal';
import AddDriverModal from '@/components/drivers/AddDriverModal';

import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import ApiClient from '@/lib/api';
import { useApp } from '@/contexts/AppContext';

export default function RoutePlanningPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { weather, setRoutePlannerInitialState } = useApp() || {};

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [activeRouteId, setActiveRouteId] = useState('safest');
  const [selectedBypassCorridor, setSelectedBypassCorridor] = useState(null);

  // Fleet Asset & Dispatch State
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(searchParams.get('vehicle') || '');
  const [selectedDriverId, setSelectedDriverId] = useState(searchParams.get('driver') || '');
  const [commodity, setCommodity] = useState(searchParams.get('commodity') || 'General Freight');
  const [weightKg, setWeightKg] = useState(searchParams.get('weight') || '12000');
  const [dispatching, setDispatching] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);

  // URL Parameters
  const consignmentIdParam = searchParams.get('consignmentId');
  const originParam = searchParams.get('origin');
  const destParam = searchParams.get('dest');
  const [activeConsignment, setActiveConsignment] = useState(null);

  // Pre-load from URL params or Consignment
  useEffect(() => {
    if (originParam || destParam) {
      if (setRoutePlannerInitialState) {
        setRoutePlannerInitialState({
          fromDistrictId: originParam || 'dabua_chowk',
          toDistrictId: destParam || 'aravali_college',
          prefer: 'safest',
        });
      }
    }
  }, [originParam, destParam, setRoutePlannerInitialState]);

  // Load consignment details if consignmentId is in URL
  useEffect(() => {
    if (consignmentIdParam) {
      const loadConsignment = async () => {
        try {
          let consignment = null;
          if (typeof ApiClient?.getConsignment === 'function') {
            const res = await ApiClient.getConsignment(consignmentIdParam);
            if (res?.success && res.data) consignment = res.data;
          }
          if (!consignment && typeof ApiClient?.getTransporterDeliveries === 'function') {
            const res = await ApiClient.getTransporterDeliveries();
            if (res?.success && Array.isArray(res.data)) {
              consignment = res.data.find(
                (d) => d.id === consignmentIdParam || d.tracking_number === consignmentIdParam
              );
            }
          }

          if (consignment) {
            setActiveConsignment(consignment);
            if (consignment.commodity) setCommodity(consignment.commodity);
            if (consignment.weight_kg) setWeightKg(String(consignment.weight_kg));
            if (consignment.origin && consignment.destination && setRoutePlannerInitialState) {
              setRoutePlannerInitialState({
                fromDistrictId: consignment.origin,
                toDistrictId: consignment.destination,
                prefer: 'safest',
              });
            }
          }
        } catch (err) {
          console.warn('Could not load linked consignment:', err);
        }
      };
      loadConsignment();
    }
  }, [consignmentIdParam, setRoutePlannerInitialState]);

  // Load available fleet assets
  useEffect(() => {
    const loadFleet = async () => {
      try {
        const [vRes, dRes] = await Promise.allSettled([
          ApiClient.getVehicles(),
          ApiClient.getDrivers(),
        ]);
        if (vRes.status === 'fulfilled' && vRes.value?.success && Array.isArray(vRes.value.data)) {
          setVehicles(vRes.value.data);
          if (!selectedVehicleId && vRes.value.data.length > 0) {
            setSelectedVehicleId(vRes.value.data[0].id);
          }
        }
        if (dRes.status === 'fulfilled' && dRes.value?.success && Array.isArray(dRes.value.data)) {
          setDrivers(dRes.value.data);
          if (!selectedDriverId && dRes.value.data.length > 0) {
            setSelectedDriverId(dRes.value.data[0].id);
          }
        }
      } catch (err) {
        console.warn('Could not load fleet for route dispatch', err);
      }
    };
    loadFleet();
  }, []);

  const handlePlanChange = useCallback((plan) => {
    setCurrentPlan(plan);
    if (plan?.preferred) {
      setActiveRouteId(plan.preferred);
    } else if (plan?.alternatives?.[0]?.id) {
      setActiveRouteId(plan.alternatives[0].id);
    }
  }, []);

  const handleLoadCorridor = useCallback((corridor) => {
    if (!corridor || !setRoutePlannerInitialState) return;
    const parts = (corridor.name || '').split(/→|->/);
    const origin = parts[0]?.trim() || '';
    const dest = parts[1]?.trim() || '';

    setRoutePlannerInitialState({
      fromDistrictId: corridor.origin_district_id,
      toDistrictId: corridor.dest_district_id,
      originName: origin,
      destName: dest,
      corridorName: corridor.name,
      prefer: 'safest',
    });

    window.scrollTo({ top: 400, behavior: 'smooth' });
  }, [setRoutePlannerInitialState]);

  // Dispatch Trip to Driver App
  const handleDispatchTrip = async () => {
    if (!currentPlan) {
      toast.error('Please evaluate a route corridor first.');
      return;
    }
    if (!selectedVehicleId) {
      toast.error('Please select an available vehicle from your fleet.');
      return;
    }
    if (!selectedDriverId) {
      toast.error('Please select a driver to assign to this route.');
      return;
    }

    setDispatching(true);
    try {
      const activeAlt =
        (currentPlan?.alternatives || []).find((a) => a.id === activeRouteId) ||
        currentPlan?.recommended ||
        currentPlan?.primary;

      const originLabel =
        currentPlan?.origin?.name ||
        currentPlan?.fromName ||
        activeAlt?.name?.split('→')?.[0]?.trim() ||
        'Origin';
      const destLabel =
        currentPlan?.destination?.name ||
        currentPlan?.toName ||
        activeAlt?.name?.split('→')?.[1]?.trim() ||
        'Destination';

      const res = await ApiClient.createTrip({
        consignmentId: consignmentIdParam || undefined,
        deliveryId: consignmentIdParam || undefined,
        routeId: activeAlt?.routeId || currentPlan?.routeId || 'RT-CORRIDOR',
        selectedRouteId: activeRouteId,
        routeName: activeAlt?.name || currentPlan?.name || `${originLabel} → ${destLabel}`,
        originDistrictId: currentPlan?.origin?.id || currentPlan?.fromDistrictId || 'kamrup',
        destDistrictId: currentPlan?.destination?.id || currentPlan?.toDistrictId || 'cachar',
        origin: originLabel,
        destination: destLabel,
        distanceKm: activeAlt?.distanceKm || activeAlt?.totalDistanceKm || 290,
        estimatedHours: activeAlt?.estimatedHours || activeAlt?.avgTravelHours || 6.5,
        riskScore: activeAlt?.riskScore || 20,
        geometry: activeAlt?.geometry || [],
        commodityType: commodity,
        weightKg: parseInt(String(weightKg).replace(/[^\d]/g, ''), 10) || 12000,
        vehicleId: selectedVehicleId,
        driverId: selectedDriverId,
        startImmediately: true,
      });

      if (res?.success) {
        const selD = drivers.find((d) => d.id === selectedDriverId);
        const selV = vehicles.find((v) => v.id === selectedVehicleId);
        toast.success(`Trip dispatched! Route sent to driver ${selD?.name || ''} on ${selV?.registration_number || selectedVehicleId}. Redirecting to live tracking...`);
        setTimeout(() => {
          navigate('/transporter/live-tracking');
        }, 900);
      } else {
        toast.error(res?.message || 'Could not assign and dispatch trip.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Server error while dispatching trip.');
    } finally {
      setDispatching(false);
    }
  };

  // Export Corridor Network CSV
  const handleExport = useCallback(async () => {
    try {
      const gis = await ApiClient.getGisRoutes().catch(() => null);
      const rows = gis?.success && gis.data?.features ? gis.data.features.map((f) => f.properties) : [];
      if (!rows.length) {
        toast.error('No corridor routes available to export right now.');
        return;
      }
      const header = ['Route', 'Origin', 'Destination', 'Distance (km)', 'Avg Hours', 'Risk Score', 'Status'];
      const lines = rows.map((r) => [
        r.name || r.id,
        r.origin_district_id || '',
        r.dest_district_id || '',
        r.distance_km ?? '',
        r.avg_travel_hours ?? '',
        r.current_risk_score ?? '',
        r.status || '',
      ].join(','));
      const csv = [header.join(','), ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `raahi-route-plan-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} corridor routes.`);
    } catch (e) {
      console.warn('Export failed:', e);
      toast.error('Could not export routes right now.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      <TransporterSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TransporterHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isDashboard={false} />

        <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0B1E36] tracking-tight leading-tight flex items-center gap-2.5">
                <Route className="w-7 h-7 text-emerald-600" />
                Route Optimization & Detour Planner
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                Dijkstra multi-criteria routing engine: calculates safest all-weather detours bypassing active landslides and flash floods.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-700">
                <CloudSun className="w-4 h-4 text-amber-500" />
                <span>{weather?.temp || '28°C'} {weather?.city || 'Guwahati'}</span>
              </div>
            </div>
          </div>

          {/* Active Consignment Assignment Banner */}
          {consignmentIdParam && (
            <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
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
                    Order linked. Select your fleet assets below, review the calculated safe detour, and dispatch.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transporter Fleet Assignment & Direct Dispatch Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
                  Fleet Dispatch:
                </span>

                {/* Vehicle Selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <Truck className="w-4 h-4 text-slate-500 shrink-0" />
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => {
                      if (e.target.value === '__add_vehicle__') {
                        setShowAddVehicleModal(true);
                      } else {
                        setSelectedVehicleId(e.target.value);
                      }
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Assign Vehicle --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration_number || v.model || v.id} ({v.type || v.model || 'Heavy'})
                      </option>
                    ))}
                    <option value="__add_vehicle__">➕ + Add Available Vehicle...</option>
                  </select>
                </div>

                {/* Driver Selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <User className="w-4 h-4 text-slate-500 shrink-0" />
                  <select
                    value={selectedDriverId}
                    onChange={(e) => {
                      if (e.target.value === '__add_driver__') {
                        setShowAddDriverModal(true);
                      } else {
                        setSelectedDriverId(e.target.value);
                      }
                    }}
                    className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Assign Driver --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name || d.full_name || d.id} {d.phone ? `(${d.phone})` : ''}
                      </option>
                    ))}
                    <option value="__add_driver__">➕ + Add Driver...</option>
                  </select>
                </div>

                {/* Commodity & Weight */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commodity}
                    onChange={(e) => setCommodity(e.target.value)}
                    placeholder="Commodity"
                    className="w-28 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                  />
                  <input
                    type="text"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="Weight (kg)"
                    className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={handleDispatchTrip}
                  disabled={dispatching || !currentPlan}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Navigation className="w-4 h-4" />
                  <span>{dispatching ? 'Dispatching...' : 'Dispatch Route to Driver App'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Prominent Action Panel: Corridors & Convoys Requiring Reroute */}
          <CorridorsRequiringReroute
            onLoadCorridor={handleLoadCorridor}
            onOpenSafeBypass={setSelectedBypassCorridor}
          />

          {/* 3-Step Guided Workflow Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              marginBottom: '16px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: '#059669',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                }}
              >
                1
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                Select Origin & Destination
              </span>
            </div>
            <span style={{ color: '#CBD5E1' }}>&rarr;</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: '#2563EB',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                }}
              >
                2
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                Engine Calculates Safest Detour
              </span>
            </div>
            <span style={{ color: '#CBD5E1' }}>&rarr;</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: '#7C3AED',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                }}
              >
                3
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                Dispatch Route to Driver App
              </span>
            </div>
          </div>

          {/* Main Route Planner: Controls & Map Lie Side-by-Side */}
          <div style={{ marginBottom: '20px' }}>
            <RoutePlannerMap
              plan={currentPlan}
              onPlanChange={handlePlanChange}
              activeRouteId={activeRouteId}
              onSelectRoute={setActiveRouteId}
              selectedDriverId={selectedDriverId}
              onSelectDriver={setSelectedDriverId}
              drivers={drivers}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
              vehicles={vehicles}
            />
          </div>

          {/* Horizontal Route Sequence & Waypoints Timeline Bar at Bottom */}
          <div style={{ marginBottom: '24px' }}>
            <RouteSequenceTimeline
              plan={currentPlan}
              activeRouteId={activeRouteId}
            />
          </div>

          {/* Analytics Triad: Distance Comparison, Cost Breakdown, Efficiency Gauge */}
          <div className="grid-3" style={{ marginBottom: '24px' }}>
            <DistanceComparisonChart
              plan={currentPlan}
              activeRouteId={activeRouteId}
            />
            <CostBreakdownChart
              plan={currentPlan}
              activeRouteId={activeRouteId}
            />
            <RouteEfficiencyGauge
              plan={currentPlan}
              activeRouteId={activeRouteId}
            />
          </div>

          {/* Bottom Row: Alternative Routes & Route Insights */}
          <div
            className="grid-2"
            style={{ gridTemplateColumns: '1.8fr 1.2fr', marginBottom: '24px' }}
          >
            <AlternativeRoutesTable
              plan={currentPlan}
              activeRouteId={activeRouteId}
              onSelectRoute={setActiveRouteId}
            />
            <RouteInsightsCard
              plan={currentPlan}
              activeRouteId={activeRouteId}
              onExport={handleExport}
            />
          </div>

          {/* Safe Bypass & Fleet Dispatch Modal */}
          <SafeBypassModal
            isOpen={Boolean(selectedBypassCorridor)}
            onClose={() => setSelectedBypassCorridor(null)}
            corridor={selectedBypassCorridor}
          />

          {/* Add Available Vehicle Modal */}
          <AddVehicleModal
            isOpen={showAddVehicleModal}
            onClose={() => setShowAddVehicleModal(false)}
            onVehicleAdded={(msg, newV) => {
              if (newV) {
                setVehicles((prev) => [newV, ...prev.filter((v) => v.id !== newV.id)]);
                setSelectedVehicleId(newV.id);
              }
            }}
          />

          {/* Add Driver Modal */}
          <AddDriverModal
            isOpen={showAddDriverModal}
            onClose={() => setShowAddDriverModal(false)}
            onDriverAdded={(newD) => {
              if (newD) {
                setDrivers((prev) => [newD, ...prev.filter((d) => d.id !== newD.id)]);
                setSelectedDriverId(newD.id);
              }
            }}
          />
        </main>
      </div>
    </div>
  );
}
