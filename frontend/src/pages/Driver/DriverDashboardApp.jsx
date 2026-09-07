import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Navigation,
  MapPin,
  Wifi,
  WifiOff,
  Satellite,
  Play,
  Square,
  RefreshCw,
  TriangleAlert,
  Siren,
  PhoneOff,
  Route,
  Map as MapIcon,
  History,
  AlertTriangle,
  User,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Truck,
  Activity,
  X,
  Gauge,
  Package,
  Phone,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDriverTracking } from '@/hooks/useDriverTracking';
import DriverLiveMap from '@/components/driver/DriverLiveMap';
import DriverReportForm from '@/components/driver/DriverReportForm';
import DriverHistory from '@/components/driver/DriverHistory';
import ApiClient from '@/lib/api';
import { subscribeToDynamicReroute } from '@/lib/socket';
import { toast } from 'sonner';

const TABS = [
  { id: 'tracking', label: 'Live Tracking', icon: MapIcon },
  { id: 'reports', label: 'Road Reports', icon: AlertTriangle },
  { id: 'history', label: 'Trip History', icon: History },
  { id: 'settings', label: 'Profile', icon: User },
];

function fmtAge(sec) {
  if (sec == null) return '—';
  if (sec < 45) return 'LIVE';
  if (sec <= 300) return 'STALE';
  return 'OFFLINE';
}

