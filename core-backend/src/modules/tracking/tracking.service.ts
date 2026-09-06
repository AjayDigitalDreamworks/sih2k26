import { Op } from 'sequelize';
import { redisClient } from '../../config/redis';
import { sequelize } from '../../config/db';
import { logger } from '../../utils/logger';
import { Vehicle, Route, Driver, Trip, Delivery } from '../../models/postgres';
import { Alert } from '../../models/mongo';
import { getSocketServer } from '../../sockets/socket.gateway';

// Tracking policy — all tunable via env (root .env). Defaults match the spec:
// LIVE when the GPS fix is fresh, STALE beyond that, OFFLINE beyond STALE.
const GPS_HISTORY_TTL = 86400;  // 24 hours
const LIVE_THRESHOLD_MS = parseInt(process.env.TRACKING_LIVE_SECONDS || '45', 10) * 1000;
const STALE_THRESHOLD_MS = parseInt(process.env.TRACKING_STALE_SECONDS || '300', 10) * 1000; // 5 minutes
const OFFLINE_THRESHOLD_MS = parseInt(process.env.TRACKING_OFFLINE_SECONDS || '600', 10) * 1000; // 10 minutes
const PROLONGED_STOP_MS = 30 * 60 * 1000;       // 30 minutes
const MIN_ACCURACY_METERS = parseInt(process.env.TRACKING_MAX_ACCURACY_METERS || '100', 10); // reject fix worse than 100m
const ROUTE_DEVIATION_THRESHOLD_METERS = 500;    // 500m from route = deviation
const MIN_SPEED_FOR_MOVING = 2;                 // km/h
const MAX_SPEED_KMH = parseInt(process.env.TRACKING_MAX_SPEED_KMH || '180', 10);
const MAX_GPS_AGE_MS = parseInt(process.env.TRACKING_MAX_GPS_AGE_SECONDS || '86400', 10) * 1000; // accept offline-sync fixes up to 24h old
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;        // future timestamps beyond this are rejected
const RATE_MIN_INTERVAL_MS = parseInt(process.env.TRACKING_MIN_INTERVAL_SECONDS || '3', 10) * 1000;
const RATE_SYNC_MAX_PER_MINUTE = parseInt(process.env.TRACKING_SYNC_MAX_PER_MINUTE || '240', 10);

// Known geofence locations for NER logistics (warehouses, delivery points, hubs)
const KNOWN_GEOFENCES = [
  { id: 'depot-guwahati', name: 'Guwahati Central Depot', type: 'warehouse', lat: 26.1445, lng: 91.7362, radiusMeters: 500 },
  { id: 'depot-tezpur', name: 'Tezpur Distribution Hub', type: 'warehouse', lat: 26.6528, lng: 92.7926, radiusMeters: 400 },
  { id: 'depot-silchar', name: 'Silchar Logistics Center', type: 'warehouse', lat: 24.8333, lng: 92.7789, radiusMeters: 400 },
  { id: 'depot-shillong', name: 'Shillong Transit Point', type: 'checkpoint', lat: 25.5788, lng: 91.8933, radiusMeters: 300 },
  { id: 'depot-dimapur', name: 'Dimapur Freight Terminal', type: 'warehouse', lat: 25.906, lng: 93.727, radiusMeters: 400 },
  { id: 'depot-imphal', name: 'Imphal Delivery Hub', type: 'delivery', lat: 24.817, lng: 93.9368, radiusMeters: 350 },
  { id: 'depot-aizawl', name: 'Aizawl Supply Center', type: 'delivery', lat: 23.7271, lng: 92.7176, radiusMeters: 350 },
  { id: 'depot-agartala', name: 'Agartala Warehouse', type: 'warehouse', lat: 23.8315, lng: 91.2868, radiusMeters: 400 },
  { id: 'depot-itanagar', name: 'Itanagar Distribution Point', type: 'delivery', lat: 27.0844, lng: 93.6053, radiusMeters: 350 },
  { id: 'depot-kohima', name: 'Kohima Transit Hub', type: 'checkpoint', lat: 25.6751, lng: 94.1086, radiusMeters: 300 },
];

// Haversine distance in meters
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Point-to-line-segment distance
function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversine(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return haversine(px, py, ax + t * dx, ay + t * dy);
}

// Nearest point on route polyline
function distanceToRoute(lat: number, lng: number, routePoints: number[][]): number {
  if (!routePoints || routePoints.length < 2) return 0;
  let minDist = Infinity;
  for (let i = 0; i < routePoints.length - 1; i++) {
    const dist = pointToSegmentDistance(lat, lng, routePoints[i][0], routePoints[i][1], routePoints[i + 1][0], routePoints[i + 1][1]);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

// Get compass direction from bearing
function bearingToDirection(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(bearing / 45) % 8];
}

// Calculate bearing between two points
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// Interpolate position along a polyline at a given fraction (0-1)
function interpolateOnPolyline(points: number[][], fraction: number): { lat: number; lng: number; segmentIndex: number } {
  if (points.length < 2) return { lat: points[0]?.[0] || 0, lng: points[0]?.[1] || 0, segmentIndex: 0 };

  // Calculate total distance
  let totalDist = 0;
  const segDists: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const d = haversine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    segDists.push(d);
    totalDist += d;
  }

  const targetDist = fraction * totalDist;
  let accumulated = 0;
  for (let i = 0; i < segDists.length; i++) {
    if (accumulated + segDists[i] >= targetDist) {
      const segFraction = segDists[i] > 0 ? (targetDist - accumulated) / segDists[i] : 0;
      return {
        lat: points[i][0] + (points[i + 1][0] - points[i][0]) * segFraction,
        lng: points[i][1] + (points[i + 1][1] - points[i][1]) * segFraction,
        segmentIndex: i,
      };
    }
    accumulated += segDists[i];
  }
  return { lat: points[points.length - 1][0], lng: points[points.length - 1][1], segmentIndex: points.length - 2 };
}

// Get route waypoints from the DB route record
async function getRouteWaypoints(routeName: string): Promise<number[][]> {
  try {
    const route = await Route.findOne({ where: { name: routeName } });
    if (route && (route as any).waypoints) {
      return (route as any).waypoints;
    }
  } catch {}
  return [];
}

// Estimate remaining distance along route from current position
function estimateRemainingDistance(currentLat: number, currentLng: number, waypoints: number[][]): number {
  if (waypoints.length < 2) return 0;

  // Find closest point on route
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < waypoints.length; i++) {
    const d = haversine(currentLat, currentLng, waypoints[i][0], waypoints[i][1]);
    if (d < minDist) {
      minDist = d;
      closestIdx = i;
    }
  }

  // Sum remaining distance from closest point to end
  let remaining = 0;
  for (let i = closestIdx; i < waypoints.length - 1; i++) {
    remaining += haversine(waypoints[i][0], waypoints[i][1], waypoints[i + 1][0], waypoints[i + 1][1]);
  }
  // Add distance to closest point (we're not exactly on it)
  remaining += minDist;
  return remaining;
}

export class TrackingService {
  /**
   * Validate incoming GPS point
   */
  static validateGpsPoint(point: any): { isValid: boolean; errors: string[]; rating: string } {
    const errors: string[] = [];
    if (typeof point.lat !== 'number' || point.lat < -90 || point.lat > 90) errors.push('Invalid latitude');
    if (typeof point.lng !== 'number' || point.lng < -180 || point.lng > 180) errors.push('Invalid longitude');
    if (typeof point.speed !== 'number' || point.speed < 0 || point.speed > MAX_SPEED_KMH) errors.push(`Invalid speed: ${point.speed}`);
    if (typeof point.heading !== 'number' || point.heading < 0 || point.heading > 360) errors.push('Invalid heading');
    if (typeof point.accuracy !== 'number' || point.accuracy < 0) errors.push('Invalid accuracy');
    if (!point.timestamp) errors.push('Missing timestamp');

    // Check timestamp freshness
    if (point.timestamp) {
      const age = Date.now() - new Date(point.timestamp).getTime();
      if (age < 0) errors.push('Future timestamp');
      if (age > STALE_THRESHOLD_MS) errors.push('Stale timestamp');
    }

    const rating = errors.length > 0 ? 'invalid'
      : (point.accuracy || 999) <= 10 ? 'high'
      : (point.accuracy || 999) <= 30 ? 'medium'
      : (point.accuracy || 999) <= MIN_ACCURACY_METERS ? 'low'
      : 'invalid';

    if (rating === 'invalid' && errors.length === 0) errors.push('GPS accuracy too low');

    return { isValid: errors.length === 0 && rating !== 'invalid', errors, rating };
  }

