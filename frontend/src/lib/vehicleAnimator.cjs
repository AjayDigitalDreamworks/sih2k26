/**
 * Vehicle Animator — Google Maps-style smooth marker interpolation
 * 
 * Uses requestAnimationFrame to smoothly interpolate between
 * successive GPS coordinates instead of teleporting the marker.
 * 
 * Also manages heading rotation, speed display, and status transitions.
 */

const Haversine = {
  distance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
  bearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  },
  direction(bearing) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(bearing / 45) % 8];
  }
};

class VehicleAnimator {
  constructor() {
    this.vehicles = new Map(); // vehicleId -> animation state
    this.animationFrameId = null;
    this.isRunning = false;
    this.onUpdate = null; // callback: (vehicleId, interpolatedState) => void
  }

  /**
   * Register a callback for position updates
   */
  setUpdateCallback(callback) {
    this.onUpdate = callback;
  }

  /**
   * Update a vehicle's target position from new GPS data
   * Called when WebSocket receives a new position
   */
  updateTarget(vehicleId, gpsData) {
    const now = Date.now();
    const existing = this.vehicles.get(vehicleId);

    // Calculate bearing to new point if we have a previous position
    let bearing = gpsData.heading || 0;
    if (existing && existing.current) {
      bearing = Haversine.bearing(
        existing.current.lat, existing.current.lng,
        gpsData.lat, gpsData.lng
      );
    }

    // Status determination
    let status = gpsData.status || 'moving';
    if (gpsData.accuracyRating === 'invalid') status = 'gps_error';
    else if (!gpsData.isValid) status = 'stale';

    if (existing) {
      // Smooth update: keep existing as start, new as target
      existing.start = { ...existing.current };
      existing.target = { lat: gpsData.lat, lng: gpsData.lng };
      existing.startTimestamp = existing.currentTimestamp || now;
      existing.targetTimestamp = now;
      existing.currentTimestamp = now;
      existing.bearing = bearing;
      existing.speed = gpsData.speed || 0;
      existing.status = status;
      existing.metadata = {
        direction: Haversine.direction(bearing),
        eta: gpsData.eta || null,
        etaMinutes: gpsData.etaMinutes || null,
        timestamp: gpsData.timestamp || new Date(now).toISOString(),
        route: gpsData.route || '',
        accuracyRating: gpsData.accuracyRating || 'unknown',
        batteryLevel: gpsData.batteryLevel || null,
        vehicleId: vehicleId,
      };
      // Calculate animation duration based on distance and speed
      const dist = Haversine.distance(existing.start.lat, existing.start.lng, gpsData.lat, gpsData.lng);
      const speed = Math.max(gpsData.speed || 20, 5); // m/s
      existing.animDuration = Math.max(800, Math.min(3000, (dist / speed) * 1000));
    } else {
      // First position — no animation needed
      this.vehicles.set(vehicleId, {
        current: { lat: gpsData.lat, lng: gpsData.lng },
        target: { lat: gpsData.lat, lng: gpsData.lng },
        start: { lat: gpsData.lat, lng: gpsData.lng },
        startTimestamp: now,
        targetTimestamp: now,
        currentTimestamp: now,
        bearing,
        speed: gpsData.speed || 0,
        status,
        animDuration: 1000,
        metadata: {
          direction: Haversine.direction(bearing),
          eta: gpsData.eta || null,
          etaMinutes: gpsData.etaMinutes || null,
          timestamp: gpsData.timestamp || new Date(now).toISOString(),
          route: gpsData.route || '',
          accuracyRating: gpsData.accuracyRating || 'unknown',
          batteryLevel: gpsData.batteryLevel || null,
          vehicleId: vehicleId,
        },
      });
    }

    if (!this.isRunning) this.start();
  }

  /**
   * Start the animation loop
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  /**
   * Stop the animation loop
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main animation loop — runs at ~60fps
   * Linearly interpolates each vehicle between start and target
   */
  animate() {
    if (!this.isRunning) return;
    const now = Date.now();

    this.vehicles.forEach((state, vehicleId) => {
      const elapsed = now - state.startTimestamp;
      const duration = state.animDuration || 1000;
      // Ease-in-out for smooth motion
      let t = Math.min(elapsed / duration, 1);
      t = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

      // Interpolate position
      const lat = state.start.lat + (state.target.lat - state.start.lat) * t;
      const lng = state.start.lng + (state.target.lng - state.start.lng) * t;

      // Smooth heading rotation
      const currentBearing = state.bearing || 0;

      state.current = { lat, lng };

      // Emit update
      if (this.onUpdate) {
        this.onUpdate(vehicleId, {
          lat,
          lng,
          bearing: currentBearing,
          speed: state.speed,
          status: state.status,
          animating: t < 1,
          ...state.metadata,
        });
      }
    });

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Get current interpolated position for a vehicle
   */
  getPosition(vehicleId) {
    const state = this.vehicles.get(vehicleId);
    if (!state) return null;
    return { lat: state.current.lat, lng: state.current.lng, bearing: state.bearing };
  }

  /**
   * Get all vehicle positions
   */
  getAllPositions() {
    const positions = {};
    this.vehicles.forEach((state, id) => {
      positions[id] = {
        lat: state.current.lat,
        lng: state.current.lng,
        bearing: state.bearing,
        speed: state.speed,
        status: state.status,
        ...state.metadata,
      };
    });
    return positions;
  }

  /**
   * Check if a vehicle is stale (no update in threshold)
   */
  isStale(vehicleId, thresholdMs = 30000) {
    const state = this.vehicles.get(vehicleId);
    if (!state) return true;
    return Date.now() - state.currentTimestamp > thresholdMs;
  }

  /**
   * Remove a vehicle from tracking
   */
  removeVehicle(vehicleId) {
    this.vehicles.delete(vehicleId);
  }

  /**
   * Clear all vehicles
   */
  clear() {
    this.vehicles.clear();
  }
}

// Export for use in React components
if (typeof window !== 'undefined') {
  window.VehicleAnimator = VehicleAnimator;
  window.Haversine = Haversine;
}

// Also export as CJS for Node require
module.exports = { VehicleAnimator, Haversine };
