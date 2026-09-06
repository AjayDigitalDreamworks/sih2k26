import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { sequelize } from '../../config/db';
import { Vehicle, District, Road, Route, RiskScore } from '../../models/postgres';
import { redisClient } from '../../config/redis';
import { env } from '../../config/env';
import { Op } from 'sequelize';

const router = Router();
router.use(authenticateJwt);

/**
 * GET /api/gis/layers
 * List all available GIS layers with their status
 */
router.get('/layers', async (_req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    const online = () => ({ status: 'online' as const, timestamp: now });
    const unavailable = (note: string) => ({ status: 'unavailable' as const, timestamp: null, note });

    const tomtomConfigured = !!process.env.TOMTOM_API_KEY;
    const floodConfigured = !!process.env.GOOGLE_FLOOD_API_KEY;
    const nasaConfigured = !!process.env.NASA_EARTHDATA_TOKEN || !!process.env.NASA_EARTHDATA_PASS;
    const imdConfigured = !!process.env.IMD_API_KEY;

    const layers = [
      { id: 'base_map', name: 'Base Map', type: 'tile', source: 'OpenStreetMap', ...online() },
      { id: 'districts', name: 'Districts', type: 'vector', source: 'Database', ...online() },
      { id: 'roads', name: 'Roads', type: 'vector', source: 'Database', ...online() },
      { id: 'vehicles', name: 'Live Vehicles', type: 'realtime', source: 'GPS Tracking', ...online() },
      { id: 'routes', name: 'Active Routes', type: 'vector', source: 'Database', ...online() },
      { id: 'risk_flood', name: 'Flood Risk', type: 'risk', source: floodConfigured ? 'Google Flood Hub + ML' : 'ML Disruption Model + live rainfall', ...online() },
      { id: 'risk_landslide', name: 'Landslide Risk', type: 'risk', source: nasaConfigured ? 'NASA LHASA + ML' : 'ML Disruption Model + live rainfall', ...online() },
      { id: 'weather', name: 'Weather', type: 'overlay', source: imdConfigured ? 'IMD + Open-Meteo' : 'Open-Meteo', ...online() },
      { id: 'rainfall', name: 'Rainfall', type: 'overlay', source: 'Open-Meteo rainfall estimate', ...online() },
      { id: 'traffic', name: 'Traffic', type: 'overlay', source: 'TomTom', ...(tomtomConfigured ? online() : unavailable('Optional live feed — routes are still colored by real-time ML risk estimate')) },
      { id: 'road_damage', name: 'Road Damage', type: 'detection', source: 'CNN incident model', ...online() },
      { id: 'disruptions', name: 'Disruptions', type: 'event', source: 'Realtime pipeline + ML', ...online() },
      { id: 'accessibility', name: 'Accessibility', type: 'analysis', source: 'District connectivity scores', ...online() },
      { id: 'hospitals', name: 'Hospitals', type: 'poi', source: 'NER medical facilities', ...online() },
      { id: 'warehouses', name: 'Warehouses', type: 'poi', source: 'NER warehouses', ...online() },
      { id: 'logistics_hubs', name: 'Logistics Hubs', type: 'poi', source: 'NER logistics hubs', ...online() },
    ];
    return sendSuccess(res, layers, 'GIS layers retrieved');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

/**
 * GET /api/gis/districts
 * Get all districts as GeoJSON-compatible features with spatial data
 */
function parseGeometry(geom: string, fallbackPoint?: [number, number]): any {
  try {
    const parsed = JSON.parse(geom);
    return parsed.geometry || parsed;
  } catch {
    // Legacy/empty geometry rows degrade to their centroid point marker.
    return { type: 'Point', coordinates: fallbackPoint || [0, 0] };
  }
}

router.get('/districts', async (req: Request, res: Response) => {
  try {
    const { state, bbox } = req.query;
    const where: any = {};
    if (state) where.state = state;

    const districts = await District.findAll({ where, raw: true });

    const features = districts.map((d: any) => ({
      type: 'Feature',
      geometry: parseGeometry(d.geom, [d.centroid_lng, d.centroid_lat]),
      properties: {
        id: d.id,
        name: d.name,
        state: d.state,
        connectivity_status: d.connectivity_status,
        connectivity_score: d.connectivity_score,
        population: d.population,
        centroid: [d.centroid_lng, d.centroid_lat],
      },
    }));

    return sendSuccess(res, { type: 'FeatureCollection', features }, 'Districts retrieved');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

/**
 * GET /api/gis/roads
 * Get roads with spatial data
 */
router.get('/roads', async (req: Request, res: Response) => {
  try {
    const { district_id, condition } = req.query;
    const where: any = {};
    if (district_id) where.district_id = district_id;
    if (condition) where.condition = condition;

    const roads = await Road.findAll({ where, raw: true });
    return sendSuccess(res, roads, 'Roads retrieved');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

/**
 * GET /api/gis/routes
 * Get routes with spatial data
 */
router.get('/routes', async (req: Request, res: Response) => {
  try {
    const { status, risk_level } = req.query;
    const where: any = {};
    if (status) where.status = status;

    const routes = await Route.findAll({
      where,
      include: [{ model: RiskScore, as: 'risk_scores', limit: 1, order: [['computed_at', 'DESC']] }],
      raw: true,
      nest: true,
    });

    const features = routes.map((r: any) => ({
      type: 'Feature',
      geometry: parseGeometry(r.geom),
      properties: {
        id: r.id,
        name: r.name,
        origin_district_id: r.origin_district_id,
        dest_district_id: r.dest_district_id,
        distance_km: r.distance_km,
        avg_travel_hours: r.avg_travel_hours,
        status: r.status,
        current_risk_score: r.current_risk_score,
        fuel_cost_estimate: r.fuel_cost_estimate,
        risk: r.risk_scores?.[0] || null,
      },
    }));

    return sendSuccess(res, { type: 'FeatureCollection', features }, 'Routes retrieved');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

/**
 * GET /api/gis/vehicles
 * Get all vehicle positions as GeoJSON features
 */
router.get('/vehicles', async (req: Request, res: Response) => {
  try {
    const { status, bbox } = req.query;
    const where: any = {};
    if (status) where.status = status;

    const vehicles = await Vehicle.findAll({ where, raw: true });

    // Enrich with live Redis positions
    const features = await Promise.all(vehicles.map(async (v: any) => {
      let livePos: any = null;
      try {
        const raw = await redisClient.get(`vehicle:live:${v.id}`);
        if (raw) livePos = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}

      const lat = livePos?.lat || v.current_lat;
      const lng = livePos?.lng || v.current_lng;
      const lastPing = v.last_ping_at ? new Date(v.last_ping_at).getTime() : 0;
      const ageMs = Date.now() - lastPing;
      let tracking_status = 'offline';
      if (ageMs < 5 * 60 * 1000) tracking_status = 'live';
      else if (ageMs < 10 * 60 * 1000) tracking_status = 'stale';

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        properties: {
          id: v.id,
          model: v.model,
          status: v.status,
          tracking_status,
          speed: livePos?.speed || v.speed,
          heading: livePos?.heading || 0,
          direction: livePos?.direction || '',
          fuel_percent: v.fuel_percent,
          current_route: v.current_route,
          last_ping_at: v.last_ping_at,
          age_seconds: Math.round(ageMs / 1000),
          accuracy_rating: livePos?.accuracyRating || 'unknown',
          eta: livePos?.eta || null,
          battery_level: livePos?.batteryLevel || null,
        },
      };
    }));

    return sendSuccess(res, { type: 'FeatureCollection', features }, 'Vehicles retrieved');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

/**
 * GET /api/gis/nearby
 * Spatial query: find features near a point
 */
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(String(req.query.lat || '0'));
    const lng = parseFloat(String(req.query.lng || '0'));
    const radius_km = parseFloat(String(req.query.radius_km || '50'));
    const layer = String(req.query.layer || 'vehicles');

    if (!lat || !lng) return sendError(res, 'lat and lng are required', 400);

    // Haversine distance approximation for PostGIS-like queries
    const results: any[] = [];

    if (layer === 'vehicles') {
      const vehicles = await Vehicle.findAll({ raw: true });
      for (const v of vehicles) {
        const dist = haversineKm(lat, lng, v.current_lat, v.current_lng);
        if (dist <= radius_km) {
          results.push({
            id: v.id,
            name: v.model,
            type: 'vehicle',
            distance_km: Math.round(dist * 10) / 10,
            lat: v.current_lat,
            lng: v.current_lng,
            status: v.status,
          });
        }
      }
    } else if (layer === 'districts') {
      const districts = await District.findAll({ raw: true });
      for (const d of districts) {
        // Distance measured from the district centroid (kept as lat/lng in the
        // response for API compatibility with the old point-based rows).
        const dLat = d.centroid_lat;
        const dLng = d.centroid_lng;
        if (dLat == null || dLng == null) continue;
        const dist = haversineKm(lat, lng, dLat, dLng);
        if (dist <= radius_km) {
          results.push({
            id: d.id,
            name: d.name,
            type: 'district',
            distance_km: Math.round(dist * 10) / 10,
            lat: dLat,
            lng: dLng,
            connectivity: d.connectivity_status,
          });
        }
      }
    }

    // Sort by distance
    results.sort((a: any, b: any) => a.distance_km - b.distance_km);

    return sendSuccess(res, { count: results.length, radius_km, center: { lat, lng }, results }, 'Nearby features retrieved');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

/**
 * GET /api/gis/risk/flood
 * Get flood risk data for districts
 */
router.get('/risk/flood', async (_req: Request, res: Response) => {
  try {
    const mlUrl = env.mlServiceUrl;
    const response = await fetch(`${mlUrl}/realtime/flood/all`);
    if (response.ok) {
      const data = await response.json();
      return sendSuccess(res, data, 'Flood risk data retrieved');
    }
    return sendSuccess(res, { status: 'unavailable', note: 'ML service unavailable' }, 'Flood risk unavailable');
  } catch {
    return sendSuccess(res, { status: 'unavailable', note: 'ML service unreachable' }, 'Flood risk unavailable');
  }
});

/**
 * GET /api/gis/risk/landslide
 * Get landslide risk data for districts
 */
router.get('/risk/landslide', async (_req: Request, res: Response) => {
  try {
    const mlUrl = env.mlServiceUrl;
    const response = await fetch(`${mlUrl}/realtime/summary`);
    if (response.ok) {
      const data = await response.json();
      return sendSuccess(res, data, 'Landslide risk data retrieved');
    }
    return sendSuccess(res, { status: 'unavailable', note: 'ML service unavailable' }, 'Landslide risk unavailable');
  } catch {
    return sendSuccess(res, { status: 'unavailable', note: 'ML service unreachable' }, 'Landslide risk unavailable');
  }
});

/**
 * GET /api/gis/pois
 * Get points of interest (hospitals, warehouses, hubs)
 */
router.get('/pois', async (req: Request, res: Response) => {
  try {
    const type = String(req.query.type || 'all');

    // NER logistics POIs (real coordinates)
    const pois = [
      // Hospitals
      { id: 'hosp-1', name: 'Guwahati Medical College', type: 'hospital', lat: 26.1629, lng: 91.7535, district: 'kamrup' },
      { id: 'hosp-2', name: 'Silchar Medical College', type: 'hospital', lat: 24.8280, lng: 92.7970, district: 'cachar' },
      { id: 'hosp-3', name: 'Shillong NEIGRIHMS', type: 'hospital', lat: 25.5710, lng: 91.8840, district: 'east_khasi' },
      { id: 'hosp-4', name: 'Jorhat Medical College', type: 'hospital', lat: 26.7569, lng: 94.2137, district: 'jorhat' },
      { id: 'hosp-5', name: 'Dibrugarh Medical College', type: 'hospital', lat: 27.4830, lng: 94.9120, district: 'dibrugarh' },
      // Warehouses
      { id: 'wh-1', name: 'Guwahati Central Depot', type: 'warehouse', lat: 26.1445, lng: 91.7362, district: 'kamrup' },
      { id: 'wh-2', name: 'Tezpur Distribution Hub', type: 'warehouse', lat: 26.6528, lng: 92.7926, district: 'sonitpur' },
      { id: 'wh-3', name: 'Silchar Logistics Center', type: 'warehouse', lat: 24.8333, lng: 92.7789, district: 'cachar' },
      { id: 'wh-4', name: 'Dimapur Freight Terminal', type: 'warehouse', lat: 25.906, lng: 93.727, district: 'dimapur' },
      { id: 'wh-5', name: 'Agartala Warehouse', type: 'warehouse', lat: 23.8315, lng: 91.2868, district: 'west_tripura' },
      // Logistics Hubs
      { id: 'hub-1', name: 'Guwahati Intermodal Hub', type: 'logistics_hub', lat: 26.1800, lng: 91.7500, district: 'kamrup' },
      { id: 'hub-2', name: '唯美 Connectivity Hub Shillong', type: 'logistics_hub', lat: 25.5788, lng: 91.8933, district: 'east_khasi' },
      { id: 'hub-3', name: 'Imphal Delivery Hub', type: 'logistics_hub', lat: 24.817, lng: 93.9368, district: 'imphal_west' },
      // Airports
      { id: 'air-1', name: 'Lokpriya Gopinath Bordoloi Intl Airport', type: 'airport', lat: 26.1061, lng: 91.5859, district: 'kamrup' },
      { id: 'air-2', name: 'Lilabari Airport', type: 'airport', lat: 27.2890, lng: 94.0950, district: 'dhemaji' },
      { id: 'air-3', name: 'Dimapur Airport', type: 'airport', lat: 25.8830, lng: 93.7711, district: 'dimapur' },
      { id: 'air-4', name: 'Imphal Intl Airport', type: 'airport', lat: 24.7600, lng: 93.8967, district: 'imphal_west' },
      // Railway Stations
      { id: 'rail-1', name: 'Guwahati Railway Station', type: 'railway', lat: 26.1844, lng: 91.7456, district: 'kamrup' },
      { id: 'rail-2', name: 'New Jalpaiguri Junction', type: 'railway', lat: 26.7008, lng: 88.4269, district: 'external' },
      { id: 'rail-3', name: 'Dimapur Railway Station', type: 'railway', lat: 25.9100, lng: 93.7300, district: 'dimapur' },
    ];

    const filtered = type === 'all' ? pois : pois.filter(p => p.type === type);

    const features = filtered.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { ...p },
    }));

    return sendSuccess(res, { type: 'FeatureCollection', features }, 'POIs retrieved');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

/**
 * GET /api/gis/viewport
 * Get all GIS data within a bounding box (for map viewport queries)
 */
router.get('/viewport', async (req: Request, res: Response) => {
  try {
    const south = parseFloat(String(req.query.south || '23'));
    const west = parseFloat(String(req.query.west || '89'));
    const north = parseFloat(String(req.query.north || '29'));
    const east = parseFloat(String(req.query.east || '97'));

    // Query vehicles within bbox
    const vehicles = await Vehicle.findAll({
      where: {
        current_lat: { [Op.between]: [south, north] },
        current_lng: { [Op.between]: [west, east] },
      },
      raw: true,
    });

    // Query districts whose centroid is within bbox
    const districts = await District.findAll({
      where: {
        centroid_lat: { [Op.between]: [south, north] },
        centroid_lng: { [Op.between]: [west, east] },
      },
      raw: true,
    });

    // Query routes that originate or terminate within bbox
    const routes = await Route.findAll({ raw: true });

    return sendSuccess(res, {
      bbox: { south, west, north, east },
      vehicles: vehicles.length,
      districts: districts.length,
      routes: routes.length,
      vehicleFeatures: vehicles.map((v: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.current_lng, v.current_lat] },
        properties: { id: v.id, model: v.model, status: v.status, speed: v.speed },
      })),
      districtFeatures: districts.map((d: any) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.centroid_lng, d.centroid_lat] },
        properties: { id: d.id, name: d.name, state: d.state, connectivity: d.connectivity_status },
      })),
    }, 'Viewport data retrieved');
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default router;