  /**
   * Process incoming GPS ping — validate, store, analyze, broadcast
   */
  static async processGpsPing(data: {
    vehicleId: string; lat: number; lng: number; speed: number;
    heading: number; accuracy: number; timestamp: string; batteryLevel?: number;
  }) {
    const vehicle = await Vehicle.findByPk(data.vehicleId);
    if (!vehicle) return { error: 'Vehicle not found' };

    // 1. Validate
    const validation = this.validateGpsPoint(data);

    // 2. Store in Redis (latest position)
    const livePayload: any = {
      vehicleId: data.vehicleId,
      lat: data.lat,
      lng: data.lng,
      speed: data.speed,
      heading: data.heading,
      accuracy: data.accuracy,
      accuracyRating: validation.rating,
      timestamp: data.timestamp,
      receivedAt: new Date().toISOString(),
      isValid: validation.isValid,
      batteryLevel: data.batteryLevel || null,
      direction: bearingToDirection(data.heading),
    };

    await redisClient.set(`vehicle:live:${data.vehicleId}`, JSON.stringify(livePayload), { ex: 300 });

    // 3. Append to GPS history (Redis list, capped at 500 points)
    const existingHistory = await this.getHistoryFromRedis(data.vehicleId);
    existingHistory.push(livePayload);
    const trimmed = existingHistory.slice(-500);
    await redisClient.set(`vehicle:history:${data.vehicleId}`, JSON.stringify(trimmed), { ex: GPS_HISTORY_TTL });

    // 4. Update vehicle in database
    const updateData: any = { last_ping_at: new Date() };
    if (validation.isValid) {
      updateData.current_lat = data.lat;
      updateData.current_lng = data.lng;
      updateData.speed = data.speed;
    }
    if (data.batteryLevel !== undefined) updateData.fuel_percent = data.batteryLevel;
    await vehicle.update(updateData);

    // 5. Analyze vehicle status
    const status = await this.analyzeVehicleStatus(data.vehicleId, livePayload);

    // 6. Broadcast via Socket.io
    const io = getSocketServer();
    const broadcastPayload = {
      ...livePayload,
      status: status.status,
      eta: status.eta,
      etaMinutes: status.etaMinutes,
      distanceRemaining: status.distanceRemaining,
      direction: bearingToDirection(data.heading),
      currentRoute: vehicle.current_route || '',
    };
    if (io) {
      io.to('admin:all').emit('vehicle:position', broadcastPayload);
      io.to(`transporter:${vehicle.transporter_id}`).emit('vehicle:position', broadcastPayload);

      // Emit route deviation alert if needed
      if (status.routeDeviation?.isDeviated) {
        io.to('admin:all').emit('alert:broadcast', {
          type: 'route_deviation',
          severity: 'high',
          title: `Route Deviation: ${data.vehicleId}`,
          message: `Vehicle ${data.vehicleId} is ${Math.round(status.routeDeviation.deviationMeters)}m off the planned route`,
          vehicleId: data.vehicleId,
          lat: data.lat,
          lng: data.lng,
          timestamp: new Date().toISOString(),
        });
      }

      // Emit geofence events
      if (status.geofenceStatus?.event) {
        io.to('admin:all').emit('geofence:event', status.geofenceStatus.event);
        io.to('admin:all').emit('alert:broadcast', {
          type: 'geofence_event',
          severity: 'low',
          title: status.geofenceStatus.event.title,
          message: status.geofenceStatus.event.message,
          vehicleId: data.vehicleId,
          lat: data.lat,
          lng: data.lng,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { ...livePayload, status };
  }

  /**
   * Analyze full vehicle status
   */
  static async analyzeVehicleStatus(vehicleId: string, latestGps: any) {
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return { status: 'offline' };

    const lastPingAt = vehicle.last_ping_at ? new Date(vehicle.last_ping_at).getTime() : 0;
    const timeSincePing = Date.now() - lastPingAt;

    // Offline detection
    if (timeSincePing > STALE_THRESHOLD_MS * 2) {
      return { status: 'offline', lastValidGps: null, speed: 0, heading: 0 };
    }

    // Stale detection
    if (timeSincePing > STALE_THRESHOLD_MS) {
      return { status: 'stale', lastValidGps: latestGps, speed: vehicle.speed || 0, heading: latestGps.heading || 0 };
    }

    // GPS error — invalid accuracy
    if (latestGps.accuracyRating === 'invalid') {
      return { status: 'gps_error', lastValidGps: latestGps, speed: vehicle.speed || 0, heading: latestGps.heading || 0 };
    }

    // Stop detection
    const history = await this.getHistoryFromRedis(vehicleId);
    const stopInfo = this.detectStops(history);

    // Route deviation
    const deviation = await this.checkRouteDeviation(vehicleId, latestGps.lat, latestGps.lng);

    // Geofence check
    const geofence = await this.checkGeofences(vehicleId, latestGps.lat, latestGps.lng);

    // ETA calculation
    const eta = await this.calculateEta(vehicleId, latestGps.lat, latestGps.lng, latestGps.speed);

    // Determine status
    let status: string;
    if (latestGps.speed < MIN_SPEED_FOR_MOVING && stopInfo.stopDurationMinutes > 30) {
      status = 'prolonged_stop';
    } else if (latestGps.speed < MIN_SPEED_FOR_MOVING) {
      status = 'stopped';
    } else if (eta.delayMinutes && eta.delayMinutes > 30) {
      status = 'delayed';
    } else {
      status = 'moving';
    }

    return {
      status,
      lastValidGps: latestGps,
      speed: latestGps.speed,
      heading: latestGps.heading,
      currentRoute: vehicle.current_route || '',
      destination: '',
      eta: eta.etaString,
      etaMinutes: eta.etaMinutes,
      distanceTravelled: stopInfo.distanceTravelled,
      distanceRemaining: eta.distanceRemaining,
      routeDeviation: deviation,
      geofenceStatus: geofence,
      stopDetection: stopInfo,
    };
  }

  static detectStops(history: any[]) {
    const stops: any[] = [];
    let stopCount = 0;
    let stopDurationMinutes = 0;
    let distanceTravelled = 0;
    if (history.length < 2) return { isStopped: false, stopDurationMinutes: 0, stopCount: 0, stops, distanceTravelled: 0 };
    let inStop = false;
    let stopStart = 0;
    for (let i = 1; i < history.length; i++) {
      const dist = haversine(history[i - 1].lat, history[i - 1].lng, history[i].lat, history[i].lng);
      distanceTravelled += dist;
      if (history[i].speed < MIN_SPEED_FOR_MOVING) {
        if (!inStop) { inStop = true; stopStart = i; stopCount++; }
      } else {
        if (inStop) {
          const duration = (new Date(history[i].timestamp).getTime() - new Date(history[stopStart].timestamp).getTime()) / 60000;
          if (duration >= 2) {
            stops.push({
              lat: history[stopStart].lat,
              lng: history[stopStart].lng,
              arrivalTime: history[stopStart].timestamp,
              departureTime: history[i].timestamp,
              durationMinutes: Math.round(duration),
            });
          }
          inStop = false;
        }
      }
    }
    if (inStop && history.length > stopStart) {
      stopDurationMinutes = (Date.now() - new Date(history[stopStart].timestamp).getTime()) / 60000;
    }
    return {
      isStopped: inStop,
      stopDurationMinutes: Math.round(stopDurationMinutes),
      stopCount,
      stops,
      distanceTravelled: Math.round(distanceTravelled),
    };
  }

  static async checkRouteDeviation(vehicleId: string, lat: number, lng: number) {
    try {
      const vehicle = await Vehicle.findByPk(vehicleId);
      if (!vehicle || !vehicle.current_route) return { isDeviated: false, deviationMeters: 0, direction: '' };

      // Try to get actual route geometry from DB
      const route = await Route.findOne({ where: { name: vehicle.current_route } });
      if (!route) return { isDeviated: false, deviationMeters: 0, direction: '' };

      // Use route waypoints if available, otherwise use origin/dest
      const waypoints = (route as any).waypoints || [];
      if (waypoints.length >= 2) {
        const devMeters = distanceToRoute(lat, lng, waypoints);
        const originLat = (route as any).origin_lat || waypoints[0][0];
        const originLng = (route as any).origin_lng || waypoints[0][1];
        return {
          isDeviated: devMeters > ROUTE_DEVIATION_THRESHOLD_METERS,
          deviationMeters: Math.round(devMeters),
          direction: bearingToDirection(calculateBearing(originLat, originLng, lat, lng)),
          routeName: vehicle.current_route,
        };
      }

      // Fallback: measure distance from origin
      const originLat = (route as any).origin_lat || 26.1445;
      const originLng = (route as any).origin_lng || 91.7362;
      const originDist = haversine(lat, lng, originLat, originLng);
      return {
        isDeviated: originDist > ROUTE_DEVIATION_THRESHOLD_METERS,
        deviationMeters: Math.round(originDist),
        direction: bearingToDirection(calculateBearing(originLat, originLng, lat, lng)),
        routeName: vehicle.current_route,
      };
    } catch {
      return { isDeviated: false, deviationMeters: 0, direction: '' };
    }
  }

  static async checkGeofences(vehicleId: string, lat: number, lng: number) {
    // Get previous geofence state from Redis
    const prevGeoKey = `vehicle:geofence:${vehicleId}`;
    const prevGeoRaw = await redisClient.get(prevGeoKey);
    let prevGeofenceId: string | null = null;
    if (prevGeoRaw) {
      try {
        const prev = typeof prevGeoRaw === 'string' ? JSON.parse(prevGeoRaw) : prevGeoRaw;
        prevGeofenceId = prev.geofenceId || null;
      } catch {}
    }

    // Check all known geofences
    let insideGeofence = false;
    let geofenceName: string | null = null;
    let geofenceType: string | null = null;
    let currentGeofenceId: string | null = null;
    let event: any = null;

    for (const fence of KNOWN_GEOFENCES) {
      const dist = haversine(lat, lng, fence.lat, fence.lng);
      if (dist <= fence.radiusMeters) {
        insideGeofence = true;
        geofenceName = fence.name;
        geofenceType = fence.type;
        currentGeofenceId = fence.id;
        break;
      }
    }

    // Detect transitions
    if (currentGeofenceId && currentGeofenceId !== prevGeofenceId) {
      // Entered a geofence
      event = {
        type: 'geofence_enter',
        title: `Vehicle entered ${geofenceName}`,
        message: `${vehicleId} has entered the ${geofenceType} geofence: ${geofenceName}`,
        geofenceId: currentGeofenceId,
        geofenceName,
        geofenceType,
        vehicleId,
        timestamp: new Date().toISOString(),
      };
    } else if (!currentGeofenceId && prevGeofenceId) {
      // Exited a geofence
      const prevFence = KNOWN_GEOFENCES.find(f => f.id === prevGeofenceId);
      event = {
        type: 'geofence_exit',
        title: `Vehicle left ${prevFence?.name || prevGeofenceId}`,
        message: `${vehicleId} has left the ${prevFence?.type || ''} geofence: ${prevFence?.name || prevGeofenceId}`,
        geofenceId: prevGeofenceId,
        geofenceName: prevFence?.name || prevGeofenceId,
        geofenceType: prevFence?.type || 'unknown',
        vehicleId,
        timestamp: new Date().toISOString(),
      };
    }

    // Save current geofence state
    await redisClient.set(prevGeoKey, JSON.stringify({ geofenceId: currentGeofenceId, geofenceName, geofenceType }), { ex: 300 });

    return { insideGeofence, geofenceName, geofenceType, event };
  }

  /** Detect whether a vehicle is entering or traversing a high-risk corridor */
  static async checkHighRiskCorridor(vehicleId: string, lat: number, lng: number, currentRouteName?: string | null) {
    try {
      // Find all routes that are at_risk, blocked, or have risk score >= 50
      const riskyRoutes = await Route.findAll({
        where: {
          [Op.or]: [
            { status: { [Op.in]: ['at_risk', 'blocked'] } },
            { current_risk_score: { [Op.gte]: 50 } },
          ],
        },
      });

      if (!riskyRoutes || riskyRoutes.length === 0) {
        return { inHighRiskCorridor: false };
      }

      let matchedRoute: Route | null = null;
      let minDistance = Infinity;

      for (const r of riskyRoutes) {
        if (currentRouteName && (r.name === currentRouteName || r.id === currentRouteName)) {
          matchedRoute = r;
          break;
        }

        if (r.geom) {
          try {
            const geoObj = typeof r.geom === 'string' ? JSON.parse(r.geom) : r.geom;
            const coords = geoObj?.coordinates || [];
            if (coords.length >= 2) {
              const dist = distanceToRoute(lat, lng, coords.map((c: any) => [c[1], c[0]]));
              if (dist <= 3500 && dist < minDistance) {
                minDistance = dist;
                matchedRoute = r;
              }
            }
          } catch { /* ignored */ }
        }
      }

      if (!matchedRoute) {
        return { inHighRiskCorridor: false };
      }

      // Generate alert if not alerted recently (30 min cooldown per route per vehicle)
      const alertKey = `vehicle:highrisk_alert:${vehicleId}:${matchedRoute.id}`;
      const alreadyAlerted = await redisClient.get(alertKey);

      if (!alreadyAlerted) {
        const alert = await Alert.create({
          id: `ALT-HR-${Date.now().toString().slice(-6)}`,
          title: `⚠️ High-Risk Corridor Alert: ${vehicleId}`,
          type: 'route_risk',
          severity: matchedRoute.status === 'blocked' ? 'High' : 'High',
          severityClass: 'high',
          districtId: matchedRoute.origin_district_id || null,
          routeId: matchedRoute.id,
          location: matchedRoute.name,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          message: `Vehicle ${vehicleId} is traversing high-risk corridor ${matchedRoute.name} (Risk Score: ${matchedRoute.current_risk_score}/100, Status: ${matchedRoute.status.toUpperCase()}). Monitoring active.`,
          channel: 'tracking',
          status: 'active',
        });

        await redisClient.set(alertKey, '1', { ex: 1800 });

        const io = getSocketServer();
        if (io) {
          const alertPayload = {
            id: alert.id,
            vehicleId,
            routeId: matchedRoute.id,
            routeName: matchedRoute.name,
            riskScore: matchedRoute.current_risk_score,
            status: matchedRoute.status,
            type: 'route_risk',
            severity: 'High',
            title: alert.title,
            message: alert.message,
            timestamp: new Date().toISOString(),
          };
          io.to('admin:all').emit('alert.created', alertPayload);
          io.to('admin:all').emit('alert:broadcast', alertPayload);
        }
        console.log(`[RISK-ALERT] ⚠️ Vehicle ${vehicleId} entered high-risk corridor ${matchedRoute.name}`);
      }

      return {
        inHighRiskCorridor: true,
        routeId: matchedRoute.id,
        routeName: matchedRoute.name,
        riskScore: matchedRoute.current_risk_score,
        routeStatus: matchedRoute.status,
      };
    } catch (err: any) {
      console.warn('[TRACKING] Error in checkHighRiskCorridor:', err?.message);
      return { inHighRiskCorridor: false };
    }
  }

  static async calculateEta(vehicleId: string, lat: number, lng: number, currentSpeed: number) {
    try {
      const vehicle = await Vehicle.findByPk(vehicleId);
      if (!vehicle || !vehicle.current_route) {
        // No route assigned — return unknown ETA
        return { etaString: 'N/A', etaMinutes: null, distanceRemaining: null, delayMinutes: 0 };
      }

      // Get route from DB
      const route = await Route.findOne({ where: { name: vehicle.current_route } });
      if (!route) {
        return { etaString: 'N/A', etaMinutes: null, distanceRemaining: null, delayMinutes: 0 };
      }

      // Get waypoints
      const waypoints = (route as any).waypoints || [];
      let distanceRemaining: number;

      if (waypoints.length >= 2) {
        distanceRemaining = estimateRemainingDistance(lat, lng, waypoints);
      } else {
        // Fallback: straight-line to destination
        const destLat = (route as any).dest_lat || (route as any).dest_district_id ? 26.6528 : 26.6528;
        const destLng = (route as any).dest_lng || 92.7926;
        distanceRemaining = haversine(lat, lng, destLat, destLng);
      }

      // Calculate ETA based on current speed and remaining distance
      const avgSpeed = Math.max(currentSpeed, 15); // minimum 15 km/h for ETA
      const estimatedHours = distanceRemaining / 1000 / avgSpeed;
      const etaMinutes = Math.round(estimatedHours * 60);
      const etaDate = new Date(Date.now() + etaMinutes * 60000);

      // Calculate delay based on route's average travel time
      const plannedHours = (route as any).avg_travel_hours || estimatedHours;
      const delayMinutes = Math.max(0, etaMinutes - Math.round(plannedHours * 60));

      return {
        etaString: etaDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        etaMinutes,
        distanceRemaining: Math.round(distanceRemaining / 1000), // in km
        delayMinutes,
      };
    } catch {
      return { etaString: 'N/A', etaMinutes: null, distanceRemaining: null, delayMinutes: 0 };
    }
  }

  static async getHistoryFromRedis(vehicleId: string): Promise<any[]> {
    try {
      const data = await redisClient.get(`vehicle:history:${vehicleId}`);
      if (!data) return [];
      if (typeof data === 'string') return JSON.parse(data);
      return data; // Upstash may return parsed object directly
    } catch { return []; }
  }

  static async getVehicleTrackingStatus(vehicleId: string) {
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return null;
    const latestGpsRaw = await redisClient.get(`vehicle:live:${vehicleId}`);
    let latestGps = null;
    if (latestGpsRaw) {
      latestGps = typeof latestGpsRaw === 'string' ? JSON.parse(latestGpsRaw) : latestGpsRaw;
    }
    const history = await this.getHistoryFromRedis(vehicleId);
    const status = await this.analyzeVehicleStatus(vehicleId, latestGps || {});
    const stopInfo = this.detectStops(history);
    return {
      vehicleId, model: vehicle.model, status: status.status, lastValidGps: latestGps,
      lastPingAt: vehicle.last_ping_at, speed: vehicle.speed || 0, heading: latestGps?.heading || 0,
      direction: bearingToDirection(latestGps?.heading || 0), currentRoute: vehicle.current_route || '',
      eta: status.eta, etaMinutes: status.etaMinutes, distanceTravelled: stopInfo.distanceTravelled,
      distanceRemaining: status.distanceRemaining || 0, routeDeviation: status.routeDeviation,
      geofenceStatus: status.geofenceStatus || { insideGeofence: false, geofenceName: null, geofenceType: null, event: null },
      stopDetection: stopInfo, gpsAccuracy: latestGps?.accuracyRating || 'unknown',
      batteryLevel: latestGps?.batteryLevel || vehicle.fuel_percent, historyPoints: history.length,
    };
  }

  static async getGpsTrail(vehicleId: string, limit: number = 200) {
    const history = await this.getHistoryFromRedis(vehicleId);
    return history.slice(-limit).map(p => ({
      lat: p.lat, lng: p.lng, speed: p.speed, heading: p.heading,
      timestamp: p.timestamp, accuracyRating: p.accuracyRating,
    }));
  }

  // ════════════════════════════════════════════════════════════════════════
  // REAL GPS TRACKING (web/PWA today, native Android tomorrow — same contract)
  // ════════════════════════════════════════════════════════════════════════

  static roleCanTrackAnyVehicle(role: string): boolean {
    return role === 'admin' || role === 'district_officer';
  }

  /** Resolve the driver record behind a driver login account. */
  static async resolveDriverForUser(userId: string): Promise<Driver | null> {
    return Driver.findOne({ where: { user_id: userId } });
  }

  /**
   * Server-side authorization. Identity is NEVER taken from the payload — it
   * comes from the authenticated JWT. A driver may only report positions for
   * their own assigned vehicle on their own started trip.
   */
  static async authorizeLocation(user: any, vehicleId?: string, tripId?: string): Promise<{ ok: boolean; error?: string; vehicle?: Vehicle; driver?: Driver | null; trip?: Trip | null; status?: number }> {
    const role = user?.role;
    if (!role) return { ok: false, error: 'Unauthorized', status: 401 };

    if (role === 'driver') {
      const driver = await this.resolveDriverForUser(user.id);
      if (!driver) return { ok: false, error: 'No driver profile linked to this account', status: 403 };
      if (driver.status !== 'active') return { ok: false, error: 'Driver account is not active', status: 403 };

      // Find the vehicle actually assigned to this driver (server-side truth).
      let assignedVehicle = vehicleId
        ? await Vehicle.findByPk(vehicleId)
        : driver.vehicle_id ? await Vehicle.findByPk(driver.vehicle_id) : null;
      if (!assignedVehicle && !vehicleId) {
        assignedVehicle = await Vehicle.findOne({ where: { assigned_driver_id: driver.id } });
      }
      if (!assignedVehicle) return { ok: false, error: 'Vehicle not found', status: 404 };
      if (driver.vehicle_id && assignedVehicle.id !== driver.vehicle_id) {
        return { ok: false, error: 'Driver is not assigned to this vehicle', status: 403 };
      }
      if (assignedVehicle.assigned_driver_id && assignedVehicle.assigned_driver_id !== driver.id) {
        return { ok: false, error: 'Vehicle is assigned to a different driver', status: 403 };
      }
      if (!driver.vehicle_id) await driver.update({ vehicle_id: assignedVehicle.id });
      if (!assignedVehicle.assigned_driver_id) await assignedVehicle.update({ assigned_driver_id: driver.id });

      // A driver must have a started trip on that vehicle before reporting GPS.
      const trip = tripId
        ? await Trip.findByPk(tripId)
        : assignedVehicle.current_trip_id ? await Trip.findByPk(assignedVehicle.current_trip_id) : null;
      if (trip && (trip.driver_id !== driver.id || trip.vehicle_id !== assignedVehicle.id)) {
        return { ok: false, error: 'Trip does not belong to this driver/vehicle', status: 403 };
      }
      if (!trip || (trip.status !== 'in_transit' && trip.status !== 'planned')) {
        return { ok: false, error: 'No started trip — start the trip before tracking', status: 403 };
      }
      if (trip.status === 'planned') {
        return { ok: false, error: 'Trip is not started yet', status: 409 };
      }
      return { ok: true, vehicle: assignedVehicle, driver, trip };
    }

    // Admin / district officer / transporter: must name the vehicle explicitly.
    if (!vehicleId) return { ok: false, error: 'vehicleId is required for this role', status: 400 };
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return { ok: false, error: 'Vehicle not found', status: 404 };
    if (role === 'transporter' && vehicle.transporter_id && vehicle.transporter_id !== user.transporterId) {
      return { ok: false, error: 'Vehicle belongs to another transporter', status: 403 };
    }
    let trip: Trip | null = null;
    if (tripId) {
      trip = await Trip.findByPk(tripId);
      if (!trip || trip.vehicle_id !== vehicle.id) return { ok: false, error: 'Trip mismatch for vehicle', status: 403 };
    }
    return { ok: true, vehicle, driver: null, trip };
  }

  /**
   * Normalized GPS observation from any client (WEB_GPS today, ANDROID_GPS
   * later). Validation is strict and log-based — never silently accepted.
   */
  static validateLocationPayload(p: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (typeof p.latitude !== 'number' || !Number.isFinite(p.latitude) || p.latitude < -90 || p.latitude > 90) errors.push('latitude out of range [-90,90]');
    if (typeof p.longitude !== 'number' || !Number.isFinite(p.longitude) || p.longitude < -180 || p.longitude > 180) errors.push('longitude out of range [-180,180]');
    if (typeof p.accuracy !== 'number' || !Number.isFinite(p.accuracy) || p.accuracy < 0) errors.push('accuracy must be >= 0');
    if (p.speed != null && (typeof p.speed !== 'number' || !Number.isFinite(p.speed) || p.speed < 0 || p.speed > MAX_SPEED_KMH)) errors.push(`speed out of range [0,${MAX_SPEED_KMH}]`);
    if (p.heading != null && (typeof p.heading !== 'number' || !Number.isFinite(p.heading) || p.heading < 0 || p.heading > 360)) errors.push('heading out of range [0,360]');
    if (p.altitude != null && (typeof p.altitude !== 'number' || !Number.isFinite(p.altitude))) errors.push('altitude must be numeric');
    const src = (p.source || 'WEB_GPS').toUpperCase();
    if (!['WEB_GPS', 'ANDROID_GPS', 'FLEET_API'].includes(src)) errors.push('unknown source');

    let ts: number | null = null;
    if (!p.gps_timestamp && !p.timestamp) {
      errors.push('gps_timestamp is required');
    } else {
      const raw = p.gps_timestamp || p.timestamp;
      ts = new Date(raw).getTime();
      if (!Number.isFinite(ts)) errors.push('invalid gps_timestamp');
      else {
        const skew = ts - Date.now();
        if (skew > MAX_CLOCK_SKEW_MS) errors.push(`future gps_timestamp (skew ${Math.round(skew / 1000)}s)`);
        if (Date.now() - ts > MAX_GPS_AGE_MS) errors.push('gps_timestamp too old (max 24h for offline sync)');
      }
    }
    return { isValid: errors.length === 0, errors };
  }

  /** Simple Redis-backed rate gate. Sync batches bypass the spacing gate but share a per-minute cap. */
  private static async checkRate(vehicleId: string, syncBatch: boolean): Promise<{ ok: boolean; message?: string }> {
    try {
      if (syncBatch) {
        const key = `tracking:rate:${vehicleId}`;
        const raw = await redisClient.get(key);
        const count = raw ? Number(raw) : 0;
        if (count >= RATE_SYNC_MAX_PER_MINUTE) return { ok: false, message: 'Sync rate limit reached — retry shortly' };
        await redisClient.set(key, String(count + 1), { ex: 60 });
        return { ok: true };
      }
      const lastRaw = await redisClient.get(`tracking:last:${vehicleId}`);
      const last = lastRaw ? Number(lastRaw) : 0;
      const elapsed = Date.now() - last;
      if (elapsed < RATE_MIN_INTERVAL_MS) {
        return { ok: false, message: `Rate limited — next upload in ${Math.ceil((RATE_MIN_INTERVAL_MS - elapsed) / 1000)}s` };
      }
      await redisClient.set(`tracking:last:${vehicleId}`, String(Date.now()), { ex: 3600 });
      return { ok: true };
    } catch {
      return { ok: true }; // fail-open only when the rate store itself is down
    }
  }

  /** Persist one verified GPS observation with its PostGIS point. */
  static async persistLocation(row: {
    vehicleId: string; driverId?: string | null; tripId?: string | null;
    latitude: number; longitude: number; accuracy?: number; speed?: number; heading?: number; altitude?: number;
    gpsTimestamp: Date; source: string;
  }): Promise<string> {
    const [res] = await sequelize.query(
      `INSERT INTO vehicle_locations
         (vehicle_id, driver_id, trip_id, latitude, longitude, accuracy_m, speed_kmh, heading_deg, altitude_m,
          gps_timestamp, received_at, source, geom)
       VALUES (:vehicleId, :driverId, :tripId, :latitude, :longitude, :accuracy, :speed, :heading, :altitude,
          :gpsTimestamp, now(), :source,
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography)
       RETURNING id`,
      {
        replacements: {
          vehicleId: row.vehicleId, driverId: row.driverId || null, tripId: row.tripId || null,
          latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy ?? null,
          speed: row.speed ?? null, heading: row.heading ?? null, altitude: row.altitude ?? null,
          gpsTimestamp: row.gpsTimestamp.toISOString(), source: row.source,
        },
      }
    );
    return (res as any)[0]?.id || '';
  }

  /**
   * MAIN INGEST — authenticated, authorized, validated, persisted, broadcast.
   * Shared by the web driver app now and the native Android app later.
   */
  static async processDriverLocation(user: any, body: any, opts: { syncBatch?: boolean } = {}) {
    const syncBatch = !!opts.syncBatch || (body.source || '').toUpperCase() === 'SYNC';
    const vehicleId = body.vehicle_id || body.vehicleId;
    const tripId = body.trip_id || body.tripId;

    // 1. Authorization (identity from token, never from the body)
    const auth = await this.authorizeLocation(user, vehicleId, tripId);
    if (!auth.ok) return { error: auth.error || 'Forbidden', statusCode: auth.status || 403 };
    const vehicle = auth.vehicle!;
    const driver = auth.driver || null;
    const trip = auth.trip || null;

    // 2. Payload validation
    const validation = this.validateLocationPayload(body);
    if (!validation.isValid) {
      console.warn(`[TRACKING] GPS rejected vehicle=${vehicle.id} user=${user.id}: ${validation.errors.join('; ')}`);
      return { error: `Invalid GPS point: ${validation.errors.join('; ')}`, statusCode: 422, rejected: true };
    }

    // 3. Rate gate
    const rate = await this.checkRate(vehicle.id, syncBatch);
    if (!rate.ok) return { error: rate.message || 'Rate limited', statusCode: 429, rejected: true };

    const gpsTimestamp = new Date(body.gps_timestamp || body.timestamp);
    const source = (body.source || 'WEB_GPS').toUpperCase();
    const speed = body.speed ?? vehicle.speed ?? 0;
    const heading = body.heading ?? vehicle.current_heading ?? 0;
    const accuracy = body.accuracy ?? 0;
    const altitude = body.altitude ?? null;
    const ageMs = Math.max(0, Date.now() - gpsTimestamp.getTime());

    // 4. Persist observation (real history, PostGIS point) — always.
    const locationId = await this.persistLocation({
      vehicleId: vehicle.id, driverId: driver?.id || null, tripId: String((trip?.id || vehicle.current_trip_id) || null),
      latitude: body.latitude, longitude: body.longitude, accuracy, speed, heading, altitude,
      gpsTimestamp, source,
    });

    const livePayload: any = {
      id: vehicle.id,
      vehicleId: vehicle.id,
      model: vehicle.model,
      transporter_id: vehicle.transporter_id,
      lat: body.latitude,
      lng: body.longitude,
      speed,
      fuel: vehicle.fuel_percent ?? null,
      heading,
      accuracy,
      accuracyRating: accuracy <= 10 ? 'high' : accuracy <= 30 ? 'medium' : accuracy <= MIN_ACCURACY_METERS ? 'low' : 'low',
      altitude,
      source,
      driver: driver?.name || null,
      driverId: driver?.id || null,
      tripId: (trip?.id || vehicle.current_trip_id) || null,
      gpsTimestamp: gpsTimestamp.toISOString(),
      timestamp: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      locationId,
    };

    // 5. Live current-state update — only when the fix is recent enough to be honest.
    const isFresh = ageMs <= STALE_THRESHOLD_MS;
    const liveStatus = ageMs <= LIVE_THRESHOLD_MS ? 'LIVE'
      : ageMs <= STALE_THRESHOLD_MS ? 'STALE'
      : 'OFFLINE';
    const movement = speed < MIN_SPEED_FOR_MOVING ? 'stopped' : 'moving';
    const updateData: any = {
      last_ping_at: new Date(),
      gps_source: source,
      live_status: liveStatus,
      last_gps_at: gpsTimestamp,
      current_heading: heading,
      current_accuracy: accuracy,
    };
    if (trip?.id) updateData.current_trip_id = trip.id;
    if (isFresh) {
      updateData.current_lat = body.latitude;
      updateData.current_lng = body.longitude;
      updateData.speed = speed;
      updateData.status = movement;
    }
    await vehicle.update(updateData);

    if (isFresh) {
      await redisClient.set(`vehicle:live:${vehicle.id}`, JSON.stringify(livePayload), { ex: 300 });
      // Redis trail (used by the legacy stop/deviation engine + map trails)
      const existingHistory = await this.getHistoryFromRedis(vehicle.id);
      existingHistory.push({ ...livePayload, timestamp: gpsTimestamp.toISOString() });
      await redisClient.set(`vehicle:history:${vehicle.id}`, JSON.stringify(existingHistory.slice(-500)), { ex: GPS_HISTORY_TTL });
    }

    // 6. High-Risk Corridor Entry Detection
    let corridorCheck: any = null;
    if (isFresh) {
      corridorCheck = await this.checkHighRiskCorridor(vehicle.id, body.latitude, body.longitude, vehicle.current_route);
      if (corridorCheck?.inHighRiskCorridor) {
        livePayload.enteringHighRiskCorridor = true;
        livePayload.corridorRisk = corridorCheck.riskScore;
        livePayload.corridorName = corridorCheck.routeName;
      }
    }

    // 7. Broadcast — server is the single source of truth for live updates.
    const broadcast = {
      ...livePayload,
      status: movement,
      liveStatus,
      ageSeconds: Math.round(ageMs / 1000),
      route: vehicle.current_route || '',
      direction: bearingToDirection(heading),
      enteringHighRiskCorridor: !!livePayload.enteringHighRiskCorridor,
      corridorRisk: livePayload.corridorRisk || null,
      corridorName: livePayload.corridorName || null,
    };
    const io = getSocketServer();
    if (io) {
      const rooms = ['admin:all', `transporter:${vehicle.transporter_id}`];
      rooms.forEach((room: string) => {
        io.to(room).emit('vehicle:position', broadcast);       // legacy dashboards
        io.to(room).emit('vehicle.location.updated', broadcast); // tracking contract event
      });
      io.emit('vehicle.status.updated', {
        vehicleId: vehicle.id, liveStatus, movement, speed, timestamp: new Date().toISOString(),
      });
      console.log(`[TRACKING] ${liveStatus} ${vehicle.id} ${body.latitude},${body.longitude} src=${source} acc=${accuracy}m age=${Math.round(ageMs / 1000)}s`);
    }

    // 8. Geofence detection on the REAL GPS pipeline (server-side state, real
    //    hub circles). Emits geofence:event + alert.created + alert:broadcast.
    let geofenceEvent: any = null;
    if (isFresh) {
      const gf = await this.checkGeofences(vehicle.id, body.latitude, body.longitude);
      geofenceEvent = gf?.event || null;
      if (geofenceEvent && io) {
        io.to('admin:all').emit('geofence:event', geofenceEvent);
        io.to('admin:all').emit('alert.created', {
          ...geofenceEvent, type: 'geofence', severity: 'info', timestamp: new Date().toISOString(),
        });
        io.to('admin:all').emit('alert:broadcast', {
          type: 'geofence_event', severity: 'low', title: geofenceEvent.title, message: geofenceEvent.message,
          vehicleId: vehicle.id, lat: body.latitude, lng: body.longitude, timestamp: new Date().toISOString(),
        });
      }
    }

    return { ok: true, locationId, liveStatus, movement, persisted: true, vehicleId: vehicle.id, geofenceEvent, corridorCheck };
  }

  /** Trip lifecycle: ASSIGNED(planned) → STARTED(in_transit, tracking on) → COMPLETED. */
  static async startTrip(user: any, tripId: string) {
    const trip = await Trip.findByPk(tripId);
    if (!trip) return { error: 'Trip not found', statusCode: 404 };
    const vehicle = await Vehicle.findByPk(trip.vehicle_id);
    if (!vehicle) return { error: 'Vehicle not found', statusCode: 404 };

    if (user.role === 'driver') {
      const driver = await this.resolveDriverForUser(user.id);
      if (!driver || trip.driver_id !== driver.id) return { error: 'Trip not assigned to this driver', statusCode: 403 };
      if (trip.vehicle_id !== (driver.vehicle_id || vehicle.id)) return { error: 'Vehicle mismatch', statusCode: 403 };
      if (!driver.vehicle_id) await driver.update({ vehicle_id: vehicle.id });
      if (!vehicle.assigned_driver_id) await vehicle.update({ assigned_driver_id: driver.id });
    } else if (user.role === 'transporter' && vehicle.transporter_id !== user.transporterId) {
      return { error: 'Vehicle belongs to another transporter', statusCode: 403 };
    }

    if (trip.status === 'completed' || trip.status === 'canceled') return { error: 'Trip already closed', statusCode: 409 };
    if (trip.status === 'in_transit') return { ok: true, alreadyStarted: true, trip };

    await trip.update({ status: 'in_transit', started_at: new Date() });
    await vehicle.update({
      status: 'moving',
      live_status: 'LIVE',
      tracking_active: true,
      current_trip_id: trip.id,
      current_route: trip.origin && trip.destination ? `${trip.origin} → ${trip.destination}` : trip.route_id,
    });
    // Synchronize any linked deliveries
    try {
      await Delivery.update({ status: 'in_transit' }, { where: { trip_id: trip.id } });
    } catch {}
    // Fresh per-trip trail: drop stale Redis trail/live from any previous run/simulation.
    await redisClient.del(`vehicle:history:${vehicle.id}`);
    await redisClient.del(`vehicle:live:${vehicle.id}`);
    const io = getSocketServer();
    if (io) io.emit('vehicle.status.updated', { vehicleId: vehicle.id, event: 'trip_started', tripId: trip.id, timestamp: new Date().toISOString() });
    console.log(`[TRACKING] Trip ${trip.id} STARTED by ${user.role}:${user.id} on ${vehicle.id}`);
    return { ok: true, trip };
  }

  static async stopTrip(user: any, tripId: string) {
    const trip = await Trip.findByPk(tripId);
    if (!trip) return { error: 'Trip not found', statusCode: 404 };
    const vehicle = await Vehicle.findByPk(trip.vehicle_id);

    if (user.role === 'driver') {
      const driver = await this.resolveDriverForUser(user.id);
      if (!driver || trip.driver_id !== driver.id) return { error: 'Trip not assigned to this driver', statusCode: 403 };
    } else if (user.role === 'transporter' && vehicle && vehicle.transporter_id !== user.transporterId) {
      return { error: 'Vehicle belongs to another transporter', statusCode: 403 };
    }

    if (trip.status === 'completed' || trip.status === 'canceled') return { error: 'Trip already closed', statusCode: 409 };
    await trip.update({ status: 'completed', actual_arrival_at: new Date(), progress_percent: 100 });
    // Synchronize any linked deliveries
    try {
      await Delivery.update({ status: 'delivered', delivered_at: new Date() }, { where: { trip_id: trip.id } });
    } catch {}
    if (vehicle) {
      await vehicle.update({
        tracking_active: false, current_trip_id: null,
        live_status: 'OFFLINE', status: 'idle', speed: 0,
      });
      await redisClient.del(`vehicle:live:${vehicle.id}`);
    }
    const io = getSocketServer();
    if (io) io.emit('vehicle.status.updated', { vehicleId: trip.vehicle_id, event: 'trip_completed', tripId: trip.id, timestamp: new Date().toISOString() });
    console.log(`[TRACKING] Trip ${trip.id} COMPLETED by ${user.role}:${user.id}`);
    return { ok: true, trip };
  }

  /**
   * DRIVER SOS / EMERGENCY — raises a critical EMERGENCY alert to admins.
   * Identity from the JWT; the vehicle comes from the driver's real assignment
   * (never from the body). Position uses the live fix when provided, otherwise
   * the vehicle's last verified GPS — never fabricated.
   */
  static async sendSos(user: any, body: any) {
    const role = user?.role;
    if (role !== 'driver' && role !== 'admin' && role !== 'district_officer' && role !== 'transporter') {
      return { error: 'Role cannot raise SOS', statusCode: 403 };
    }

    let vehicle: Vehicle | null = null;
    let actorName = user?.name || role;
    if (role === 'driver') {
      const driver = await this.resolveDriverForUser(user.id);
      if (!driver) return { error: 'No driver profile linked to this account', statusCode: 403 };
      if (driver.status !== 'active') return { error: 'Driver account is not active', statusCode: 403 };
      vehicle = driver.vehicle_id ? await Vehicle.findByPk(driver.vehicle_id) : null;
      if (!vehicle) {
        vehicle = await Vehicle.findOne({ where: { assigned_driver_id: driver.id } });
        if (vehicle) await driver.update({ vehicle_id: vehicle.id });
      }
      if (!vehicle) return { error: 'No vehicle assigned to this driver — cannot raise SOS', statusCode: 403 };
      actorName = driver.name;
    } else {
      const vehicleId = body.vehicle_id || body.vehicleId;
      if (!vehicleId) return { error: 'vehicleId is required for this role', statusCode: 400 };
      vehicle = await Vehicle.findByPk(String(vehicleId));
      if (!vehicle) return { error: 'Vehicle not found', statusCode: 404 };
      if (role === 'transporter' && vehicle.transporter_id && vehicle.transporter_id !== user.transporterId) {
        return { error: 'Vehicle belongs to another transporter', statusCode: 403 };
      }
    }

    // Position: body override only when plausible; else last verified vehicle GPS.
    let lat = body.latitude ?? body.lat;
    let lng = body.longitude ?? body.lng;
    const plausible = (v: any) => typeof v === 'number' && Number.isFinite(v);
    if (!plausible(lat) || !plausible(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      lat = vehicle.current_lat;
      lng = vehicle.current_lng;
    }
    const hasPos = plausible(lat) && plausible(lng);

    let locationLabel = 'Live coordinates';
    if (hasPos) {
      let best = Infinity;
      for (const f of KNOWN_GEOFENCES) {
        const d = haversine(Number(lat), Number(lng), f.lat, f.lng);
        if (d < best) { best = d; locationLabel = `${f.name} (~${Math.round(d / 1000)} km)`; }
      }
    }
    const reason = String(body.reason || '').trim();
    const alert = await Alert.create({
      id: `sos-${Date.now()}`,
      title: `🚨 EMERGENCY SOS — ${vehicle.id}`,
      type: 'emergency_sos',
      severity: 'High',
      severityClass: 'critical',
      districtId: (vehicle as any).district_id || null,
      routeId: vehicle.current_route || null,
      location: hasPos ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)} · ${locationLabel}` : 'Position unknown — no GPS fix',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      message: reason || `${actorName} requested emergency assistance from ${vehicle.id}.`,
      channel: 'sos',
    });

    await vehicle.update({ live_status: 'EMERGENCY' });
    const sosKey = `vehicle:sos:${vehicle.id}`;
    await redisClient.set(sosKey, JSON.stringify({
      active: true, alertId: alert.id, at: new Date().toISOString(),
      lat: hasPos ? Number(lat) : null, lng: hasPos ? Number(lng) : null,
      driverName: actorName, reason: reason || null,
    }), { ex: 21600 });

    const payload = {
      vehicleId: vehicle.id, driver: actorName, lat: hasPos ? Number(lat) : null,
      lng: hasPos ? Number(lng) : null, reason: reason || null,
      timestamp: new Date().toISOString(), alertId: alert.id,
    };
    const io = getSocketServer();
    if (io) {
      io.emit('emergency.sos', payload);
      io.emit('alert.created', { ...payload, type: 'emergency_sos', severity: 'critical', title: alert.title });
      io.emit('alert:broadcast', {
        type: 'emergency_sos', severityClass: 'critical', severity: 'High',
        title: alert.title, message: alert.message,
        vehicleId: vehicle.id, lat: payload.lat, lng: payload.lng,
        timestamp: new Date().toISOString(),
      });
    }
    console.log(`[SOS] 🚨 EMERGENCY from ${actorName} (${vehicle.id}) at ${hasPos ? `${lat},${lng}` : 'no fix'}`);
    return { ok: true, alert, vehicleId: vehicle.id, sosActive: true, timestamp: payload.timestamp };
  }

  /** Cancel an active SOS (driver taps the button again). */
  static async cancelSos(user: any) {
    const role = user?.role;
    let vehicleId: string | null = null;
    if (role === 'driver') {
      const driver = await this.resolveDriverForUser(user.id);
      if (!driver?.vehicle_id) return { error: 'No vehicle assigned', statusCode: 403 };
      vehicleId = driver.vehicle_id;
    } else {
      const v = await Vehicle.findOne({ where: { live_status: 'EMERGENCY' }, order: [['updatedAt', 'DESC']] });
      vehicleId = v?.id || null;
    }
    if (!vehicleId) return { ok: true, sosActive: false };

    const sosKey = `vehicle:sos:${vehicleId}`;
    const raw = await redisClient.get(sosKey);
    let alertId: string | null = null;
    if (raw) {
      try { alertId = (typeof raw === 'string' ? JSON.parse(raw) : raw).alertId || null; } catch { /* noop */ }
    }
    await redisClient.del(sosKey);
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (vehicle && vehicle.live_status === 'EMERGENCY') await vehicle.update({ live_status: 'OFFLINE' });
    if (alertId) {
      try { await Alert.findOneAndUpdate({ id: alertId }, { status: 'resolved' }); } catch { /* noop */ }
    }
    const io = getSocketServer();
    if (io) io.emit('emergency.sos.cancelled', { vehicleId, alertId, timestamp: new Date().toISOString() });
    console.log(`[SOS] ✅ EMERGENCY cleared for ${vehicleId}`);
    return { ok: true, sosActive: false, vehicleId };
  }

  /** Current SOS state for this driver's vehicle (server-side truth). */
  static async getSosActive(user: any) {
    const role = user?.role;
    let vehicleId: string | null = null;
    if (role === 'driver') {
      const driver = await this.resolveDriverForUser(user.id);
      vehicleId = driver?.vehicle_id || null;
    } else {
      const v = await Vehicle.findOne({ where: { live_status: 'EMERGENCY' }, order: [['updatedAt', 'DESC']] });
      vehicleId = v?.id || null;
    }
    if (!vehicleId) return { active: false };
    const raw = await redisClient.get(`vehicle:sos:${vehicleId}`);
    if (!raw) return { active: false };
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { active: !!data.active, vehicleId, ...data };
  }

  /** All vehicles with an ACTIVE SOS — admin/transporter dashboards render these as red markers. */
  static async getAllActiveSos(user: any) {
    const role = user?.role;
    if (role !== 'admin' && role !== 'transporter') return { error: 'Admin or transporter role required', statusCode: 403 };
    try {
      const keys = await redisClient.keys('vehicle:sos:*');
      const entries: any[] = [];
      if (keys && keys.length) {
        const rawList = await Promise.all(keys.map((k: string) => redisClient.get(k)));
        keys.forEach((k: string, i: number) => {
          const raw = rawList[i];
          if (!raw) return;
          let d: any = null;
          try { d = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { /* skip malformed */ }
          if (!d || !d.active) return;
          const vehicleId = k.replace('vehicle:sos:', '');
          entries.push({
            vehicleId,
            lat: typeof d.lat === 'number' ? d.lat : null,
            lng: typeof d.lng === 'number' ? d.lng : null,
            driver: d.driverName || null,
            reason: d.reason || null,
            since: d.at || null,
            alertId: d.alertId || null,
          });
        });
      }
      // Enrich with current vehicle info (model / route) — real DB rows, no mock.
      if (entries.length) {
        const ids = entries.map((e) => e.vehicleId);
        const vehicles = await Vehicle.findAll({ where: { id: { [Op.in]: ids } } });
        const byId: Record<string, any> = {};
        for (const v of vehicles) byId[v.id] = v;
        for (const e of entries) {
          const v = byId[e.vehicleId];
          if (v) {
            e.model = v.model || null;
            e.route = v.current_route || null;
            if (e.lat == null && v.current_lat != null && v.current_lng != null) {
              e.lat = v.current_lat; e.lng = v.current_lng;
            }
          }
        }
      }
      return { active: entries.length > 0, vehicles: entries };
    } catch (err) {
      logger.error('[SOS] getAllActiveSos failed', err as Error);
      return { active: false, vehicles: [] };
    }
  }

  /** Driver home-context: login → assigned vehicle + current/next trip. */
  static async getDriverContext(user: any) {
    const driver = await this.resolveDriverForUser(user.id);
    if (!driver) return { error: 'No driver profile linked to this account', statusCode: 403 };
    let vehicle = driver.vehicle_id ? await Vehicle.findByPk(driver.vehicle_id) : null;
    if (!vehicle) {
      vehicle = await Vehicle.findOne({ where: { assigned_driver_id: driver.id } });
      if (vehicle) await driver.update({ vehicle_id: vehicle.id });
    }
    const activeTrip = vehicle?.current_trip_id
      ? await Trip.findByPk(vehicle.current_trip_id)
      : await Trip.findOne({ where: { driver_id: driver.id, status: { [Op.in]: ['planned', 'in_transit'] } }, order: [['createdAt', 'DESC']] });
    return { driver, vehicle, trip: activeTrip || null };
  }

  /** Persisted history (PostGIS table) with time/trip filters + pagination. */
  static async getPersistedHistory(vehicleId: string, opts: { startTime?: string; endTime?: string; tripId?: string; limit?: number; offset?: number } = {}) {
    const limit = Math.min(parseInt(String(opts.limit || '500'), 10) || 500, 5000);
    const offset = parseInt(String(opts.offset || '0'), 10) || 0;
    const where: string[] = ['vehicle_id = :vehicleId'];
    const replacements: any = { vehicleId };
    if (opts.tripId) { where.push('trip_id = :tripId'); replacements.tripId = opts.tripId; }
    if (opts.startTime) { where.push('gps_timestamp >= :startTime'); replacements.startTime = new Date(opts.startTime).toISOString(); }
    if (opts.endTime) { where.push('gps_timestamp <= :endTime'); replacements.endTime = new Date(opts.endTime).toISOString(); }
    const [rows] = await sequelize.query(
      `SELECT id, vehicle_id, driver_id, trip_id, latitude, longitude, accuracy_m, speed_kmh, heading_deg,
              altitude_m, gps_timestamp, received_at, source,
              ST_Y(geom::geometry) AS geom_lat, ST_X(geom::geometry) AS geom_lng
         FROM vehicle_locations
        WHERE ${where.join(' AND ')}
        ORDER BY gps_timestamp DESC
        LIMIT :limit OFFSET :offset`,
      { replacements: { ...replacements, limit, offset } }
    );
    const [countRows] = await sequelize.query(
      `SELECT COUNT(*)::int AS total FROM vehicle_locations WHERE ${where.join(' AND ')}`,
      { replacements }
    );
    return {
      count: rows.length, total: (countRows as any)[0]?.total || 0, limit, offset,
      points: (rows as any[]).map(r => ({
        id: r.id, vehicleId: r.vehicle_id, driverId: r.driver_id, tripId: r.trip_id,
        latitude: r.latitude, longitude: r.longitude, accuracy: r.accuracy_m, speed: r.speed_kmh,
        heading: r.heading_deg, altitude: r.altitude_m, gpsTimestamp: r.gps_timestamp, receivedAt: r.received_at,
        source: r.source, geomLat: r.geom_lat ?? null, geomLng: r.geom_lng ?? null,
      })),
    };
  }

  /**
   * Trip end summary — computed from REAL persisted GPS observations.
   * start/end time, distance, stops, top speed, avg speed. Never fabricated.
   */
  static async getTripSummary(vehicleId: string, tripId?: string) {
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (!vehicle) return null;
    const trip = tripId
      ? await Trip.findByPk(tripId)
      : await Trip.findOne({ where: { vehicle_id: vehicleId }, order: [['createdAt', 'DESC']] });
    if (!trip) return { vehicleId, hasData: false, reason: 'NO_TRIP' };

    const [rows] = await sequelize.query(
      `SELECT latitude, longitude, speed_kmh, gps_timestamp, source
         FROM vehicle_locations
        WHERE vehicle_id = :vehicleId AND trip_id = :tripId
        ORDER BY gps_timestamp ASC
        LIMIT 10000`,
      { replacements: { vehicleId, tripId: trip.id } }
    );
    const points = (rows as any[]).map((r) => ({
      lat: Number(r.latitude), lng: Number(r.longitude),
      speed: Number(r.speed_kmh) || 0,
      gpsTimestamp: new Date(r.gps_timestamp),
      source: r.source,
    }));
    if (points.length < 1) return { vehicleId, tripId: trip.id, hasData: false, reason: 'NO_GPS' };

    const startedAt = points[0].gpsTimestamp;
    const endedAt = points[points.length - 1].gpsTimestamp;
    const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));

    let totalDistanceM = 0;
    let topSpeed = 0;
    let speedSum = 0;
    let speedCount = 0;
    const stops: any[] = [];
    let inStop = false;
    let stopStartIdx = 0;
    for (let i = 0; i < points.length; i++) {
      if (i > 0) totalDistanceM += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
      topSpeed = Math.max(topSpeed, points[i].speed);
      if (points[i].speed > 0) { speedSum += points[i].speed; speedCount++; }
      const stopped = points[i].speed < MIN_SPEED_FOR_MOVING;
      if (stopped && !inStop) { inStop = true; stopStartIdx = i; }
      else if (!stopped && inStop) {
        const mins = (points[i].gpsTimestamp.getTime() - points[stopStartIdx].gpsTimestamp.getTime()) / 60000;
        if (mins >= 2) stops.push({
          lat: points[stopStartIdx].lat, lng: points[stopStartIdx].lng,
          arrivalTime: points[stopStartIdx].gpsTimestamp.toISOString(),
          departureTime: points[i].gpsTimestamp.toISOString(),
          durationMinutes: Math.round(mins),
        });
        inStop = false;
      }
    }
    if (inStop) {
      const mins = (endedAt.getTime() - points[stopStartIdx].gpsTimestamp.getTime()) / 60000;
      if (mins >= 2) stops.push({
        lat: points[stopStartIdx].lat, lng: points[stopStartIdx].lng,
        arrivalTime: points[stopStartIdx].gpsTimestamp.toISOString(),
        departureTime: endedAt.toISOString(),
        durationMinutes: Math.round(mins),
      });
    }

    return {
      vehicleId, tripId: trip.id,
      route: trip.route_id || null,
      origin: trip.origin || null,
      destination: trip.destination || null,
      status: trip.status,
      hasData: true,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes,
      distanceKm: Math.round(totalDistanceM / 1000),
      topSpeedKmh: Math.round(topSpeed),
      avgSpeedKmh: speedCount ? Math.round(speedSum / speedCount) : 0,
      stopCount: stops.length,
      stops,
      pointCount: points.length,
      sources: Array.from(new Set(points.map((p) => p.source))),
    };
  }

  /** Dashboard status aggregation — real numbers only. */
  static async getTrackingStatusOverview() {
    const now = Date.now();
    const vehicles = await Vehicle.findAll();
    const rows = await Promise.all(vehicles.map(async (v) => {
      const liveRaw = await redisClient.get(`vehicle:live:${v.id}`);
      let live: any = null;
      if (liveRaw) live = typeof liveRaw === 'string' ? JSON.parse(liveRaw) : liveRaw;
      const lastGpsMs = live?.gpsTimestamp ? new Date(live.gpsTimestamp).getTime()
        : v.last_gps_at ? new Date(v.last_gps_at).getTime()
        : v.last_ping_at ? new Date(v.last_ping_at).getTime() : 0;
      const ageMs = lastGpsMs ? Math.max(0, now - lastGpsMs) : Infinity;
      // A vehicle whose trip ended / tracking was switched off is never LIVE —
      // its last coordinates are history, not a live position.
      const trackingOn = !!v.tracking_active || !!v.current_trip_id || !!live;
      const liveStatus = !trackingOn ? 'OFFLINE'
        : ageMs <= LIVE_THRESHOLD_MS ? 'LIVE'
        : ageMs <= STALE_THRESHOLD_MS ? 'STALE'
        : 'OFFLINE';
      return {
        vehicleId: v.id, model: v.model, liveStatus, ageSeconds: Number.isFinite(ageMs) ? Math.round(ageMs / 1000) : null,
        trackingActive: v.tracking_active, currentTripId: v.current_trip_id, speed: v.speed || 0, source: v.gps_source || null,
      };
    }));
    return {
      totalVehicles: vehicles.length,
      live: rows.filter(r => r.liveStatus === 'LIVE').length,
      stale: rows.filter(r => r.liveStatus === 'STALE').length,
      offline: rows.filter(r => r.liveStatus === 'OFFLINE').length,
      activeTrips: vehicles.filter(v => v.tracking_active).length,
      moving: vehicles.filter(v => v.tracking_active && (v.speed || 0) > MIN_SPEED_FOR_MOVING).length,
      stopped: vehicles.filter(v => v.tracking_active && (v.speed || 0) <= MIN_SPEED_FOR_MOVING).length,
      vehicles: rows,
      thresholds: { liveSeconds: LIVE_THRESHOLD_MS / 1000, staleSeconds: STALE_THRESHOLD_MS / 1000, offlineSeconds: OFFLINE_THRESHOLD_MS / 1000 },
    };
  }
}
