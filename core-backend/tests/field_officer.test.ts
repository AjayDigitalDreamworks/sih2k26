import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { sequelize, connectPostgres, ensureFieldOfficerSchema } from '../src/config/db';
import { connectMongo } from '../src/config/mongo';
import {
  User,
  FieldTask,
  FieldVerification,
  FieldReportPostgres,
  FieldMedia,
} from '../src/models/postgres';
import { FieldReport as MongoFieldReport, Alert as MongoAlert, AuditLog } from '../src/models/mongo';
import bcrypt from 'bcrypt';

let connected = false;

before(async () => {
  await connectPostgres();
  await connectMongo();
  await sequelize.sync();
  await ensureFieldOfficerSchema();
  connected = true;
});

after(async () => {
  if (connected) {
    await sequelize.close();
    const mongoose = (await import('mongoose')).default;
    await mongoose.disconnect();
  }
});

describe('Field Officer Module & Ground-Truth Verification', () => {
  const testOfficerId = `test_officer_${Date.now()}`;
  const testEmail = `officer_test_${Date.now()}@raahi.gov.in`;

  test('should create Field Officer user with field_officer role', async () => {
    const pw = await bcrypt.hash('password123', 10);
    const user = await User.create({
      id: testOfficerId,
      name: 'Test Field Officer',
      email: testEmail,
      password_hash: pw,
      role: 'field_officer',
      district_id: 'kamrup',
      agency: 'PWD Road Safety Division',
      phone: '+91 9999988888',
    });

    assert.ok(user.id);
    assert.strictEqual(user.role, 'field_officer');
    assert.strictEqual(user.district_id, 'kamrup');
  });

  test('should create and transition FieldTask through full verification lifecycle', async () => {
    const taskId = `FT-TEST-${Date.now()}`;

    // 1. Create task in ASSIGNED status
    const task = await FieldTask.create({
      id: taskId,
      title: 'Landslide on NH-27 KM 34',
      issue_type: 'LANDSLIDE',
      priority: 'CRITICAL',
      status: 'ASSIGNED',
      district_id: 'kamrup',
      assigned_officer_id: testOfficerId,
      latitude: 26.1820,
      longitude: 91.7560,
      location_name: 'NH-27 Near Basistha Crossing',
      description: 'Major slope collapse after heavy rainfall.',
    });

    assert.ok(task.id);
    assert.strictEqual(task.status, 'ASSIGNED');
    assert.strictEqual(task.priority, 'CRITICAL');

    // 2. Transition: ACCEPTED
    task.status = 'ACCEPTED';
    await task.save();
    let updated = await FieldTask.findByPk(taskId);
    assert.strictEqual(updated?.status, 'ACCEPTED');

    // 3. Transition: EN_ROUTE
    task.status = 'EN_ROUTE';
    await task.save();
    updated = await FieldTask.findByPk(taskId);
    assert.strictEqual(updated?.status, 'EN_ROUTE');

    // 4. Transition: ARRIVED
    task.status = 'ARRIVED';
    task.notes = '[ARRIVED]: Officer on site at 26.1820, 91.7560';
    await task.save();
    updated = await FieldTask.findByPk(taskId);
    assert.strictEqual(updated?.status, 'ARRIVED');

    // 5. Submit Physical Field Verification
    const verId = `VER-TEST-${Date.now()}`;
    const verification = await FieldVerification.create({
      id: verId,
      task_id: taskId,
      officer_id: testOfficerId,
      verification_result: 'CONFIRMED',
      observed_severity: 'CRITICAL',
      road_passability: 'IMPASSABLE_4W',
      safety_status: 'HIGH_DANGER',
      action_recommended: 'ROUTE_DIVERSION',
      observation_notes: 'Confirmed 30 meters of active rock slurry blocking eastbound lane.',
      latitude: 26.1821,
      longitude: 91.7561,
      gps_accuracy_m: 6.2,
      verified_at: new Date(),
    });

    assert.ok(verification.id);
    assert.strictEqual(verification.verification_result, 'CONFIRMED');
    assert.strictEqual(verification.road_passability, 'IMPASSABLE_4W');
    assert.strictEqual(verification.safety_status, 'HIGH_DANGER');

    // 6. Attach evidence media
    const media = await FieldMedia.create({
      id: `MED-TEST-${Date.now()}`,
      task_id: taskId,
      verification_id: verId,
      file_path: '/uploads/field-evidence/test-rockfall.jpg',
      file_name: 'test-rockfall.jpg',
      mime_type: 'image/jpeg',
      file_size: 204800,
      caption: 'Eastbound lane blockage view from KM 34',
    });

    assert.ok(media.id);
    assert.strictEqual(media.verification_id, verId);

    // 7. Update Task to VERIFIED
    task.status = 'VERIFIED';
    await task.save();
    updated = await FieldTask.findByPk(taskId, {
      include: [
        { model: FieldVerification, as: 'verification' },
        { model: FieldMedia, as: 'media' },
      ],
    });

    assert.strictEqual(updated?.status, 'VERIFIED');
    assert.ok((updated as any)?.verification);
    assert.strictEqual((updated as any)?.media?.length, 1);

    // Clean up
    await media.destroy();
    await verification.destroy();
    await task.destroy();
  });

  test('should enforce idempotency key uniqueness on FieldReportPostgres', async () => {
    const key = `idemp-key-${Date.now()}`;
    const report1Id = `FR-TEST-1-${Date.now()}`;
    const report2Id = `FR-TEST-2-${Date.now()}`;

    // Create first report
    const report1 = await FieldReportPostgres.create({
      id: report1Id,
      idempotency_key: key,
      officer_id: testOfficerId,
      district_id: 'kamrup',
      issue_type: 'ROAD_DAMAGE',
      severity: 'HIGH',
      road_status: 'PARTIALLY_BLOCKED',
      safety_status: 'CAUTION_REQUIRED',
      immediate_action_required: true,
      description: 'Deep potholes on bridge approach',
      latitude: 26.1445,
      longitude: 91.7362,
      accuracy_m: 5.0,
      status: 'SUBMITTED',
      source: 'FIELD_OFFICER_WEB',
    });

    assert.ok(report1.id);

    // Attempt to create second report with the identical idempotency_key
    const duplicate = await FieldReportPostgres.create({
      id: report2Id,
      idempotency_key: key,
      officer_id: testOfficerId,
      district_id: 'kamrup',
      issue_type: 'ROAD_DAMAGE',
      severity: 'HIGH',
      road_status: 'PARTIALLY_BLOCKED',
      description: 'Duplicate attempt',
      latitude: 26.1445,
      longitude: 91.7362,
    }).catch((err) => {
      assert.strictEqual(err.name, 'SequelizeUniqueConstraintError');
      return null;
    });

    assert.strictEqual(duplicate, null, 'Duplicate idempotency key must be rejected by PostgreSQL unique constraint');

    // Clean up
    await report1.destroy();
  });

  test('should mirror FieldReport into MongoDB with proper schema', async () => {
    const mongoId = `FR-MONGO-${Date.now()}`;
    const report = await MongoFieldReport.create({
      id: mongoId,
      type: 'ROAD_DAMAGE',
      iconType: 'damage',
      location: '26.1445, 91.7362 (kamrup)',
      districtId: 'kamrup',
      reportedBy: 'Test Field Officer',
      priority: 'High',
      status: 'In Progress',
      reportedOn: new Date().toLocaleString(),
      image: '/uploads/field-evidence/test.jpg',
      photos: ['/uploads/field-evidence/test.jpg'],
      description: 'Test road damage mirrored report',
      coordinates: { lat: 26.1445, lng: 91.7362 },
    });

    assert.ok(report.id);
    assert.strictEqual(report.districtId, 'kamrup');
    assert.strictEqual(report.coordinates?.lat, 26.1445);

    await report.deleteOne();
  });

  test('should clean up test officer', async () => {
    await User.destroy({ where: { id: testOfficerId } });
    const user = await User.findByPk(testOfficerId);
    assert.strictEqual(user, null);
  });
});

