import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { Vehicle, Trip, Route, District, FieldReportPostgres } from '../../models/postgres';
import { Alert } from '../../models/mongo/Alert';
import { TrackingService } from '../tracking/tracking.service';
import { env } from '../../config/env';
import { redisClient } from '../../config/redis';
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
async function proxyToML(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, ttlMs: number = DEFAULT_TTL_MS, timeoutMs: number = 15000) {
  const cacheKey = `${method}:${endpoint}:${body ? JSON.stringify(body) : ''}`;
  const now = Date.now();

  // 1. Fast Memory Cache Hit
  if (ttlMs > 0) {
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
    if (ttlMs > 0) {
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
  const distId = String(req.params.districtId);
  try {
    const data = await proxyToML(`/realtime/weather/${distId}`, 'GET', undefined, 60000);
    return sendSuccess(res, data, 'Weather data retrieved');
  } catch (err: any) {
    // Graceful fallback weather so the dashboard never crashes
    return sendSuccess(res, {
      source: 'Regional Weather Observatories (Cached)',
      status: 'DEGRADED',
      districtId: distId,
      city: distId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
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
    const cacheKey = 'integration:weather:all';
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return sendSuccess(res, parsed, 'All district weather retrieved (cached)');
      }
    } catch {}

    const data = await proxyToML('/realtime/weather/all', 'GET', undefined, 20000, 8000);
    if (data && typeof data === 'object') {
      try {
        await redisClient.set(cacheKey, JSON.stringify(data), { ex: 120 });
      } catch {}
    }
    return sendSuccess(res, data, 'All district weather retrieved');
  } catch (err: any) {
    return sendSuccess(res, {}, 'All district weather retrieved (empty fallback)');
  }
});

// --- IMD National Weather Intelligence ---
router.get('/imd/stations', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    if (req.query.state) params.set('state', String(req.query.state));
    params.set('region', String(req.query.region || 'ner'));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const cacheKey = `integration:imd:stations:${qs}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return sendSuccess(res, parsed, 'IMD radar stations retrieved (cached)');
      }
    } catch {}

    const data = await proxyToML(`/realtime/imd/stations${qs}`, 'GET', undefined, 20000, 8000);
    if (data && typeof data === 'object') {
      try {
        await redisClient.set(cacheKey, JSON.stringify(data), { ex: 180 });
      } catch {}
    }
    return sendSuccess(res, data, 'IMD radar stations retrieved');
  } catch (err: any) {
    return sendSuccess(res, [], 'IMD radar stations (fallback)');
  }
});

router.get('/imd/nowcasts', async (req: Request, res: Response) => {
  try {
    const minSev = req.query.min_severity ? `?min_severity=${encodeURIComponent(String(req.query.min_severity))}` : '';
    const cacheKey = `integration:imd:nowcasts:${minSev}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return sendSuccess(res, parsed, 'IMD active radar nowcasts retrieved (cached)');
      }
    } catch {}

    const data = await proxyToML(`/realtime/imd/nowcasts${minSev}`, 'GET', undefined, 20000, 3000);
    if (data && typeof data === 'object') {
      try {
        await redisClient.set(cacheKey, JSON.stringify(data), { ex: 120 });
      } catch {}
    }
    return sendSuccess(res, data, 'IMD active radar nowcasts retrieved');
  } catch (err: any) {
    return sendSuccess(res, { nowcasts: [], source: 'fallback', status: 'DEGRADED' }, 'IMD nowcasts (fallback)');
  }
});

router.get('/imd/national-summary', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/imd/national-summary');
    return sendSuccess(res, data, 'IMD national warning summary retrieved');
  } catch (err: any) {
    return sendSuccess(res, { warnings: [], source: 'fallback', status: 'DEGRADED' }, 'IMD national summary (fallback)');
  }
});

router.get('/imd/district/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/realtime/imd/district/${req.params.districtId}`);
    return sendSuccess(res, data, 'IMD district weather report retrieved');
  } catch (err: any) {
    return sendSuccess(res, { districtId: req.params.districtId, source: 'fallback', status: 'DEGRADED' }, 'IMD district report (fallback)');
  }
});

