import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../sih2k26/.env') });

const connectionString = process.env.POSTGRES_URI || 'postgres://ner_admin:change_me_in_production@localhost:5432/ner_logistics';
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running Phase 0 Foundations Migration & Seed...');

    // 0. Enable PostGIS
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('✅ PostGIS extension confirmed.');

    // 1. district_burn_rates
    await client.query(`
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
    `);
    console.log('✅ district_burn_rates table & index created.');

    // 2. rate_configs
    await client.query(`
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
    `);
    console.log('✅ rate_configs table created.');

    // 3. dead_zone_segments
    await client.query(`
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
    `);
    console.log('✅ dead_zone_segments table & spatial index created.');

    // 4. bridges schema upgrades
    await client.query(`
      ALTER TABLE bridges ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);
      ALTER TABLE bridges ADD COLUMN IF NOT EXISTS is_bailey_bridge BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE bridges ADD COLUMN IF NOT EXISTS corridor_id VARCHAR(50);
      ALTER TABLE bridges ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NOT NULL DEFAULT now();
      UPDATE bridges SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326) WHERE geom IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_bridges_geom ON bridges USING GIST (geom);
    `);
    console.log('✅ bridges table upgraded with PostGIS geom, is_bailey_bridge, corridor_id, verified_at.');

    // 5. deliveries eway_bill_no
    await client.query(`
      ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS eway_bill_no VARCHAR(12);
      DO $$ BEGIN
        ALTER TABLE deliveries ADD CONSTRAINT chk_deliveries_eway_bill CHECK (eway_bill_no IS NULL OR eway_bill_no ~ '^\\d{12}$');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ deliveries table upgraded with eway_bill_no + 12-digit check constraint.');

    // ─── SEED REFERENCE DATA ─────────────────────────────────────────

    // Seed district_burn_rates
    const burnRates = [
      { district_id: 'cachar', commodity: 'oxygen', rate_value: 0.65, rate_unit: 'kg_per_bed_day' },
      { district_id: 'cachar', commodity: 'food', rate_value: 0.45, rate_unit: 'kg_per_person_day' },
      { district_id: 'cachar', commodity: 'fuel', rate_value: 0.22, rate_unit: 'liters_per_person_day' },
      { district_id: 'cachar', commodity: 'medicine', rate_value: 0.15, rate_unit: 'kg_per_person_day' },

      { district_id: 'dima_hasao', commodity: 'oxygen', rate_value: 0.55, rate_unit: 'kg_per_bed_day' },
      { district_id: 'dima_hasao', commodity: 'food', rate_value: 0.40, rate_unit: 'kg_per_person_day' },
      { district_id: 'dima_hasao', commodity: 'fuel', rate_value: 0.20, rate_unit: 'liters_per_person_day' },
      { district_id: 'dima_hasao', commodity: 'medicine', rate_value: 0.12, rate_unit: 'kg_per_person_day' },

      { district_id: 'kamrup', commodity: 'oxygen', rate_value: 0.70, rate_unit: 'kg_per_bed_day' },
      { district_id: 'kamrup', commodity: 'food', rate_value: 0.50, rate_unit: 'kg_per_person_day' },
      { district_id: 'kamrup', commodity: 'fuel', rate_value: 0.25, rate_unit: 'liters_per_person_day' },
      { district_id: 'kamrup', commodity: 'medicine', rate_value: 0.18, rate_unit: 'kg_per_person_day' },

      { district_id: 'aizawl', commodity: 'oxygen', rate_value: 0.60, rate_unit: 'kg_per_bed_day' },
      { district_id: 'aizawl', commodity: 'food', rate_value: 0.45, rate_unit: 'kg_per_person_day' },
      { district_id: 'aizawl', commodity: 'fuel', rate_value: 0.22, rate_unit: 'liters_per_person_day' },
      { district_id: 'aizawl', commodity: 'medicine', rate_value: 0.14, rate_unit: 'kg_per_person_day' },
    ];

    for (const br of burnRates) {
      await client.query(`
        INSERT INTO district_burn_rates (district_id, commodity, rate_value, rate_unit, effective_from)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT DO NOTHING;
      `, [br.district_id, br.commodity, br.rate_value, br.rate_unit]);
    }
    console.log(`✅ Seeded ${burnRates.length} district burn rate references.`);

    // Seed rate_configs
    await client.query(`
      INSERT INTO rate_configs (id, config_key, rate_value, rate_unit, vehicle_class, effective_from)
      VALUES 
        ('rc-diesel-med', 'diesel_rate_per_km', 14.50, 'INR_per_km', 'medium_commercial', now()),
        ('rc-diesel-heavy', 'diesel_rate_per_km_heavy', 19.80, 'INR_per_km', 'heavy_multi_axle', now())
      ON CONFLICT (config_key) DO UPDATE SET rate_value = EXCLUDED.rate_value;
    `);
    console.log('✅ Seeded rate_configs (diesel rates ₹14.50/km and ₹19.80/km).');

    // Seed dead_zone_segments with real GeoJSON LineString
    const dzBarailGeom = {
      type: 'LineString',
      coordinates: [
        [92.70, 25.00],
        [92.78, 25.05],
        [92.85, 25.10],
        [93.00, 25.18],
        [93.12, 25.25]
      ]
    };
    const dzSelaGeom = {
      type: 'LineString',
      coordinates: [
        [91.95, 27.40],
        [92.05, 27.48],
        [92.15, 27.55],
        [92.25, 27.65]
      ]
    };

    await client.query(`
      INSERT INTO dead_zone_segments (id, corridor_id, name, entry_checkpost_id, entry_checkpost_name, exit_checkpost_id, exit_checkpost_name, length_km, default_speed_kmh, geom)
      VALUES 
        ('dz-barail-pass', 'NH-27', 'Barail Pass KM 44–68', 'CP-HAFLONG', 'Haflong Checkpost', 'CP-JATINGA', 'Jatinga Transit Checkpost', 24.0, 32.0, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
        ('dz-sela-pass', 'NH-13', 'Sela Pass Mountain Gap (KM 88-112)', 'CP-DIRANG', 'Dirang Base Checkpost', 'CP-BAISAKHI', 'Baisakhi Post', 26.0, 28.0, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        geom = EXCLUDED.geom,
        default_speed_kmh = EXCLUDED.default_speed_kmh,
        exit_checkpost_name = EXCLUDED.exit_checkpost_name;
    `, [JSON.stringify(dzBarailGeom), JSON.stringify(dzSelaGeom)]);
    console.log('✅ Seeded dead_zone_segments with surveyed PostGIS geometries.');

    // Seed Barail Bailey Bridge #3 (15t limit) on NH-27
    await client.query(`
      INSERT INTO bridges (id, name, road_id, district_id, status, load_capacity_tons, lat, lng, is_bailey_bridge, corridor_id, verified_at, geom, "createdAt", "updatedAt")
      VALUES 
        ('BR-05', 'Barail Bailey Bridge #3', 'NH-27', 'dima_hasao', 'operational', 15.0, 25.0500, 92.7800, true, 'NH-27', '2026-08-01 00:00:00+00', ST_SetSRID(ST_MakePoint(92.7800, 25.0500), 4326), now(), now())
      ON CONFLICT (id) DO UPDATE SET 
        load_capacity_tons = 15.0,
        is_bailey_bridge = true,
        geom = ST_SetSRID(ST_MakePoint(92.7800, 25.0500), 4326),
        verified_at = '2026-08-01 00:00:00+00';
    `);
    console.log('✅ Seeded Barail Bailey Bridge #3 (15t capacity, is_bailey_bridge: true).');

  } finally {
    client.release();
    await pool.end();
  }
}

main().then(() => {
  console.log('🎉 Phase 0 Migration & Reference Seed Finished Successfully.');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
