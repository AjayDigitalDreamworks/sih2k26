import { useState, useEffect, useRef, useCallback } from 'react';
import ApiClient from '@/lib/api';
import { trackingQueue, isOffline } from '@/lib/trackingQueue';
import { subscribeToTripUpdates } from '@/lib/socket';

// Tracking policy — tunable at build/runtime via config (mirrors backend env).
const TRACKING_INTERVAL_MS = 1000 * (Number(import.meta.env.VITE_TRACKING_INTERVAL_SECONDS) || 5);
const MOVEMENT_UPLOAD_METERS = Number(import.meta.env.VITE_TRACKING_MOVEMENT_METERS) || 30;
const MAX_UPLOAD_ACCURACY_M = Number(import.meta.env.VITE_TRACKING_MAX_ACCURACY_METERS) || 150;
const WATCH_OPTS = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 20000,
};

const MS_TO_KMH = 3.6;

function gpsErrorText(err) {
  if (!err) return 'GPS unavailable';
  switch (err.code) {
    case 1: return 'Location permission denied';
    case 2: return 'Location unavailable (GPS off / no signal)';
    case 3: return 'GPS timeout — no fix received';
    default: return 'GPS unavailable';
  }
}

export function useDriverTracking() {
  const [ctx, setCtx] = useState(null);           // { driver, vehicle, trip }
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [ctxError, setCtxError] = useState(null);

  const [permission, setPermission] = useState('prompt'); // prompt | granted | denied | unsupported
  const [gps, setGps] = useState(null);           // latest fix {lat,lng,accuracy,...}
  const [gpsError, setGpsError] = useState(null);
  const [watchActive, setWatchActive] = useState(false);
  const [online, setOnline] = useState(isOffline() ? false : true);
  const [lastUploadAt, setLastUploadAt] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [tripBusy, setTripBusy] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosError, setSosError] = useState(null);
  const [lastCompleted, setLastCompleted] = useState(null); // { id, origin, destination, at } shown until a new trip is assigned

  const watchIdRef = useRef(null);
  const lastFixRef = useRef(null);
  const lastUploadRef = useRef(null); // last successfully uploaded fix (for movement check)
  const startedRef = useRef(false);
  const stoppingRef = useRef(false);    // true while a STOP request is in flight
  const lastUploadAtRef = useRef(null); // last successful upload time
  const ctxRef = useRef(null);          // latest context, for effect guards

  const refreshPendingCount = useCallback(async () => {
    const n = await trackingQueue.count();
    setPendingCount(n);
  }, []);

  // ---- SOS state (server-side truth) ----
  const loadSos = useCallback(async () => {
    try {
      const res = await ApiClient.getSosActive();
      if (res?.success) setSosActive(!!res.data?.active);
    } catch (e) { /* keep previous state */ }
  }, []);

  // ---- Context (driver → vehicle → trip) ----
  const loadContext = useCallback(async () => {
    try {
      const res = await ApiClient.getTrackingContext();
      if (res?.success && res.data) {
        setCtx(res.data);
        setCtxError(null);
      } else {
        setCtx(null);
        setCtxError(res?.message || 'No driver context');
      }
    } catch (e) {
      setCtxError(e.message || 'Failed to load driver context');
    } finally {
      setLoadingCtx(false);
    }
  }, []);

  useEffect(() => { loadSos(); }, [loadSos]);

  useEffect(() => { loadContext(); refreshPendingCount(); }, [loadContext, refreshPendingCount]);

  // Once a fresh (planned/in_transit) assignment appears, clear the completed banner.
  useEffect(() => {
    if (ctx?.trip && ctx.trip.id && ctx.trip.id !== lastCompleted?.id) setLastCompleted(null);
    if (!ctx?.trip && ctx && lastCompleted && ctx.vehicle) {
      // keep banner — driver finished their last trip and no new one is assigned yet
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  // Keep the ref of the context so listeners/effects can check trip state.
  useEffect(() => { ctxRef.current = ctx; }, [ctx]);

  // Real-time trip & vehicle assignment updates via WebSocket
  useEffect(() => {
    const unsub = subscribeToTripUpdates((data) => {
      if (!data) return;
      const curDriverId = ctxRef.current?.driver?.id;
      const curVehicleId = ctxRef.current?.vehicle?.id;
      const curTripId = ctxRef.current?.trip?.id;
      if (
        (data.driverId && data.driverId === curDriverId) ||
        (data.vehicleId && data.vehicleId === curVehicleId) ||
        (data.tripId && (data.tripId === curTripId || !curTripId))
      ) {
        loadContext();
      }
    });
    return () => unsub();
  }, [loadContext]);

  // ---- Connectivity ----
  useEffect(() => {
    const activeTrip = () => !!ctxRef.current?.trip && ctxRef.current.trip.status === 'in_transit';
    const goOnline = () => {
      setOnline(true);
      if (activeTrip()) flushQueue();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Module-level shared watch id. React StrictMode double-invokes effects in
  // dev; two instances must share ONE real geolocation watch + upload interval
  // so the GPS stream is never duplicated (which would double upload rate and
  // trip the backend spacing gate). A remount re-registers after cleanup runs.
  const sharedWatchId = useRef(typeof globalThis !== 'undefined' && globalThis.__TRACKING_WATCH__ ? globalThis.__TRACKING_WATCH__ : null);

  // ---- Browser GPS (REAL geolocation only — no synthetic points) ----
  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setPermission('unsupported');
      setGpsError('This browser does not support geolocation');
      return;
    }
    if (sharedWatchId.current != null) {
      // A watch from a previous mount still exists — reuse it, don't re-ask.
      setWatchActive(true);
      return;
    }
    setWatchActive(true);
    sharedWatchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude ?? null,
          speed: pos.coords.speed != null ? Math.max(0, pos.coords.speed * MS_TO_KMH) : null,
          heading: pos.coords.heading ?? null,
          gpsTimestamp: new Date(pos.timestamp).toISOString(),
        };
        lastFixRef.current = fix;
        setGps(fix);
        setPermission('granted');
        setGpsError(null);
      },
      (err) => {
        setGpsError(gpsErrorText(err));
        if (err && err.code === 1) setPermission('denied');
      },
      WATCH_OPTS
    );
    try { globalThis.__TRACKING_WATCH__ = sharedWatchId.current; } catch { /* noop */ }
  }, []);

  const stopWatching = useCallback(() => {
    // The real unmount clears the shared watch; StrictMode's effect re-run
    // will re-register it afterwards. Leaving a stale watch running would keep
    // the GPS stream alive on pages that no longer need tracking.
    const id = (typeof globalThis !== 'undefined' && globalThis.__TRACKING_WATCH__) || sharedWatchId.current;
    if (id != null) {
      try { navigator.geolocation.clearWatch(id); } catch { /* noop */ }
    }
    sharedWatchId.current = null;
    try { delete globalThis.__TRACKING_WATCH__; } catch { /* noop */ }
    setWatchActive(false);
  }, []);

  useEffect(() => {
    // Ask once on mount (permission prompt). User can re-request via button.
    startWatching();
    return () => stopWatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Upload one real point ----
  const sendFix = useCallback(async (fix, tripId) => {
    const payload = {
      vehicle_id: ctx?.vehicle?.id,
      trip_id: tripId || null,
      latitude: fix.lat,
      longitude: fix.lng,
      accuracy: Math.round(fix.accuracy * 10) / 10,
      speed: fix.speed != null ? Math.round(fix.speed * 10) / 10 : null,
      heading: fix.heading != null ? Math.round(fix.heading) : null,
      altitude: fix.altitude != null ? Math.round(fix.altitude) : null,
      gps_timestamp: fix.gpsTimestamp,
      source: 'WEB_GPS',
    };
    setUploading(true);
    setUploadError(null);
    try {
      if (isOffline()) {
        const ok = await trackingQueue.enqueue(payload);
        if (!ok) setUploadError('Offline — point could not be queued (storage unavailable)');
      } else {
        const res = await ApiClient.postTrackingLocation(payload, false);
        if (res?.success) {
          setLastUploadAt(new Date());
          lastUploadRef.current = fix;
          await flushQueue(); // push any backlog now that we are online
        } else {
          setUploadError(res?.message || 'Upload failed');
          await trackingQueue.enqueue(payload);
        }
      }
    } catch (e) {
      setUploadError(e.message || 'Upload failed');
      await trackingQueue.enqueue(payload);
    } finally {
      setUploading(false);
      await refreshPendingCount();
    }
  }, [ctx]);

  // Flush queued observations (original gps_timestamp preserved). Only runs
  // while a trip is active — points from a finished trip are invalid and would
  // be rejected by the server forever, so they are dropped on STOP instead.
  const flushQueue = useCallback(async () => {
    if (isOffline()) return 0;
    const queued = await trackingQueue.getAll();
    if (!queued.length) return 0;
    let sent = 0;
    const failIds = [];
    for (const p of queued) {
      try {
        const res = await ApiClient.postTrackingLocation(p, true);
        if (res?.success) sent += 1;
        else failIds.push(p.id);
      } catch {
        failIds.push(p.id);
      }
    }
    await trackingQueue.remove(queued.filter(p => !failIds.includes(p.id)).map(p => p.id));
    await refreshPendingCount();
    if (sent > 0) setLastUploadAt(new Date());
    return sent;
  }, [refreshPendingCount]);

  // ---- Upload policy: interval + meaningful movement ----
  useEffect(() => {
    if (!ctx || !ctx.trip || ctx.trip.status !== 'in_transit') return undefined;
    if (!lastFixRef.current) return undefined;
    const iv = setInterval(async () => {
      // Stop in flight / trip closed server-side: never keep pushing points.
      if (stoppingRef.current) return;
      if (!ctxRef.current?.trip || ctxRef.current.trip.status !== 'in_transit') return;
      const fix = lastFixRef.current;
      if (!fix) return;
      // Skip very poor fixes silently (logged locally, never fabricated).
      if (fix.accuracy > MAX_UPLOAD_ACCURACY_M) return;
      const last = lastUploadRef.current;
      const moved = last
        ? haversineMeters(last.lat, last.lng, fix.lat, fix.lng)
        : Infinity;
      const intervalElapsed = !lastUploadAtRef.current || (Date.now() - lastUploadAtRef.current.getTime()) >= TRACKING_INTERVAL_MS;
      if (moved >= MOVEMENT_UPLOAD_METERS || intervalElapsed) {
        await sendFix(fix, ctx.trip.id);
      }
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  useEffect(() => { lastUploadAtRef.current = lastUploadAt; }, [lastUploadAt]);

  // ---- SOS / EMERGENCY ----
  const sendSos = useCallback(async (reason) => {
    setSosBusy(true);
    setSosError(null);
    try {
      const fix = lastFixRef.current || gps;
      const payload = {
        reason: String(reason || '').trim() || 'Driver requested emergency assistance',
      };
      if (fix?.lat != null && fix?.lng != null) {
        payload.latitude = fix.lat;
        payload.longitude = fix.lng;
      }
      const res = await ApiClient.sendSos(payload);
      if (res?.success) {
        setSosActive(true);
        return true;
      }
      setSosError(res?.message || 'Could not raise SOS');
      return false;
    } catch (e) {
      setSosError(e.message || 'Could not raise SOS — check connection');
      return false;
    } finally {
      setSosBusy(false);
    }
  }, [gps]);

  const cancelSos = useCallback(async () => {
    setSosBusy(true);
    setSosError(null);
    try {
      const res = await ApiClient.cancelSos();
      if (res?.success) {
        setSosActive(false);
        return true;
      }
      setSosError(res?.message || 'Could not clear SOS');
      return false;
    } catch (e) {
      setSosError(e.message || 'Could not clear SOS — check connection');
      return false;
    } finally {
      setSosBusy(false);
    }
  }, []);

  // ---- Trip actions ----
  const startTrip = useCallback(async () => {
    if (!ctx?.trip) return false;
    setTripBusy(true);
    try {
      const res = await ApiClient.startTrip(ctx.trip.id);
      if (res?.success) {
        startedRef.current = true;
        await loadContext();
        // Push the first real fix immediately once tracking starts.
        if (lastFixRef.current) await sendFix(lastFixRef.current, ctx.trip.id);
        return true;
      }
      setUploadError(res?.message || 'Could not start trip');
      return false;
    } catch (e) {
      setUploadError(e.message || 'Could not start trip');
      return false;
    } finally {
      setTripBusy(false);
    }
  }, [ctx, loadContext, sendFix]);

  const stopTrip = useCallback(async () => {
    if (!ctx?.trip) return false;
    setTripBusy(true);
    stoppingRef.current = true;
    try {
      const res = await ApiClient.stopTrip(ctx.trip.id);
      if (res?.success) {
        startedRef.current = false;
        setLastUploadAt(null);
        setLastCompleted({
          id: ctx.trip.id, origin: ctx.trip.origin, destination: ctx.trip.destination, at: new Date(),
        });
        // The server has already closed the trip — any unsent queue points for
        // it are no longer valid and would be rejected forever. Drop them.
        await trackingQueue.clear();
        await refreshPendingCount();
        await loadContext();
        return true;
      }
      setUploadError(res?.message || 'Could not stop trip');
      return false;
    } catch (e) {
      setUploadError(e.message || 'Could not stop trip');
      return false;
    } finally {
      stoppingRef.current = false;
      setTripBusy(false);
    }
  }, [ctx, loadContext, flushQueue]);

  // Derived UI state — honest, never fabricated.
  const tripStarted = !!ctx?.trip && ctx.trip.status === 'in_transit';
  const hasFreshGps = !!gps && Date.now() - new Date(gps.gpsTimestamp).getTime() < 30000;
  const lastUploadAgeSec = lastUploadAt ? Math.max(0, Math.round((Date.now() - lastUploadAt.getTime()) / 1000)) : null;
  const gpsReady = permission === 'granted' && hasFreshGps && !gpsError;
  const trackingLive = tripStarted && !!lastUploadAt && lastUploadAgeSec <= 45;
  const syncState = !online ? 'CONNECTION_LOST' : pendingCount > 0 ? 'PENDING' : trackingLive ? 'LIVE' : lastUploadAt ? 'SYNCED' : 'IDLE';

  return {
    ctx, loadingCtx, ctxError, reloadContext: loadContext, lastCompleted,
    permission, gps, gpsError, watchActive, startWatching, stopWatching,
    online, lastUploadAt, lastUploadAgeSec, pendingCount, uploading, uploadError,
    tripStarted, gpsReady, trackingLive, syncState, startTrip, stopTrip, tripBusy,
    sosActive, sosBusy, sosError, sendSos, cancelSos,
    reload: loadContext,
  };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