export default function DriverDashboardApp() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const t = useDriverTracking();
  const [tab, setTab] = useState('tracking');
  const [, setTick] = useState(0);
  const [sosModalOpen, setSosModalOpen] = useState(false);

  // 1-second timer for live freshness updates
  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const [routeCoords, setRouteCoords] = useState(null);
  const [trail, setTrail] = useState([]);
  const [live, setLive] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [reroutedNotice, setReroutedNotice] = useState(null);

  const isDriver = user?.backendRole === 'driver';
  const vehicle = t.ctx?.vehicle;
  const trip = t.ctx?.trip;
  const gps = t.gps;
  const ageSec = t.lastUploadAgeSec != null && t.lastUploadAgeSec !== 0
    ? t.lastUploadAgeSec
    : t.trackingLive ? 0 : null;

  // Live map data: real-time road route with alert-avoidance, or GIS fallback
  const loadRoute = useCallback(async () => {
    if (!trip?.route_id && !vehicle?.id) {
      setRouteCoords(null);
      return;
    }
    // 1. Try alert-aware live road route first
    if (vehicle?.id) {
      try {
        const liveRes = await ApiClient.getLiveRoute(vehicle.id);
        const d = liveRes?.data || {};
        if (d.hasRoute && Array.isArray(d.geometry) && d.geometry.length > 1) {
          setRouteCoords(d.geometry);
          if (d.rerouted) {
            setReroutedNotice(d.rerouteReason || 'Dynamic safe detour active');
          }
          return;
        }
      } catch {
        // Fallback to GIS routes below
      }
    }
    // 2. Fallback to GIS corridor geometries
    try {
      const res = await ApiClient.getGisRoutes();
      const feats = res?.success ? res.data?.features || [] : [];
      const feat = feats.find((f) => f.properties?.id === trip?.route_id) ||
        feats.find(
          (f) =>
            (f.properties?.name || '').toLowerCase().includes(
              String((vehicle?.current_route || '').toLowerCase().split('(')[0].trim() || '').toLowerCase()
            ) && f.properties?.name
        );
      if (feat?.geometry?.coordinates?.length) {
        setRouteCoords(feat.geometry.coordinates);
      }
    } catch {
      // GIS unavailable — map will show GPS trail only
    }
  }, [trip?.route_id, vehicle?.id, vehicle?.current_route]);

  const loadTrail = useCallback(async () => {
    if (!vehicle?.id) {
      setTrail([]);
      return;
    }
    try {
      const res = await ApiClient.getVehicleHistory(vehicle.id, { trip_id: trip?.id || '', limit: '300' });
      if (res?.success && Array.isArray(res.data?.points)) {
        setTrail(res.data.points);
      }
    } catch {
      // keep previous trail
    }
  }, [vehicle?.id, trip?.id]);

  const loadLive = useCallback(async () => {
    if (!vehicle?.id) {
      setLive(null);
      return;
    }
    try {
      const res = await ApiClient.getVehicleTrackingStatus(vehicle.id);
      if (res?.success && res.data) {
        setLive(res.data);
      }
    } catch {
      setLiveError('Live status unavailable');
    }
  }, [vehicle?.id]);

  // Poll server live-state while tracking
  useEffect(() => {
    if (t.tripStarted && vehicle?.id) {
      loadLive();
      const iv = setInterval(() => {
        loadLive();
        loadTrail();
      }, 8000);
      return () => clearInterval(iv);
    }
    setLive(null);
    return undefined;
  }, [t.tripStarted, vehicle?.id, loadLive, loadTrail]);

  useEffect(() => {
    if (trip?.id && vehicle?.id) {
      loadRoute();
      loadTrail();
    } else {
      setRouteCoords(null);
      setTrail([]);
    }
  }, [trip?.id, vehicle?.id, loadRoute, loadTrail, t.lastCompleted]);

  // Real-time dynamic reroute push listener for in-transit hazards
  useEffect(() => {
    const unsub = subscribeToDynamicReroute((data) => {
      if (!data || !data.vehicleId) return;
      if (data.vehicleId === vehicle?.id && Array.isArray(data.geometry) && data.geometry.length > 1) {
        setRouteCoords(data.geometry);
        const reason = data.rerouteReason || 'Dynamic safe bypass active';
        setReroutedNotice(reason);
        toast.warning(`⚠️ Reroute: ${reason}`, { duration: 6000 });
      }
    });
    return () => unsub();
  }, [vehicle?.id]);

  // Refresh context shortly after start/stop
  useEffect(() => {
    if (t.trackingLive || t.lastCompleted) {
      const id = setTimeout(() => {
        t.reload();
        loadLive();
        loadTrail();
      }, 2500);
      return () => clearTimeout(id);
    }
  }, [t.trackingLive, t.lastCompleted]);

  if (!isDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6 font-sans">
        <div className="max-w-md w-full text-center bg-slate-800/80 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <Truck className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">RAAHI Driver Portal</h1>
          <p className="text-slate-400 text-sm mb-6">This account is not registered as a fleet driver.</p>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white transition-colors"
          >
            Sign In with Driver Account
          </button>
        </div>
      </div>
    );
  }

  const handleSosConfirm = async () => {
    setSosModalOpen(false);
    if (t.sosActive) {
      await t.cancelSos();
    } else {
      await t.sendSos();
    }
  };

  const handleStart = async () => {
    if (!trip || trip.status !== 'planned' || !trip.route_id) {
      toast.error('Trip cannot be started: route corridor has not been evaluated or assigned by transporter');
      return;
    }
    const ok = await t.startTrip();
    if (ok) {
      toast.success('Trip started — live GPS tracking active');
      setTab('tracking');
    }
  };

  const handleStop = async () => {
    if (!trip || trip.status !== 'in_transit') return;
    if (!window.confirm('Stop tracking and complete this trip? All telemetry will be finalized.')) return;
    const ok = await t.stopTrip();
    if (ok) {
      toast.success('Trip completed — tracking stopped');
    }
  };

  const handleConfirmDelivery = async (deliveryId) => {
    try {
      const res = await ApiClient.confirmDelivery(deliveryId);
      if (res?.success) {
        toast.success('Consignment delivery & handover confirmed successfully!');
        await t.reload();
      } else {
        toast.error(res?.message || 'Could not confirm delivery');
      }
    } catch (e) {
      toast.error(e.message || 'Could not confirm delivery');
    }
  };

  const gpsFresh = gps ? Math.max(0, (Date.now() - new Date(gps.gpsTimestamp).getTime()) / 1000) : null;
  const marker = gps?.lat != null ? { lat: gps.lat, lng: gps.lng, heading: gps.heading || 0 } : null;

  const devMeters = live?.routeDeviation?.isDeviated ? live.routeDeviation.deviationMeters : null;
  const insideGeofence = live?.geofenceStatus?.insideGeofence ? live.geofenceStatus.geofenceName : null;
  const prolongedStop = live?.stopDetection?.stopDurationMinutes >= 2 ? live.stopDetection.stopDurationMinutes : null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-28 select-none">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white shadow-md border-b border-emerald-700/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Truck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-base font-black tracking-wider text-white">RAAHI</span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/40 text-emerald-300">
                  Driver
                </span>
              </div>
              <div className="text-xs text-slate-300 font-medium mt-1 flex items-center gap-1.5">
                <span>{user?.name}</span>
                {vehicle?.id && (
                  <>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-emerald-200 font-bold">{vehicle.id}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick SOS Trigger in Header */}
            <button
              onClick={() => setSosModalOpen(true)}
              disabled={t.sosBusy || !vehicle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                t.sosActive
                  ? 'bg-amber-500 text-slate-950 animate-pulse shadow-lg shadow-amber-500/50'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-900/50'
              } disabled:opacity-50`}
              title="Emergency SOS"
            >
              <Siren className="w-3.5 h-3.5" />
              <span>{t.sosActive ? 'SOS ACTIVE' : 'SOS'}</span>
            </button>

            {/* Refresh assignment */}
            <button
              onClick={() => {
                t.reload();
                toast.info('Reloading driver assignment...');
              }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Refresh Assignment"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Sign Out */}
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-500/30 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Scroll Area ── */}
      <main className="max-w-2xl mx-auto px-3.5 pt-3.5 space-y-3.5">
        {/* Context error alert if any */}
        {t.ctxError && !t.ctx && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
            <TriangleAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">Assignment Alert</p>
              <p className="text-rose-700 mt-0.5">{t.ctxError}</p>
            </div>
          </div>
        )}

        {t.loadingCtx ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 shadow-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-sm font-semibold">Synchronizing fleet assignment…</p>
          </div>
        ) : (
          <>
            {tab === 'tracking' && (
              <TrackingView
                t={t}
                vehicle={vehicle}
                trip={trip}
                marker={marker}
                gps={gps}
                gpsFresh={gpsFresh}
                ageSec={ageSec}
                live={live}
                liveError={liveError}
                routeCoords={routeCoords}
                trail={trail}
                devMeters={devMeters}
                insideGeofence={insideGeofence}
                prolongedStop={prolongedStop}
                onStart={handleStart}
                onStop={handleStop}
                onOpenSos={() => setSosModalOpen(true)}
                reroutedNotice={reroutedNotice}
                deliveries={t.ctx?.deliveries || []}
                onConfirmDelivery={handleConfirmDelivery}
              />
            )}

            {tab === 'reports' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
                <div>
                  <h2 className="text-base font-black text-slate-900">Report Road Incidents</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t.tripStarted
                      ? 'Live GPS fix will be automatically attached to your dispatch report.'
                      : 'Reports attach your browser GPS coordinates to alert the control center.'}
                  </p>
                </div>
                <DriverReportForm mode="incident" latestFix={gps} />
                <div className="h-px bg-slate-100 my-4" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">GIS Road Damage & Obstacle Reporting</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Report potholes, landslides, or floods to the route risk engine.</p>
                </div>
                <DriverReportForm mode="road" latestFix={gps} />
              </div>
            )}

            {tab === 'history' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h2 className="text-base font-black text-slate-900">Completed Trips History</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Verified trip logs, GPS distances, and travel metrics.</p>
                </div>
                <div className="p-4">
                  <DriverHistory />
                </div>
              </div>
            )}

            {tab === 'settings' && <ProfileView user={user} />}
          </>
        )}
      </main>

      {/* ── Fixed Bottom Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-around">
          {TABS.map((tb) => {
            const Icon = tb.icon;
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`flex-1 py-2.5 flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                  active ? 'text-emerald-700 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                  {tb.id === 'tracking' && t.tripStarted && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  )}
                </div>
                <span className="text-[11px] leading-none">{tb.label}</span>
                {active && <span className="w-6 h-0.5 rounded-full bg-emerald-600 -mb-1 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── SOS Emergency Confirmation Modal ── */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-rose-100 text-center space-y-4">
            <div
              className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                t.sosActive ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600 animate-bounce'
              }`}
            >
              {t.sosActive ? <PhoneOff className="w-8 h-8" /> : <Siren className="w-8 h-8" />}
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">
                {t.sosActive ? 'Cancel Active Emergency?' : 'Confirm Emergency SOS?'}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {t.sosActive
                  ? 'Your current emergency status will be cleared and the central command center will be informed that you are safe.'
                  : 'This broadcasts a critical PRIORITY EMERGENCY alert to state command centers and attaches your live GPS coordinates.'}
              </p>
            </div>

            {gps && (
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-xs font-mono text-slate-600">
                Fix: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} (±{Math.round(gps.accuracy)}m)
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSosModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSosConfirm}
                disabled={t.sosBusy}
                className={`flex-1 py-3 rounded-xl font-black text-xs text-white shadow-md transition-colors cursor-pointer ${
                  t.sosActive ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {t.sosBusy ? 'Transmitting…' : t.sosActive ? 'Clear SOS' : 'Trigger SOS Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TRACKING VIEW (Primary Driver Workspace)
   ───────────────────────────────────────────────────────────────────────────── */
function TrackingView({
  t,
  vehicle,
  trip,
  marker,
  gps,
  gpsFresh,
  ageSec,
  live,
  liveError,
  routeCoords,
  trail,
  devMeters,
  insideGeofence,
  prolongedStop,
  onStart,
  onStop,
  onOpenSos,
  reroutedNotice,
  deliveries = [],
  onConfirmDelivery,
}) {
  const hasEvaluatedTrip = Boolean(trip && trip.status === 'planned' && trip.route_id);
  const isInTransit = Boolean(trip && trip.status === 'in_transit');

  return (
    <div className="space-y-3.5">
      {/* ── Assigned Vehicle & Trip Banner ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
              <Truck className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-900">{vehicle?.id || 'No Vehicle Assigned'}</span>
                {vehicle?.model && (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {vehicle.model}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {hasEvaluatedTrip || isInTransit
                  ? `${trip.origin || 'Origin'} → ${trip.destination || 'Destination'}`
                  : t.lastCompleted
                  ? `Completed: ${t.lastCompleted.origin} → ${t.lastCompleted.destination}`
                  : 'Awaiting Transporter Route Assignment'}
              </p>
            </div>
          </div>

          <div>
            {isInTransit && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> IN TRANSIT
              </span>
            )}
            {hasEvaluatedTrip && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                CORRIDOR ASSIGNED
              </span>
            )}
            {!hasEvaluatedTrip && !isInTransit && t.lastCompleted && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                ✓ COMPLETED
              </span>
            )}
            {!hasEvaluatedTrip && !isInTransit && !t.lastCompleted && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                AWAITING ROUTE
              </span>
            )}
          </div>
        </div>

        {/* Assigned Corridor Detail Card (Shown ONLY when Transporter has evaluated and assigned a route corridor) */}
        {hasEvaluatedTrip && (
          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-800 flex items-center gap-1">
                <Route className="w-3.5 h-3.5 text-emerald-600" /> Assigned Route Corridor:
              </span>
              <span className="font-black text-slate-900">{trip.route_id}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span>{trip.origin} → {trip.destination}</span>
              {(trip.distance_km || trip.distanceKm) && (
                <span className="font-bold text-slate-800">{trip.distance_km || trip.distanceKm} km</span>
              )}
            </div>
          </div>
        )}

        {/* Awaiting Transporter Route Assignment Notice (Shown when NO evaluated corridor is assigned) */}
        {!hasEvaluatedTrip && !isInTransit && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-black text-slate-700">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Awaiting Transporter Route Assignment</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Your transporter has not evaluated or assigned a route corridor yet. Once your transporter selects and evaluates a corridor in Route Planning, the trip assignment and <strong>Start Trip</strong> option will appear here automatically.
            </p>
          </div>
        )}

        {/* Start Button: Strictly rendered ONLY when transporter has evaluated and assigned the corridor */}
        {hasEvaluatedTrip && (
          <button
            onClick={onStart}
            disabled={t.tripBusy}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-sm tracking-wide shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-60"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{t.tripBusy ? 'STARTING TRACKING…' : 'START TRIP & BEGIN TRACKING'}</span>
          </button>
        )}

        {isInTransit && (
          <button
            onClick={onStop}
            disabled={t.tripBusy}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-black text-sm tracking-wide shadow-md shadow-rose-700/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-60"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>{t.tripBusy ? 'FINALIZING TRIP…' : 'STOP TRIP & COMPLETE'}</span>
          </button>
        )}
      </div>

      {/* ── Status Pills Bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* GPS Fix Pill */}
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${
            t.gpsReady
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-amber-700 bg-amber-50 border-amber-200'
          }`}
        >
          <Satellite className="w-3 h-3" />
          <span>
            {t.permission === 'denied'
              ? 'GPS Permission Denied'
              : !t.gpsReady
              ? 'GPS Acquiring…'
              : gpsFresh != null && gpsFresh <= 30
              ? 'GPS Live'
              : 'GPS Ready'}
          </span>
        </span>

        {/* Connectivity Pill */}
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${
            t.online
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-amber-700 bg-amber-50 border-amber-200'
          }`}
        >
          {t.online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span>{t.online ? 'Online' : 'Offline Mode'}</span>
        </span>

        {/* Server Sync Pill */}
        {ageSec != null && (
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${
              ageSec <= 45
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : ageSec <= 300
                ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-slate-600 bg-slate-100 border-slate-200'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>Server: {fmtAge(ageSec)}</span>
          </span>
        )}

        {/* Offline Queue Count */}
        {t.pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border text-indigo-700 bg-indigo-50 border-indigo-200">
            Queue: {t.pendingCount}
          </span>
        )}
      </div>

      {/* ── Interactive Live Map Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="font-black text-slate-800 flex items-center gap-1.5">
            <MapIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>Corridor & GPS Breadcrumbs</span>
          </div>
          {gps && (
            <span className="font-mono text-[11px] text-slate-500 font-semibold">
              ±{Math.round(gps.accuracy)}m accuracy
            </span>
          )}
        </div>

        {reroutedNotice && (
          <div className="px-3.5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-800 animate-pulse">
            <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="flex-1 leading-snug">
              <span className="font-bold text-amber-900">Dynamic Reroute Active:</span> {reroutedNotice}
            </div>
          </div>
        )}

        <div className="relative">
          <DriverLiveMap marker={marker} route={routeCoords} trail={trail} height={280} />
        </div>

        {/* Map Legend */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-3.5 text-[11px] text-slate-600 font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-1 rounded bg-blue-600" /> Highway Corridor
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-1 rounded bg-emerald-500 border border-emerald-600" /> GPS Trail
          </span>
          {gps && (
            <span className="ml-auto font-mono text-[10px] text-slate-500">
              {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
            </span>
          )}
        </div>
      </div>

      {/* ── Live Telemetry Details Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Speed</span>
          <span className="text-base font-black text-slate-900 mt-0.5 block">
            {gps?.speed != null ? `${Math.round(gps.speed)} km/h` : '0 km/h'}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Heading</span>
          <span className="text-base font-black text-slate-900 mt-0.5 block">
            {gps?.heading != null ? `${Math.round(gps.heading)}°` : '—'}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">GPS Fix Age</span>
          <span className="text-base font-black text-slate-900 mt-0.5 block">
            {gpsFresh == null ? '—' : `${Math.round(gpsFresh)}s`}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Server Sync</span>
          <span className="text-base font-black text-slate-900 mt-0.5 block">
            {ageSec == null ? '—' : `${ageSec}s ago`}
          </span>
        </div>
      </div>

      {/* ── Corridor Analysis Card (PostGIS alerts) ── */}
      {(trip?.status === 'in_transit' || devMeters || insideGeofence || prolongedStop) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Corridor Telemetry Analysis</h4>
            <span className="text-[10px] text-slate-400 font-bold">Server Verified</span>
          </div>

          {devMeters && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-bold flex items-center gap-2">
              <TriangleAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>Route Deviation Alert: {Math.round(devMeters)}m away from assigned highway.</span>
            </div>
          )}

          {insideGeofence && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-2.5 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Within Geofence: {insideGeofence}</span>
            </div>
          )}

          {prolongedStop && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2.5 text-xs font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Stationary for {Math.round(prolongedStop)} minutes.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Distance Remaining:</span>
              <span className="font-bold text-slate-800">{live?.distanceRemaining != null ? `${live.distanceRemaining} km` : '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Corridor ETA:</span>
              <span className="font-bold text-slate-800">{live?.eta || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Consignment Cargo & Delivery / Pickup Card ── */}
      {(hasEvaluatedTrip || isInTransit) && deliveries && deliveries.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-emerald-600" /> Consignment & Cargo Handover
            </h4>
            <span className="text-[10px] font-bold text-slate-400">Delivery / Pickup</span>
          </div>

          {deliveries.map((del) => {
            const isDelivered = del.status === 'delivered';
            return (
              <div key={del.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-900">{del.id}</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 uppercase">
                        {del.commodity_type || 'General Cargo'}
                      </span>
                      {del.weight_kg && (
                        <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {del.weight_kg} kg
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-700">Consignee:</span>
                      <span>{del.consignee_name}</span>
                      {del.consignee_phone && (
                        <span className="text-slate-400">({del.consignee_phone})</span>
                      )}
                    </div>
                  </div>

                  <div>
                    {isDelivered ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> DELIVERED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" /> IN TRANSIT
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-slate-200/60">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Pickup Point</span>
                    <span className="font-bold text-slate-800">{trip.origin}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Drop-off / Handover</span>
                    <span className="font-bold text-slate-800">{trip.destination}</span>
                  </div>
                </div>

                {/* Handover Action */}
                {!isDelivered && isInTransit && (
                  <button
                    type="button"
                    onClick={() => onConfirmDelivery && onConfirmDelivery(del.id)}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Consignment Handover / Delivered</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── GPS Permission / Offline Guidance Card ── */}
      {(!t.watchActive || t.permission === 'denied' || t.gpsError) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">GPS Access Required for Live Tracking</p>
              <p className="text-amber-700 mt-0.5">
                {t.permission === 'denied'
                  ? 'Browser location permission is blocked. Please enable location in your device settings.'
                  : 'Enable GPS so your vehicle location broadcasts to the regional dispatch map.'}
              </p>
            </div>
          </div>
          <button
            onClick={t.startWatching}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs cursor-pointer"
          >
            {t.permission === 'denied' ? 'Request Permission Again' : 'Enable Device GPS'}
          </button>
        </div>
      )}

      {/* ── Emergency SOS Dedicated Bottom Action ── */}
      <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-600" /> Emergency Assistance
          </span>
          <p className="text-[11px] text-rose-700 mt-0.5">
            Broadcast distress beacon to police and highway patrol.
          </p>
        </div>
        <button
          onClick={onOpenSos}
          className={`px-4 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition-all active:scale-95 cursor-pointer ${
            t.sosActive ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
          }`}
        >
          {t.sosActive ? 'CANCEL SOS' : 'TRIGGER SOS'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROFILE VIEW
   ───────────────────────────────────────────────────────────────────────────── */
function ProfileView({ user }) {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await ApiClient.getDriverMe();
        if (res?.success) {
          setProfile(res.data);
          setName(res.data.driver?.name || res.data.user?.name || user?.name || '');
          setPhone(res.data.driver?.phone || res.data.user?.phone || '');
        }
      } catch {
        // non-fatal
      }
    })();
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await ApiClient.updateDriverMe({ name: name.trim(), phone: phone.trim() || null });
      if (res?.success) {
        toast.success('Driver profile updated');
        setProfile(res.data);
      } else {
        toast.error(res?.message || 'Could not update profile');
      }
    } catch (err) {
      toast.error(err.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div>
        <h2 className="text-base font-black text-slate-900">Driver Credentials & Profile</h2>
        <p className="text-xs text-slate-500 mt-0.5">Authenticated fleet driver profile linked to your vehicle.</p>
      </div>

      {profile?.driver && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Driver ID:</span>
            <span className="font-mono font-bold text-slate-800">{profile.driver.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Safety Rating:</span>
            <span className="font-bold text-emerald-700">{profile.driver.rating ?? '5.0'} ★</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Assigned Vehicle:</span>
            <span className="font-mono font-bold text-slate-800">{profile.vehicle?.id || 'Unassigned'}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 90000 00000"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Saving changes…' : 'Update Profile'}
        </button>
      </form>

      <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
        <p>
          <b>Privacy Policy:</b> Real GPS location is only collected during an active trip that you initiate, and ceases immediately upon tapping Stop.
        </p>
        <p>
          <b>Offline Capability:</b> Telemetry points recorded during network drops are buffered locally in IndexedDB and dispatched once internet returns.
        </p>
      </div>
    </div>
  );
}
