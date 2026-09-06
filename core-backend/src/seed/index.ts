import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { sequelize, connectPostgres, ensureSpatialIndexes, ensureTrackingSchema, ensureFieldOfficerSchema } from '../config/db';
import { connectMongo } from '../config/mongo';
import {
  User,
  District,
  Road,
  Bridge,
  Route,
  RiskScore,
  Driver,
  Vehicle,
  Trip,
  Delivery,
  FieldTask,
  FieldVerification,
  FieldReportPostgres,
  FieldMedia,
} from '../models/postgres';
import { createDistrictPolygon } from '../models/postgres/District';
import { createRouteLinestring } from '../models/postgres/Route';

/**
 * CLEAN SEED — wipes BOTH databases completely and rebuilds with ONLY:
 *
 *   PostgreSQL:
 *     - 1 admin, 1 transporter and 4 driver LOGIN ACCOUNTS
 *     - 4 fleet Driver profiles (DRV-01..04), one linked to each driver account
 *       so transporters can assign them and the Driver App can resolve identity
 *     - 0 vehicles / 0 trips / 0 deliveries — real fleet ops start from the UI
 *     - Real NER master geography: 12 districts (PostGIS polygons), 6 roads,
 *       4 bridges, 5 corridor routes (linestrings) + risk scores
 *   MongoDB:
 *     - emptied completely (alerts / field reports / audit logs / notifications)
 *
 * No mock business data, no fake GPS, no demo alerts — pages show real counts
 * (empty states where there is genuinely nothing yet).
 *
 * LOGIN CREDENTIALS (password for every account: password123):
 *   admin@raahi.gov.in        → Admin Dashboard
 *   transporter@raahi.gov.in  → Transporter Dashboard
 *   driver1@raahi.gov.in      → Driver App (DRV-01)
 *   driver2@raahi.gov.in      → Driver App (DRV-02)
 *   driver3@raahi.gov.in      → Driver App (DRV-03)
 *   driver4@raahi.gov.in      → Driver App (DRV-04)
 */

const PASSWORD = 'password123';

async function wipeEverything() {
  // PostgreSQL: drop the whole public schema (drops every table, enum, index,
  // function incl. PostGIS objects), recreate it, re-enable PostGIS.
  await sequelize.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await sequelize.query('CREATE SCHEMA public;');
  try {
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis;');
  } catch (extErr: any) {
    console.warn('⚠️ PostGIS extension notice:', extErr.message);
  }

  // MongoDB: drop the entire database (all collections).
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
}

