import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { sequelize } from '../../config/db';
import { sendSuccess, sendError } from '../../utils/response';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import {
  User,
  District,
  Road,
  Bridge,
  FieldTask,
  FieldVerification,
  FieldReportPostgres,
  FieldMedia,
} from '../../models/postgres';
import {
  FieldReport as MongoFieldReport,
  Alert as MongoAlert,
  AuditLog,
} from '../../models/mongo';
import { TrackingService } from '../tracking/tracking.service';

const EVIDENCE_DIR = path.join(__dirname, '../../../uploads/field-evidence');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export class FieldOfficerController {
  /**
   * GET /api/field-officer/me
   * Get officer profile, agency, jurisdiction, and assigned district
   */
  static async getMe(req: Request, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);

      const user = await User.findByPk(req.user.id, {
        attributes: ['id', 'name', 'email', 'role', 'district_id', 'agency', 'phone', 'createdAt'],
      });

      if (!user) return sendError(res, 'User profile not found', 404);

      let district = null;
      if (user.district_id) {
        district = await District.findByPk(user.district_id, {
          attributes: ['id', 'name', 'state', 'connectivity_status', 'centroid_lat', 'centroid_lng'],
        });
      }

      return sendSuccess(
        res,
        {
          ...user.toJSON(),
          district,
        },
        'Field officer profile retrieved'
      );
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  /**
   * GET /api/field-officer/dashboard
   * Real KPIs: total assigned tasks, pending verifications, verified today, nearby alerts
   */
  static async getDashboardSummary(req: Request, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);

      const officerId = req.user.id;
      const districtId = req.user.districtId || 'kamrup';

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [assignedCount, activeCount, verifiedTodayCount, unsafeCount, myReportsCount] =
        await Promise.all([
          FieldTask.count({
            where: {
              [Op.or]: [{ assigned_officer_id: officerId }, { assigned_officer_id: null, district_id: districtId }],
            },
          }),
          FieldTask.count({
            where: {
              assigned_officer_id: officerId,
              status: { [Op.in]: ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'VERIFYING'] },
            },
          }),
          FieldTask.count({
            where: {
              assigned_officer_id: officerId,
              status: 'VERIFIED',
              updatedAt: { [Op.gte]: todayStart },
            },
          }),
          FieldTask.count({
            where: {
              assigned_officer_id: officerId,
              status: 'UNSAFE_TO_VERIFY',
            },
          }),
          FieldReportPostgres.count({
            where: { officer_id: officerId },
          }),
        ]);

      // Active unverified alerts in officer's district
      let activeAlertsCount = 0;
      try {
        activeAlertsCount = await MongoAlert.countDocuments({
          districtId,
          status: 'active',
        });
      } catch {
        activeAlertsCount = 0;
      }

      return sendSuccess(
        res,
        {
          totalAssigned: assignedCount,
          activeTasks: activeCount,
          verifiedToday: verifiedTodayCount,
          unsafeTasks: unsafeCount,
          myReportsCount,
          districtActiveAlerts: activeAlertsCount,
          timestamp: new Date().toISOString(),
        },
        'Dashboard summary retrieved'
      );
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  /**
   * GET /api/field-officer/tasks
   * List assigned verification tasks for the logged in officer
   */
  static async getTasks(req: Request, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);

      const officerId = req.user.id;
      const districtId = req.user.districtId || 'kamrup';
      const { status, priority, limit = 50, offset = 0 } = req.query;

      const where: any = {
        [Op.or]: [{ assigned_officer_id: officerId }, { assigned_officer_id: null, district_id: districtId }],
      };

      if (status && typeof status === 'string') {
        const statuses = status.split(',').map((s) => s.trim().toUpperCase());
        where.status = { [Op.in]: statuses };
      }

      if (priority && typeof priority === 'string') {
        where.priority = priority.toUpperCase();
      }

      const tasks = await FieldTask.findAll({
        where,
        include: [
          {
            model: FieldVerification,
            as: 'verification',
            required: false,
          },
          {
            model: FieldMedia,
            as: 'media',
            required: false,
            attributes: ['id', 'file_path', 'file_name', 'mime_type', 'file_size', 'caption'],
          },
        ],
        order: [
          ['priority', 'DESC'],
          ['updatedAt', 'DESC'],
        ],
        limit: Number(limit),
        offset: Number(offset),
      });

      return sendSuccess(res, tasks, `Retrieved ${tasks.length} field tasks`);
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  /**
   * GET /api/field-officer/tasks/:id
   * Get single task with full verification history and distance from officer GPS
   */
  static async getTaskById(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { lat, lng } = req.query;

      const task = await FieldTask.findByPk(id, {
        include: [
          {
            model: FieldVerification,
            as: 'verification',
            required: false,
          },
          {
            model: FieldMedia,
            as: 'media',
            required: false,
          },
          {
            model: User,
            as: 'officer',
            attributes: ['id', 'name', 'agency', 'phone'],
            required: false,
          },
        ],
      });

      if (!task) return sendError(res, 'Task not found', 404);

      let distance_meters: number | null = null;
      if (lat && lng) {
        const officerLat = parseFloat(String(lat));
        const officerLng = parseFloat(String(lng));
        if (!isNaN(officerLat) && !isNaN(officerLng)) {
          distance_meters = haversineMeters(officerLat, officerLng, task.latitude, task.longitude);
        }
      }

      return sendSuccess(
        res,
        {
          ...task.toJSON(),
          distance_meters,
        },
        'Task details retrieved'
      );
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  /**
   * POST /api/field-officer/tasks/:id/status
   * Transition task status: ACCEPTED, EN_ROUTE, ARRIVED, UNSAFE_TO_VERIFY, CLOSED
   */
  static async updateTaskStatus(req: Request, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);

      const id = String(req.params.id);
      const { status, latitude, longitude, accuracy_m, notes, unsafe_reason } = req.body;

      if (!status) return sendError(res, 'Status is required', 400);

      const validStatuses = [
        'ASSIGNED',
        'ACCEPTED',
        'EN_ROUTE',
        'ARRIVED',
        'VERIFYING',
        'VERIFIED',
        'REJECTED',
        'UNSAFE_TO_VERIFY',
        'CLOSED',
      ];
      const targetStatus = status.toUpperCase();
      if (!validStatuses.includes(targetStatus)) {
        return sendError(res, `Invalid status ${status}. Valid options: ${validStatuses.join(', ')}`, 400);
      }

      const task = await FieldTask.findByPk(id);
      if (!task) return sendError(res, 'Task not found', 404);

      // Auto-assign to requesting officer if currently unassigned
      if (!task.assigned_officer_id) {
        task.assigned_officer_id = req.user.id;
      }

      let proximityWarning = null;
      let distanceMeters: number | null = null;

      // When arriving at site, compute real PostGIS / haversine proximity
      if (targetStatus === 'ARRIVED' && latitude != null && longitude != null) {
        distanceMeters = haversineMeters(
          parseFloat(String(latitude)),
          parseFloat(String(longitude)),
          task.latitude,
          task.longitude
        );

        if (distanceMeters > 1000) {
          proximityWarning = `Officer reported arrival ${Math.round(distanceMeters)}m from incident coordinates.`;
        }
      }

      task.status = targetStatus as any;
      if (notes) {
        task.notes = task.notes ? `${task.notes}\n[${targetStatus}]: ${notes}` : `[${targetStatus}]: ${notes}`;
      }
      if (unsafe_reason) {
        task.notes = task.notes
          ? `${task.notes}\n[UNSAFE REASON]: ${unsafe_reason}`
          : `[UNSAFE REASON]: ${unsafe_reason}`;
      }
      if (proximityWarning) {
        task.notes = task.notes ? `${task.notes}\n[WARNING]: ${proximityWarning}` : `[WARNING]: ${proximityWarning}`;
      }

      await task.save();

      // Log in AuditLog
      try {
        await AuditLog.create({
          userId: req.user.id,
          action: `FIELD_TASK_STATUS_${targetStatus}`,
          entityType: 'FieldTask',
          entityId: task.id,
          meta: {
            previousStatus: task.status,
            targetStatus,
            distanceMeters,
            proximityWarning,
            latitude,
            longitude,
            accuracy_m,
          },
          timestamp: new Date(),
        });
      } catch {}

      return sendSuccess(
        res,
        {
          task,
          distance_meters: distanceMeters,
          proximity_warning: proximityWarning,
        },
        `Task status updated to ${targetStatus}`
      );
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  /**
   * POST /api/field-officer/tasks/:id/verify
   * Submit physical inspection evidence and ground-truth verification
   */
  static async verifyTask(req: Request, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);

      const id = String(req.params.id);
      const {
        verification_result,
        observed_severity = 'MEDIUM',
        road_passability = 'PASSABLE',
        safety_status = 'SAFE',
        action_recommended = 'NONE',
        observation_notes,
        unsafe_reason,
        latitude,
        longitude,
        gps_accuracy_m,
        photos = [],
      } = req.body;

      if (!verification_result) {
        return sendError(res, 'verification_result is required', 400);
      }
      if (latitude == null || longitude == null) {
        return sendError(res, 'Real latitude and longitude coordinates are required for field verification', 400);
      }

      const task = await FieldTask.findByPk(id);
      if (!task) return sendError(res, 'Task not found', 404);

      const officerId = req.user.id;
      const verificationId = `VER-${Date.now()}-${uuidv4().substring(0, 6)}`;

      // Create Verification record
      const verification = await FieldVerification.create({
        id: verificationId,
        task_id: task.id,
        officer_id: officerId,
        verification_result,
        observed_severity,
        road_passability,
        safety_status,
        action_recommended,
        observation_notes,
        unsafe_reason,
        latitude: parseFloat(String(latitude)),
        longitude: parseFloat(String(longitude)),
        gps_accuracy_m: gps_accuracy_m != null ? parseFloat(String(gps_accuracy_m)) : null,
        verified_at: new Date(),
      });

      // Link any media attachments
      if (Array.isArray(photos) && photos.length > 0) {
        for (const photo of photos) {
          if (photo.file_path) {
            await FieldMedia.create({
              id: `MED-${Date.now()}-${uuidv4().substring(0, 6)}`,
              task_id: task.id,
              verification_id: verification.id,
              file_path: photo.file_path,
              file_name: photo.file_name || path.basename(photo.file_path),
              mime_type: photo.mime_type || 'image/jpeg',
              file_size: photo.file_size || 0,
              caption: photo.caption || null,
            });
          }
        }
      }

      // Update FieldTask status
      const newStatus = verification_result === 'UNSAFE_TO_VERIFY' ? 'UNSAFE_TO_VERIFY' : 'VERIFIED';
      task.status = newStatus as any;
      task.assigned_officer_id = officerId;
      if (observation_notes) {
        task.notes = task.notes ? `${task.notes}\n[VERIFIED]: ${observation_notes}` : observation_notes;
      }
      await task.save();

      // If road is impassable or severely hazardous, update linked Alert or Road
      const isRoadImpassable =
        road_passability === 'IMPASSABLE_ALL' ||
        road_passability === 'IMPASSABLE_4W' ||
        safety_status === 'HIGH_DANGER' ||
        safety_status === 'EVACUATE';

      if (task.alert_id) {
        try {
          await MongoAlert.findOneAndUpdate(
            { id: task.alert_id },
            {
              status: isRoadImpassable ? 'active' : 'resolved',
              message: `[VERIFIED BY FIELD OFFICER] ${observation_notes || verification_result}. Passability: ${road_passability}. Safety: ${safety_status}.`,
            }
          );
        } catch {}
      } else if (isRoadImpassable) {
        // Create emergency Alert in MongoDB so transporters and drivers receive it immediately
        try {
          const newAlert = await MongoAlert.create({
            id: `ALT-VER-${Date.now()}`,
            title: `CRITICAL: ${task.title} (Field Verified)`,
            type: task.issue_type.toLowerCase(),
            severity: 'High',
            severityClass: 'high',
            districtId: task.district_id,
            location: task.location_name || `${task.latitude.toFixed(4)}, ${task.longitude.toFixed(4)}`,
            time: new Date().toLocaleTimeString(),
            message: `Ground-truth verified disruption: ${observation_notes || task.title}. Passability: ${road_passability}. Action: ${action_recommended}.`,
            channel: 'app',
            status: 'active',
          });
          TrackingService.evaluateDynamicReroutesForAlert(newAlert).catch(() => {});
        } catch {}
      }

      // Log in Mongo AuditLog
      try {
        await AuditLog.create({
          userId: officerId,
          action: 'VERIFY_FIELD_TASK',
          entityType: 'FieldTask',
          entityId: task.id,
          meta: {
            verificationId,
            verification_result,
            road_passability,
            safety_status,
            action_recommended,
            photosCount: photos.length,
          },
          timestamp: new Date(),
        });
      } catch {}

      return sendSuccess(
        res,
        {
          task,
          verification,
        },
        `Field verification submitted successfully (${verification_result})`
      );
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  /**
   * POST /api/field-officer/reports
   * Log a new ground-truth incident discovered during field patrol
   */
  static async createReport(req: Request, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);

      const {
        idempotency_key,
        issue_type,
        severity = 'MEDIUM',
        road_status = 'OPEN',
        safety_status = 'SAFE',
        immediate_action_required = false,
        recommended_actions,
        description,
        latitude,
        longitude,
        accuracy_m,
        district_id,
        photos = [],
      } = req.body;

      if (!issue_type || !description) {
        return sendError(res, 'issue_type and description are required', 400);
      }
      if (latitude == null || longitude == null) {
        return sendError(res, 'Real latitude and longitude coordinates are required', 400);
      }

      // Idempotency check: if report already exists for this idempotency key, return it cleanly
      if (idempotency_key) {
        const existingReport = await FieldReportPostgres.findOne({
          where: { idempotency_key },
        });
        if (existingReport) {
          return sendSuccess(
            res,
            { report: existingReport, deduplicated: true },
            'Report already received (idempotent)',
            200
          );
        }
      }

      const officerId = req.user.id;
      const assignedDistrict = district_id || req.user.districtId || 'kamrup';
      const reportId = `FR-${Date.now()}-${uuidv4().substring(0, 6)}`;

      // 1. Create in PostgreSQL
      const pgReport = await FieldReportPostgres.create({
        id: reportId,
        idempotency_key: idempotency_key || null,
        officer_id: officerId,
        district_id: assignedDistrict,
        issue_type,
        severity,
        road_status,
        safety_status,
        immediate_action_required: Boolean(immediate_action_required),
        recommended_actions: recommended_actions || null,
        description,
        latitude: parseFloat(String(latitude)),
        longitude: parseFloat(String(longitude)),
        accuracy_m: accuracy_m != null ? parseFloat(String(accuracy_m)) : null,
        status: 'SUBMITTED',
        source: 'FIELD_OFFICER_WEB',
      });

      // 2. Link media
      const savedMedia: any[] = [];
      if (Array.isArray(photos) && photos.length > 0) {
        for (const photo of photos) {
          if (photo.file_path) {
            const media = await FieldMedia.create({
              id: `MED-${Date.now()}-${uuidv4().substring(0, 6)}`,
              report_id: pgReport.id,
              file_path: photo.file_path,
              file_name: photo.file_name || path.basename(photo.file_path),
              mime_type: photo.mime_type || 'image/jpeg',
              file_size: photo.file_size || 0,
              caption: photo.caption || null,
            });
            savedMedia.push(media);
          }
        }
      }

      // 3. Mirror into MongoDB FieldReport for Admin & ML integration
      try {
        await MongoFieldReport.create({
          id: reportId,
          type: issue_type,
          iconType: 'damage',
          location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)} (${assignedDistrict})`,
          districtId: assignedDistrict,
          reportedBy: req.user.name || 'Field Officer',
          priority: severity === 'CRITICAL' ? 'High' : severity === 'HIGH' ? 'High' : 'Medium',
          status: 'In Progress',
          reportedOn: new Date().toLocaleString(),
          image: savedMedia[0]?.file_path || '/assets/field-reports/damage.jpg',
          photos: savedMedia.map((m) => m.file_path),
          description,
          coordinates: { lat: parseFloat(String(latitude)), lng: parseFloat(String(longitude)) },
        });
      } catch (mongoErr: any) {
        console.warn('⚠️ Could not mirror report to MongoDB:', mongoErr.message);
      }

      // 4. Also auto-create a FieldTask for tracking this verified incident
      try {
        await FieldTask.create({
          id: `FT-${Date.now()}-${uuidv4().substring(0, 4)}`,
          title: `${issue_type} Reported at ${assignedDistrict}`,
          issue_type,
          priority: severity as any,
          status: 'VERIFIED',
          district_id: assignedDistrict,
          assigned_officer_id: officerId,
          description,
          latitude: parseFloat(String(latitude)),
          longitude: parseFloat(String(longitude)),
          location_name: `${assignedDistrict} (Field Reported)`,
          notes: `Direct ground-truth report: ${description}`,
        });
      } catch {}

      // Log in Mongo AuditLog
      try {
        await AuditLog.create({
          userId: officerId,
          action: 'CREATE_FIELD_OFFICER_REPORT',
          entityType: 'FieldReport',
          entityId: pgReport.id,
          meta: {
            issue_type,
            severity,
            road_status,
            latitude,
            longitude,
          },
          timestamp: new Date(),
        });
      } catch {}

      return sendSuccess(
        res,
        {
          report: pgReport,
          media: savedMedia,
        },
        'Ground-truth field report logged successfully',
        201
      );
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  /**
   * GET /api/field-officer/reports
   * List all reports submitted by the logged in officer
   */
  static async getReports(req: Request, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);

      const officerId = req.user.id;
      const reports = await FieldReportPostgres.findAll({
        where: { officer_id: officerId },
        include: [{ model: FieldMedia, as: 'media' }],
        order: [['createdAt', 'DESC']],
        limit: 100,
      });

      return sendSuccess(res, reports, `Retrieved ${reports.length} field reports`);
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  /**
   * GET /api/field-officer/nearby-alerts
   * Spatial intelligence: active alerts, damaged roads & bridges within radius of officer GPS
   */
  static async getNearbyAlerts(req: Request, res: Response) {
    try {
      const lat = parseFloat(String(req.query.lat || '0'));
      const lng = parseFloat(String(req.query.lng || '0'));
      const radiusKm = parseFloat(String(req.query.radius_km || '25'));

      if (!lat || !lng) {
        return sendError(res, 'lat and lng parameters are required for nearby intelligence query', 400);
      }

      const radiusMeters = radiusKm * 1000;
      const results: any[] = [];

      // 1. Nearby damaged or closed bridges
      const bridges = await Bridge.findAll({
        where: {
          status: { [Op.in]: ['damaged', 'closed'] },
        },
        raw: true,
      });

      for (const b of bridges) {
        const dist = haversineMeters(lat, lng, b.lat, b.lng);
        if (dist <= radiusMeters) {
          results.push({
            id: b.id,
            title: b.name,
            type: 'BRIDGE_DAMAGE',
            severity: b.status === 'closed' ? 'CRITICAL' : 'HIGH',
            distance_km: Math.round((dist / 1000) * 10) / 10,
            latitude: b.lat,
            longitude: b.lng,
            district_id: b.district_id,
            status: b.status,
            description: `Bridge status: ${b.status}. Capacity: ${b.load_capacity_tons} tons.`,
          });
        }
      }

      // 2. Nearby damaged roads
      const roads = await Road.findAll({
        where: {
          condition: { [Op.in]: ['damaged', 'blocked'] },
        },
        raw: true,
      });

      for (const r of roads) {
        results.push({
          id: r.id,
          title: r.name,
          type: 'ROAD_DAMAGE',
          severity: r.condition === 'blocked' ? 'CRITICAL' : 'HIGH',
          district_id: r.district_id,
          condition: r.condition,
          slope_risk: r.slope_risk,
          description: `Road condition: ${r.condition}. Slope risk: ${r.slope_risk}%. Type: ${r.road_type}.`,
        });
      }

      // 3. Nearby active alerts from MongoDB
      try {
        const alerts = await MongoAlert.find({ status: 'active' }).limit(30).lean().exec();
        for (const a of alerts as any[]) {
          results.push({
            id: a.id,
            title: a.title,
            type: a.type.toUpperCase(),
            severity: a.severity.toUpperCase(),
            location: a.location,
            district_id: a.districtId,
            time: a.time,
            message: a.message,
            source: 'SYSTEM_ALERT',
          });
        }
      } catch {}

      // 4. Nearby FieldTasks
      const tasks = await FieldTask.findAll({
        where: {
          status: { [Op.in]: ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'VERIFYING'] },
        },
        raw: true,
      });

      for (const t of tasks) {
        const dist = haversineMeters(lat, lng, t.latitude, t.longitude);
        if (dist <= radiusMeters) {
          results.push({
            id: t.id,
            title: t.title,
            type: t.issue_type,
            severity: t.priority,
            distance_km: Math.round((dist / 1000) * 10) / 10,
            latitude: t.latitude,
            longitude: t.longitude,
            district_id: t.district_id,
            status: t.status,
            description: t.description,
            source: 'FIELD_TASK',
          });
        }
      }

      // Sort by distance if distance is present
      results.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));

      return sendSuccess(
        res,
        {
          count: results.length,
          radius_km: radiusKm,
          center: { lat, lng },
          hazards: results,
        },
        'Nearby spatial intelligence retrieved'
      );
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  /**
   * POST /api/field-officer/media/upload
   * Accepts multipart/form-data OR base64 JSON payload
   * Stored under /uploads/field-evidence/
   */
  static async uploadMedia(req: Request, res: Response) {
    try {
      // 1. Check if multipart file from multer
      if ((req as any).file) {
        const file = (req as any).file;
        const uploadRes = await uploadImageToCloudinary(file.path, {
          filename: file.originalname,
          mimetype: file.mimetype,
        });

        return sendSuccess(
          res,
          {
            file_path: uploadRes.url,
            url: uploadRes.url,
            file_name: file.originalname,
            file_size: uploadRes.bytes || file.size,
            mime_type: file.mimetype,
            provider: uploadRes.provider,
          },
          'Photo evidence uploaded successfully'
        );
      }

      // 2. Check if base64 data URL in body
      const { image, data, file: bodyFile, photo, fileName, caption } = req.body;
      const rawImage = image || data || bodyFile || photo;
      if (rawImage && typeof rawImage === 'string') {
        const matches = rawImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let mimeType = 'image/jpeg';
        let buffer: Buffer;

        if (matches && matches.length === 3) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(image, 'base64');
        }

        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!allowedMimes.includes(mimeType)) {
          return sendError(res, `Unsupported image type: ${mimeType}. Allowed: JPEG, PNG, WebP`, 400);
        }

        const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
        const generatedFilename = `evidence-${Date.now()}-${uuidv4().substring(0, 8)}.${ext}`;

        const uploadRes = await uploadImageToCloudinary(buffer, {
          filename: fileName || generatedFilename,
          mimetype: mimeType,
        });

        return sendSuccess(
          res,
          {
            file_path: uploadRes.url,
            url: uploadRes.url,
            file_name: fileName || generatedFilename,
            file_size: uploadRes.bytes || buffer.length,
            mime_type: mimeType,
            caption: caption || null,
            provider: uploadRes.provider,
          },
          'Photo evidence uploaded successfully'
        );
      }

      return sendError(res, 'No photo evidence file or base64 image provided', 400);
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  /**
   * POST /api/field-officer/sync
   * Offline synchronization: processes an array of queued reports, verifications, and status transitions
   */
  static async syncBatch(req: Request, res: Response) {
    try {
      if (!req.user) return sendError(res, 'Unauthorized', 401);

      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return sendError(res, 'items array is required for batch sync', 400);
      }

      const results: any[] = [];
      let processed = 0;
      let duplicates = 0;
      let failed = 0;

      for (const item of items) {
        try {
          const { type, payload, idempotency_key } = item;

          if (type === 'report') {
            // Deduplication check
            if (idempotency_key) {
              const existing = await FieldReportPostgres.findOne({ where: { idempotency_key } });
              if (existing) {
                duplicates++;
                results.push({ idempotency_key, status: 'SKIPPED_DUPLICATE', id: existing.id });
                continue;
              }
            }

            const officerId = req.user.id;
            const assignedDistrict = payload.district_id || req.user.districtId || 'kamrup';
            const reportId = `FR-${Date.now()}-${uuidv4().substring(0, 6)}`;

            const pgReport = await FieldReportPostgres.create({
              id: reportId,
              idempotency_key: idempotency_key || null,
              officer_id: officerId,
              district_id: assignedDistrict,
              issue_type: payload.issue_type || 'ROAD_DAMAGE',
              severity: payload.severity || 'MEDIUM',
              road_status: payload.road_status || 'OPEN',
              safety_status: payload.safety_status || 'SAFE',
              immediate_action_required: Boolean(payload.immediate_action_required),
              recommended_actions: payload.recommended_actions || null,
              description: payload.description || 'Offline synced report',
              latitude: parseFloat(String(payload.latitude)),
              longitude: parseFloat(String(payload.longitude)),
              accuracy_m: payload.accuracy_m != null ? parseFloat(String(payload.accuracy_m)) : null,
              status: 'SUBMITTED',
              source: 'FIELD_OFFICER_WEB',
            });

            // Mirror to Mongo
            try {
              await MongoFieldReport.create({
                id: reportId,
                type: payload.issue_type,
                iconType: 'damage',
                location: `${payload.latitude}, ${payload.longitude}`,
                districtId: assignedDistrict,
                reportedBy: req.user.name || 'Field Officer',
                priority: payload.severity === 'CRITICAL' ? 'High' : 'Medium',
                status: 'Pending',
                reportedOn: new Date().toLocaleString(),
                image: '/assets/field-reports/damage.jpg',
                description: payload.description,
                coordinates: { lat: payload.latitude, lng: payload.longitude },
              });
            } catch {}

            processed++;
            results.push({ idempotency_key, status: 'SYNCED', id: pgReport.id });
          } else if (type === 'verification') {
            const { task_id } = payload;
            const task = await FieldTask.findByPk(task_id);
            if (!task) {
              failed++;
              results.push({ idempotency_key, status: 'TASK_NOT_FOUND' });
              continue;
            }

            const verificationId = `VER-${Date.now()}-${uuidv4().substring(0, 6)}`;
            await FieldVerification.create({
              id: verificationId,
              task_id: task.id,
              officer_id: req.user.id,
              verification_result: payload.verification_result || 'CONFIRMED',
              observed_severity: payload.observed_severity || 'MEDIUM',
              road_passability: payload.road_passability || 'PASSABLE',
              safety_status: payload.safety_status || 'SAFE',
              action_recommended: payload.action_recommended || 'NONE',
              observation_notes: payload.observation_notes || null,
              unsafe_reason: payload.unsafe_reason || null,
              latitude: parseFloat(String(payload.latitude)),
              longitude: parseFloat(String(payload.longitude)),
              gps_accuracy_m: payload.gps_accuracy_m != null ? parseFloat(String(payload.gps_accuracy_m)) : null,
              verified_at: new Date(),
            });

            task.status = payload.verification_result === 'UNSAFE_TO_VERIFY' ? 'UNSAFE_TO_VERIFY' : 'VERIFIED';
            await task.save();

            processed++;
            results.push({ idempotency_key, status: 'SYNCED', id: verificationId });
          } else if (type === 'status_update') {
            const { task_id, status } = payload;
            const task = await FieldTask.findByPk(task_id);
            if (task) {
              task.status = status;
              await task.save();
              processed++;
              results.push({ idempotency_key, status: 'SYNCED', id: task.id });
            } else {
              failed++;
              results.push({ idempotency_key, status: 'TASK_NOT_FOUND' });
            }
          }
        } catch (itemErr: any) {
          failed++;
          results.push({ status: 'FAILED', error: itemErr.message });
        }
      }

      return sendSuccess(
        res,
        {
          total: items.length,
          processed,
          duplicates,
          failed,
          results,
        },
        `Batch sync completed: ${processed} synced, ${duplicates} duplicates skipped, ${failed} failed`
      );
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }
}
