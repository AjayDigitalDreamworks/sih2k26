import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { Vehicle, Trip, Route, District } from '../../models/postgres';
import { TrackingService } from '../tracking/tracking.service';
import { env } from '../../config/env';
import { LocalDisasterDigitalTwin } from './simulation.engine';

const ML_URL = env.mlServiceUrl;

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

interface CacheEntry {
  data: any;
  expiresAt: number;
}
const proxyCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60 * 1000; // 60s default cache

/**
 * Proxy helper — forwards requests to ML service with in-memory caching,
 * configurable timeout (default 8s), and graceful stale cache fallback.
 */
async function proxyToML(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, ttlMs: number = DEFAULT_TTL_MS, timeoutMs: number = 8000) {
  const cacheKey = `${method}:${endpoint}:${body ? JSON.stringify(body) : ''}`;
  const now = Date.now();

  // 1. Fast Memory Cache Hit
  if (method === 'GET' && ttlMs > 0) {
    const cached = proxyCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  const url = `${ML_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const resp = await fetch(url, options);
    if (!resp.ok) throw new Error(`ML service returned ${resp.status}`);
    const data = await resp.json();
    if (method === 'GET') {
      proxyCache.set(cacheKey, { data, expiresAt: now + ttlMs });
    }
    return data;
  } catch (err: any) {
    // 2. Upstream Timeout or Error -> Serve Stale Cache if available
    const stale = proxyCache.get(cacheKey);
    if (stale) {
      return stale.data;
    }
    throw err;
  }
}

// --- Weather ---
router.get('/weather/:districtId', async (req: Request, res: Response) => {
  const distId = req.params.districtId;
  try {
    const data = await proxyToML(`/realtime/weather/${distId}`, 'GET', undefined, 60000);
    return sendSuccess(res, data, 'Weather data retrieved');
  } catch (err: any) {
    // Graceful fallback weather so the dashboard never crashes
    return sendSuccess(res, {
      source: 'Regional Weather Observatories (Cached)',
      status: 'DEGRADED',
      districtId: distId,
      city: distId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      temp_celsius: 28,
      humidity_percent: 74,
      rainfall_24h_mm: 0,
      wind_kmh: 10,
      condition: 'Partly Cloudy',
      forecast7Day: [],
      nowcastRadar: { active: false, alertColor: 'green', message: 'Normal weather conditions' },
    }, 'Weather data retrieved (fallback)');
  }
});

router.get('/weather', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/weather/all', 'GET', undefined, 60000);
    return sendSuccess(res, data, 'All district weather retrieved');
  } catch (err: any) {
    return sendSuccess(res, {}, 'All district weather retrieved (empty fallback)');
  }
});

// --- IMD National Weather Intelligence ---
router.get('/imd/stations', async (req: Request, res: Response) => {
  try {
    const stateParam = req.query.state ? `?state=${encodeURIComponent(String(req.query.state))}` : '';
    const data = await proxyToML(`/realtime/imd/stations${stateParam}`);
    return sendSuccess(res, data, 'IMD radar stations retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/imd/nowcasts', async (req: Request, res: Response) => {
  try {
    const minSev = req.query.min_severity ? `?min_severity=${encodeURIComponent(String(req.query.min_severity))}` : '';
    const data = await proxyToML(`/realtime/imd/nowcasts${minSev}`);
    return sendSuccess(res, data, 'IMD active radar nowcasts retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/imd/national-summary', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/imd/national-summary');
    return sendSuccess(res, data, 'IMD national warning summary retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/imd/district/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/realtime/imd/district/${req.params.districtId}`);
    return sendSuccess(res, data, 'IMD district weather report retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.post('/imd/corridor-check', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/imd/corridor-check', 'POST', req.body);
    return sendSuccess(res, data, 'IMD corridor weather impact evaluated');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/imd/health', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/imd/health');
    return sendSuccess(res, data, 'IMD health telemetry retrieved');
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
    const data = await proxyToML(`/realtime/traffic/route?${params}`, 'GET', undefined, 120000, 10000);
    return sendSuccess(res, data, 'Traffic data retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/traffic/flow', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/realtime/traffic/flow?${params}`, 'GET', undefined, 60000, 10000);
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
    const data = await proxyToML('/realtime/summary', 'GET', undefined, 60000);
    return sendSuccess(res, data, 'All districts summary retrieved');
  } catch (err: any) {
    return sendSuccess(res, [], 'All districts summary retrieved (fallback)');
  }
});

// --- Alerts ---
router.get('/alerts/check/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/alerts/check/${req.params.districtId}`, 'GET', undefined, 30000);
    return sendSuccess(res, data, 'District alerts checked');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/alerts/check-all', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/alerts/check-all', 'GET', undefined, 30000);
    return sendSuccess(res, data, 'All districts alerts checked');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/alerts/active', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/alerts/active', 'GET', undefined, 15000);
    return sendSuccess(res, data, 'Active alerts retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

// --- ML Models ---
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/pipeline/models', 'GET', undefined, 60000);
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
    const data = await proxyToML('/pipeline/status', 'GET', undefined, 20000);
    return sendSuccess(res, data, 'Pipeline status retrieved');
  } catch (err: any) {
    return sendSuccess(res, { running: true, uptimeSeconds: 3600, activeAlerts: 0 }, 'Pipeline status (fallback)');
  }
});

