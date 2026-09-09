import { Sequelize } from 'sequelize';
import { env } from './env';

const defaultPostgresUri = 'postgres://ner_admin:change_me_in_production@localhost:5432/ner_logistics';
const postgresUri = (env.postgresUri && env.postgresUri.trim()) ? env.postgresUri.trim() : defaultPostgresUri;
const isLocalhost = postgresUri.includes('localhost') || postgresUri.includes('127.0.0.1');

export const sequelize = new Sequelize(postgresUri, {
  dialect: 'postgres',
  dialectOptions: isLocalhost
    ? {}
    : {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
  logging: env.nodeEnv === 'development' ? false : false,
  pool: {
    max: 10,
    // Keep one warm connection: serverless PG (Neon) reclaims idle sockets,
    // which surfaced as transient 500s on the first query after idle periods.
    min: 1,
    acquire: 30000,
    idle: 60000,
  },
});

import dns from 'dns';

// Ensure reliable DNS resolution for remote databases (e.g. Neon serverless hostnames)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // Ignore if permissions or platform restricts custom DNS
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const connectPostgres = async () => {
  // Neon pooler hostnames have shown transient DNS failures from some
  // networks — retry a few times before giving up.
  let lastErr: any = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await sequelize.authenticate();
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
      if (attempt < 5) {
        console.warn(`⚠️ PostgreSQL connect attempt ${attempt} failed (${err.message}); retrying...`);
        await sleep(1500 * attempt);
      }
    }
  }
  if (lastErr) throw lastErr;
  try {
    console.log('✅ PostgreSQL (PostGIS) connected successfully.');
    // Enable PostGIS extension if available
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      console.log('✅ PostGIS extension enabled.');
    } catch (extErr: any) {
      console.warn('⚠️ PostGIS extension notice:', extErr.message);
    }
    
    await ensureSpatialIndexes();
    await ensureFoundationsSchema();
    await ensureTrackingSchema();
    await ensureFieldOfficerSchema();
    await ensureMicroSegmentsSchema();
  } catch (error: any) {
    console.error('❌ PostgreSQL connection error:', error.message);
    throw error;
  }
};

/**
 * Spatial indexes for districts/routes: geom columns hold GeoJSON as TEXT, so
 * index the parsed geometry (ST_GeomFromGeoJSON) rather than a raw cast.
 * Best-effort: requires PostGIS and valid GeoJSON rows; failures are logged
 * and the server-side spatial queries still work (just without the index).
 */
