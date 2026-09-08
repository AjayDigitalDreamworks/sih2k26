import { useEffect, useRef, useState, useCallback } from 'react';

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function bearingToDirection(bearing) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(bearing / 45) % 8];
}

const ANIMATION_DURATION = 2000;

export function useVehicleTracking(socket) {
  const [positions, setPositions] = useState({});
  const [trails, setTrails] = useState({});
  const animStates = useRef({});
  const animFrameRef = useRef(null);
  const isRunning = useRef(false);

  const animate = useCallback(() => {
    if (!isRunning.current) return;
    const now = Date.now();

    setPositions(prev => {
      const updated = { ...prev };
      Object.keys(animStates.current).forEach(vehicleId => {
        const state = animStates.current[vehicleId];
        if (!state) return;
        const elapsed = now - state.startTimestamp;
        const duration = state.animDuration || ANIMATION_DURATION;
        let t = Math.min(elapsed / duration, 1);
        t = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        const lat = state.startLat + (state.targetLat - state.startLat) * t;
        const lng = state.startLng + (state.targetLng - state.startLng) * t;
        let bearing = state.targetBearing;
        if (state.startBearing !== undefined) {
          let diff = bearing - state.startBearing;
          if (diff > 180) diff -= 360;
          if (diff < -180) diff += 360;
          bearing = state.startBearing + diff * t;
        }
        updated[vehicleId] = {
          lat, lng,
          bearing: ((bearing % 360) + 360) % 360,
          direction: bearingToDirection(bearing),
          speed: state.speed, status: state.status, animating: t < 1,
          eta: state.eta, etaMinutes: state.etaMinutes, timestamp: state.timestamp,
          route: state.route, accuracyRating: state.accuracyRating,
          batteryLevel: state.batteryLevel, lastUpdate: state.lastUpdate,
          inDeadZone: state.inDeadZone || false,
          fatigueWarning: state.fatigueWarning || false,
          continuousDrivingMins: state.continuousDrivingMins || 0,
        };
      });
      return updated;
    });

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const startAnimation = useCallback(() => {
    if (isRunning.current) return;
    isRunning.current = true;
    animFrameRef.current = requestAnimationFrame(animate);
  }, [animate]);

  const stopAnimation = useCallback(() => {
    isRunning.current = false;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleGpsUpdate = useCallback((vehicleId, data) => {
    const now = Date.now();
    const prev = animStates.current[vehicleId];
    let bearing = data.heading || 0;
    let animDuration = ANIMATION_DURATION;
    if (prev) {
      bearing = calculateBearing(prev.targetLat, prev.targetLng, data.lat, data.lng);
      const dist = haversineDistance(prev.targetLat, prev.targetLng, data.lat, data.lng);
      const speedMs = Math.max(data.speed || 20, 5) * 0.277778;
      animDuration = Math.max(600, Math.min(3000, (dist / speedMs) * 1000));
    }
    let status = data.inDeadZone ? 'in_dead_zone' : data.status || 'moving';
    if (data.accuracyRating === 'invalid') status = 'gps_error';
    else if (!data.isValid && !data.inDeadZone) status = 'stale';

    animStates.current[vehicleId] = {
      startLat: prev ? prev.targetLat : data.lat,
      startLng: prev ? prev.targetLng : data.lng,
      startBearing: prev ? bearing : undefined,
      targetLat: data.lat, targetLng: data.lng, targetBearing: bearing,
      startTimestamp: now, animDuration,
      speed: data.speed || 0, status,
      eta: data.eta || null, etaMinutes: data.etaMinutes || null,
      timestamp: data.timestamp || new Date(now).toISOString(),
      route: data.route || data.currentRoute || '',
      accuracyRating: data.accuracyRating || 'unknown',
      batteryLevel: data.fuel != null ? `${data.fuel}%` : data.batteryLevel || null,
      lastUpdate: now,
      inDeadZone: !!data.inDeadZone,
      fatigueWarning: !!data.fatigueWarning,
      continuousDrivingMins: data.continuousDrivingMins || 0,
    };

    setTrails(prev => {
      const trail = prev[vehicleId] || [];
      const newTrail = [...trail, { lat: data.lat, lng: data.lng, timestamp: data.timestamp || new Date(now).toISOString(), speed: data.speed }];
      if (newTrail.length > 200) newTrail.shift();
      return { ...prev, [vehicleId]: newTrail };
    });

    if (!isRunning.current) startAnimation();
  }, [startAnimation]);

  useEffect(() => {
    if (!socket) return;
    const handlePosition = (data) => {
      const vehicleId = data.vehicleId || data.id;
      if (vehicleId && data.lat && data.lng) handleGpsUpdate(vehicleId, data);
    };
    socket.on('vehicle:position', handlePosition);
    return () => { socket.off('vehicle:position', handlePosition); };
  }, [socket, handleGpsUpdate]);

  useEffect(() => { return () => { stopAnimation(); }; }, [stopAnimation]);

  return {
    positions, trails,
    getVehiclePosition: (id) => positions[id] || null,
    getVehicleTrail: (id) => trails[id] || [],
    isVehicleStale: (id, thresholdMs = 30000) => {
      const pos = positions[id];
      if (!pos) return true;
      return Date.now() - pos.lastUpdate > thresholdMs;
    },
  };
}
export default useVehicleTracking;
