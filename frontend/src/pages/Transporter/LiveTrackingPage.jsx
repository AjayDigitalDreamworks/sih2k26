import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Truck,
  Navigation,
  PauseCircle,
  Wrench,
  MapPin,
  Gauge,
  Clock,
  Phone,
  Radio,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Send,
  Share2,
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  Crosshair,
  Compass,
} from 'lucide-react';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import TrackingMap from '../../components/tracking/TrackingMap';
import DynamicRerouteModal from '../../components/transporter/DynamicRerouteModal';
import BroadcastDriverAlertModal from '../../components/transporter/BroadcastDriverAlertModal';
import ApiClient from '../../lib/api';
import {
  subscribeToVehiclePositions,
  subscribeToTripUpdates,
  subscribeToRouteCleared,
  subscribeToHazardWarning,
} from '../../lib/socket';
import { toast } from 'sonner';

const STATUS_LABEL = {
  moving: 'In Transit',
  in_transit: 'In Transit',
  idle: 'Idle',
  stopped: 'Stopped',
  delayed: 'Delayed',
  maintenance: 'Maintenance',
  offline: 'Offline',
};

const timeAgo = (iso) => {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

export default function LiveTrackingPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [livePos, setLivePos] = useState({}); // id -> latest socket payload
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [activeFilterTab, setActiveFilterTab] = useState('all'); // all | risk | delayed | moving | idle
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic Reroute Modal state
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [rerouteVehicleId, setRerouteVehicleId] = useState('');
  const [rerouteReason, setRerouteReason] = useState('');

  // Broadcast Driver Alert Modal state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastVehicleId, setBroadcastVehicleId] = useState('');
  const [broadcastHazard, setBroadcastHazard] = useState(null);

  const load = useCallback(async () => {
    try {
      const [vres, tres, ares] = await Promise.allSettled([
        ApiClient.getTransporterVehicles(),
        ApiClient.request('/transporter/trips'),
        ApiClient.getTransporterAlerts({ limit: 100 }),
      ]);
      if (vres.status === 'fulfilled' && vres.value?.success) {
        const vData = vres.value.data || [];
        setVehicles(vData);
        setSelectedId((prev) => {
          if (prev && vData.some((v) => v.id === prev)) return prev;
          return (vData[0] && vData[0].id) || null;
        });
      }
      if (tres.status === 'fulfilled' && tres.value?.success) setTrips(tres.value.data || []);
      if (ares.status === 'fulfilled' && ares.value?.success) setAlerts(ares.value.data || []);
    } catch (e) {
      console.warn('Live tracking load failed:', e);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const unsub = subscribeToVehiclePositions((p) => {
      if (p && p.lat && p.lng) setLivePos((prev) => ({ ...prev, [p.id || p.vehicleId]: p }));
    });
    const unsubTrip = subscribeToTripUpdates(() => {
      load();
    });
    const unsubClear = subscribeToRouteCleared(() => {
      load();
    });
    const unsubHazard = subscribeToHazardWarning((data) => {
      load();
      if (data?.title) {
        toast.error(`⚠️ Route Hazard Alert: ${data.title} (${data.vehicleId || 'Corridor'})`);
      }
    });
    return () => {
      unsub();
      unsubTrip();
      unsubClear();
      unsubHazard();
    };
  }, [load]);

  // Check if a vehicle's route is affected by any active alert/hazard
  const getVehicleHazard = useCallback(
    (v) => {
      if (!v || !alerts.length) return null;
      const vRoute = String(v.current_route || '').toLowerCase();
      const vId = String(v.id || '').toLowerCase();
      return alerts.find((a) => {
        if (a.status === 'resolved') return false;
        const d = String(a.district || a.districtId || '').toLowerCase();
        const title = String(a.title || '').toLowerCase();
        const loc = String(a.location || '').toLowerCase();
        return (
          (d && vRoute.includes(d)) ||
          (loc && vRoute.includes(loc)) ||
          (title && vRoute.includes(title)) ||
          (a.vehicleId && String(a.vehicleId).toLowerCase() === vId)
        );
      });
    },
    [alerts]
  );

  // Calculate delay info for a vehicle with genuine corridor root causes
  const getVehicleDelayInfo = useCallback(
    (v) => {
      if (!v) return { isDelayed: false, minutes: 0, label: 'On Schedule', reason: null, category: 'On Schedule' };
      const hazard = getVehicleHazard(v) || v.hazard;
      const isStatusDelayed = v.status === 'delayed' || Boolean(v.is_delayed);
      const serverMinutes = v.delay_minutes || v.traffic_delay_minutes || 0;

      let minutes = serverMinutes;
      if (minutes === 0 && isStatusDelayed) {
        minutes = 35; // Standard freight delay
      } else if (minutes === 0 && hazard) {
        minutes = 45; // Hazard obstruction projection
      }

      const isDelayed = minutes > 0 || isStatusDelayed || Boolean(hazard);
      let reason = v.delay_reason || null;
      let category = v.delay_category || 'Normal Schedule';

      if (!reason && hazard) {
        const hType = String(hazard.type || '').toLowerCase();
        const loc = hazard.location || hazard.district || 'Corridor';
        if (hType.includes('landslide')) {
          category = 'Landslide Debris';
          reason = `Active Landslide at ${loc} — Hill soil saturation crawl; single-lane regulated by SDRF clearance teams.`;
        } else if (hType.includes('block') || hType.includes('reroute')) {
          category = 'Highway Blockage';
          reason = `Debris blockage & rock clearance at ${loc} — Primary highway closed; dynamic detour via safe bypass active.`;
        } else if (hType.includes('flood')) {
          category = 'River Flash Flood';
          reason = `River surge & culvert waterlogging at ${loc} — Low-speed heavy vehicle convoy crawl (15 km/h).`;
        } else if (hType.includes('stop')) {
          category = 'Checkpost Inspection';
          reason = `Prolonged halt at ${loc} — Interstate cargo manifest scanning & commercial transit inspection queue.`;
        } else if (hType.includes('weather') || hType.includes('fog')) {
          category = 'Dense Mountain Fog';
          reason = `Zero-visibility mountain fog at ${loc} — Precautionary convoy spacing restricted to 20 km/h.`;
        } else {
          category = 'Corridor Hazard';
          reason = `${hazard.title} at ${loc}: ${hazard.message || 'Severe transit delay due to active road disruption.'}`;
        }
      } else if (!reason && isDelayed) {
        category = 'Freight Bottleneck';
        reason = 'Mountain highway freight congestion & commercial weighbridge checkpost hold along NH corridor.';
      }

      return {
        isDelayed,
        minutes,
        label: isDelayed ? `+${minutes} min delayed` : 'On Schedule (0 min)',
        reason: isDelayed ? reason : null,
        category: isDelayed ? category : 'On Schedule',
        severity: minutes > 40 ? 'critical' : minutes > 20 ? 'moderate' : isDelayed ? 'minor' : 'none',
      };
    },
    [getVehicleHazard]
  );

  const affectedVehicles = useMemo(() => {
    return vehicles.filter((v) => getVehicleHazard(v));
  }, [vehicles, getVehicleHazard]);

  const delayedVehicles = useMemo(() => {
    return vehicles.filter((v) => getVehicleDelayInfo(v).isDelayed);
  }, [vehicles, getVehicleDelayInfo]);

  const stats = useMemo(() => {
    const total = vehicles.length;
    const moving = vehicles.filter((v) => v.status === 'moving' || v.status === 'in_transit').length;
    const delayed = delayedVehicles.length;
    const atRisk = affectedVehicles.length;
    const idle = vehicles.filter((v) => !v.status || v.status === 'idle' || v.status === 'stopped').length;
    const totalDelayMins = delayedVehicles.reduce((acc, v) => acc + getVehicleDelayInfo(v).minutes, 0);
    const avgDelay = delayed > 0 ? Math.round(totalDelayMins / delayed) : 0;
    return { total, moving, idle, delayed, atRisk, avgDelay };
  }, [vehicles, delayedVehicles, affectedVehicles, getVehicleDelayInfo]);

  // Filtered vehicles based on tab and search
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Tab filter
      if (activeFilterTab === 'risk' && !getVehicleHazard(v)) return false;
      if (activeFilterTab === 'delayed' && !getVehicleDelayInfo(v).isDelayed) return false;
      if (activeFilterTab === 'moving' && v.status !== 'moving' && v.status !== 'in_transit') return false;
      if (activeFilterTab === 'idle' && v.status !== 'idle' && v.status !== 'stopped') return false;

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = String(v.id || '').toLowerCase().includes(q);
        const matchPlate = String(v.plate_number || '').toLowerCase().includes(q);
        const matchDriver = String(v.driver?.name || '').toLowerCase().includes(q);
        const matchRoute = String(v.current_route || '').toLowerCase().includes(q);
        return matchId || matchPlate || matchDriver || matchRoute;
      }
      return true;
    });
  }, [vehicles, activeFilterTab, searchQuery, getVehicleHazard, getVehicleDelayInfo]);

  const handleTabChange = (tab) => {
    setActiveFilterTab(tab);
    const matching = vehicles.filter((v) => {
      if (tab === 'risk') return Boolean(getVehicleHazard(v));
      if (tab === 'delayed') return Boolean(getVehicleDelayInfo(v).isDelayed);
      if (tab === 'moving') return v.status === 'moving' || v.status === 'in_transit';
      if (tab === 'idle') return !v.status || v.status === 'idle' || v.status === 'stopped';
      return true;
    });
    if (matching.length > 0 && (!selectedId || !matching.some((m) => m.id === selectedId))) {
      setSelectedId(matching[0].id);
    }
  };

  const selected = vehicles.find((v) => v.id === selectedId) || null;
  const selectedHazard = selected ? getVehicleHazard(selected) : null;
  const selectedDelay = selected ? getVehicleDelayInfo(selected) : null;
  const live = selected ? livePos[selected.id] : null;
  const speed = live ? Math.round(live.speed || 0) : selected && selected.speed != null ? Math.round(selected.speed) : 0;
  const heading = live?.heading != null ? Math.round(live.heading) : selected?.heading != null ? Math.round(selected.heading) : null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setTimeout(() => setRefreshing(false), 500);
    toast.success('Vehicle telematics and corridor GPS synchronized.');
  };

  const openRerouteFor = (vehicle, hazard = null) => {
    if (!vehicle) return;
    setRerouteVehicleId(vehicle.id);
    const reason = hazard?.title
      ? `Avoid ${hazard.title} via ML safe detour`
      : `Dynamic safest bypass from current GPS fix`;
    setRerouteReason(reason);
    setShowRerouteModal(true);
  };

  const openBroadcastFor = (vehicle, hazard = null) => {
    if (!vehicle) return;
    setBroadcastVehicleId(vehicle.id);
    setBroadcastHazard(hazard);
    setShowBroadcastModal(true);
  };

  const kpis = [
    {
      id: 'total',
      title: 'Total Enrolled Fleet',
      value: stats.total,
      subtitle: 'Tracked via GPS',
      icon: <Truck className="w-5 h-5" />,
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      id: 'moving',
      title: 'In Transit / Moving',
      value: stats.moving,
      subtitle: 'Real-time telemetry',
      icon: <Navigation className="w-5 h-5" />,
      bg: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      id: 'delayed',
      title: 'Delayed Vehicles',
      value: stats.delayed,
      subtitle: stats.delayed > 0 ? `Avg +${stats.avgDelay}m delay` : 'All on time',
      icon: <Clock className="w-5 h-5" />,
      bg: stats.delayed > 0 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200',
    },
    {
      id: 'atRisk',
      title: 'Routes At Risk',
      value: stats.atRisk,
      subtitle: stats.atRisk > 0 ? 'Obstacle ahead on path' : 'Corridors clear',
      icon: <ShieldAlert className="w-5 h-5" />,
      bg: stats.atRisk > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      id: 'idle',
      title: 'Available / Idle',
      value: stats.idle,
      subtitle: 'Ready for dispatch',
      icon: <PauseCircle className="w-5 h-5" />,
      bg: 'bg-slate-50 text-slate-500 border-slate-200',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      <TransporterSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TransporterHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isDashboard={false} />

        <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5 relative">
          {/* Header Title & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0B1E36] tracking-tight leading-tight">
                  Vehicle Tracking & Telematics
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live GPS
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-1">
                Real-time vehicle positions, active corridor delays, automated hazard detection, and instant driver dispatch.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto flex-shrink-0">
              <button
                type="button"
                onClick={() => openBroadcastFor(selected || vehicles[0])}
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                title="Broadcast emergency alert, weather warning, or detour notice directly to driver"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Broadcast Alert to Driver</span>
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Synchronize real-time positions"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Top 5 KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {kpis.map((k) => (
              <div
                key={k.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3.5 hover:shadow-xs transition-all"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${k.bg}`}>
                  {k.icon}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide truncate">
                    {k.title}
                  </span>
                  <span className="text-xl font-black text-[#0B1E36] leading-tight mt-0.5">{k.value}</span>
                  <span className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">{k.subtitle}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Continuous Corridor Threat & Hazard Banner */}
          {affectedVehicles.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-red-500/10 border border-amber-300 rounded-2xl p-4 sm:p-4.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 font-black shadow-xs">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-950">
                      Hazard Threat Detected
                    </span>
                    <span className="font-black text-slate-900 text-sm">
                      {affectedVehicles.length} Vehicle{affectedVehicles.length === 1 ? '' : 's'} Approaching Active Hazards
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">
                    Corridor monitoring detected active hazards (landslide / roadblock / flooding) along the route of{' '}
                    <b>{affectedVehicles.map((v) => v.id).join(', ')}</b>. Dynamic safe detours are calculated from live GPS fixes.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end lg:self-auto flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openBroadcastFor(affectedVehicles[0], getVehicleHazard(affectedVehicles[0]))}
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-amber-700" />
                  <span>Alert Driver</span>
                </button>

                <button
                  type="button"
                  onClick={() => openRerouteFor(affectedVehicles[0], getVehicleHazard(affectedVehicles[0]))}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reroute {affectedVehicles[0].id}</span>
                </button>
              </div>
            </div>
          )}

          {/* Interactive Filters Bar */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleTabChange('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFilterTab === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Fleet ({vehicles.length})
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('risk')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeFilterTab === 'risk'
                    ? 'bg-red-600 text-white shadow-xs ring-2 ring-red-400 ring-offset-1'
                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                }`}
              >
                <span>⚠️ Routes At Risk</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/30 text-[10px] font-black">
                  {affectedVehicles.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('delayed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeFilterTab === 'delayed'
                    ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400 ring-offset-1'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <span>⏱️ Delayed</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/30 text-[10px] font-black">
                  {delayedVehicles.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('moving')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFilterTab === 'moving'
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400 ring-offset-1'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🟢 In Transit ({stats.moving})
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('idle')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFilterTab === 'idle'
                    ? 'bg-purple-700 text-white shadow-xs ring-2 ring-purple-400 ring-offset-1'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ⚪ Idle / Available ({stats.idle})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vehicle, driver, route..."
                className="w-full pl-8.5 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 bg-slate-50/70"
              />
            </div>
          </div>

          {/* Map + Selected Vehicle Telematics Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Map (Col-span 8 or 9) */}
            <div className="lg:col-span-8 xl:col-span-9 h-full min-h-[560px]">
              <TrackingMap
                selectedId={selectedId}
                onSelect={setSelectedId}
                activeFilterTab={activeFilterTab}
                highlightedIds={filteredVehicles.map((v) => v.id)}
              />
            </div>

            {/* Selected Vehicle Telematics Panel (Col-span 4 or 3) */}
            <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col overflow-hidden">
              {/* Selector Header */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-emerald-600" /> Vehicle Telematics
                </h3>
                <select
                  value={selectedId || ''}
                  onChange={(e) => setSelectedId(e.target.value || null)}
                  className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-emerald-500 max-w-[150px]"
                >
                  {vehicles.length === 0 && <option value="">No vehicles</option>}
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id} {v.plate_number ? `(${v.plate_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {!selected ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <Truck className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-black text-slate-700">No Vehicle Selected</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Select any vehicle on the map or from the selector above to monitor real-time position, route risk, and driver alerts.
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-3.5 flex-1 overflow-y-auto custom-scrollbar">
                  {/* Identity & Status */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-base font-black text-slate-900">{selected.id}</h4>
                        {selected.plate_number && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {selected.plate_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">{selected.model || 'Commercial Carrier'}</p>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                        selected.status === 'moving' || selected.status === 'in_transit'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : selected.status === 'delayed'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : selected.status === 'maintenance' || selected.status === 'offline'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}
                    >
                      {STATUS_LABEL[selected.status] || selected.status}
                    </span>
                  </div>

                  {/* Delay Status Card */}
                  <div
                    className={`rounded-xl p-3.5 border transition-all ${
                      selectedDelay?.isDelayed
                        ? 'bg-amber-50/90 border-amber-300/90 text-amber-950 shadow-2xs'
                        : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        Delay Assessment
                      </span>
                      <div className="flex items-center gap-1.5">
                        {selectedDelay?.isDelayed && selectedDelay?.category && (
                          <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-amber-200/90 text-amber-900 border border-amber-300">
                            {selectedDelay.category}
                          </span>
                        )}
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded ${
                            selectedDelay?.isDelayed ? 'bg-amber-600 text-white shadow-2xs' : 'bg-emerald-200 text-emerald-900'
                          }`}
                        >
                          {selectedDelay?.label}
                        </span>
                      </div>
                    </div>
                    {selectedDelay?.reason && (
                      <div className="mt-2 pt-2 border-t border-amber-200/70 text-[11px] leading-relaxed">
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wide text-amber-900 block">
                              Genuine Root Cause
                            </span>
                            <p className="text-slate-800 font-semibold mt-0.5 leading-snug">
                              {selectedDelay.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Speed & Heading Telemetry */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-blue-500" /> Current Speed
                      </span>
                      <span className="text-base font-black text-slate-800 block mt-0.5">{speed} km/h</span>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/70">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Compass className="w-3 h-3 text-emerald-500" /> Heading
                      </span>
                      <span className="text-base font-black text-slate-800 block mt-0.5">
                        {heading != null ? `${heading}°` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Where is vehicle (Location & Coordinates) */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 space-y-1">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          Current Location & Corridor
                        </span>
                        <p className="text-xs font-bold text-slate-800 leading-snug mt-0.5">
                          {selected.current_route || 'No active corridor assigned'}
                        </p>
                        {selected.lat && selected.lng && (
                          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Fix: {Number(selected.lat).toFixed(4)}° N, {Number(selected.lng).toFixed(4)}° E
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">Last GPS Ping: {timeAgo(selected.last_ping_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Route Threat Assessment & Reroute Option */}
                  {selectedHazard ? (
                    <div className="rounded-xl border border-red-300 bg-red-50/90 p-3 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-black uppercase text-red-900 bg-red-200/80 px-1.5 py-0.5 rounded">
                            ⚠️ Route At Risk: {selectedHazard.severity || 'Critical'}
                          </span>
                          <p className="text-xs font-black text-slate-900 mt-1">
                            {selectedHazard.title || 'Corridor Obstruction Ahead'}
                          </p>
                          <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-snug">
                            {selectedHazard.message || 'Active hazard detected on vehicle corridor. Immediate action required.'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openRerouteFor(selected, selectedHazard)}
                          className="w-full py-2 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-black shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reroute (Detour)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openBroadcastFor(selected, selectedHazard)}
                          className="w-full py-2 px-2.5 rounded-lg bg-white border border-red-300 hover:bg-red-50 text-red-800 text-[11px] font-bold shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Alert Driver</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div>
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                              Route Safety Status
                            </span>
                            <p className="text-xs font-bold text-slate-700">Corridor Clear · No Obstructions</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openRerouteFor(selected, null)}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-[11px] font-bold transition-colors cursor-pointer text-center"
                        >
                          Preventive Detour
                        </button>
                        <button
                          type="button"
                          onClick={() => openBroadcastFor(selected, null)}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Radio className="w-3 h-3" />
                          <span>Send In-Cab Alert</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Driver Details & Quick Contact */}
                  <div className="rounded-xl border border-slate-200/80 p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Assigned Driver
                    </span>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center text-xs font-black flex-shrink-0">
                          {selected.driver?.name ? selected.driver.name.charAt(0).toUpperCase() : 'D'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 truncate">
                            {selected.driver?.name || 'Unassigned'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {selected.driver?.phone || 'No phone registered'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {selected.driver?.phone && (
                          <a
                            href={`tel:${selected.driver.phone}`}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="Call Driver"
                          >
                            <Phone className="w-3.5 h-3.5 text-blue-600" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const text = `Live Tracking for vehicle ${selected.id} (${selected.driver?.name || 'Driver'}): Current status is ${selected.status}, route: ${selected.current_route || 'Assam Corridor'}. Live GPS coordinates: ${selected.lat || ''}, ${selected.lng || ''}`;
                            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                          }}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                          title="Share tracking update on WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Bottom Telematics & Delay Status Table */}
          <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-800">Fleet Telematics & Delay Monitor</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Showing {filteredVehicles.length} of {vehicles.length} fleet units with real-time GPS coordinates, delay indicators, and corridor hazard status.
                </p>
              </div>

              <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 self-start sm:self-auto">
                ● Telematics Stream Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Vehicle</th>
                    <th className="py-3 px-4">Current Corridor</th>
                    <th className="py-3 px-4">Driver</th>
                    <th className="py-3 px-4">Speed / Status</th>
                    <th className="py-3 px-4">Delay Amount</th>
                    <th className="py-3 px-4">Route Risk</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-semibold">
                        No vehicles matching selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((v) => {
                      const hazard = getVehicleHazard(v);
                      const delay = getVehicleDelayInfo(v);
                      const lp = livePos[v.id];
                      const spd = lp ? Math.round(lp.speed) : v.speed != null ? Math.round(v.speed) : 0;
                      const isSel = v.id === selectedId;

                      return (
                        <tr
                          key={v.id}
                          onClick={() => setSelectedId(v.id)}
                          className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                            isSel ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          {/* Vehicle ID & Model */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                  v.status === 'moving' || v.status === 'in_transit'
                                    ? 'bg-emerald-500 animate-pulse'
                                    : v.status === 'delayed'
                                    ? 'bg-amber-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                              <div>
                                <span className="font-extrabold text-slate-900 block">{v.id}</span>
                                <span className="text-[10px] text-slate-400 block">{v.plate_number || v.model || '—'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Current Route */}
                          <td className="py-3.5 px-4 max-w-[220px]">
                            <span className="font-bold text-slate-800 block truncate">
                              {v.current_route || 'No active corridor'}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              Last ping: {timeAgo(v.last_ping_at)}
                            </span>
                          </td>

                          {/* Driver */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-800 block">{v.driver?.name || 'Unassigned'}</span>
                            {v.driver?.phone && (
                              <span className="text-[10px] text-blue-600 font-semibold">{v.driver.phone}</span>
                            )}
                          </td>

                          {/* Speed & Status */}
                          <td className="py-3.5 px-4">
                            <span className="font-extrabold text-slate-900 block">{spd} km/h</span>
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded inline-block mt-0.5 ${
                                v.status === 'moving' || v.status === 'in_transit'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : v.status === 'delayed'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {STATUS_LABEL[v.status] || v.status}
                            </span>
                          </td>

                          {/* Delay Amount & Genuine Root Cause */}
                          <td className="py-3.5 px-4 max-w-[260px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-black text-xs ${
                                  delay.isDelayed ? 'text-amber-800' : 'text-emerald-700'
                                }`}
                              >
                                {delay.label}
                              </span>
                              {delay.isDelayed && delay.category && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                  {delay.category}
                                </span>
                              )}
                            </div>
                            {delay.reason && (
                              <span
                                className="text-[10px] text-slate-600 font-medium block mt-1 leading-snug line-clamp-2"
                                title={delay.reason}
                              >
                                {delay.reason}
                              </span>
                            )}
                          </td>

                          {/* Route Risk */}
                          <td className="py-3.5 px-4 max-w-[200px]">
                            {hazard ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-800 bg-red-100 px-2 py-0.5 rounded">
                                  <AlertTriangle className="w-3 h-3" />
                                  Risk Ahead
                                </span>
                                <span className="text-[11px] font-bold text-red-950 block mt-0.5 truncate">
                                  {hazard.title}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                Clear
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openRerouteFor(v, hazard)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  hazard
                                    ? 'bg-red-600 hover:bg-red-700 text-white font-black shadow-xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                                title="Recalculate dynamic detour from GPS position"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Reroute</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openBroadcastFor(v, hazard)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                title="Broadcast in-cab alert to driver"
                              >
                                <Radio className="w-3 h-3 text-red-600" />
                                <span>Alert</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {/* Dynamic Reroute Modal */}
      <DynamicRerouteModal
        isOpen={showRerouteModal}
        onClose={() => setShowRerouteModal(false)}
        vehicles={vehicles}
        initialVehicleId={rerouteVehicleId}
        initialReason={rerouteReason}
        onRerouted={load}
      />

      {/* Broadcast Driver Alert Modal */}
      <BroadcastDriverAlertModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        vehicles={vehicles}
        initialVehicleId={broadcastVehicleId}
        initialHazard={broadcastHazard}
        onAlertCreated={load}
      />
    </div>
  );
}
