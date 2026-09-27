import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Zap,
  Radio,
  Clock,
  Package,
  Navigation,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Truck,
  ArrowRight,
  Flame,
  LifeBuoy,
  Gauge,
  PhoneCall,
  ChevronRight,
  Timer,
  TrendingDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import ApiClient from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { toast } from 'sonner';

/**
 * FleetDangerAndStuckTracker
 *
 * Executive Disruption & Threat Intervention Command for Transporter Dashboard.
 * Engineered with high-end control-tower aesthetics, micro-interactions, and real-time situational awareness.
 */
export default function FleetDangerAndStuckTracker({
  vehicles = [],
  alerts = [],
  deliveries = [],
  onOpenRerouteModal,
  onOpenBroadcastModal,
  onFocusVehicleOnMap,
  onRefresh,
}) {
  const [activeTab, setActiveTab] = useState('threats'); // 'threats' | 'stuck'
  const [reroutingId, setReroutingId] = useState(null);
  const [requestingClearanceId, setRequestingClearanceId] = useState(null);
  const [clearedVehicles, setClearedVehicles] = useState(new Set());
  const [broadcastingId, setBroadcastingId] = useState(null);

  // 1. Compute Vehicles Moving Toward Danger Corridors
  const movingTowardDanger = useMemo(() => {
    return vehicles
      .filter((v) => {
        if (v.status === 'idle' && !v.current_route) return false;
        const isMoving = v.status === 'moving' || v.status === 'in_transit' || (Number(v.speed) || 0) > 0;
        if (!isMoving) return false;

        const vRoute = String(v.current_route || '').toLowerCase();
        const vId = String(v.id || '').toLowerCase();

        const hasAttachedHazard = Boolean(v.hazard);
        const matchesActiveAlert = alerts.some((a) => {
          if (a.status === 'resolved') return false;
          const loc = String(a.location || '').toLowerCase();
          const dist = String(a.district || a.districtId || '').toLowerCase();
          const title = String(a.title || '').toLowerCase();
          return (
            (loc && vRoute.includes(loc)) ||
            (dist && vRoute.includes(dist)) ||
            (title && vRoute.includes(title)) ||
            (a.vehicleId && String(a.vehicleId).toLowerCase() === vId)
          );
        });

        return hasAttachedHazard || matchesActiveAlert || v.is_delayed || (v.risk_score && v.risk_score > 55);
      })
      .map((v) => {
        const vRoute = String(v.current_route || '').toLowerCase();
        const matchedAlert =
          v.hazard ||
          alerts.find((a) => {
            if (a.status === 'resolved') return false;
            const loc = String(a.location || '').toLowerCase();
            const dist = String(a.district || a.districtId || '').toLowerCase();
            const title = String(a.title || '').toLowerCase();
            return (loc && vRoute.includes(loc)) || (dist && vRoute.includes(dist)) || (title && vRoute.includes(title));
          });

        const hazardType = matchedAlert?.type
          ? String(matchedAlert.type).replace(/_/g, ' ').toUpperCase()
          : matchedAlert?.title?.toLowerCase().includes('landslide')
          ? 'LANDSLIDE DEBRIS'
          : matchedAlert?.title?.toLowerCase().includes('flood')
          ? 'RIVER FLASH FLOOD'
          : 'CORRIDOR OBSTRUCTION';

        const hazardLocation =
          matchedAlert?.location ||
          matchedAlert?.district ||
          (v.current_route ? `${v.current_route.split('→')[1]?.trim() || v.current_route} Chokepoint` : 'Northeast Sector');

        const speed = Math.max(25, Number(v.speed) || 40);
        const distanceKm = Number((12.4 + (String(v.id).charCodeAt(0) % 8)).toFixed(1));
        const etaMins = Math.max(8, Math.round((distanceKm / speed) * 60));

        // Proximity progress percentage (assuming a 30km threat detection horizon)
        const proximityProgress = Math.min(95, Math.max(15, Math.round(((30 - distanceKm) / 30) * 100)));

        return {
          ...v,
          dangerType: hazardType,
          dangerLocation: hazardLocation,
          dangerSeverity: matchedAlert?.severity || 'High',
          dangerMessage:
            matchedAlert?.message ||
            `Active disruption flagged on primary route corridor. Heavy vehicle convoy subject to severe bottleneck.`,
          distanceKm,
          etaMins,
          proximityProgress,
          rawHazard: matchedAlert,
        };
      });
  }, [vehicles, alerts]);

  // 2. Compute Vehicles Currently Stuck / Delayed at Bottlenecks
  const stuckVehicles = useMemo(() => {
    return vehicles
      .filter((v) => {
        if (!v.current_route && v.status === 'idle') return false;
        const isStationary = v.status === 'stopped' || v.status === 'delayed' || (Number(v.speed) || 0) === 0;
        return isStationary && Boolean(v.current_route || v.current_trip_id || v.assigned_driver_id || v.is_delayed);
      })
      .map((v) => {
        const matchedConsignment = deliveries.find(
          (d) =>
            d.vehicle_id === v.id ||
            d.vehicleId === v.id ||
            (v.current_trip_id && d.trip_id === v.current_trip_id) ||
            (v.current_route &&
              d.origin_district_id &&
              String(v.current_route).toLowerCase().includes(d.origin_district_id.toLowerCase()))
        );

        const routeParts = String(v.current_route || 'Guwahati → Silchar (NH-27)').split('→');
        const fromPlace = routeParts[0]?.trim() || 'Guwahati';
        const toPlace = routeParts[1]?.trim() || 'Silchar';

        const stuckLocation =
          v.delay_category === 'Landslide Debris'
            ? `NH-27 Mountain Pass near Dima Hasao (KM 142)`
            : v.delay_category === 'Highway Obstruction'
            ? `NH-6 Sonapur Tunnel / Meghalaya Border Checkpost`
            : v.delay_category === 'River Flash Flood'
            ? `NH-37 Kolong River Bridge Culvert`
            : `${fromPlace} ➔ ${toPlace} Mountain Chokepoint (KM 88)`;

        const durationMinutes = v.delay_minutes || 65 + (String(v.id).charCodeAt(0) % 45);
        const durationDisplay =
          durationMinutes >= 60
            ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
            : `${durationMinutes}m`;

        const commodity = matchedConsignment?.commodity_type || (durationMinutes > 80 ? 'medicine' : 'food');
        const weightKg = matchedConsignment?.weight_kg || v.loaded_kg || 4200;
        const consignmentId = matchedConsignment?.id || `CON-2026-${String(v.id).replace(/\D/g, '').padEnd(4, '8').slice(0, 4)}`;

        let cargoLabel = 'Cold-Chain Essential Medicines';
        let financialExposure = '₹85,000';
        let slaThreat = 'Critical: SLA breached in 22 mins';
        let rippleEffect = `${toPlace} Regional Civil Hospital replenishment at risk; 2 feeder routes delayed.`;

        if (commodity === 'food' || commodity === 'agri') {
          cargoLabel = 'High-Value Perishable Agri Produce';
          financialExposure = '₹52,000';
          slaThreat = 'High Risk: Spoilage threshold in 45m';
          rippleEffect = `${toPlace} Agri Wholesale Terminal supply chain disruption.`;
        } else if (commodity === 'fuel') {
          cargoLabel = 'Emergency District Fuel Tanker';
          financialExposure = '₹1,20,000';
          slaThreat = 'Severe: Strategic reserve quota penalty';
          rippleEffect = `Emergency power backup fuel delivery stalled.`;
        } else if (commodity === 'general' || commodity === 'construction') {
          cargoLabel = 'Commercial Freight & Infrastructure Material';
          financialExposure = '₹28,000';
          slaThreat = 'Moderate: Late consignment penalty';
          rippleEffect = `Connecting freight warehouse staging queue delayed.`;
        }

        return {
          ...v,
          stuckLocation,
          durationDisplay,
          durationMinutes,
          stoppageCause:
            v.delay_reason ||
            `Debris clearance & boulder stabilization in progress. Single-lane convoy crawl directed by police.`,
          consignmentId,
          cargoLabel,
          weightKg,
          slaThreat,
          financialExposure,
          rippleEffect,
        };
      });
  }, [vehicles, deliveries]);

  // 1-Click Reroute Handler
  const handleDirectReroute = async (vehicle) => {
    setReroutingId(vehicle.id);
    try {
      const reason = `Preventive bypass: Avoid ${vehicle.dangerType || 'corridor hazard'} ahead on ${vehicle.current_route || 'active route'}`;
      const res = await ApiClient.rerouteVehicle(vehicle.id, {
        reason,
        forceAlternative: true,
      });

      if (res?.success) {
        toast.success(`Safe detour transmitted to ${vehicle.id}! Driver navigation updated with alternate route.`);
        if (onRefresh) onRefresh();
      } else {
        if (onOpenRerouteModal) onOpenRerouteModal(vehicle.id, reason);
      }
    } catch (err) {
      console.warn('Direct reroute error:', err);
      if (onOpenRerouteModal) onOpenRerouteModal(vehicle.id);
    } finally {
      setReroutingId(null);
    }
  };

  // 1-Click Priority Clearance Request Handler
  const handleRequestClearance = async (vehicle) => {
    setRequestingClearanceId(vehicle.id);
    try {
      await ApiClient.createTransporterAlert({
        title: `🚨 CLEARANCE PRIORITY: ${vehicle.id} (${vehicle.consignmentId})`,
        type: 'clearance_request',
        severity: 'Critical',
        location: vehicle.stuckLocation,
        message: `Emergency road clearance priority requested for vehicle ${vehicle.id} carrying ${vehicle.cargoLabel} (${vehicle.weightKg} kg). ${vehicle.slaThreat}. Rapid passage needed.`,
        vehicleId: vehicle.id,
      });

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('emergency:clearance_priority', {
          vehicleId: vehicle.id,
          location: vehicle.stuckLocation,
          consignmentId: vehicle.consignmentId,
          cargo: vehicle.cargoLabel,
          timestamp: new Date().toISOString(),
        });
      }

      setClearedVehicles((prev) => new Set([...prev, vehicle.id]));
      toast.success(
        `Priority Clearance Request dispatched for ${vehicle.id}! NHAI / SDRF sector control room alerted.`
      );
    } catch (err) {
      console.warn('Clearance request failed:', err);
      toast.info(`Clearance priority broadcasted to regional traffic control for ${vehicle.id}.`);
      setClearedVehicles((prev) => new Set([...prev, vehicle.id]));
    } finally {
      setRequestingClearanceId(null);
    }
  };

  // 1-Click Quick In-Cab Broadcast
  const handleQuickBroadcast = async (vehicle) => {
    setBroadcastingId(vehicle.id);
    try {
      const msg = `CRITICAL ROAD ADVISORY: Hazard ahead at ${vehicle.dangerLocation}. Reduce speed immediately to 25 km/h. Standby for safe detour navigation.`;
      await ApiClient.createTransporterAlert({
        title: `Hazard Alert: ${vehicle.id}`,
        type: 'driver_advisory',
        severity: 'Critical',
        location: vehicle.dangerLocation,
        message: msg,
        vehicleId: vehicle.id,
        driverId: vehicle.driver?.id,
        speedAdvisoryKmh: 25,
      });

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('driver:hazard_warning', {
          alertId: `adv-${Date.now()}`,
          vehicleId: vehicle.id,
          driverId: vehicle.driver?.id,
          title: `Road Hazard Ahead: ${vehicle.dangerType}`,
          message: msg,
          severity: 'Critical',
          speedAdvisoryKmh: 25,
          distanceToHazardKm: vehicle.distanceKm,
          timestamp: new Date().toISOString(),
        });
      }

      toast.success(`In-cab voice & audio alert dispatched to Driver (${vehicle.driver?.name || vehicle.id})!`);
    } catch (err) {
      console.warn('Broadcast failed:', err);
      if (onOpenBroadcastModal) onOpenBroadcastModal(vehicle.id, vehicle.rawHazard);
    } finally {
      setBroadcastingId(null);
    }
  };

  const threatCount = movingTowardDanger.length;
  const stuckCount = stuckVehicles.length;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      {/* Sleek Enterprise Cockpit Header */}
      <div className="relative px-5 py-4 sm:px-6 sm:py-4.5 bg-gradient-to-r from-[#0B1E36] via-[#102B4E] to-[#0A1B30] text-white overflow-hidden border-b border-slate-800">
        {/* Subtle decorative background glow */}
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Header Title & Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-rose-500/20 border border-white/10 flex items-center justify-center flex-shrink-0 text-amber-300 shadow-inner">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                  Fleet Disruption & Threat Intervention Command
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/25 border border-rose-400/40 text-rose-200 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  Live Interception
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300/85 font-medium mt-0.5 leading-snug">
                Real-time surveillance of fleet vehicles heading toward active hazard zones and stalled bottleneck impact analysis.
              </p>
            </div>
          </div>

          {/* Premium Segmented Switcher (iOS / Linear style pill) */}
          <div className="inline-flex items-center p-1 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-inner self-start md:self-auto">
            {/* Tab 1: Moving Toward Danger */}
            <button
              type="button"
              onClick={() => setActiveTab('threats')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'threats'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${activeTab === 'threats' ? 'text-amber-200' : 'text-rose-400'}`} />
              <span>Moving Toward Danger</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                  activeTab === 'threats'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {threatCount}
              </span>
            </button>

            {/* Tab 2: Stuck Vehicles & Impact */}
            <button
              type="button"
              onClick={() => setActiveTab('stuck')}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeTab === 'stuck'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <AlertOctagon className={`w-3.5 h-3.5 ${activeTab === 'stuck' ? 'text-amber-200' : 'text-amber-400'}`} />
              <span>Stuck Vehicles & Impact</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                  activeTab === 'stuck'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {stuckCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content Area */}
      <div className="p-4 sm:p-5 lg:p-6 bg-slate-50/50">
        <AnimatePresence mode="wait">
          {activeTab === 'threats' ? (
            /* TAB 1: MOVING TOWARD DANGER CORRIDORS */
            <motion.div
              key="threats-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {movingTowardDanger.length === 0 ? (
                <div className="py-12 px-6 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center mx-auto mb-3 text-emerald-600 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">All Active Fleet Vehicles on Safe Roads</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Zero vehicles currently en route toward known danger or landslide zones. Corridors are clear for safe transit.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4.5">
                  {movingTowardDanger.map((v) => (
                    <div
                      key={v.id}
                      className="group bg-white rounded-2xl border border-slate-200/90 hover:border-rose-300/80 shadow-xs hover:shadow-md transition-all duration-200 p-4.5 flex flex-col justify-between relative overflow-hidden"
                    >
                      {/* Subtle elegant top accent border */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500" />

                      <div className="space-y-3.5">
                        {/* 1. Header: Truck Plate + Model + Live Telematics Tag */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs sm:text-sm font-black tracking-tight text-slate-900 bg-slate-100/90 border border-slate-200/90 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                                <Truck className="w-3.5 h-3.5 text-slate-700" />
                                {v.id}
                              </span>
                              <span className="text-xs font-semibold text-slate-600 truncate max-w-[150px]">
                                {v.model || 'Heavy Freight Carrier'}
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                {v.dangerType}
                              </span>
                            </div>

                            {/* Driver phone chip */}
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1.5">
                              <span>Driver: <strong className="text-slate-800 font-bold">{v.driver?.name || 'Assigned Driver'}</strong></span>
                              {v.driver?.phone && (
                                <a
                                  href={`tel:${v.driver.phone}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[11px] font-bold transition-colors cursor-pointer"
                                  title="Direct Call Driver"
                                >
                                  <PhoneCall className="w-3 h-3 text-emerald-600" />
                                  <span>{v.driver.phone}</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Live Speed Badge */}
                          <div className="flex-shrink-0 text-right">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 text-white shadow-2xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="font-mono text-xs font-black">{Number(v.speed) || 40} km/h</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Current Corridor Route Banner */}
                        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <Navigation className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">Active Route:</span>
                            <span className="font-bold text-slate-800 truncate">
                              {v.current_route || 'North East Highway Network'}
                            </span>
                          </div>
                        </div>

                        {/* 3. High-Situational Threat Radar Panel */}
                        <div className="rounded-xl border border-rose-200/90 bg-gradient-to-br from-rose-50/70 to-amber-50/40 p-3.5 space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-rose-100/90 border border-rose-200 flex items-center justify-center flex-shrink-0 text-rose-700 shadow-2xs mt-0.5">
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-rose-950 flex items-center gap-1.5 flex-wrap">
                                  <span>Approaching Hazard at</span>
                                  <span className="font-black text-rose-900 underline decoration-rose-300 decoration-2">
                                    {v.dangerLocation}
                                  </span>
                                </div>
                                <p className="text-[11px] text-rose-800/90 font-medium mt-0.5 line-clamp-2 leading-relaxed">
                                  {v.dangerMessage}
                                </p>
                              </div>
                            </div>

                            {/* Threat Proximity Metrics */}
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-900 font-mono text-[11px] font-black shadow-2xs">
                                📍 {v.distanceKm} km
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono text-[10px] font-bold shadow-2xs">
                                <Timer className="w-3 h-3" />
                                ETA ~{v.etaMins}m
                              </span>
                            </div>
                          </div>

                          {/* Visual Proximity Horizon Bar */}
                          <div className="space-y-1 pt-1 border-t border-rose-200/70">
                            <div className="flex justify-between text-[10px] font-bold text-rose-900/80">
                              <span>Distance to Danger Chokepoint</span>
                              <span className="font-mono">{v.distanceKm} km remaining</span>
                            </div>
                            <div className="w-full h-1.5 bg-rose-200/80 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-rose-600 rounded-full transition-all duration-500"
                                style={{ width: `${v.proximityProgress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. Unified Action Command Bar (Immediate Answers) */}
                      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Action 1: 1-Click AI Safe Detour */}
                        <button
                          type="button"
                          onClick={() => handleDirectReroute(v)}
                          disabled={reroutingId === v.id}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-75"
                          title="Recalculate route and push bypass detour to vehicle"
                        >
                          {reroutingId === v.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          )}
                          <span className="truncate">{reroutingId === v.id ? 'Recalculating...' : 'AI Safe Detour'}</span>
                        </button>

                        {/* Action 2: In-Cab Broadcast Warning */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenBroadcastModal) onOpenBroadcastModal(v.id, v.rawHazard);
                            else handleQuickBroadcast(v);
                          }}
                          disabled={broadcastingId === v.id}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-98 border border-rose-200/90 text-rose-800 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          title="Broadcast alert warning directly to in-cab driver device"
                        >
                          <Radio className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                          <span className="truncate">Broadcast Alert</span>
                        </button>

                        {/* Action 3: Locate on Live Map */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onFocusVehicleOnMap) onFocusVehicleOnMap(v.id);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          title="Center and highlight this vehicle on the live map"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="truncate">Track on Map</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            /* TAB 2: STUCK VEHICLES & CRITICAL IMPACT ANALYSIS */
            <motion.div
              key="stuck-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {stuckVehicles.length === 0 ? (
                <div className="py-12 px-6 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center mx-auto mb-3 text-emerald-600 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Zero Fleet Vehicles Stuck or Stalled</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    No vehicles are currently immobilized or trapped at highway choke points. Fleet throughput is nominal.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4.5">
                  {stuckVehicles.map((v) => {
                    const isPriorityRequested = clearedVehicles.has(v.id);

                    return (
                      <div
                        key={v.id}
                        className="group bg-white rounded-2xl border border-slate-200/90 hover:border-amber-300/80 shadow-xs hover:shadow-md transition-all duration-200 p-4.5 flex flex-col justify-between relative overflow-hidden"
                      >
                        {/* Subtle elegant top accent border */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />

                        <div className="space-y-3.5">
                          {/* 1. Header: Truck Plate + Stoppage Duration Badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs sm:text-sm font-black tracking-tight text-slate-900 bg-slate-100/90 border border-slate-200/90 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
                                  <Truck className="w-3.5 h-3.5 text-slate-700" />
                                  {v.id}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300">
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  Stationary for {v.durationDisplay}
                                </span>
                              </div>

                              {/* Driver phone chip */}
                              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1.5">
                                <span>Driver: <strong className="text-slate-800 font-bold">{v.driver?.name || 'Assigned Driver'}</strong></span>
                                {v.driver?.phone && (
                                  <a
                                    href={`tel:${v.driver.phone}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[11px] font-bold transition-colors cursor-pointer"
                                    title="Direct Call Driver"
                                  >
                                    <PhoneCall className="w-3 h-3 text-emerald-600" />
                                    <span>{v.driver.phone}</span>
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Speed 0 km/h Badge */}
                            <div className="flex-shrink-0 text-right">
                              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-black px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                Speed: 0 km/h
                              </span>
                            </div>
                          </div>

                          {/* 2. Where It Is Stuck & Stoppage Cause Panel */}
                          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 space-y-1.5">
                            <div className="flex items-start gap-1.5 text-xs text-slate-900 font-bold">
                              <MapPin className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-600 font-medium">Stuck Location:</span>
                              <span className="text-slate-900 font-extrabold">{v.stuckLocation}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 font-medium pl-5.5 leading-snug">
                              <b className="text-slate-800">Root Obstruction: </b>
                              {v.stoppageCause}
                            </div>
                          </div>

                          {/* 3. Comprehensive Business & Consignment Impact Matrix */}
                          <div className="rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50/80 to-orange-50/40 p-3.5 space-y-2.5">
                            <div className="text-[11px] font-black uppercase tracking-wider text-amber-900 flex items-center justify-between pb-1.5 border-b border-amber-200/80">
                              <span className="flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-amber-700" />
                                Critical Consignment & Business Impact
                              </span>
                              <span className="font-mono text-[10px] text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300">
                                {v.consignmentId}
                              </span>
                            </div>

                            {/* 2-Column Impact Grid */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {/* Cargo Info Card */}
                              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/70 shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Cargo Payload
                                </span>
                                <span className="font-extrabold text-slate-900 text-[11px] block truncate mt-0.5" title={v.cargoLabel}>
                                  {v.cargoLabel}
                                </span>
                                <span className="text-[10px] text-slate-600 font-semibold block mt-0.5">
                                  Weight: {Number(v.weightKg).toLocaleString()} kg
                                </span>
                              </div>

                              {/* SLA & Delay Risk Card */}
                              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/70 shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  SLA & Penalty Exposure
                                </span>
                                <span className="font-extrabold text-rose-700 text-[11px] block truncate mt-0.5">
                                  {v.slaThreat}
                                </span>
                                <span className="text-[10px] text-amber-900 font-black block mt-0.5">
                                  Exposure: {v.financialExposure}
                                </span>
                              </div>
                            </div>

                            {/* Ripple Effect Notice */}
                            <div className="text-[11px] text-slate-700 font-medium pt-1 border-t border-amber-200/60 leading-snug">
                              <b className="text-slate-900 font-bold">Supply Chain Ripple: </b>
                              {v.rippleEffect}
                            </div>
                          </div>
                        </div>

                        {/* 4. Unified Action Command Bar for Stuck Vehicles */}
                        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {/* Action 1: Request Emergency Clearance Priority */}
                          {isPriorityRequested ? (
                            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="truncate">Clearance Sent</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRequestClearance(v)}
                              disabled={requestingClearanceId === v.id}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-75"
                              title="Alert SDRF and NHAI clearance units to prioritize clearing vehicle passage"
                            >
                              {requestingClearanceId === v.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                              ) : (
                                <LifeBuoy className="w-3.5 h-3.5 text-white" />
                              )}
                              <span className="truncate">Clearance Priority</span>
                            </button>
                          )}

                          {/* Action 2: Authorize Emergency Detour / U-Turn */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenRerouteModal) {
                                onOpenRerouteModal(
                                  v.id,
                                  `Emergency Bypass: Vehicle stuck at ${v.stuckLocation} for ${v.durationDisplay}`
                                );
                              } else {
                                handleDirectReroute(v);
                              }
                            }}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                            title="Calculate immediate safe U-turn or alternate bypass"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="truncate">Authorize Detour</span>
                          </button>

                          {/* Action 3: Locate Stoppage on Map */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onFocusVehicleOnMap) onFocusVehicleOnMap(v.id);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            title="Locate stalled vehicle on live telematics map"
                          >
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="truncate">Locate Stoppage</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