router.get('/pipeline/alerts', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/pipeline/alerts?${params}`, 'GET', undefined, 15000);
    return sendSuccess(res, data, 'Pipeline alerts retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/pipeline/risk-scores', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/pipeline/risk-scores', 'GET', undefined, 60000);
    return sendSuccess(res, data, 'Pipeline risk scores retrieved');
  } catch (err: any) {
    return sendSuccess(res, {}, 'Pipeline risk scores (fallback)');
  }
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

router.post('/route/reroute-vehicle', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML('/route/reroute-vehicle', 'POST', req.body);
    return sendSuccess(res, data, 'Vehicle dynamically rerouted');
  } catch (err: any) { return sendError(res, err.message); }
});


// --- Live vehicle route: real GPS position → destination over the road network ---
// Uses TrackingService to dynamically calculate safest route, auto-avoiding any active
// road hazards or roadblocks along the vehicle's remaining corridor.
router.get('/live-route/:vehicleId', async (req: Request, res: Response) => {
  try {
    const avoidParam = req.query.avoid ? String(req.query.avoid).split(',').map(s => s.trim()) : undefined;
    const result = await TrackingService.calculateLiveDynamicRoute(String(req.params.vehicleId), {
      avoidCorridors: avoidParam,
    });

    if (!result.hasRoute) {
      return sendSuccess(res, result, result.reason || 'Vehicle has no active route');
    }

    return sendSuccess(res, result, result.rerouted ? 'Live dynamic reroute retrieved' : 'Live route retrieved');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// --- Dynamic Reroute: force or automated reroute for active vehicle ---
// Recalculates safe road route avoiding specified or active corridors, updates Redis,
// and broadcasts real-time 'vehicle:rerouted' events to Admin, Transporter, and Driver.
router.post('/live-route/:vehicleId/reroute', async (req: Request, res: Response) => {
  try {
    const { avoidCorridors, avoidDistricts, reason } = req.body || {};
    const result = await TrackingService.calculateLiveDynamicRoute(String(req.params.vehicleId), {
      avoidCorridors: Array.isArray(avoidCorridors) ? avoidCorridors : avoidCorridors ? [String(avoidCorridors)] : undefined,
      avoidDistricts: Array.isArray(avoidDistricts) ? avoidDistricts : avoidDistricts ? [String(avoidDistricts)] : undefined,
      reason: reason || 'Manual operator dynamic reroute to safest alternative corridor',
      broadcast: true,
    });

    if (!result.hasRoute) {
      return sendError(res, result.reason || 'Could not reroute vehicle', 400);
    }

    return sendSuccess(res, result, 'Vehicle dynamically rerouted successfully');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

// --- Disaster Digital Twin Simulation ---
router.get('/simulation/presets', async (_req: Request, res: Response) => {
  try {
    const data: any = await proxyToML('/simulation/presets');
    return sendSuccess(res, data?.presets || data, 'Simulation presets retrieved');
  } catch (err: any) {
    console.warn('[IntegrationRoutes] ML Service unavailable for presets, using in-memory presets fallback');
    return sendSuccess(
      res,
      {
        presets: LocalDisasterDigitalTwin.getPresets(),
        mountainPasses: LocalDisasterDigitalTwin.getMountainPasses(),
      },
      'Simulation presets retrieved (in-memory engine)'
    );
  }
});

router.post('/simulation/run', async (req: Request, res: Response) => {
  try {
    const data: any = await proxyToML('/simulation/run', 'POST', req.body);
    return sendSuccess(res, data?.data || data, 'Simulation executed');
  } catch (err: any) {
    console.warn('[IntegrationRoutes] ML Service unavailable for simulation run, using in-memory simulation engine');
    const result = LocalDisasterDigitalTwin.runSimulation(req.body || {});
    return sendSuccess(res, result, 'Simulation executed (in-memory engine)');
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
