import { sequelize } from '../config/db';

/**
 * Spatial query helpers for PostGIS operations.
 *
 * `districts.geom` / `routes.geom` store GeoJSON as TEXT, so every predicate
 * converts them with ST_GeomFromGeoJSON and runs INSIDE PostgreSQL (the
 * PostGIS spatial engine) instead of shipping rows to JS. A lightweight JS
 * fallback keeps each helper working if PostGIS is not available.
 */

// Check if a point (lat, lng) is within a district polygon
export async function isPointInDistrict(
  lat: number,
  lng: number,
  districtId: string
): Promise<boolean> {
  try {
    const [rows] = await sequelize.query(
      `SELECT ST_Contains(
                ST_SetSRID(ST_GeomFromGeoJSON(geom), 4326),
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
              ) AS inside
         FROM districts
        WHERE id = :districtId
          AND geom IS NOT NULL AND geom <> ''
        LIMIT 1`,
      { replacements: { districtId, lat, lng } }
    );
    return !!(rows as any[])[0]?.inside;
  } catch {
    // PostGIS unavailable — fall back to a JS point-in-polygon check.
    const [rows] = await sequelize.query(
      `SELECT geom FROM districts
        WHERE id = :districtId AND geom IS NOT NULL AND geom <> ''
        LIMIT 1`,
      { replacements: { districtId } }
    );
    const geom = (rows as any[])[0]?.geom;
    try {
      const geojson = JSON.parse(geom);
      if (geojson?.type === 'Polygon') return pointInPolygon(lat, lng, geojson.coordinates[0]);
    } catch {
      return false;
    }
    return false;
  }
}

// Check if a point is within any district (returns district id)
export async function findDistrictContainingPoint(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const [rows] = await sequelize.query(
      `SELECT id
         FROM districts
        WHERE geom IS NOT NULL AND geom <> ''
          AND ST_Contains(
                ST_SetSRID(ST_GeomFromGeoJSON(geom), 4326),
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
              )
        LIMIT 1`,
      { replacements: { lat, lng } }
    );
    return (rows as any[])[0]?.id || null;
  } catch {
    // PostGIS unavailable — fall back to a JS scan of stored polygons.
    const [rows] = await sequelize.query(
      `SELECT id, geom FROM districts
        WHERE geom IS NOT NULL AND geom <> ''`
    );
    for (const district of rows as any[]) {
      try {
        const geojson = JSON.parse(district.geom);
        if (geojson?.type === 'Polygon' && pointInPolygon(lat, lng, geojson.coordinates[0])) {
          return district.id;
        }
      } catch {
        continue;
      }
    }
    return null;
  }
}

// Get districts within a radius of a point (km)
export async function getDistrictsWithinRadius(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<Array<{ id: string; name: string; centroid_lat: number; centroid_lng: number }>> {
  const radiusM = radiusKm * 1000;
  try {
    const [rows] = await sequelize.query(
      `SELECT id, name, centroid_lat, centroid_lng,
              ST_Distance(
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(centroid_lng, centroid_lat), 4326)::geography
              ) AS distance_m
         FROM districts
        WHERE centroid_lat IS NOT NULL AND centroid_lng IS NOT NULL
          AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(centroid_lng, centroid_lat), 4326)::geography,
                :radiusM
              )
        ORDER BY distance_m ASC`,
      { replacements: { lat, lng, radiusM } }
    );
    return (rows as any[]).map((d) => ({
      id: d.id,
      name: d.name,
      centroid_lat: Number(d.centroid_lat),
      centroid_lng: Number(d.centroid_lng),
    }));
  } catch {
    // PostGIS unavailable — fall back to a JS Haversine scan over centroids.
    const [rows] = await sequelize.query(
      `SELECT id, name, centroid_lat, centroid_lng FROM districts`
    );
    const results: Array<{ id: string; name: string; centroid_lat: number; centroid_lng: number; _km: number }> = [];
    for (const d of rows as any[]) {
      if (d.centroid_lat == null || d.centroid_lng == null) continue;
      const dist = haversineDistance(lat, lng, Number(d.centroid_lat), Number(d.centroid_lng));
      if (dist <= radiusKm) {
        results.push({
          id: d.id,
          name: d.name,
          centroid_lat: Number(d.centroid_lat),
          centroid_lng: Number(d.centroid_lng),
          _km: dist,
        });
      }
    }
    results.sort((a, b) => a._km - b._km);
    return results.map(({ _km, ...d }) => d);
  }
}

// Haversine distance between two points in km
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Ray-casting algorithm to check if a [lng, lat] coordinate is inside a polygon ring
function pointInPolygon(lat: number, lng: number, polygon: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Get route geometry as GeoJSON
export async function getRouteGeometry(routeId: string): Promise<any | null> {
  const [rows] = await sequelize.query(
    `SELECT geom FROM routes WHERE id = :routeId AND geom IS NOT NULL AND geom <> '' LIMIT 1`,
    { replacements: { routeId } }
  );
  const geom = (rows as any[])[0]?.geom;
  if (!geom) return null;
  try {
    const parsed = JSON.parse(geom);
    return parsed?.geometry || parsed || null;
  } catch {
    return null;
  }
}

// Calculate route length from geometry (for validation)
export function calculateLinestringLength(coordinates: Array<[number, number]>): number {
  let totalLength = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalLength += haversineDistance(
      coordinates[i - 1][1],
      coordinates[i - 1][0],
      coordinates[i][1],
      coordinates[i][0]
    );
  }
  return totalLength;
}
