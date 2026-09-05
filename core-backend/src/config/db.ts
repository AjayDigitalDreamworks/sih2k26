import { Sequelize } from 'sequelize';
import { env } from './env';

export const sequelize = new Sequelize(env.postgresUri, {
  dialect: 'postgres',
  dialectOptions: {
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

export const connectPostgres = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL (Neon) connected successfully.');
    // Enable PostGIS extension if available
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      console.log('✅ PostGIS extension checked/enabled.');
    } catch (extErr: any) {
      console.warn('⚠️ PostGIS extension notice:', extErr.message);
    }
    await ensureTrackingSchema();
  } catch (error: any) {
    console.error('❌ PostgreSQL connection error:', error.message);
    throw error;
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
