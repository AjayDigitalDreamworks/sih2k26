import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Truck,
  Navigation,
  PauseCircle,
  Wrench,
  WifiOff,
  MapPin,
  Gauge,
  Clock,
  Phone,
  Radio,
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import TrackingMap from '../../components/tracking/TrackingMap';
import DynamicRerouteModal from '../../components/transporter/DynamicRerouteModal';
import ApiClient from '../../lib/api';
import { subscribeToVehiclePositions, subscribeToTripUpdates, subscribeToRouteCleared } from '../../lib/socket';

const STATUS_LABEL = {
  moving: 'In Transit',
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
  const [toast, setToast] = useState('');

  // Dynamic Reroute Modal state
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [rerouteVehicleId, setRerouteVehicleId] = useState('');
  const [rerouteReason, setRerouteReason] = useState('');

  const triggerToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    try {
      const [vres, tres, ares] = await Promise.allSettled([
        ApiClient.getTransporterVehicles(),
        ApiClient.request('/transporter/trips'),
        ApiClient.getTransporterAlerts(),
      ]);
      if (vres.status === 'fulfilled' && vres.value?.success) {
        setVehicles(vres.value.data || []);
        setSelectedId((prev) => {
          if (prev && (vres.value.data || []).some((v) => v.id === prev)) return prev;
          return (vres.value.data && vres.value.data[0] && vres.value.data[0].id) || null;
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
    const t = setInterval(load, 10000);
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
    return () => {
      unsub();
      unsubTrip();
      unsubClear();
    };
  }, [load]);

  const stats = useMemo(() => {
    const total = vehicles.length;
    const moving = vehicles.filter((v) => v.status === 'moving').length;
    const delayed = vehicles.filter((v) => v.status === 'delayed').length;
    const maintenance = vehicles.filter((v) => v.status === 'maintenance').length;
    const offline = vehicles.filter((v) => v.status === 'offline').length;
    const idle = vehicles.filter((v) => v.status === 'idle' || v.status === 'stopped').length;
    return { total, moving, idle, delayed, maintenance, offline };
  }, [vehicles]);

  // Check if an active vehicle's route is affected by any active alert/hazard
  const getVehicleHazard = useCallback((v) => {
    if (!v) return null;
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
  }, [alerts]);

  const affectedVehicles = useMemo(() => {
    return vehicles.filter(
      (v) => (v.status === 'moving' || v.status === 'in_transit') && getVehicleHazard(v)
    );
  }, [vehicles, getVehicleHazard]);

  const selected = vehicles.find((v) => v.id === selectedId) || null;
  const selectedHazard = selected ? getVehicleHazard(selected) : null;
  const live = selected ? livePos[selected.id] : null;
  const speed = live ? Math.round(live.speed || 0) : selected && selected.speed != null ? Math.round(selected.speed) : 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setTimeout(() => setRefreshing(false), 500);
    triggerToast('Live tracking data synchronised.');
  };

  const kpis = [
    { id: 'total', title: 'Total Vehicles', value: stats.total, icon: <Truck className="w-5 h-5" />, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { id: 'moving', title: 'In Transit', value: stats.moving, icon: <Navigation className="w-5 h-5" />, bg: 'bg-blue-50 text-blue-600 border-blue-100' },
    { id: 'idle', title: 'Idle / Stopped', value: stats.idle, icon: <PauseCircle className="w-5 h-5" />, bg: 'bg-orange-50 text-orange-500 border-orange-100' },
    { id: 'delayed', title: 'Delayed', value: stats.delayed, icon: <Clock className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-600 border-amber-100' },
    { id: 'offline', title: 'Maintenance / Offline', value: stats.maintenance + stats.offline, icon: <Wrench className="w-5 h-5" />, bg: 'bg-rose-50 text-rose-500 border-rose-100' },
  ];

  // real-time activity feed = vehicles by last ping (merged with live socket info)
  const activity = useMemo(
    () =>
      [...vehicles]
        .sort((a, b) => new Date(b.last_ping_at || 0) - new Date(a.last_ping_at || 0))
        .map((v) => {
          const lp = livePos[v.id];
          return {
            id: v.id,
            status: v.status || 'idle',
            speed: lp ? Math.round(lp.speed) : v.speed != null ? Math.round(v.speed) : 0,
            route: v.current_route,
            driver: v.driver?.name || 'Unassigned',
            pingAt: v.last_ping_at,
          };
        }),
    [vehicles, livePos]
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      <TransporterSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TransporterHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isDashboard={false} />

        <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5 relative">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0B1E36] tracking-tight leading-tight">Live Tracking & GPS</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                Real-time positions of your fleet — updates broadcast every 4 seconds.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto flex-shrink-0">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                {stats.moving > 0 ? `${stats.moving} moving · GPS live` : 'GPS online · fleet idle'}
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="p-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {kpis.map((k) => (
              <div key={k.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${k.bg}`}>{k.icon}</div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide truncate">{k.title}</span>
                  <span className="text-xl font-black text-[#0B1E36] leading-tight mt-0.5">{k.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Continuous Corridor Threat Detection Banner */}
          {affectedVehicles.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 font-black shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                      Obstruction Detected on Active Route
                    </span>
                    <span className="font-extrabold text-slate-900">
                      {affectedVehicles.length} Vehicle{affectedVehicles.length === 1 ? '' : 's'} Approaching Hazards
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium mt-1 leading-snug">
                    Continuous route monitoring detected new disruptions (landslide/flood/damage) along the active path. Dynamic safe detour is calculated and ready to push to driver.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRerouteVehicleId(affectedVehicles[0].id);
                  const h = getVehicleHazard(affectedVehicles[0]);
                  setRerouteReason(h?.title ? `Avoid ${h.title} via ML safe detour` : 'Dynamic safe detour');
                  setShowRerouteModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 flex-shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reroute {affectedVehicles[0].id}</span>
              </button>
            </div>
          )}

          {/* Map + Live vehicle panel */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-9">
              <TrackingMap selectedId={selectedId} onSelect={setSelectedId} />
            </div>

            {/* Right: live selected vehicle */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-600" /> Live Vehicle
                </h3>
                <select
                  value={selectedId || ''}
                  onChange={(e) => setSelectedId(e.target.value || null)}
                  className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-emerald-500 max-w-[160px]"
                >
                  {vehicles.length === 0 && <option value="">No vehicles</option>}
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.id}</option>
                  ))}
                </select>
              </div>

              {!selected ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <Truck className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-black text-slate-700">No vehicle selected</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {vehicles.length === 0
                      ? 'Register a vehicle from My Vehicles and set it In Transit — it will appear here live.'
                      : 'Pick a vehicle from the list to see its live telemetry.'}
                  </p>
                </div>
              ) : (
                <div className="p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-black text-slate-900">{selected.id}</h4>
                      <p className="text-xs text-slate-400 font-medium">{selected.model || '—'}</p>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                      selected.status === 'moving' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : selected.status === 'delayed' ? 'bg-amber-50 text-amber-700 border-amber-200' : selected.status === 'maintenance' || selected.status === 'offline' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                    }`}>
                      {STATUS_LABEL[selected.status] || selected.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Gauge className="w-3 h-3 text-blue-500" /> Speed</span>
                      <span className="text-base font-black text-slate-800 block mt-0.5">{speed} km/h</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Condition</span>
                      <span className="text-base font-black text-slate-800 block mt-0.5">Optimal</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                    <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-slate-700 leading-snug">{selected.current_route || 'No route assigned'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Last ping: {timeAgo(selected.last_ping_at)}</p>
                    </div>
                  </div>

                  {/* Continuous Route Safety Monitor & Reroute Option */}
                  {selectedHazard ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-black uppercase text-amber-900 bg-amber-200/80 px-1.5 py-0.5 rounded">
                            Hazard Ahead on Corridor
                          </span>
                          <p className="text-xs font-bold text-slate-900 mt-1">{selectedHazard.title || 'Road Obstruction Ahead'}</p>
                          <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-tight">
                            {selectedHazard.message || 'Disruption detected on active route corridor.'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRerouteVehicleId(selected.id);
                          setRerouteReason(`Avoid ${selectedHazard.title} via ML safe detour`);
                          setShowRerouteModal(true);
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reroute Vehicle (Safe Detour)</span>
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Continuous Monitoring Active</span>
                          <p className="text-[11px] text-slate-600 font-medium">Corridor clear · No active hazards</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRerouteVehicleId(selected.id);
                          setRerouteReason('Preventive dynamic detour');
                          setShowRerouteModal(true);
                        }}
                        className="px-2 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        Detour
                      </button>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200/80 p-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Driver</span>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center text-xs font-black flex-shrink-0">
                        {selected.driver?.name ? selected.driver.name.charAt(0).toUpperCase() : '—'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-slate-900 truncate">{selected.driver?.name || 'Unassigned'}</p>
                        {selected.driver?.phone && (
                          <a href={`tel:${selected.driver.phone}`} className="flex items-center gap-1 text-[11px] text-blue-600 font-semibold">
                            <Phone className="w-3 h-3" /> {selected.driver.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Bottom: activity + trips */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800">Fleet Activity</h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">REAL-TIME</span>
              </div>
              <div className="divide-y divide-slate-100">
                {activity.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-medium">
                    No fleet activity yet — vehicles will appear here as soon as they start moving.
                  </div>
                ) : (
                  activity.slice(0, 8).map((a) => (
                    <div key={a.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.status === 'moving' ? 'bg-emerald-500' : a.status === 'delayed' ? 'bg-amber-500' : a.status === 'maintenance' || a.status === 'offline' ? 'bg-slate-400' : 'bg-orange-400'}`} />
                      <span className="text-xs font-black text-slate-800 flex-shrink-0">{a.id}</span>
                      <span className="text-[11px] text-slate-500 font-medium truncate flex-1">
                        {a.route || 'No route'} · driver: {a.driver}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600 flex-shrink-0">{a.speed} km/h</span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 w-16 text-right">{timeAgo(a.pingAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-800">Active Trips</h3>
              </div>
              {trips.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  <p>No trips scheduled yet.</p>
                  <p className="mt-1">Plan a trip from the Route Planning page and it will show up here live.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {trips.slice(0, 6).map((tp) => (
                    <div key={tp.id} className="px-5 py-3 flex items-center gap-2 hover:bg-slate-50/60 transition-colors">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-800 truncate">{tp.id}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {tp.origin} → {tp.destination}{tp.vehicle?.id ? ` · ${tp.vehicle.id}` : ''}
                        </p>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex-shrink-0 capitalize">
                        {(tp.status || 'planned').replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