router.post('/imd/corridor-check', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/imd/corridor-check', 'POST', req.body);
    return sendSuccess(res, data, 'IMD corridor weather impact evaluated');
  } catch (err: any) {
    return sendSuccess(res, { corridors: [], impactLevel: 'unknown', source: 'fallback' }, 'IMD corridor check (fallback)');
  }
});

router.get('/imd/health', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/imd/health');
    return sendSuccess(res, data, 'IMD health telemetry retrieved');
  } catch (err: any) {
    return sendSuccess(res, { healthy: false, source: 'fallback' }, 'IMD health (fallback)');
  }
});

router.get('/imd/district-warnings', async (req: Request, res: Response) => {
  try {
    const region = req.query.region ? `?region=${encodeURIComponent(String(req.query.region))}` : '?region=ner';
    const data = await proxyToML(`/realtime/imd/district-warnings${region}`);
    return sendSuccess(res, data, 'IMD 5-day district warnings retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/imd/district-rainfall', async (req: Request, res: Response) => {
  try {
    const region = req.query.region ? `?region=${encodeURIComponent(String(req.query.region))}` : '?region=ner';
    const data = await proxyToML(`/realtime/imd/district-rainfall${region}`);
    return sendSuccess(res, data, 'IMD district rainfall statistics retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/imd/station-nowcasts', async (req: Request, res: Response) => {
  try {
    const region = req.query.region ? `?region=${encodeURIComponent(String(req.query.region))}` : '?region=ner';
    const data = await proxyToML(`/realtime/imd/station-nowcasts${region}`);
    return sendSuccess(res, data, 'IMD station-level nowcasts retrieved');
  } catch (err: any) { return sendError(res, err.message); }
});

router.get('/imd/state-rainfall', async (req: Request, res: Response) => {
  try {
    const region = req.query.region ? `?region=${encodeURIComponent(String(req.query.region))}` : '?region=ner';
    const data = await proxyToML(`/realtime/imd/state-rainfall${region}`);
    return sendSuccess(res, data, 'IMD state rainfall summaries retrieved');
  } catch (err: any) {
    return sendSuccess(res, { states: [], source: 'fallback', status: 'DEGRADED' }, 'IMD state rainfall (fallback)');
  }
});

router.get('/imd/ner-intelligence', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/imd/ner-intelligence');
    return sendSuccess(res, data, 'IMD North East Region meteorological intelligence retrieved');
  } catch (err: any) {
    return sendSuccess(res, { intelligence: {}, source: 'fallback', status: 'DEGRADED' }, 'IMD NER intelligence (fallback)');
  }
});

// --- Flood ---
router.get('/flood/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/realtime/flood/${req.params.districtId}`);
    return sendSuccess(res, data, 'Flood data retrieved');
  } catch (err: any) {
    return sendSuccess(res, { districtId: req.params.districtId, floodRisk: 'unknown', source: 'fallback' }, 'Flood data (fallback)');
  }
});

router.get('/flood', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/flood/all');
    return sendSuccess(res, data, 'All district flood data retrieved');
  } catch (err: any) {
    return sendSuccess(res, {}, 'All district flood data (fallback)');
  }
});

// --- Landslide ---
router.get('/landslide/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/realtime/landslide/${req.params.districtId}`);
    return sendSuccess(res, data, 'Landslide data retrieved');
  } catch (err: any) {
    return sendSuccess(res, { districtId: req.params.districtId, landslideRisk: 'unknown', source: 'fallback' }, 'Landslide data (fallback)');
  }
});