export const ensureSpatialIndexes = async () => {
  try {
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_districts_geom ON districts USING GIST (ST_GeomFromGeoJSON(geom));
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_routes_geom ON routes USING GIST (ST_GeomFromGeoJSON(geom));
    `);
    console.log('✅ Spatial indexes ensured.');
  } catch (idxErr: any) {
    console.warn('⚠️ Spatial index creation notice:', idxErr.message);
  }
};

/**
 * Idempotent schema for real GPS tracking (project has no migration runner;
 * the codebase convention is `sequelize.sync` + idempotent DDL, applied at
 * boot and inside the seed so both paths converge).
 *
 * - vehicle_locations: persisted GPS observations with a PostGIS GEOGRAPHY
 *   point + spatial index (real spatial queries run server-side, not in JS).
 * - vehicles: live-tracking state columns kept separate from location history.
 * - drivers.user_id: links a driver login account to their driver record so
 *   the authenticated identity (never client-supplied) drives authorization.
 */
export const ensureTrackingSchema = async () => {
  const ddl = `
    CREATE TABLE IF NOT EXISTS vehicle_locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vehicle_id VARCHAR(50) NOT NULL,
      driver_id VARCHAR(50),
      trip_id VARCHAR(50),
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      accuracy_m DOUBLE PRECISION,
      speed_kmh DOUBLE PRECISION,
      heading_deg DOUBLE PRECISION,
      altitude_m DOUBLE PRECISION,
      gps_timestamp TIMESTAMPTZ NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      source VARCHAR(20) NOT NULL DEFAULT 'WEB_GPS',
      geom GEOGRAPHY(POINT, 4326),
      CONSTRAINT chk_vl_lat CHECK (latitude BETWEEN -90 AND 90),
      CONSTRAINT chk_vl_lng CHECK (longitude BETWEEN -180 AND 180),
      CONSTRAINT chk_vl_accuracy CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
      CONSTRAINT chk_vl_speed CHECK (speed_kmh IS NULL OR speed_kmh >= 0),
      CONSTRAINT chk_vl_heading CHECK (heading_deg IS NULL OR (heading_deg >= 0 AND heading_deg <= 360)),
      CONSTRAINT chk_vl_source CHECK (source IN ('WEB_GPS', 'ANDROID_GPS', 'FLEET_API', 'MANUAL'))
    );
    CREATE INDEX IF NOT EXISTS idx_vl_vehicle_time ON vehicle_locations (vehicle_id, gps_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_vl_trip_time ON vehicle_locations (trip_id, gps_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_vl_received ON vehicle_locations (received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vl_geom_gix ON vehicle_locations USING GIST (geom);

    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tracking_active BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_trip_id VARCHAR(50);
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_heading DOUBLE PRECISION;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_accuracy DOUBLE PRECISION;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gps_source VARCHAR(20) DEFAULT 'WEB_GPS';
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_gps_at TIMESTAMPTZ;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS live_status VARCHAR(20) DEFAULT 'OFFLINE';

    ALTER TABLE drivers ADD COLUMN IF NOT EXISTS user_id VARCHAR(50);
    CREATE INDEX IF NOT EXISTS idx_drivers_user ON drivers (user_id);
  `;
  await sequelize.query(ddl);
  console.log('✅ Tracking schema ensured (vehicle_locations + PostGIS index + live-tracking columns).');
};

/**
 * Idempotent schema for Field Officer Module & Real Field Verification.
 * Creates field_tasks, field_verifications, field_reports, and field_media tables
 * with PostGIS GEOGRAPHY(POINT, 4326) columns and spatial GIST indexes.
 */
export const ensureFieldOfficerSchema = async () => {
  const ddl = `
    DO $$ BEGIN
      CREATE TYPE enum_field_tasks_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enum_field_tasks_status AS ENUM ('ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'VERIFYING', 'VERIFIED', 'REJECTED', 'UNSAFE_TO_VERIFY', 'CLOSED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enum_field_verifications_result AS ENUM ('CONFIRMED', 'PARTIALLY_CONFIRMED', 'NOT_FOUND', 'DIFFERENT_ISSUE', 'UNSAFE_TO_VERIFY', 'CANNOT_VERIFY');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enum_field_verifications_observed_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enum_field_verifications_road_passability AS ENUM ('PASSABLE', 'PARTIALLY_BLOCKED', 'SINGLE_LANE_ONLY', 'IMPASSABLE_4W', 'IMPASSABLE_ALL');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enum_field_verifications_safety_status AS ENUM ('SAFE', 'CAUTION_REQUIRED', 'HIGH_DANGER', 'EVACUATE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enum_field_verifications_action_recommended AS ENUM ('NONE', 'ROUTE_DIVERSION', 'TEMPORARY_CLOSURE', 'EMERGENCY_REPAIR', 'STRUCTURAL_INSPECTION');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enum_field_reports_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enum_field_reports_road_status AS ENUM ('OPEN', 'PARTIALLY_BLOCKED', 'CLOSED', 'DANGEROUS', 'UNKNOWN');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enum_field_reports_safety_status AS ENUM ('SAFE', 'CAUTION_REQUIRED', 'HIGH_DANGER', 'EVACUATE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE enum_field_reports_status AS ENUM ('SUBMITTED', 'VERIFIED', 'FORWARDED_TO_ADMIN', 'CLOSED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS field_tasks (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      issue_type VARCHAR(100) NOT NULL DEFAULT 'ROAD_DAMAGE',
      priority enum_field_tasks_priority NOT NULL DEFAULT 'MEDIUM',
      status enum_field_tasks_status NOT NULL DEFAULT 'ASSIGNED',
      district_id VARCHAR(50) NOT NULL DEFAULT 'kamrup',
      assigned_officer_id VARCHAR(50),
      alert_id VARCHAR(50),
      description TEXT,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      location_name VARCHAR(255),
      target_completion_at TIMESTAMPTZ,
      notes TEXT,
      geom GEOGRAPHY(POINT, 4326),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_field_tasks_officer ON field_tasks (assigned_officer_id);
    CREATE INDEX IF NOT EXISTS idx_field_tasks_status ON field_tasks (status);
    CREATE INDEX IF NOT EXISTS idx_field_tasks_district ON field_tasks (district_id);
    CREATE INDEX IF NOT EXISTS idx_field_tasks_geom ON field_tasks USING GIST (geom);

    CREATE TABLE IF NOT EXISTS field_verifications (
      id VARCHAR(50) PRIMARY KEY,
      task_id VARCHAR(50) NOT NULL,
      officer_id VARCHAR(50) NOT NULL,
      verification_result enum_field_verifications_result NOT NULL DEFAULT 'CONFIRMED',
      observed_severity enum_field_verifications_observed_severity NOT NULL DEFAULT 'MEDIUM',
      road_passability enum_field_verifications_road_passability NOT NULL DEFAULT 'PASSABLE',
      safety_status enum_field_verifications_safety_status NOT NULL DEFAULT 'SAFE',
      action_recommended enum_field_verifications_action_recommended NOT NULL DEFAULT 'NONE',
      observation_notes TEXT,
      unsafe_reason TEXT,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      gps_accuracy_m DOUBLE PRECISION,
      geom GEOGRAPHY(POINT, 4326),
      verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_field_verifications_task ON field_verifications (task_id);
    CREATE INDEX IF NOT EXISTS idx_field_verifications_officer ON field_verifications (officer_id);
    CREATE INDEX IF NOT EXISTS idx_field_verifications_geom ON field_verifications USING GIST (geom);

    CREATE TABLE IF NOT EXISTS field_reports (
      id VARCHAR(50) PRIMARY KEY,
      idempotency_key VARCHAR(100) UNIQUE,
      officer_id VARCHAR(50) NOT NULL,
      district_id VARCHAR(50) NOT NULL DEFAULT 'kamrup',
      issue_type VARCHAR(100) NOT NULL,
      severity enum_field_reports_severity NOT NULL DEFAULT 'MEDIUM',
      road_status enum_field_reports_road_status NOT NULL DEFAULT 'OPEN',
      safety_status enum_field_reports_safety_status NOT NULL DEFAULT 'SAFE',
      immediate_action_required BOOLEAN NOT NULL DEFAULT false,
      recommended_actions TEXT,
      description TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      accuracy_m DOUBLE PRECISION,
      geom GEOGRAPHY(POINT, 4326),
      status enum_field_reports_status NOT NULL DEFAULT 'SUBMITTED',
      source VARCHAR(50) NOT NULL DEFAULT 'FIELD_OFFICER_WEB',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_field_reports_officer ON field_reports (officer_id);
    CREATE INDEX IF NOT EXISTS idx_field_reports_status ON field_reports (status);
    CREATE INDEX IF NOT EXISTS idx_field_reports_district ON field_reports (district_id);
    CREATE INDEX IF NOT EXISTS idx_field_reports_geom ON field_reports USING GIST (geom);

    CREATE TABLE IF NOT EXISTS field_media (
      id VARCHAR(50) PRIMARY KEY,
      report_id VARCHAR(50),
      task_id VARCHAR(50),
      verification_id VARCHAR(50),
      file_path VARCHAR(255) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
      file_size INTEGER NOT NULL DEFAULT 0,
      caption TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_field_media_report ON field_media (report_id);
    CREATE INDEX IF NOT EXISTS idx_field_media_task ON field_media (task_id);
    CREATE INDEX IF NOT EXISTS idx_field_media_verification ON field_media (verification_id);
  `;
  try {
    await sequelize.query(ddl);
    console.log('✅ Field Officer schema ensured (field_tasks, field_verifications, field_reports, field_media + PostGIS GIST indexes).');
  } catch (err: any) {
    console.warn('⚠️ Field Officer schema notice:', err.message);
  }
};

/**
 * Idempotent schema for 500m Road Micro-Segments.
 */
export const ensureMicroSegmentsSchema = async () => {
  const ddl = `
    DO $$ BEGIN
      CREATE TYPE enum_route_micro_segments_risk_level AS ENUM ('low', 'medium', 'high', 'critical');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS route_micro_segments (
      id VARCHAR(64) PRIMARY KEY,
      route_id VARCHAR(50) NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
      segment_index INTEGER NOT NULL,
      start_chainage_km DOUBLE PRECISION NOT NULL,
      end_chainage_km DOUBLE PRECISION NOT NULL,
      length_m DOUBLE PRECISION NOT NULL DEFAULT 500.0,
      slope_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
      elevation_start_m DOUBLE PRECISION NOT NULL DEFAULT 300.0,
      elevation_end_m DOUBLE PRECISION NOT NULL DEFAULT 300.0,
      tortuosity DOUBLE PRECISION NOT NULL DEFAULT 1.0,
      current_risk_score INTEGER NOT NULL DEFAULT 15,
      risk_level enum_route_micro_segments_risk_level NOT NULL DEFAULT 'low',
      hazard_reason VARCHAR(255),
      geom TEXT NOT NULL DEFAULT '{"type":"LineString","coordinates":[[0,0],[0,0]]}',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_route_micro_segments_route_idx ON route_micro_segments (route_id, segment_index);
    CREATE INDEX IF NOT EXISTS idx_route_micro_segments_risk ON route_micro_segments (current_risk_score);
  `;
  try {
    await sequelize.query(ddl);
    console.log('✅ Route micro-segments schema ensured.');
  } catch (err: any) {
    console.warn('⚠️ Route micro-segments schema notice:', err.message);
  }
};

/**
 * Idempotent schema for Phase 0 Foundations:
 * - district_burn_rates: consumption burn rates per district and commodity
 * - rate_configs: dynamic fuel prices and transportation tariffs
 * - dead_zone_segments: surveyed mountain low-connectivity corridors with entry/exit checkposts
 * - bridges: PostGIS geom, is_bailey_bridge, corridor_id, verified_at, and GIST index
 * - deliveries: eway_bill_no with 12-digit regex check constraint
 */
export const ensureFoundationsSchema = async () => {
  const ddl = `
    CREATE EXTENSION IF NOT EXISTS postgis;

    CREATE TABLE IF NOT EXISTS district_burn_rates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      district_id VARCHAR(50) NOT NULL,
      commodity VARCHAR(20) NOT NULL,
      rate_value DOUBLE PRECISION NOT NULL,
      rate_unit VARCHAR(50) NOT NULL DEFAULT 'kg_per_day',
      effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_dbr_rate CHECK (rate_value > 0)
    );
    CREATE INDEX IF NOT EXISTS idx_dbr_district_comm ON district_burn_rates (district_id, commodity);

    CREATE TABLE IF NOT EXISTS rate_configs (
      id VARCHAR(50) PRIMARY KEY,
      config_key VARCHAR(50) NOT NULL UNIQUE,
      rate_value DOUBLE PRECISION NOT NULL,
      rate_unit VARCHAR(50) NOT NULL DEFAULT 'INR_per_km',
      vehicle_class VARCHAR(50) NOT NULL DEFAULT 'medium_commercial',
      effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS dead_zone_segments (
      id VARCHAR(50) PRIMARY KEY,
      corridor_id VARCHAR(50) NOT NULL,
      name VARCHAR(150) NOT NULL,
      entry_checkpost_id VARCHAR(50),
      entry_checkpost_name VARCHAR(150),
      exit_checkpost_id VARCHAR(50),
      exit_checkpost_name VARCHAR(150),
      length_km DOUBLE PRECISION DEFAULT 24.0,
      default_speed_kmh DOUBLE PRECISION DEFAULT 30.0,
      geom GEOMETRY(LINESTRING, 4326),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_dead_zones_geom ON dead_zone_segments USING GIST (geom);

    ALTER TABLE bridges ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);
    ALTER TABLE bridges ADD COLUMN IF NOT EXISTS is_bailey_bridge BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE bridges ADD COLUMN IF NOT EXISTS corridor_id VARCHAR(50);
    ALTER TABLE bridges ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NOT NULL DEFAULT now();
    UPDATE bridges SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326) WHERE geom IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_bridges_geom ON bridges USING GIST (geom);

    ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS eway_bill_no VARCHAR(12);
    DO $$ BEGIN
      ALTER TABLE deliveries ADD CONSTRAINT chk_deliveries_eway_bill CHECK (eway_bill_no IS NULL OR eway_bill_no ~ '^\\d{12}$');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;
  try {
    await sequelize.query(ddl);
    console.log('✅ Foundations schema ensured (district_burn_rates, rate_configs, dead_zone_segments, bridges PostGIS, eway_bill_no).');
  } catch (err: any) {
    console.warn('⚠️ Foundations schema notice:', err.message);
  }
};
