import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { Vehicle, Trip, Route, District } from '../../models/postgres';

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// "2h 5m" / "45m" / "3h" / "90 min" -> minutes
function parseDurationText(text?: string | null): number | null {
  if (!text) return null;
  const s = String(text);
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  const total = (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
  return total > 0 ? total : null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const router = Router();
router.use(authenticateJwt);

/**
 * Proxy helper — forwards requests to ML service and returns the response.
 */
async function proxyToML(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) {
  const url = `${ML_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  const resp = await fetch(url, options);
  if (!resp.ok) throw new Error(`ML service returned ${resp.status}`);
  return resp.json();
}

// --- Weather ---
router.get('/weather/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/realtime/weather/${req.params.districtId}`);
    return sendSuccess(res, data, 'Weather data retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/weather', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/weather/all');
    return sendSuccess(res, data, 'All district weather retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Flood ---
router.get('/flood/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/realtime/flood/${req.params.districtId}`);
    return sendSuccess(res, data, 'Flood data retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/flood', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/flood/all');
    return sendSuccess(res, data, 'All district flood data retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Landslide ---
router.get('/landslide/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/realtime/landslide/${req.params.districtId}`);
    return sendSuccess(res, data, 'Landslide data retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Traffic ---
router.get('/traffic/route', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/realtime/traffic/route?${params}`);
    return sendSuccess(res, data, 'Traffic data retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/traffic/flow', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/realtime/traffic/flow?${params}`);
    return sendSuccess(res, data, 'Traffic flow data retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Routing ---
router.get('/route', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/realtime/route?${params}`);
    return sendSuccess(res, data, 'Route retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Full Context ---
router.get('/context/district/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/realtime/context/district/${req.params.districtId}`);
    return sendSuccess(res, data, 'Full district context retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/context/route', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/realtime/context/route?${params}`);
    return sendSuccess(res, data, 'Full route context retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/summary');
    return sendSuccess(res, data, 'All districts summary retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Alerts ---
router.get('/alerts/check/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/alerts/check/${req.params.districtId}`);
    return sendSuccess(res, data, 'District alerts checked');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/alerts/check-all', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/alerts/check-all');
    return sendSuccess(res, data, 'All districts alerts checked');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/alerts/active', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/alerts/active');
    return sendSuccess(res, data, 'Active alerts retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- ML Models ---
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/pipeline/models');
    return sendSuccess(res, data, 'ML model status retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Incident Detection ---
router.post('/incident-detect', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML('/risk/incident-detect', 'POST', req.body);
    return sendSuccess(res, data, 'Incident detection result');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Real-Time Pipeline ---
router.get('/pipeline/status', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/pipeline/status');
    return sendSuccess(res, data, 'Pipeline status retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/pipeline/alerts', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/pipeline/alerts?${params}`);
    return sendSuccess(res, data, 'Pipeline alerts retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/pipeline/risk-scores', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/pipeline/risk-scores');
    return sendSuccess(res, data, 'Pipeline risk scores retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/pipeline/disruptions', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/pipeline/disruptions');
    return sendSuccess(res, data, 'Pipeline disruptions retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/pipeline/map-data', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/pipeline/map-data');
    return sendSuccess(res, data, 'Pipeline map data retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- All Disruptions (bulk) ---
router.get('/disruptions/all', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/risk/disruption-predict/all');
    return sendSuccess(res, data, 'All district disruptions retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Live Route Optimization ---
router.get('/route/optimize', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/route/optimize/live?${params}`);
    return sendSuccess(res, data, 'Live route optimization retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Route Planner (real road geometry, safest/shortest, live conditions) ---
router.post('/route/plan', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML('/route/plan', 'POST', req.body);
    return sendSuccess(res, data, 'Route plan retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- Live vehicle route: real GPS position → destination over the road network ---
// Resolves the vehicle's ACTIVE trip → its DB route → destination district, then
// asks the ML planner for a safest/shortest road route starting at the vehicle's
// actual live GPS fix. No fabricated geometry — the polyline follows real roads.
router.get('/live-route/:vehicleId', async (req: Request, res: Response) => {
  try {
    const vehicle = await Vehicle.findByPk(String(req.params.vehicleId));
    if (!vehicle) return sendError(res, 'Vehicle not found', 404);

    const hasGps =
      vehicle.current_lat != null && vehicle.current_lng != null &&
      Number.isFinite(vehicle.current_lat) && Number.isFinite(vehicle.current_lng) &&
      !(vehicle.current_lat === 0 && vehicle.current_lng === 0);

    const trip = await Trip.findOne({
      where: {
        vehicle_id: vehicle.id,
        status: { [Op.in]: ['planned', 'in_transit', 'delayed'] },
      },
      order: [['createdAt', 'DESC']],
      raw: true,
    });
    if (!trip) {
      return sendSuccess(res, {
        vehicleId: vehicle.id,
        hasRoute: false,
        reason: 'NO_ACTIVE_TRIP',
        vehicle: {
          liveStatus: vehicle.live_status || null,
          lastGpsAt: vehicle.last_gps_at || null,
          trackingActive: !!vehicle.tracking_active,
          lat: vehicle.current_lat ?? null,
          lng: vehicle.current_lng ?? null,
        },
      }, 'Vehicle has no active trip');
    }

    const route = await Route.findByPk(String(trip.route_id || ''), { raw: true });
    if (!route) {
      return sendSuccess(res, {
        vehicleId: vehicle.id,
        hasRoute: false,
        reason: 'TRIP_ROUTE_MISSING',
        trip: { id: trip.id, status: trip.status, origin: trip.origin, destination: trip.destination },
      }, 'Active trip has no route row');
    }

    const destDistrictId = route.dest_district_id;
    let originDistrictId = route.origin_district_id;

    // Start the route from the vehicle's REAL GPS position when one exists:
    // snap the corridor graph start to the nearest real district hub, and let
    // the ML planner draw the first leg from the exact GPS coordinate.
    if (hasGps) {
      const districts = await District.findAll({ attributes: ['id', 'lat', 'lng'], raw: true });
      let bestId = originDistrictId;
      let bestKm = Infinity;
      for (const d of districts as any[]) {
        const km = haversineKm(vehicle.current_lat, vehicle.current_lng, Number(d.lat), Number(d.lng));
        if (km < bestKm) { bestKm = km; bestId = d.id; }
      }
      originDistrictId = bestId;
    }

    const planBody: any = {
      originDistrictId,
      destDistrictId,
      prefer: 'safest',
    };
    if (hasGps) {
      planBody.currentLat = vehicle.current_lat;
      planBody.currentLng = vehicle.current_lng;
    }

    const resp = await fetch(`${ML_URL}/route/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planBody),
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) throw new Error(`Route plan failed (ML ${resp.status})`);
    const plan: any = await resp.json();
    if (!plan.success) {
      return sendSuccess(res, {
        vehicleId: vehicle.id, hasRoute: false, reason: 'PLAN_FAILED', planError: plan.error,
      }, 'Could not plan live route');
    }

    const rec = plan.recommended || {};
    const alt = plan.safest && plan.shortest && plan.safest !== plan.shortest
      ? { safest: plan.safest, shortest: plan.shortest }
      : undefined;

    // Live ETA: real road duration of the remaining legs + live traffic delay.
    // Never invented — only when the ML planner returned road durations.
    let etaMinutes = 0;
    let trafficDelayMinutes = 0;
    for (const leg of (rec.legs || [])) {
      const dur = parseDurationText(leg.osrmDurationText);
      if (dur != null) etaMinutes += dur;
      const delay = (leg.traffic && typeof leg.traffic.delaySeconds === 'number' && leg.traffic.delaySeconds > 0)
        ? leg.traffic.delaySeconds / 60 : 0;
      if (delay > 0) { etaMinutes += delay; trafficDelayMinutes += delay; }
    }
    const etaAt = etaMinutes > 0 ? new Date(Date.now() + etaMinutes * 60000).toISOString() : null;

    return sendSuccess(res, {
      vehicleId: vehicle.id,
      hasRoute: true,
      routeName: route.name,
      vehicle: {
        liveStatus: vehicle.live_status || null,
        lastGpsAt: vehicle.last_gps_at || null,
        trackingActive: !!vehicle.tracking_active,
        lat: vehicle.current_lat ?? null,
        lng: vehicle.current_lng ?? null,
        speed: vehicle.speed || 0,
        heading: vehicle.current_heading || 0,
      },
      trip: { id: trip.id, status: trip.status, origin: trip.origin, destination: trip.destination, progress: trip.progress_percent || 0 },
      origin: plan.origin,
      destination: plan.destination,
      preferred: plan.preferred,
      geometry: rec.geometry || [],
      legs: rec.legs || [],
      totalDistanceKm: rec.totalDistanceKm ?? null,
      riskScore: rec.riskScore ?? null,
      riskLevel: rec.riskLevel ?? null,
      alerts: plan.alerts || [],
      routingProvider: plan.routingProvider || 'corridor',
      gpsStart: !!(plan.origin && plan.origin.gpsStart),
      alternatives: alt,
      etaMinutes: etaMinutes > 0 ? Math.round(etaMinutes) : null,
      etaAt,
      etaLabel: etaAt ? new Date(etaAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null,
      trafficDelayMinutes: Math.round(trafficDelayMinutes),
    }, 'Live route retrieved');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// --- Health ---
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/health');
    return sendSuccess(res, data, 'ML service health');
  } catch (err: any) { return sendError(res, 'ML service unreachable', 503); }
});

export default router;
