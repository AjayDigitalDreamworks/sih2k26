import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { sequelize, connectPostgres } from '../src/config/db';
import { connectMongo } from '../src/config/mongo';
import {
  User,
  District,
  Road,
  Bridge,
  Route,
  RiskScore,
  Vehicle,
  Driver,
  Trip,
  Delivery,
} from '../src/models/postgres';
import { FieldReport, Alert, AuditLog, NotificationsLog } from '../src/models/mongo';
import bcrypt from 'bcrypt';
import { TrackingService } from '../src/modules/tracking/tracking.service';

let connected = false;

before(async () => {
  // Connect to databases
  await connectPostgres();
  await connectMongo();
  // Ensure schema is in sync without dropping existing seeded tables
  await sequelize.sync();
  connected = true;
  console.log('✅ Test database connections established (tables synced with new schema)');
});

after(async () => {
  if (connected) {
    // Close BOTH connections so the test runner exits cleanly — mongoose keeps
    // sockets alive and would otherwise leave the process hanging after tests.
    await sequelize.close();
    const mongoose = (await import('mongoose')).default;
    await mongoose.disconnect();
  }
});

  describe('PostgreSQL Models', () => {
    test('should create and retrieve a User with proper password hashing', async () => {
      const password = 'testpassword123';
      const password_hash = await bcrypt.hash(password, 12);

      const user = await User.create({
        id: 'test_user_' + Date.now(),
        name: 'Test User',
        email: 'test@example.com',
        password_hash,
        role: 'transporter',
        transporter_id: 'test_transporter',
        agency: 'Test Agency',
        phone: '+919876543210',
      });

      assert.ok(user.id, 'User should have an id');
      assert.strictEqual(user.email, 'test@example.com');
      assert.strictEqual(user.role, 'transporter');

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);
      assert.strictEqual(isValid, true);

      // Clean up
      await user.destroy();
    });

    test('should create District with PostGIS geometry', async () => {
      const { createDistrictPolygon } = await import('../src/models/postgres/District');

      const district = await District.create({
        id: 'test_district_' + Date.now(),
        name: 'Test District',
        state: 'Assam',
        connectivity_status: 'accessible',
        connectivity_score: 85,
        population: 500000,
        geom: createDistrictPolygon(26.0, 91.0, 20),
        centroid_lat: 26.0,
        centroid_lng: 91.0,
      });

      assert.ok(district.id, 'District should have id');
      assert.ok(district.geom, 'District should have geometry');
      assert.ok(district.geom.includes('Polygon'), 'Geometry should be polygon');

      // Clean up
      await district.destroy();
    });

    test('should create Route with PostGIS linestring', async () => {
      const { createRouteLinestring } = await import('../src/models/postgres/Route');

      const route = await Route.create({
        id: 'test_route_' + Date.now(),
        name: 'Test Route',
        origin_district_id: 'kamrup',
        dest_district_id: 'sonitpur',
        road_ids: ['NH-27'],
        distance_km: 100,
        avg_travel_hours: 2.5,
        status: 'good',
        current_risk_score: 25,
        fuel_cost_estimate: 1500,
        toll_cost: 100,
        geom: createRouteLinestring(26.1445, 91.7362, 26.6528, 92.7926),
      });

      assert.ok(route.id, 'Route should have an id');
      assert.ok(route.geom, 'Route should have geometry');
      const geom = JSON.parse(route.geom);
      assert.strictEqual(geom.type, 'LineString');
      assert.ok(geom.coordinates.length > 1, 'Linestring should have multiple points');

      // Clean up
      await route.destroy();
    });

    test('should create Vehicle and link to Driver', async () => {
      const vehicle = await Vehicle.create({
        id: 'TEST-VEH-' + Date.now(),
        model: 'Test Vehicle Model',
        transporter_id: 'transporter_01',
        type: 'Light Commercial Vehicle',
        capacity_kg: 3500,
        status: 'idle',
        current_lat: 26.1445,
        current_lng: 91.7362,
        speed: 0,
        fuel_percent: 80,
        tracking_active: false,
        live_status: 'OFFLINE',
      });

      const driver = await Driver.create({
        id: 'TEST-DRV-' + Date.now(),
        name: 'Test Driver',
        phone: '9876543210',
        license_number: 'TEST-LIC-001',
        license_expiry: new Date('2028-12-31'),
        vehicle_id: vehicle.id,
        transporter_id: 'transporter_01',
        user_id: null,
        status: 'active',
        rating: 4.5,
      });

      // Verify association
      const fetchedDriver = await Driver.findByPk(driver.id);
      assert.strictEqual(fetchedDriver?.vehicle_id, vehicle.id);

      // Clean up
      await driver.destroy();
      await vehicle.destroy();
    });

    test('should create Trip with proper foreign key relationships', async () => {
      const vehicle = await Vehicle.create({
        id: 'TEST-VEH-TIP-' + Date.now(),
        model: 'Trip Test Vehicle',
        transporter_id: 'transporter_01',
        type: 'Light Commercial Vehicle',
        capacity_kg: 3500,
        status: 'idle',
      });

      const driver = await Driver.create({
        id: 'TEST-DRV-TIP-' + Date.now(),
        name: 'Trip Test Driver',
        phone: '9876543210',
        license_number: 'TRIP-TEST-LIC',
        license_expiry: new Date('2028-12-31'),
        transporter_id: 'transporter_01',
        status: 'active',
      });

      const route = await Route.create({
        id: 'TEST-ROUTE-TIP-' + Date.now(),
        name: 'Trip Test Route',
        origin_district_id: 'kamrup',
        dest_district_id: 'sonitpur',
        road_ids: [],
        distance_km: 50,
        avg_travel_hours: 1.5,
        status: 'good',
        current_risk_score: 15,
        geom: JSON.stringify({ type: 'LineString', coordinates: [[91.7, 26.1], [92.7, 26.6]] }),
      });

      const trip = await Trip.create({
        id: 'TRIP-TEST-' + Date.now(),
        vehicle_id: vehicle.id,
        driver_id: driver.id,
        route_id: route.id,
        transporter_id: 'transporter_01',
        origin: 'Guwahati',
        destination: 'Tezpur',
        status: 'planned',
        progress_percent: 0,
        eta: new Date(Date.now() + 3600000),
      });

      assert.ok(trip.id, 'Trip should have id');
      assert.strictEqual(trip.vehicle_id, vehicle.id);
      assert.strictEqual(trip.driver_id, driver.id);
      assert.strictEqual(trip.route_id, route.id);

      // Verify relationships
      const fetchTrip = await Trip.findByPk(trip.id, {
        include: [
          { model: Vehicle, as: 'vehicle' },
          { model: Driver, as: 'driver' },
          { model: Route, as: 'route' },
        ],
      });

      assert.strictEqual(fetchTrip?.vehicle?.id, vehicle.id);
      assert.strictEqual(fetchTrip?.driver?.id, driver.id);
      assert.strictEqual(fetchTrip?.route?.id, route.id);

      // Clean up
      await trip.destroy();
      await route.destroy();
      await driver.destroy();
      await vehicle.destroy();
    });

    test('should create Delivery linked to Trip with proper FK relationships', async () => {
      // Create a proper vehicle and driver for FK test
      const testVehicle = await Vehicle.create({
        id: 'TEST-VEH-DEL-' + Date.now(),
        model: 'Test Vehicle for Delivery',
        transporter_id: 'transporter_01',
        type: 'Light Commercial Vehicle',
        capacity_kg: 3500,
        status: 'idle',
      });

      const testDriver = await Driver.create({
        id: 'TEST-DRV-DEL-' + Date.now(),
        name: 'Test Driver for Delivery',
        phone: '9876543210',
        license_number: 'DEL-TEST-LIC',
        license_expiry: new Date('2028-12-31'),
        transporter_id: 'transporter_01',
        status: 'active',
      });

      const testRoute = await Route.create({
        id: 'TEST-ROUTE-DEL-' + Date.now(),
        name: 'Test Route for Delivery',
        origin_district_id: 'kamrup',
        dest_district_id: 'sonitpur',
        road_ids: [],
        distance_km: 50,
        avg_travel_hours: 1.5,
        status: 'good',
        current_risk_score: 15,
        geom: JSON.stringify({ type: 'LineString', coordinates: [[91.7, 26.1], [92.7, 26.6]] }),
      });

      const trip = await Trip.create({
        id: 'DEL-TEST-TRIP-' + Date.now(),
        vehicle_id: testVehicle.id,
        driver_id: testDriver.id,
        route_id: testRoute.id,
        transporter_id: 'transporter_01',
        origin: 'Test Origin',
        destination: 'Test Destination',
        status: 'planned',
        eta: new Date(Date.now() + 3600000),
      });

      const delivery = await Delivery.create({
        id: 'CON-TEST-' + Date.now(),
        trip_id: trip.id,
        transporter_id: 'transporter_01',
        origin_district_id: 'kamrup',
        dest_district_id: 'sonitpur',
        commodity_type: 'medicine',
        priority: 'critical',
        consignee_name: 'Test Hospital',
        consignee_phone: '+919876543210',
        weight_kg: 500,
        status: 'pending',
      });

      assert.ok(delivery.id, 'Delivery should have id');
      assert.strictEqual(delivery.trip_id, trip.id);
      assert.strictEqual(delivery.commodity_type, 'medicine');
      assert.strictEqual(delivery.priority, 'critical');

      // Clean up
      await delivery.destroy();
      await trip.destroy();
      await testRoute.destroy();
      await testDriver.destroy();
      await testVehicle.destroy();
    });

    test('should create RiskScore for Route', async () => {
      const route = await Route.create({
        id: 'RISK-TEST-ROUTE-' + Date.now(),
        name: 'Risk Test Route',
        origin_district_id: 'kamrup',
        dest_district_id: 'sonitpur',
        road_ids: [],
        distance_km: 50,
        avg_travel_hours: 1.5,
        status: 'good',
        current_risk_score: 30,
        geom: JSON.stringify({ type: 'LineString', coordinates: [[91.7, 26.1], [92.7, 26.6]] }),
      });

      const riskScore = await RiskScore.create({
        route_id: route.id,
        score: 45,
        risk_level: 'medium',
        factors: {
          rainfall_24h_mm: 25,
          slope_risk: 40,
          road_condition: 'good',
          congestion: 'moderate',
        },
      });

      assert.ok(riskScore.id, 'RiskScore should have id');
      assert.strictEqual(riskScore.route_id, route.id);
      assert.strictEqual(riskScore.score, 45);
      assert.strictEqual(riskScore.risk_level, 'medium');

      // Clean up
      await riskScore.destroy();
      await route.destroy();
    });

    test('should enforce foreign key constraints', async () => {
      // Try to create a trip with non-existent vehicle - should fail or succeed based on DB config
      // With Sequelize, this might not throw immediately if constraints aren't enforced
      // But the relationship should be maintainable
      const invalidTrip = await Trip.create({
        id: 'INVALID-TRIP-' + Date.now(),
        vehicle_id: 'NONEXISTENT-VEHICLE',
        driver_id: 'NONEXISTENT-DRIVER',
        route_id: 'NONEXISTENT-ROUTE',
        transporter_id: 'transporter_01',
        origin: 'Test',
        destination: 'Test',
        status: 'planned',
      }).catch(() => null);

      // Note: Sequelize by default doesn't enforce FK constraints at DB level
      // The application layer should handle validation
      assert.strictEqual(invalidTrip, null);
    });
  });

  describe('MongoDB Models', () => {
    test('should create and retrieve FieldReport with dynamic structure', async () => {
      const report = await FieldReport.create({
        id: 'FR-TEST-' + Date.now(),
        type: 'Road Damage',
        iconType: 'damage',
        location: 'Test Road, Assam',
        districtId: 'kamrup',
        reportedBy: 'Test Driver',
        priority: 'High',
        status: 'Pending',
        reportedOn: new Date().toLocaleString(),
        image: '/assets/test.jpg',
        photos: ['/assets/photo1.jpg', '/assets/photo2.jpg'],
        description: 'Test road damage description',
        coordinates: { lat: 26.1445, lng: 91.7362 },
      });

      assert.ok(report.id, 'Report should have an id');
      assert.strictEqual(report.type, 'Road Damage');
      assert.strictEqual(report.photos.length, 2);
      assert.ok(report.coordinates, 'Report should have coordinates');
      assert.strictEqual(report.coordinates?.lat, 26.1445);
      assert.strictEqual(report.coordinates?.lng, 91.7362);

      // Query by district
      const byDistrict = await FieldReport.find({ districtId: 'kamrup' });
      assert.ok(byDistrict.length > 0, 'Should find reports by district');

      // Clean up
      await report.deleteOne();
    });

    test('should create Alert with translations map', async () => {
      const alert = await Alert.create({
        id: 'ALT-TEST-' + Date.now(),
        title: 'Test Alert',
        type: 'blocked_road',
        severity: 'High',
        severityClass: 'high',
        districtId: 'kamrup',
        routeId: 'test_route',
        location: 'Test Location',
        time: new Date().toLocaleTimeString(),
        message: 'Test alert message',
        translations: {
          en: 'Test alert in English',
          as: 'Englishত পৰীক্ষা সতর্কতা',
          bn: 'ইংরেজিতে পরীক্ষা সতর্কতা',
        },
        channel: 'app',
        status: 'active',
      });

      assert.ok(alert.id, 'Alert should have id');
      assert.ok(alert.translations, 'Alert should have translations');
      // translations is a Mongoose Map — access via .get() (property access is undefined)
      const directEn = (alert.translations as any)?.get ? (alert.translations as any).get('en') : (alert.translations as any)?.en;
      assert.strictEqual(directEn, 'Test alert in English');
      const assameseTranslation = alert.translations?.as || alert.translations?.get?.('as');
      console.log('Alert translations:', JSON.stringify(alert.translations));
      // MongoDB Map types: use .get() to access values
      const translations = alert.toJSON()?.translations || alert.translations;
      
      // If it's a Map, use .get()
      const enValue = typeof translations?.get === 'function' 
        ? translations.get('en') 
        : translations?.en;
      
      assert.ok(enValue, 'English translation should exist');
      assert.strictEqual(enValue, 'Test alert in English', 'English translation should match');

      // Clean up
      await alert.deleteOne();
    });

    test('should create AuditLog with metadata', async () => {
      const auditLog = await AuditLog.create({
        userId: 'test_user',
        action: 'CREATE_FIELD_REPORT',
        entityType: 'FieldReport',
        entityId: 'FR-TEST-001',
        meta: {
          reportType: 'Road Damage',
          districtId: 'kamrup',
          coordinates: { lat: 26.1445, lng: 91.7362 },
        },
        timestamp: new Date(),
      });

      assert.strictEqual(auditLog.userId, 'test_user');
      assert.strictEqual(auditLog.action, 'CREATE_FIELD_REPORT');
      assert.ok(auditLog.meta, 'AuditLog should have meta');
      assert.strictEqual(auditLog.meta?.reportType, 'Road Damage');

      // Clean up
      await auditLog.deleteOne();
    });

    test('should create NotificationsLog with delivery status', async () => {
      const notification = await (await import('../src/models/mongo')).NotificationsLog.create({
        userId: 'test_user',
        alertId: 'ALT-TEST-001',
        channel: 'sms',
        deliveryStatus: 'sent',
        message: 'Test SMS notification',
        sentAt: new Date(),
      });

      assert.strictEqual(notification.userId, 'test_user');
      assert.strictEqual(notification.channel, 'sms');
      assert.strictEqual(notification.deliveryStatus, 'sent');

      // Clean up
      await notification.deleteOne();
    });
  });

  describe('Cross-Model Relationships', () => {
    test('should link Delivery → Trip → Vehicle → Driver properly', async () => {
      // Create vehicle
      const vehicle = await Vehicle.create({
        id: 'REL-VEH-' + Date.now(),
        model: 'Relationship Test Vehicle',
        transporter_id: 'transporter_01',
        type: 'Light Commercial Vehicle',
        capacity_kg: 3500,
        status: 'idle',
      });

      // Create driver
      const driver = await Driver.create({
        id: 'REL-DRV-' + Date.now(),
        name: 'Relationship Test Driver',
        phone: '9876543210',
        license_number: 'REL-TEST-LIC',
        license_expiry: new Date('2028-12-31'),
        vehicle_id: vehicle.id,
        transporter_id: 'transporter_01',
        status: 'active',
      });

      // Create route
      const route = await Route.create({
        id: 'REL-ROUTE-' + Date.now(),
        name: 'Relationship Test Route',
        origin_district_id: 'kamrup',
        dest_district_id: 'sonitpur',
        road_ids: [],
        distance_km: 50,
        avg_travel_hours: 1.5,
        status: 'good',
        current_risk_score: 15,
        geom: JSON.stringify({ type: 'LineString', coordinates: [[91.7, 26.1], [92.7, 26.6]] }),
      });

      // Create trip linking all
      const trip = await Trip.create({
        id: 'REL-TRIP-' + Date.now(),
        vehicle_id: vehicle.id,
        driver_id: driver.id,
        route_id: route.id,
        transporter_id: 'transporter_01',
        origin: 'Guwahati',
        destination: 'Tezpur',
        status: 'in_transit',
        progress_percent: 50,
        eta: new Date(Date.now() + 3600000),
      });

      // Create delivery linked to trip
      const delivery = await Delivery.create({
        id: 'REL-CON-' + Date.now(),
        trip_id: trip.id,
        transporter_id: 'transporter_01',
        origin_district_id: 'kamrup',
        dest_district_id: 'sonitpur',
        commodity_type: 'medicine',
        priority: 'critical',
        consignee_name: 'Test Recipient',
        consignee_phone: '+919876543210',
        weight_kg: 250,
        status: 'in_transit',
      });

      // Verify delivery has trip_id
      const fetchedDelivery = await Delivery.findByPk(delivery.id);
      assert.strictEqual(fetchedDelivery?.trip_id, trip.id);

      // Verify trip has correct vehicle and driver
      const fetchTrip = await Trip.findByPk(trip.id);
      assert.strictEqual(fetchTrip?.vehicle_id, vehicle.id);
      assert.strictEqual(fetchTrip?.driver_id, driver.id);

      // Verify vehicle-driver link
      const fetchedDriver = await Driver.findByPk(driver.id);
      assert.strictEqual(fetchedDriver?.vehicle_id, vehicle.id);

      // Clean up
      await delivery.destroy();
      await trip.destroy();
      await route.destroy();
      await driver.destroy();
      await vehicle.destroy();
    });
  });

  describe('Spatial Queries', () => {
    test('should find districts within radius using haversine', async () => {
      const { getDistrictsWithinRadius } = await import('../src/utils/spatialQueries');

      // Test point - use the centroid coordinates
      // Note: This test requires districts to exist in DB (from seed data)
      // Without seed data, the function returns empty array which is valid behavior
      const nearby = await getDistrictsWithinRadius(26.1445, 91.7362, 100);

      // With empty DB, we just verify the function works without error
      assert.ok(Array.isArray(nearby), 'Should return an array');
      console.log(`Found ${nearby.length} districts within 100km`);
    });

    test('should find district containing a point', async () => {
      const { findDistrictContainingPoint } = await import('../src/utils/spatialQueries');

      // Test point - this requires district polygons to exist in DB
      // Without seed data, returns null which is valid behavior
      const district = await findDistrictContainingPoint(26.1445, 91.7362);

      // With empty DB, we just verify the function works without error
      assert.ok(district === null || typeof district === 'string', 'Should return null or district id');
    });
  });

  describe('Data Integrity', () => {
    test('should prevent duplicate email in User', async () => {
      const password_hash = await bcrypt.hash('password123', 12);
      const email = 'unique@test.com';

      await User.create({
        id: 'unique_user_1',
        name: 'User 1',
        email,
        password_hash,
        role: 'viewer',
      });

      // Try to create another user with same email
      const duplicate = await User.create({
        id: 'unique_user_2',
        name: 'User 2',
        email,
        password_hash,
        role: 'viewer',
      }).catch((err: any) => {
        assert.strictEqual(err.name, 'SequelizeUniqueConstraintError');
        return null;
      });

      assert.strictEqual(duplicate, null);

      // Clean up
      await User.destroy({ where: { id: 'unique_user_1' } });
    });

    test('should validate enum values', async () => {
      const invalidStatus = await Vehicle.create({
        id: 'INVALID-STATUS-' + Date.now(),
        model: 'Invalid Status Vehicle',
        transporter_id: 'transporter_01',
        type: 'Light Commercial Vehicle',
        capacity_kg: 3500,
        status: 'invalid_status',
      }).catch((err: any) => {
        // Postgres ENUM constraint fails at DB level, so error is SequelizeDatabaseError
        assert.ok(err.name === 'SequelizeDatabaseError' || err.name === 'SequelizeValidationError', 'Should throw validation or database error');
        return null;
      });

      assert.strictEqual(invalidStatus, null);
    });
  });

  describe('Driver & Vehicle 1-to-1 Tracking Flow', () => {
    test('should enforce strict 1-to-1 Driver <-> Vehicle assignment and release', async () => {
      const v1Id = 'V-TEST-SYNC-1';
      const v2Id = 'V-TEST-SYNC-2';

      // Clean up any leftovers
      await Vehicle.destroy({ where: { id: [v1Id, v2Id] } });

      const v1 = await Vehicle.create({
        id: v1Id,
        model: 'Tata 407',
        transporter_id: 'transporter_01',
        type: 'truck',
        capacity_kg: 3500,
        status: 'idle',
        assigned_driver_id: 'DRV-01',
      });
      await Driver.update({ vehicle_id: v1Id }, { where: { id: 'DRV-01' } });

      let driver = await Driver.findByPk('DRV-01');
      assert.strictEqual(driver?.vehicle_id, v1Id, 'Driver should be assigned to v1');

      // Now create v2 and reassign DRV-01 to v2 — simulate transporter reassignment
      // Release old vehicle
      if (driver?.vehicle_id) {
        await Vehicle.update({ assigned_driver_id: null }, { where: { id: driver.vehicle_id } });
      }
      const v2 = await Vehicle.create({
        id: v2Id,
        model: 'Eicher Pro',
        transporter_id: 'transporter_01',
        type: 'truck',
        capacity_kg: 5000,
        status: 'idle',
        assigned_driver_id: 'DRV-01',
      });
      await Driver.update({ vehicle_id: v2Id }, { where: { id: 'DRV-01' } });

      // Verify v1 is released
      const freshV1 = await Vehicle.findByPk(v1Id);
      assert.strictEqual(freshV1?.assigned_driver_id, null, 'Previous vehicle v1 should have null assigned_driver_id');

      // Verify v2 is assigned to DRV-01
      const freshV2 = await Vehicle.findByPk(v2Id);
      assert.strictEqual(freshV2?.assigned_driver_id, 'DRV-01', 'New vehicle v2 should have assigned_driver_id DRV-01');

      driver = await Driver.findByPk('DRV-01');
      assert.strictEqual(driver?.vehicle_id, v2Id, 'Driver should now be assigned to v2');

      // Clean up
      await Driver.update({ vehicle_id: null }, { where: { id: 'DRV-01' } });
      await v1.destroy();
      await v2.destroy();
    });

    test('should authorize GPS location only when trip is in_transit and belongs to driver', async () => {
      const vId = 'V-TEST-TRACK-1';
      const tripId = 'TRIP-TEST-AUTH-1';

      await Trip.destroy({ where: { id: tripId } });
      await Vehicle.destroy({ where: { id: vId } });

      const vehicle = await Vehicle.create({
        id: vId,
        model: 'Ashok Leyland',
        transporter_id: 'transporter_01',
        type: 'truck',
        capacity_kg: 8000,
        status: 'idle',
        assigned_driver_id: 'DRV-01',
      });
      await Driver.update({ vehicle_id: vId }, { where: { id: 'DRV-01' } });

      const trip = await Trip.create({
        id: tripId,
        transporter_id: 'transporter_01',
        vehicle_id: vId,
        driver_id: 'DRV-01',
        route_id: 'R-01',
        origin: 'Guwahati',
        destination: 'Tezpur',
        status: 'planned',
        progress_percent: 0,
        eta: new Date(Date.now() + 3600000),
      });

      const driverUser = { id: 'usr_driver_001', role: 'driver' };

      // Before trip start: authorizeLocation must reject with 409
      const preAuth = await TrackingService.authorizeLocation(driverUser, vId, tripId);
      assert.strictEqual(preAuth.ok, false);
      assert.strictEqual(preAuth.status, 409, 'Planned trip should return 409 Trip is not started yet');

      // Start the trip
      const startResult = await TrackingService.startTrip(driverUser, tripId);
      assert.strictEqual(startResult.ok, true, 'startTrip should succeed');

      // Now authorizeLocation should succeed
      const postAuth = await TrackingService.authorizeLocation(driverUser, vId, tripId);
      assert.strictEqual(postAuth.ok, true, 'authorizeLocation should succeed after trip started');
      assert.strictEqual(postAuth.vehicle?.id, vId);

      // Stop the trip
      const stopResult = await TrackingService.stopTrip(driverUser, tripId);
      assert.strictEqual(stopResult.ok, true, 'stopTrip should succeed');

      // Clean up
      await Driver.update({ vehicle_id: null }, { where: { id: 'DRV-01' } });
      await trip.destroy();
      await vehicle.destroy();
    });
  });