export async function runSeed() {
  console.log('🌱 Starting CLEAN seed — wiping both databases...');

  await connectPostgres();
  await connectMongo();
  await wipeEverything();

  // Recreate model tables on the fresh schema, then the raw tracking/spatial DDL.
  await sequelize.sync();
  await ensureTrackingSchema();
  await ensureFieldOfficerSchema();
  await ensureSpatialIndexes();
  console.log('✅ PostgreSQL tables created (users, drivers, districts, roads, bridges, routes, risk_scores, vehicle_locations, field_tasks, field_verifications, field_reports, field_media).');

  // ─── LOGIN USERS (1 admin, 1 transporter, 1 field officer, 4 drivers) ──
  const pw = await bcrypt.hash(PASSWORD, 12);
  await User.bulkCreate([
    {
      id: 'usr_admin_001',
      name: 'System Admin',
      email: 'admin@raahi.gov.in',
      password_hash: pw,
      role: 'admin',
      agency: 'MDoNER — Raahi Platform',
      phone: '+91 9000000001',
    },
    {
      id: 'usr_transporter_001',
      name: 'Pranab Gogoi',
      email: 'transporter@raahi.gov.in',
      password_hash: pw,
      role: 'transporter',
      transporter_id: 'transporter_01',
      agency: 'Brahmaputra Heavy Freight Logistics',
      phone: '+91 9000000002',
    },
    {
      id: 'usr_officer_001',
      name: 'Anup Baruah',
      email: 'officer1@raahi.gov.in',
      password_hash: pw,
      role: 'field_officer',
      district_id: 'kamrup',
      agency: 'Assam PWD Road Safety & GIS Division',
      phone: '+91 9000000007',
    },
    {
      id: 'usr_driver_001',
      name: 'Rakesh Das',
      email: 'driver1@raahi.gov.in',
      password_hash: pw,
      role: 'driver',
      transporter_id: 'transporter_01',
      agency: 'Brahmaputra Heavy Freight Logistics',
      phone: '+91 9000000003',
    },
    {
      id: 'usr_driver_002',
      name: 'Manoj Kalita',
      email: 'driver2@raahi.gov.in',
      password_hash: pw,
      role: 'driver',
      transporter_id: 'transporter_01',
      agency: 'Brahmaputra Heavy Freight Logistics',
      phone: '+91 9000000004',
    },
    {
      id: 'usr_driver_003',
      name: 'Dipankar Bora',
      email: 'driver3@raahi.gov.in',
      password_hash: pw,
      role: 'driver',
      transporter_id: 'transporter_01',
      agency: 'Brahmaputra Heavy Freight Logistics',
      phone: '+91 9000000005',
    },
    {
      id: 'usr_driver_004',
      name: 'Hemanta Deka',
      email: 'driver4@raahi.gov.in',
      password_hash: pw,
      role: 'driver',
      transporter_id: 'transporter_01',
      agency: 'Brahmaputra Heavy Freight Logistics',
      phone: '+91 9000000006',
    },
  ]);
  console.log('✅ 7 login users seeded (1 admin, 1 transporter, 1 field officer, 4 drivers).');

  // ─── FLEET DRIVER PROFILES (DRV-01..04 ⇄ driver login accounts) ───
  // These are what transporter assignment lists and the Driver App resolve —
  // an account alone is not assignable until its profile exists.
  await Driver.bulkCreate([
    { id: 'DRV-01', name: 'Rakesh Das', phone: '9000000003', license_number: 'AS-2021-0045123', license_expiry: new Date('2029-12-31'), transporter_id: 'transporter_01', user_id: 'usr_driver_001', status: 'active', rating: 4.9 },
    { id: 'DRV-02', name: 'Manoj Kalita', phone: '9000000004', license_number: 'AS-2020-0034871', license_expiry: new Date('2030-06-30'), transporter_id: 'transporter_01', user_id: 'usr_driver_002', status: 'active', rating: 4.7 },
    { id: 'DRV-03', name: 'Dipankar Bora', phone: '9000000005', license_number: 'AS-2022-0056209', license_expiry: new Date('2031-03-15'), transporter_id: 'transporter_01', user_id: 'usr_driver_003', status: 'active', rating: 4.8 },
    { id: 'DRV-04', name: 'Hemanta Deka', phone: '9000000006', license_number: 'AS-2021-0061934', license_expiry: new Date('2030-11-20'), transporter_id: 'transporter_01', user_id: 'usr_driver_004', status: 'active', rating: 4.6 },
  ]);
  console.log('✅ 4 fleet driver profiles seeded (each linked to a driver account).');

  // ─── DISTRICTS (12 real NER districts with PostGIS polygons) ──────
  await District.bulkCreate([
    { id: 'kamrup', name: 'Kamrup Metropolitan (Guwahati)', state: 'Assam', connectivity_status: 'accessible', connectivity_score: 92, population: 1253938, geom: createDistrictPolygon(26.1445, 91.7362, 45), centroid_lat: 26.1445, centroid_lng: 91.7362 },
    { id: 'sonitpur', name: 'Sonitpur (Tezpur)', state: 'Assam', connectivity_status: 'accessible', connectivity_score: 84, population: 1924110, geom: createDistrictPolygon(26.6528, 92.7926, 50), centroid_lat: 26.6528, centroid_lng: 92.7926 },
    { id: 'cachar', name: 'Cachar (Silchar)', state: 'Assam', connectivity_status: 'partial', connectivity_score: 68, population: 1736617, geom: createDistrictPolygon(24.8170, 92.7985, 40), centroid_lat: 24.8170, centroid_lng: 92.7985 },
    { id: 'dima_hasao', name: 'Dima Hasao (Haflong)', state: 'Assam', connectivity_status: 'partial', connectivity_score: 58, population: 214102, geom: createDistrictPolygon(25.1764, 93.0232, 35), centroid_lat: 25.1764, centroid_lng: 93.0232 },
    { id: 'east_khasi', name: 'East Khasi Hills (Shillong)', state: 'Meghalaya', connectivity_status: 'accessible', connectivity_score: 88, population: 825922, geom: createDistrictPolygon(25.5788, 91.8933, 25), centroid_lat: 25.5788, centroid_lng: 91.8933 },
    { id: 'west_khasi', name: 'West Khasi Hills (Nongstoin)', state: 'Meghalaya', connectivity_status: 'partial', connectivity_score: 65, population: 383461, geom: createDistrictPolygon(25.5244, 91.2662, 40), centroid_lat: 25.5244, centroid_lng: 91.2662 },
    { id: 'dimapur', name: 'Dimapur', state: 'Nagaland', connectivity_status: 'accessible', connectivity_score: 80, population: 378811, geom: createDistrictPolygon(25.9060, 93.7270, 20), centroid_lat: 25.9060, centroid_lng: 93.7270 },
    { id: 'kohima', name: 'Kohima', state: 'Nagaland', connectivity_status: 'partial', connectivity_score: 72, population: 267988, geom: createDistrictPolygon(25.6751, 94.1086, 15), centroid_lat: 25.6751, centroid_lng: 94.1086 },
    { id: 'imphal_west', name: 'Imphal West', state: 'Manipur', connectivity_status: 'blocked', connectivity_score: 42, population: 517992, geom: createDistrictPolygon(24.8170, 93.9368, 20), centroid_lat: 24.8170, centroid_lng: 93.9368 },
    { id: 'aizawl', name: 'Aizawl', state: 'Mizoram', connectivity_status: 'partial', connectivity_score: 64, population: 400309, geom: createDistrictPolygon(23.7271, 92.7176, 25), centroid_lat: 23.7271, centroid_lng: 92.7176 },
    { id: 'papum_pare', name: 'Papum Pare (Itanagar)', state: 'Arunachal Pradesh', connectivity_status: 'accessible', connectivity_score: 78, population: 176573, geom: createDistrictPolygon(27.0844, 93.6053, 30), centroid_lat: 27.0844, centroid_lng: 93.6053 },
    { id: 'west_tripura', name: 'West Tripura (Agartala)', state: 'Tripura', connectivity_status: 'accessible', connectivity_score: 86, population: 918200, geom: createDistrictPolygon(23.8315, 91.2868, 20), centroid_lat: 23.8315, centroid_lng: 91.2868 },
  ] as any);
  console.log('✅ 12 districts seeded (with PostGIS polygons).');

  // ─── ROADS (6 national highways) ──────────────────────────────────
  await Road.bulkCreate([
    { id: 'NH-27', name: 'National Highway 27 (East-West Corridor)', district_id: 'kamrup', road_type: '4-Lane National Highway', condition: 'good', slope_risk: 15, length_km: 180 },
    { id: 'NH-37', name: 'National Highway 37 (Brahmaputra Valley Trunk)', district_id: 'sonitpur', road_type: '2-Lane National Highway', condition: 'good', slope_risk: 20, length_km: 145 },
    { id: 'NH-6', name: 'National Highway 6 (Shillong-Silchar Corridor)', district_id: 'dima_hasao', road_type: 'Hill Highway', condition: 'damaged', slope_risk: 75, length_km: 210 },
    { id: 'NH-2', name: 'National Highway 2 (Dimapur-Kohima-Imphal)', district_id: 'dimapur', road_type: 'Mountain Highway', condition: 'blocked', slope_risk: 85, length_km: 195 },
    { id: 'NH-306', name: 'National Highway 306 (Silchar-Aizawl Lifeline)', district_id: 'cachar', road_type: '2-Lane Hill Road', condition: 'damaged', slope_risk: 65, length_km: 130 },
    { id: 'NH-415', name: 'National Highway 415 (Banderdewa-Itanagar)', district_id: 'papum_pare', road_type: '4-Lane Highway', condition: 'good', slope_risk: 30, length_km: 60 },
  ] as any);
  console.log('✅ 6 roads seeded.');

  // ─── BRIDGES (4) ──────────────────────────────────────────────────
  await Bridge.bulkCreate([
    { id: 'BR-01', name: 'Saraighat Double Decker Bridge', road_id: 'NH-27', district_id: 'kamrup', status: 'operational', load_capacity_tons: 60, lat: 26.1287, lng: 91.6811 },
    { id: 'BR-02', name: 'Kolia Bhomora Setu (Brahmaputra)', road_id: 'NH-37', district_id: 'sonitpur', status: 'operational', load_capacity_tons: 50, lat: 26.6044, lng: 92.8622 },
    { id: 'BR-03', name: 'Jatinga Valley Viaduct', road_id: 'NH-6', district_id: 'dima_hasao', status: 'damaged', load_capacity_tons: 25, lat: 25.1200, lng: 93.0300 },
    { id: 'BR-04', name: 'Barak River Suspension Bridge', road_id: 'NH-306', district_id: 'cachar', status: 'operational', load_capacity_tons: 40, lat: 24.8300, lng: 92.8100 },
  ] as any);
  console.log('✅ 4 bridges seeded.');

  // ─── ROUTES + RISK SCORES (5 corridor routes with linestrings) ────
  await Route.bulkCreate([
    { id: 'R-01', name: 'Guwahati → Tezpur (NH-27/37)', origin_district_id: 'kamrup', dest_district_id: 'sonitpur', road_ids: ['NH-27', 'NH-37'], distance_km: 175, avg_travel_hours: 3.5, status: 'good', current_risk_score: 18, fuel_cost_estimate: 2450, toll_cost: 320, geom: createRouteLinestring(26.1445, 91.7362, 26.6528, 92.7926, [[26.3, 92.0], [26.4, 92.3]]) },
    { id: 'R-02', name: 'Guwahati → Shillong (NH-6)', origin_district_id: 'kamrup', dest_district_id: 'east_khasi', road_ids: ['NH-6'], distance_km: 98, avg_travel_hours: 2.2, status: 'good', current_risk_score: 22, fuel_cost_estimate: 1550, toll_cost: 180, geom: createRouteLinestring(26.1445, 91.7362, 25.5788, 91.8933, [[25.8, 91.8]]) },
    { id: 'R-03', name: 'Silchar → Aizawl (NH-306)', origin_district_id: 'cachar', dest_district_id: 'aizawl', road_ids: ['NH-306'], distance_km: 168, avg_travel_hours: 6.0, status: 'at_risk', current_risk_score: 68, fuel_cost_estimate: 3200, toll_cost: 0, geom: createRouteLinestring(24.8170, 92.7985, 23.7271, 92.7176, [[24.2, 92.7], [23.9, 92.7]]) },
    { id: 'R-04', name: 'Dimapur → Kohima → Imphal (NH-2)', origin_district_id: 'dimapur', dest_district_id: 'imphal_west', road_ids: ['NH-2'], distance_km: 215, avg_travel_hours: 8.5, status: 'blocked', current_risk_score: 92, fuel_cost_estimate: 4800, toll_cost: 250, geom: createRouteLinestring(25.9060, 93.7270, 24.8170, 93.9368, [[25.6751, 94.1086], [25.2, 94.0]]) },
    { id: 'R-05', name: 'Guwahati → Itanagar (NH-415)', origin_district_id: 'kamrup', dest_district_id: 'papum_pare', road_ids: ['NH-27', 'NH-415'], distance_km: 330, avg_travel_hours: 7.0, status: 'good', current_risk_score: 28, fuel_cost_estimate: 4900, toll_cost: 450, geom: createRouteLinestring(26.1445, 91.7362, 27.0844, 93.6053, [[26.5, 92.5], [26.8, 93.0]]) },
  ] as any);

  await RiskScore.bulkCreate([
    { route_id: 'R-01', score: 18, risk_level: 'low', factors: { rainfall_24h_mm: 5.2, slope_risk: 15, road_condition: 'good', congestion: 'low' } },
    { route_id: 'R-02', score: 22, risk_level: 'low', factors: { rainfall_24h_mm: 12.0, slope_risk: 35, road_condition: 'good', congestion: 'moderate' } },
    { route_id: 'R-03', score: 68, risk_level: 'high', factors: { rainfall_24h_mm: 45.8, slope_risk: 70, road_condition: 'damaged', congestion: 'high' } },
    { route_id: 'R-04', score: 92, risk_level: 'critical', factors: { rainfall_24h_mm: 82.4, slope_risk: 85, road_condition: 'blocked', congestion: 'blocked' } },
    { route_id: 'R-05', score: 28, risk_level: 'low', factors: { rainfall_24h_mm: 8.4, slope_risk: 25, road_condition: 'good', congestion: 'low' } },
  ]);
  console.log('✅ 5 corridor routes + risk scores seeded (with linestrings).');

  // ─── FIELD VERIFICATION TASKS (2 real NER field tasks) ───────────
  await FieldTask.bulkCreate([
    {
      id: 'FT-1001',
      title: 'NH-27 KM 42 Slope Subsidence & Pothole Cluster',
      issue_type: 'ROAD_DAMAGE',
      priority: 'HIGH',
      status: 'ASSIGNED',
      district_id: 'kamrup',
      assigned_officer_id: 'usr_officer_001',
      latitude: 26.1550,
      longitude: 91.7510,
      location_name: 'NH-27 Guwahati East Corridor, Near Basistha Chariali',
      description: 'Satellite alert indicated road surface distress and shoulder erosion following heavy rainfall. Requires on-site verification of lane passability.',
    },
    {
      id: 'FT-1002',
      title: 'Saraighat Approach Road Drainage Waterlogging',
      issue_type: 'FLOOD',
      priority: 'CRITICAL',
      status: 'ACCEPTED',
      district_id: 'kamrup',
      assigned_officer_id: 'usr_officer_001',
      latitude: 26.1310,
      longitude: 91.6850,
      location_name: 'Saraighat North Approach, Jalukbari',
      description: 'Sensor alert flagged 30cm standing water on the westbound slow lane. Field inspection required to assess heavy freight vehicle restrictions.',
    },
  ]);
  console.log('✅ 2 field verification tasks seeded (assigned to Field Officer).');

  // ─── VERIFY CLEAN STATE ───────────────────────────────────────────
  const [userCount, driverCount, districtCount, routeCount, vehicleCount, tripCount, deliveryCount, taskCount] = await Promise.all([
    User.count(),
    Driver.count(),
    District.count(),
    Route.count(),
    Vehicle.count(),
    Trip.count(),
    Delivery.count(),
    FieldTask.count(),
  ]);
  const mongoCollections = await mongoose.connection.db!.listCollections().toArray();

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  ✅ SEED COMPLETE — both databases are clean.');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  PostgreSQL — ${userCount} users, ${driverCount} drivers, ${vehicleCount} vehicles, ${tripCount} trips, ${deliveryCount} deliveries, ${taskCount} field tasks, ${districtCount} districts, ${routeCount} routes`);
  console.log(`  MongoDB    — ${mongoCollections.length} collections (all empty).`);
  console.log('');
  console.log('  LOGIN CREDENTIALS (password: password123):');
  console.log('    Admin         → admin@raahi.gov.in');
  console.log('    Transporter   → transporter@raahi.gov.in');
  console.log('    Field Officer → officer1@raahi.gov.in');
  console.log('    Drivers       → driver1@raahi.gov.in  (DRV-01)');
  console.log('                    driver2@raahi.gov.in  (DRV-02)');
  console.log('                    driver3@raahi.gov.in  (DRV-03)');
  console.log('                    driver4@raahi.gov.in  (DRV-04)');
  console.log('');
  console.log('  Note: no vehicles/trips/deliveries/alerts are seeded — those are');
  console.log('  created through the dashboards, so no stale or mock data appears.');
  console.log('══════════════════════════════════════════════════════════');
}

// CLI entry point
if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed error:', err);
      process.exit(1);
    });
}
