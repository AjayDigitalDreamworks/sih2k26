/**
 * Raahi Real-GPS tracking tests.
 * Run: npm test  (tsx --test)
 *
 * Pure validation tests run offline. DB-backed tests NEVER touch live trips:
 * they create their own throwaway planned trip on the driver's real assigned
 * vehicle (resolved from the DB) and delete it — plus its GPS rows — in
 * teardown. The vehicle's live state is snapshotted and restored, so running
 * the suite against real fleet data is non-destructive.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TrackingService } from '../src/modules/tracking/tracking.service';
import { sequelize } from '../src/config/db';
import { Vehicle, Trip, Driver } from '../src/models/postgres';

const DRIVER_USER = { id: 'usr_driver_004', role: 'driver' as const };
let REF = { vehicleId: '', tripId: '', driverId: '', createdTestTrip: false };
// Snapshot of the vehicle's real pre-test state — restored in teardown.
let ORIGINAL_VEHICLE: any = null;
const nowIso = () => new Date().toISOString();

async function resetTrip() {
  if (!REF.tripId) return;
  await Trip.update(
    { status: 'planned', actual_arrival_at: null, progress_percent: 0 },
    { where: { id: REF.tripId } }
  );
  await Vehicle.update(
    { tracking_active: false, current_trip_id: null, live_status: 'OFFLINE', status: 'idle', speed: 0, current_route: null },
    { where: { id: REF.vehicleId } }
  );
}

before(async () => {
  // Resolve the driver's REAL assigned vehicle from the DB — never wipe data.
  const driver = await Driver.findOne({ where: { user_id: DRIVER_USER.id } });
  assert.ok(driver, 'reference driver fixture missing — run the seed first');

  const vehicle = driver.vehicle_id ? await Vehicle.findByPk(driver.vehicle_id) : null;
  assert.ok(vehicle, 'reference vehicle fixture missing — driver has no assigned vehicle');

  // Own throwaway trip on the real vehicle — never reuse a live trip.
  const tripId = `TRP-TEST-${Date.now().toString().slice(-6)}`;
  const trip = await Trip.create({
    id: tripId,
    transporter_id: driver.transporter_id || 'transporter_01',
    vehicle_id: vehicle.id,
    driver_id: driver.id,
    route_id: 'R-01',
    origin: 'Guwahati',
    destination: 'Tezpur',
    status: 'planned',
    progress_percent: 0,
    eta: new Date(Date.now() + 5 * 3600 * 1000),
  });

  REF = { vehicleId: vehicle.id, tripId: trip.id, driverId: driver.id, createdTestTrip: true };
  ORIGINAL_VEHICLE = vehicle.toJSON();
  await resetTrip();
});

after(async () => {
  try {
    // Wipe GPS rows created for the throwaway trip, then delete the trip itself.
    if (REF.tripId) {
      await sequelize.query('DELETE FROM vehicle_locations WHERE trip_id = :tripId', { replacements: { tripId: REF.tripId } });
      await Trip.destroy({ where: { id: REF.tripId } });
    }
    // Restore the vehicle to exactly its pre-test state.
    if (ORIGINAL_VEHICLE) {
      await Vehicle.update(
        {
          status: ORIGINAL_VEHICLE.status ?? 'idle',
          tracking_active: ORIGINAL_VEHICLE.tracking_active ?? false,
          current_trip_id: ORIGINAL_VEHICLE.current_trip_id ?? null,
          live_status: ORIGINAL_VEHICLE.live_status ?? 'OFFLINE',
          current_route: ORIGINAL_VEHICLE.current_route ?? null,
          speed: ORIGINAL_VEHICLE.speed ?? 0,
          current_lat: ORIGINAL_VEHICLE.current_lat ?? null,
          current_lng: ORIGINAL_VEHICLE.current_lng ?? null,
          last_gps_at: ORIGINAL_VEHICLE.last_gps_at ?? null,
          last_ping_at: ORIGINAL_VEHICLE.last_ping_at ?? null,
          gps_source: ORIGINAL_VEHICLE.gps_source ?? null,
          current_heading: ORIGINAL_VEHICLE.current_heading ?? 0,
          current_accuracy: ORIGINAL_VEHICLE.current_accuracy ?? null,
        },
        { where: { id: ORIGINAL_VEHICLE.id } }
      );
    }
  } finally {
    await sequelize.close();
  }
});

// ─── Validation (offline, pure) ───

test('GPS validation accepts a valid real fix', () => {
  const r = TrackingService.validateLocationPayload({
    latitude: 26.1532, longitude: 91.7488, accuracy: 8, speed: 42, heading: 140,
    gps_timestamp: nowIso(), source: 'WEB_GPS',
  });
  assert.equal(r.isValid, true);
  assert.equal(r.errors.length, 0);
});

test('GPS validation rejects out-of-range coordinates', () => {
  for (const lat of [95, -91, 26.1]) {
    if (lat === 26.1) continue;
    const r = TrackingService.validateLocationPayload({ latitude: lat, longitude: 91.7, accuracy: 5, gps_timestamp: nowIso() });
    assert.equal(r.isValid, false, `lat ${lat} must be rejected`);
  }
  const badLng = TrackingService.validateLocationPayload({ latitude: 26.1, longitude: 181, accuracy: 5, gps_timestamp: nowIso() });
  assert.equal(badLng.isValid, false);
});

test('GPS validation rejects impossible physics & bad accuracy/source', () => {
  assert.equal(TrackingService.validateLocationPayload({ latitude: 26, longitude: 91, accuracy: -3, gps_timestamp: nowIso() }).isValid, false);
  assert.equal(TrackingService.validateLocationPayload({ latitude: 26, longitude: 91, accuracy: 5, speed: -1, gps_timestamp: nowIso() }).isValid, false);
  assert.equal(TrackingService.validateLocationPayload({ latitude: 26, longitude: 91, accuracy: 5, heading: 400, gps_timestamp: nowIso() }).isValid, false);
  assert.equal(TrackingService.validateLocationPayload({ latitude: 26, longitude: 91, accuracy: 5, gps_timestamp: nowIso(), source: 'SNAKE_OIL' }).isValid, false);
});

test('GPS validation enforces timestamp policy (no future, max 24h old)', () => {
  const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  assert.equal(TrackingService.validateLocationPayload({ latitude: 26, longitude: 91, accuracy: 5, gps_timestamp: future }).isValid, false);
  const tooOld = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  assert.equal(TrackingService.validateLocationPayload({ latitude: 26, longitude: 91, accuracy: 5, gps_timestamp: tooOld }).isValid, false);
  const missing = TrackingService.validateLocationPayload({ latitude: 26, longitude: 91, accuracy: 5 });
  assert.equal(missing.isValid, false);
});

// ─── Authorization (DB) ───

test('driver cannot report for a vehicle they are not assigned to', async () => {
  const auth = await TrackingService.authorizeLocation(DRIVER_USER, 'AS-01-CD-5678');
  assert.equal(auth.ok, false);
  assert.ok((auth.status || 0) >= 403 || (auth.error || '').includes('not'), `expected rejection, got ${auth.error}`);
});

test('driver cannot report GPS before the trip is started', async () => {
  await resetTrip();
  const auth = await TrackingService.authorizeLocation(DRIVER_USER, REF.vehicleId, REF.tripId);
  assert.equal(auth.ok, false); // trip is 'planned', not 'in_transit'
});

test('driver IS authorized once their trip is in_transit', async () => {
  await resetTrip();
  const started = await TrackingService.startTrip(DRIVER_USER, REF.tripId);
  assert.equal(started.ok, true);
  const auth = await TrackingService.authorizeLocation(DRIVER_USER, REF.vehicleId, REF.tripId);
  assert.equal(auth.ok, true);
  assert.equal(auth.vehicle?.id, REF.vehicleId);
  assert.equal(auth.trip?.id, REF.tripId);
});

// ─── Trip lifecycle (DB) ───

test('trip lifecycle: planned → in_transit (tracking on) → completed (tracking off)', async () => {
  await resetTrip();
  const started = await TrackingService.startTrip(DRIVER_USER, REF.tripId);
  assert.equal(started.ok, true);
  const trip1 = await Trip.findByPk(REF.tripId);
  const vehicle1 = await Vehicle.findByPk(REF.vehicleId);
  assert.equal(trip1?.status, 'in_transit');
  assert.equal(vehicle1?.tracking_active, true);
  assert.equal(vehicle1?.current_trip_id, REF.tripId);

  const stopped = await TrackingService.stopTrip(DRIVER_USER, REF.tripId);
  assert.equal(stopped.ok, true);
  const trip2 = await Trip.findByPk(REF.tripId);
  const vehicle2 = await Vehicle.findByPk(REF.vehicleId);
  assert.equal(trip2?.status, 'completed');
  assert.ok(trip2?.actual_arrival_at, 'arrival recorded');
  assert.equal(vehicle2?.tracking_active, false);
  assert.equal(vehicle2?.current_trip_id, null);
  assert.equal(vehicle2?.live_status, 'OFFLINE');
});

// ─── Real ingest → PostGIS persistence (DB) ───

test('processDriverLocation persists a real fix with geometry and returns LIVE', async () => {
  await resetTrip();
  await TrackingService.startTrip(DRIVER_USER, REF.tripId);

  const res = await TrackingService.processDriverLocation(DRIVER_USER, {
    latitude: 26.1555, longitude: 91.7544, accuracy: 6.5, speed: 44, heading: 138,
    altitude: 62, gps_timestamp: nowIso(), source: 'WEB_GPS',
  });
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.liveStatus, 'LIVE');
  assert.ok(res.locationId, 'location row id returned');

  // Row exists with geometry POINT in PostGIS
  const [rows]: any = await sequelize.query(
    `SELECT latitude, longitude, source, ST_AsText(geom::geometry) AS geom_pt
       FROM vehicle_locations WHERE id = :id`,
    { replacements: { id: res.locationId } }
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'WEB_GPS');
  assert.ok(/POINT\(91\.7544 26\.1555\)/.test(rows[0].geom_pt), `geom wrong: ${rows[0].geom_pt}`);

  // Vehicle current state updated + history reflects the point
  const vehicle = await Vehicle.findByPk(REF.vehicleId);
  assert.ok(Math.abs((vehicle?.current_lat || 0) - 26.1555) < 0.0001);
  assert.equal(vehicle?.gps_source, 'WEB_GPS');

  const hist = await TrackingService.getPersistedHistory(REF.vehicleId, { tripId: REF.tripId, limit: 100 });
  assert.ok(hist.total >= 1);
  assert.ok(hist.points.some((p: any) => p.id === res.locationId));

  // Reject: point without a started trip after completion
  await TrackingService.stopTrip(DRIVER_USER, REF.tripId);
  const blocked = await TrackingService.processDriverLocation(DRIVER_USER, {
    latitude: 26.16, longitude: 91.76, accuracy: 5, gps_timestamp: nowIso(), source: 'WEB_GPS',
  });
  assert.equal(blocked.ok, undefined);
  assert.equal(blocked.statusCode, 403);

  // cleanup the location rows created in this test
  await sequelize.query('DELETE FROM vehicle_locations WHERE trip_id = :tripId', { replacements: { tripId: REF.tripId } });
});

test('sync batches of old offline observations are accepted and stored (not live)', async () => {
  await resetTrip();
  await TrackingService.startTrip(DRIVER_USER, REF.tripId);
  const old = new Date(Date.now() - 3 * 60 * 1000).toISOString(); // 3 min old — STALE, still valid
  // Real offline-sync clients resend each queued point with its original
  // source (WEB_GPS) plus the X-Tracking-Sync header → syncBatch flag.
  const res = await TrackingService.processDriverLocation(DRIVER_USER, {
    latitude: 26.16, longitude: 91.76, accuracy: 12, speed: 0, heading: 0,
    gps_timestamp: old, source: 'WEB_GPS',
  }, { syncBatch: true });
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.liveStatus, 'STALE'); // honest — not marked LIVE
  await sequelize.query('DELETE FROM vehicle_locations WHERE trip_id = :tripId', { replacements: { tripId: REF.tripId } });
});