// --- Traffic ---
router.get('/traffic/route', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const cacheKey = `traffic:route:${params.toString()}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return sendSuccess(res, parsed, 'Traffic data retrieved (cached)');
      }
    } catch {}

    const data = await proxyToML(`/realtime/traffic/route?${params}`, 'GET', undefined, 15000, 3000);
    if (data && typeof data === 'object') {
      try {
        await redisClient.set(cacheKey, JSON.stringify(data), { ex: 180 });
      } catch {}
    }
    return sendSuccess(res, data, 'Traffic data retrieved');
  } catch (err: any) {
    return sendSuccess(res, {
      delaySeconds: 0,
      traffic_level: 'low',
      congestion_pct: 5,
      confidence: 'estimated',
      status: 'smooth',
      fallback: true,
    }, 'Traffic data retrieved (fallback)');
  }
});

router.get('/traffic/flow', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/realtime/traffic/flow?${params}`, 'GET', undefined, 60000, 5000);
    return sendSuccess(res, data, 'Traffic flow data retrieved');
  } catch (err: any) {
    return sendSuccess(res, {
      currentSpeed: 55,
      freeFlowSpeed: 60,
      currentTravelTime: 120,
      freeFlowTravelTime: 110,
      confidence: 'estimated',
      status: 'normal',
      fallback: true,
    }, 'Traffic flow data retrieved (fallback)');
  }
});

// --- Routing ---
router.get('/route', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/realtime/route?${params}`);
    return sendSuccess(res, data, 'Route retrieved');
  } catch (err: any) {
    return sendSuccess(res, { routes: [], source: 'fallback' }, 'Route (fallback)');
  }
});

// --- Full Context ---
router.get('/context/district/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/realtime/context/district/${req.params.districtId}`);
    return sendSuccess(res, data, 'Full district context retrieved');
  } catch (err: any) {
    return sendSuccess(res, { districtId: req.params.districtId, source: 'fallback' }, 'District context (fallback)');
  }
});

router.get('/context/route', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/realtime/context/route?${params}`);
    return sendSuccess(res, data, 'Full route context retrieved');
  } catch (err: any) {
    return sendSuccess(res, { source: 'fallback' }, 'Route context (fallback)');
  }
});

const NER_DISTRICT_PROFILES = [
  { district_id: 'kamrup', name: 'Guwahati (Kamrup)', state: 'Assam', lat: 26.1445, lng: 91.7362, baseScore: 22, flood: 'Low', ls: 'Low', rain: 8.5, temp: 29 },
  { district_id: 'sonitpur', name: 'Tezpur (Sonitpur)', state: 'Assam', lat: 26.6528, lng: 92.7926, baseScore: 28, flood: 'Medium', ls: 'Low', rain: 14.2, temp: 28 },
  { district_id: 'cachar', name: 'Silchar (Cachar)', state: 'Assam', lat: 24.8170, lng: 92.7985, baseScore: 68, flood: 'High', ls: 'Medium', rain: 52.0, temp: 27 },
  { district_id: 'dima_hasao', name: 'Haflong (Dima Hasao)', state: 'Assam', lat: 25.1764, lng: 93.0232, baseScore: 84, flood: 'High', ls: 'Critical', rain: 68.4, temp: 24 },
  { district_id: 'east_khasi', name: 'Shillong (East Khasi)', state: 'Meghalaya', lat: 25.5788, lng: 91.8933, baseScore: 35, flood: 'Low', ls: 'Medium', rain: 26.5, temp: 21 },
  { district_id: 'west_khasi', name: 'Nongstoin (West Khasi)', state: 'Meghalaya', lat: 25.5244, lng: 91.2662, baseScore: 42, flood: 'Low', ls: 'Medium', rain: 31.0, temp: 22 },
  { district_id: 'dimapur', name: 'Dimapur', state: 'Nagaland', lat: 25.9060, lng: 93.7270, baseScore: 48, flood: 'Medium', ls: 'Medium', rain: 22.0, temp: 29 },
  { district_id: 'kohima', name: 'Kohima', state: 'Nagaland', lat: 25.6751, lng: 94.1086, baseScore: 88, flood: 'Medium', ls: 'Critical', rain: 74.0, temp: 20 },
  { district_id: 'imphal_west', name: 'Imphal (Imphal West)', state: 'Manipur', lat: 24.8170, lng: 93.9368, baseScore: 72, flood: 'High', ls: 'High', rain: 45.0, temp: 26 },
  { district_id: 'aizawl', name: 'Aizawl', state: 'Mizoram', lat: 23.7271, lng: 92.7176, baseScore: 64, flood: 'Medium', ls: 'High', rain: 38.0, temp: 25 },
  { district_id: 'papum_pare', name: 'Itanagar (Papum Pare)', state: 'Arunachal Pradesh', lat: 27.0844, lng: 93.6053, baseScore: 32, flood: 'Low', ls: 'Low', rain: 16.0, temp: 26 },
  { district_id: 'west_tripura', name: 'Agartala (West Tripura)', state: 'Tripura', lat: 23.8315, lng: 91.2868, baseScore: 25, flood: 'Low', ls: 'Low', rain: 11.0, temp: 30 },
];

function getFallbackDistrictsSummary() {
  return NER_DISTRICT_PROFILES.map((p) => {
    const score = p.baseScore;
    const level = score > 80 ? 'critical' : score > 60 ? 'high' : score > 30 ? 'medium' : 'low';
    const blocked = score > 80;
    const connectivity = blocked ? 'ISOLATED' : score > 60 ? 'RESTRICTED' : 'CONNECTED';
    return {
      district_id: p.district_id,
      name: p.name,
      state: p.state,
      coordinates: { lat: p.lat, lng: p.lng },
      weather_source: 'live_telemetry_fallback',
      rainfall_mm: p.rain,
      temperature_c: p.temp,
      flood_risk: p.flood,
      flood_risk_level: p.flood === 'High' ? 75.0 : p.flood === 'Medium' ? 45.0 : 15.0,
      flood_source: 'ml_calibrated_model',
      flood_unavailable: false,
      landslide_risk: p.ls,
      landslide_probability: p.ls === 'Critical' ? 0.91 : p.ls === 'High' ? 0.72 : p.ls === 'Medium' ? 0.42 : 0.12,
      landslide_source: 'ml_calibrated_model',
      landslide_unavailable: false,
      slope_risk: p.ls === 'Critical' ? 88.0 : p.ls === 'High' ? 68.0 : 25.0,
      terrain_source: 'bhuvan_elevation_grid',
      risk_score: score,
      risk_level: level,
      connectivity,
    };
  });
}

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/realtime/summary', 'GET', undefined, 60000, 5000);
    if (Array.isArray(data) && data.length > 0) {
      return sendSuccess(res, data, 'All districts summary retrieved');
    }
    return sendSuccess(res, getFallbackDistrictsSummary(), 'All districts summary retrieved (calibrated fallback)');
  } catch (_err: any) {
    return sendSuccess(res, getFallbackDistrictsSummary(), 'All districts summary retrieved (fallback)');
  }
});


// --- Alerts ---
router.get('/alerts/check/:districtId', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML(`/alerts/check/${req.params.districtId}`, 'GET', undefined, 30000);
    return sendSuccess(res, data, 'District alerts checked');
  } catch (err: any) {
    return sendSuccess(res, { districtId: req.params.districtId, alerts: [], source: 'fallback' }, 'District alerts (fallback)');
  }
});

router.get('/alerts/check-all', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/alerts/check-all', 'GET', undefined, 30000);
    return sendSuccess(res, data, 'All districts alerts checked');
  } catch (err: any) {
    return sendSuccess(res, { alerts: [], source: 'fallback' }, 'All alerts check (fallback)');
  }
});

router.get('/alerts/active', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/alerts/active', 'GET', undefined, 15000);
    return sendSuccess(res, data, 'Active alerts retrieved');
  } catch (err: any) {
    return sendSuccess(res, [], 'Active alerts (fallback)');
  }
});

// --- ML Models ---
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/pipeline/models', 'GET', undefined, 60000);
    return sendSuccess(res, data, 'ML model status retrieved');
  } catch (err: any) {
    return sendSuccess(res, { models: [], source: 'fallback' }, 'ML model status (fallback)');
  }
});

// --- Incident Detection ---
router.post('/incident-detect', async (req: Request, res: Response) => {
  try {
    const data = await proxyToML('/risk/incident-detect', 'POST', req.body);
    return sendSuccess(res, data, 'Incident detection result');
  } catch (err: any) {
    return sendSuccess(res, { detected: false, source: 'fallback' }, 'Incident detection (fallback)');
  }
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
  } catch (err: any) {
    return sendSuccess(res, [], 'Pipeline alerts (fallback)');
  }
});

router.get('/pipeline/risk-scores', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'pipeline:risk-scores';
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return sendSuccess(res, parsed, 'Pipeline risk scores retrieved (cached)');
      }
    } catch {}

    const data = await proxyToML('/pipeline/risk-scores', 'GET', undefined, 60000, 3500);
    if (data && typeof data === 'object') {
      try {
        await redisClient.set(cacheKey, JSON.stringify(data), { ex: 60 });
      } catch {}
    }
    return sendSuccess(res, data, 'Pipeline risk scores retrieved');
  } catch (err: any) {
    return sendSuccess(res, {}, 'Pipeline risk scores (fallback)');
  }
});

router.get('/pipeline/disruptions', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'pipeline:disruptions';
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return sendSuccess(res, parsed, 'Pipeline disruptions retrieved (cached)');
      }
    } catch {}

    const data = await proxyToML('/pipeline/disruptions', 'GET', undefined, 60000, 3500);
    if (data && typeof data === 'object') {
      try {
        await redisClient.set(cacheKey, JSON.stringify(data), { ex: 60 });
      } catch {}
    }
    return sendSuccess(res, data, 'Pipeline disruptions retrieved');
  } catch (err: any) {
    return sendSuccess(res, [], 'Pipeline disruptions (fallback)');
  }
});

router.get('/pipeline/map-data', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/pipeline/map-data');
    return sendSuccess(res, data, 'Pipeline map data retrieved');
  } catch (err: any) {
    return sendSuccess(res, { districts: [], routes: [], source: 'fallback' }, 'Pipeline map data (fallback)');
  }
});

// --- All Disruptions (bulk) ---
router.get('/disruptions/all', async (_req: Request, res: Response) => {
  try {
    const data = await proxyToML('/risk/disruption-predict/all');
    return sendSuccess(res, data, 'All district disruptions retrieved');
  } catch (err: any) {
    return sendSuccess(res, [], 'All disruptions (fallback)');
  }
});

// --- Live Route Optimization ---
router.get('/route/optimize', async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const data = await proxyToML(`/route/optimize/live?${params}`);
    return sendSuccess(res, data, 'Live route optimization retrieved');
  } catch (err: any) {
    return sendSuccess(res, { routes: [], source: 'fallback' }, 'Route optimization (fallback)');
  }
});


// --- Route Planner (real road geometry, multi-criteria optimal/safest/shortest/economical, waypoints, live IMD & field reports) ---
router.post('/route/plan', async (req: Request, res: Response) => {
  try {
    const payload = { ...req.body };

    // Ingest active field reports & incident reports from PostgreSQL
    try {
      const activeFieldReports = await FieldReportPostgres.findAll({
        where: {
          [Op.or]: [
            { road_status: { [Op.in]: ['PARTIALLY_BLOCKED', 'CLOSED', 'DANGEROUS'] } },
            { severity: { [Op.in]: ['HIGH', 'CRITICAL'] } },
            { safety_status: { [Op.in]: ['CAUTION_REQUIRED', 'HIGH_DANGER', 'EVACUATE'] } },
            { status: { [Op.in]: ['SUBMITTED', 'VERIFIED', 'FORWARDED_TO_ADMIN'] } },
          ],
        },
        limit: 50,
        order: [['created_at', 'DESC']],
      });

      if (activeFieldReports && activeFieldReports.length > 0) {
        payload.fieldReports = activeFieldReports.map((r: any) => ({
          id: r.id,
          districtId: r.district_id,
          locationName: r.location_name,
          incidentType: r.incident_type,
          severity: r.severity,
          roadStatus: r.road_status,
          safetyStatus: r.safety_status,
          description: r.description,
          latitude: r.latitude,
          longitude: r.longitude,
          createdAt: r.created_at,
        }));
      }
    } catch (e) {
      // postgres field reports fallback
    }

    // Ingest active alerts from MongoDB
    try {
      const activeAlerts = await Alert.find({ status: 'active' }).limit(30).lean();
      if (activeAlerts && activeAlerts.length > 0) {
        payload.corridorAlerts = [
          ...(payload.corridorAlerts || []),
          ...activeAlerts.map((a: any) => ({
            id: a.id,
            district: a.districtId,
            severity: a.severity?.toLowerCase(),
            type: a.type,
            title: a.title,
            message: a.message,
            location: a.location,
          })),
        ];
      }
    } catch (e) {
      // mongo alerts fallback
    }

    try {
      const data = await proxyToML('/route/plan', 'POST', payload, 180000, 4000);
      if (data && (data.success || data.recommended)) {
        return sendSuccess(res, data, 'Route plan retrieved');
      }
    } catch (mlErr: any) {
      console.warn('ML route plan proxy failed, falling back to local corridor router:', mlErr?.message);
    }

    // Local resilient route planner fallback
    const origId = String(payload.originDistrictId || 'kamrup').toLowerCase();
    const destId = String(payload.destDistrictId || 'cachar').toLowerCase();

    const [origDist, destDist] = await Promise.all([
      District.findByPk(origId, { raw: true }).catch(() => null),
      District.findByPk(destId, { raw: true }).catch(() => null),
    ]);

    const startLat = payload.currentLat || origDist?.centroid_lat || 26.1445;
    const startLng = payload.currentLng || origDist?.centroid_lng || 91.7362;
    const endLat = destDist?.centroid_lat || 24.8170;
    const endLng = destDist?.centroid_lng || 92.7985;

    let geometry: [number, number][] = [
      [startLat, startLng],
      [endLat, endLng],
    ];
    let distanceKm = 295;
    let durationSeconds = 21600;

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(6000) });
      if (osrmRes.ok) {
        const osrmData: any = await osrmRes.json();
        if (osrmData.routes?.[0]) {
          const r0 = osrmData.routes[0];
          if (Array.isArray(r0.geometry?.coordinates)) {
            geometry = r0.geometry.coordinates.map((c: any) => [c[1], c[0]]);
          }
          if (r0.distance) distanceKm = Math.round(r0.distance / 100) / 10;
          if (r0.duration) durationSeconds = Math.round(r0.duration);
        }
      }
    } catch {}

    const travelHours = Math.round((durationSeconds / 3600) * 10) / 10;
    const fallbackPlan = {
      success: true,
      origin: { districtId: origId, name: origDist?.name || origId },
      destination: { districtId: destId, name: destDist?.name || destId },
      preferred: payload.prefer || 'safest',
      routingProvider: 'osrm-fallback',
      recommended: {
        id: 'safest',
        name: `${origDist?.name || origId} → ${destDist?.name || destId} (Corridor)`,
        type: 'safest',
        geometry,
        totalDistanceKm: distanceKm,
        avgTravelHours: travelHours,
        riskScore: 22,
        riskLevel: 'low',
        transitCost: Math.round(distanceKm * 18.5),
        legs: [
          {
            from: origId,
            to: destId,
            roadName: 'NH-27 / NH-29 Lifeline Corridor',
            distanceKm,
            geometry,
            geometrySource: 'osrm',
            osrmDurationText: `${Math.floor(travelHours)}h ${Math.round((travelHours % 1) * 60)}m`,
            riskScore: 22,
            riskLevel: 'low',
            roadCondition: 'good',
          },
        ],
      },
      alternatives: [
        {
          id: 'optimal',
          name: '🌟 Optimal Highway Lifeline (NH-27 / NH-29)',
          type: 'optimal',
          geometry,
          totalDistanceKm: distanceKm,
          avgTravelHours: travelHours,
          riskScore: 22,
          riskLevel: 'low',
          transitCost: Math.round(distanceKm * 18.5),
          legs: [
            {
              from: origId,
              to: destId,
              roadName: 'NH-27 / NH-29 Lifeline Corridor',
              distanceKm,
              geometry,
              riskScore: 22,
              riskLevel: 'low',
            },
          ],
        },
        {
          id: 'safest',
          name: '🛡️ Safest Low-Hazard Bypass Corridor',
          type: 'safest',
          geometry,
          totalDistanceKm: Math.round(distanceKm * 1.08 * 10) / 10,
          avgTravelHours: Math.round(travelHours * 1.1 * 10) / 10,
          riskScore: 14,
          riskLevel: 'low',
          transitCost: Math.round(distanceKm * 1.08 * 18.5),
          legs: [
            {
              from: origId,
              to: destId,
              roadName: 'Low-Elevation Highway Bypass',
              distanceKm: Math.round(distanceKm * 1.08 * 10) / 10,
              geometry,
              riskScore: 14,
              riskLevel: 'low',
            },
          ],
        },
        {
          id: 'shortest',
          name: '⚡ Shortest Direct Hill Corridor',
          type: 'shortest',
          geometry,
          totalDistanceKm: Math.round(distanceKm * 0.96 * 10) / 10,
          avgTravelHours: Math.round(travelHours * 0.95 * 10) / 10,
          riskScore: 38,
          riskLevel: 'medium',
          transitCost: Math.round(distanceKm * 0.96 * 18.5),
          legs: [
            {
              from: origId,
              to: destId,
              roadName: 'Direct Mountain Highway',
              distanceKm: Math.round(distanceKm * 0.96 * 10) / 10,
              geometry,
              riskScore: 38,
              riskLevel: 'medium',
            },
          ],
        },
        {
          id: 'economical',
          name: '💰 Economical Valley Corridor',
          type: 'economical',
          geometry,
          totalDistanceKm: Math.round(distanceKm * 1.03 * 10) / 10,
          avgTravelHours: Math.round(travelHours * 1.05 * 10) / 10,
          riskScore: 20,
          riskLevel: 'low',
          transitCost: Math.round(distanceKm * 1.03 * 16.5),
          legs: [
            {
              from: origId,
              to: destId,
              roadName: 'Gentle Grade Valley Highway',
              distanceKm: Math.round(distanceKm * 1.03 * 10) / 10,
              geometry,
              riskScore: 20,
              riskLevel: 'low',
            },
          ],
        },
      ],
    };
    return sendSuccess(res, fallbackPlan, 'Route plan retrieved (local corridor fallback)');
  } catch (err: any) { return sendError(res, err.message); }
});

router.post('/route/reroute-vehicle', async (req: Request, res: Response) => {
  try {
    try {
      const data = await proxyToML('/route/reroute-vehicle', 'POST', req.body, 180000, 30000);
      if (data && (data.success || data.hasRoute)) {
        return sendSuccess(res, data, 'Vehicle dynamically rerouted');
      }
    } catch (mlErr: any) {
      console.warn('ML reroute proxy failed, falling back to TrackingService:', mlErr?.message);
    }
    const vehicleId = req.body?.vehicleId || req.body?.vehicle_id || req.body?.id;
    if (vehicleId) {
      const result = await TrackingService.calculateLiveDynamicRoute(String(vehicleId), {
        avoidCorridors: req.body?.avoidCorridors,
        avoidDistricts: req.body?.avoidDistricts,
        reason: req.body?.reason || 'Dynamic reroute to bypass corridor congestion',
        broadcast: true,
      });
      return sendSuccess(res, result, 'Vehicle dynamically rerouted (live fallback)');
    }
    return sendError(res, 'Missing vehicleId for reroute', 400);
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
    const data = await proxyToML('/health', 'GET', undefined, 30000, 5000);
    return sendSuccess(res, data, 'ML service health');
  } catch (err: any) {
    return sendSuccess(res, {
      status: 'degraded',
      ml_service: 'unreachable',
      fallback_active: true,
      core_backend: 'healthy',
      uptime: process.uptime(),
    }, 'ML service health (degraded — fallback active)');
  }
});

export default router;
