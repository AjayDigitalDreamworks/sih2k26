import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { User, Vehicle, Driver, Trip } from '../../models/postgres';
import { FieldReport, Alert } from '../../models/mongo';
import { sendSuccess, sendError } from '../../utils/response';
import { notifyRiskRecalculation } from '../../utils/mlRiskTrigger';
import { TrackingService } from '../tracking/tracking.service';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { getSocketServer } from '../../sockets/socket.gateway';

// Incident types a driver can raise from the road (maps to FieldReport.type).
const INCIDENT_TYPES = [
  'Road Block', 'Accident', 'Flood', 'Landslide', 'Vehicle Breakdown',
  'Heavy Traffic', 'Road Damage', 'Pothole', 'Flooded Road', 'Debris',
  'Other',
];

function sanitizeUser(user: User) {
  const json = user.toJSON();
  delete (json as any).password_hash;
  return json;
}

function isPlausibleCoord(v: any) {
  return typeof v === 'number' && Number.isFinite(v);
}

export class DriverController {
  // GET /api/driver/me — own profile + fleet identity (never any other driver).
  static async me(req: Request, res: Response) {
    try {
      const user = await User.findByPk(String(req.user?.id));
      if (!user) return sendError(res, 'Account not found', 404);
      const driver = await Driver.findOne({ where: { user_id: user.id } });

      let vehicle: Vehicle | null = null;
      let trip: Trip | null = null;
      if (driver) {
        if (driver.vehicle_id) vehicle = await Vehicle.findByPk(driver.vehicle_id);
        if (!vehicle) {
          vehicle = await Vehicle.findOne({ where: { assigned_driver_id: driver.id } });
          if (vehicle) {
            await driver.update({ vehicle_id: vehicle.id });
          }
        }
        if (vehicle?.current_trip_id) {
          trip = await Trip.findByPk(vehicle.current_trip_id);
        }
        if (!trip) {
          trip = await Trip.findOne({
            where: { driver_id: driver.id, status: { [Op.in]: ['planned', 'in_transit'] } },
            order: [['createdAt', 'DESC']],
          });
        }
      }

      const vehicleSafe = vehicle ? {
        id: vehicle.id, model: vehicle.model, type: vehicle.type,
        capacity_kg: vehicle.capacity_kg, status: vehicle.status,
        current_route: vehicle.current_route || null, live_status: vehicle.live_status || null,
        last_gps_at: vehicle.last_gps_at || null,
      } : null;
      const tripSafe = trip ? {
        id: trip.id, vehicle_id: trip.vehicle_id, route_id: trip.route_id,
        origin: trip.origin, destination: trip.destination, status: trip.status,
        eta: trip.eta || null, started_at: trip.started_at || null,
        actual_arrival_at: trip.actual_arrival_at || null,
      } : null;

      return sendSuccess(res, {
        user: sanitizeUser(user),
        driver: driver ? { id: driver.id, name: driver.name, phone: driver.phone, rating: driver.rating, status: driver.status } : null,
        vehicle: vehicleSafe,
        trip: tripSafe,
      }, 'Driver profile');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // GET /api/driver/vehicle — the driver's own assigned vehicle only.
  static async vehicle(req: Request, res: Response) {
    try {
      const driver = await Driver.findOne({ where: { user_id: String(req.user?.id) } });
      if (!driver) return sendError(res, 'No driver profile linked to this account', 404);
      let vehicle: Vehicle | null = null;
      if (driver.vehicle_id) {
        vehicle = await Vehicle.findByPk(driver.vehicle_id);
      }
      if (!vehicle) {
        vehicle = await Vehicle.findOne({ where: { assigned_driver_id: driver.id } });
        if (vehicle) {
          await driver.update({ vehicle_id: vehicle.id });
        }
      }
      if (!vehicle) return sendSuccess(res, null, 'No vehicle assigned yet');
      return sendSuccess(res, {
        id: vehicle.id, model: vehicle.model, type: vehicle.type,
        capacity_kg: vehicle.capacity_kg, status: vehicle.status,
        current_route: vehicle.current_route || null,
      }, 'Assigned vehicle');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // GET /api/driver/trips/active — current/planned trip (authorized driver only).
  static async activeTrip(req: Request, res: Response) {
    try {
      const driver = await Driver.findOne({ where: { user_id: String(req.user?.id) } });
      if (!driver) return sendError(res, 'No driver profile linked to this account', 404);
      const trip = await Trip.findOne({
        where: { driver_id: driver.id, status: { [Op.in]: ['planned', 'in_transit'] } },
        order: [['createdAt', 'DESC']],
      });
      return sendSuccess(res, trip || null, 'Active trip');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // GET /api/driver/trips/history — completed/canceled trips of THIS driver only.
  static async tripHistory(req: Request, res: Response) {
    try {
      const driver = await Driver.findOne({ where: { user_id: String(req.user?.id) } });
      if (!driver) return sendError(res, 'No driver profile linked to this account', 404);
      const trips = await Trip.findAll({
        where: { driver_id: driver.id, status: { [Op.in]: ['completed', 'canceled'] } },
        order: [['createdAt', 'DESC']],
        limit: 50,
        include: [{ model: Vehicle, as: 'vehicle', attributes: ['id', 'model', 'type'] }],
      });
      const rows = trips.map((t) => {
        const assoc = (t as any).vehicle as Vehicle | null;
        return {
          id: t.id, route_id: t.route_id, vehicle_id: t.vehicle_id,
          origin: t.origin, destination: t.destination, status: t.status,
          started_at: t.started_at || null, actual_arrival_at: t.actual_arrival_at || null,
          progress_percent: t.progress_percent,
          vehicle: assoc ? { id: assoc.id, model: assoc.model } : null,
        };
      });
      return sendSuccess(res, rows, 'Trip history');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // GET /api/driver/trips/:tripId/summary — real stats from persisted GPS (own trip only).
  static async tripSummary(req: Request, res: Response) {
    try {
      const driver = await Driver.findOne({ where: { user_id: String(req.user?.id) } });
      if (!driver) return sendError(res, 'No driver profile linked to this account', 404);
      const trip = await Trip.findByPk(String(req.params.tripId));
      if (!trip) return sendError(res, 'Trip not found', 404);
      if (trip.driver_id !== driver.id) return sendError(res, 'Trip does not belong to you', 403);
      const summary = await TrackingService.getTripSummary(trip.vehicle_id, trip.id);
      if (!summary) return sendError(res, 'Vehicle not found', 404);
      return sendSuccess(res, summary, 'Trip summary from real GPS history');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // POST /api/driver/media/upload — upload photo evidence for reports
  static async uploadMedia(req: Request, res: Response) {
    try {
      if ((req as any).file) {
        const file = (req as any).file;
        const uploadRes = await uploadImageToCloudinary(file.path, {
          folder: 'raahi/driver-reports',
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
          'Driver photo evidence uploaded successfully'
        );
      }

      const { image, data, file: bodyFile, photo, fileName } = req.body || {};
      const rawImage = image || data || bodyFile || photo;
      if (rawImage && typeof rawImage === 'string') {
        const matches = rawImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let mimeType = 'image/jpeg';
        let buffer: Buffer;

        if (matches && matches.length === 3) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          buffer = Buffer.from(rawImage, 'base64');
        }

        const uploadRes = await uploadImageToCloudinary(buffer, {
          folder: 'raahi/driver-reports',
          filename: fileName || `driver-evidence-${Date.now()}`,
          mimetype: mimeType,
        });

        return sendSuccess(
          res,
          {
            file_path: uploadRes.url,
            url: uploadRes.url,
            file_name: fileName || `driver-evidence-${Date.now()}`,
            file_size: uploadRes.bytes || buffer.length,
            mime_type: mimeType,
            provider: uploadRes.provider,
          },
          'Driver photo evidence uploaded successfully'
        );
      }

      return sendError(res, 'No photo file or base64 image provided', 400);
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }

  // POST /api/driver/incidents — driver road/incident report (real FieldReport).
  static async reportIncident(req: Request, res: Response) {
    try {
      const driver = await Driver.findOne({ where: { user_id: String(req.user?.id) } });
      if (!driver) return sendError(res, 'No driver profile linked to this account', 404);
      const { type, description, districtId, priority, location, coordinates, image, photos } = req.body || {};

      let imageUrl = String(image || '').trim();

      // 1. Multipart file upload priority
      if ((req as any).file) {
        const file = (req as any).file;
        const uploadRes = await uploadImageToCloudinary(file.path, {
          folder: 'raahi/driver-reports',
          filename: file.originalname,
          mimetype: file.mimetype,
        });
        imageUrl = uploadRes.url;
      } else if (imageUrl && imageUrl.startsWith('data:image/')) {
        const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const uploadRes = await uploadImageToCloudinary(buffer, {
            folder: 'raahi/driver-reports',
            filename: `driver-incident-${Date.now()}`,
            mimetype: mimeType,
          });
          imageUrl = uploadRes.url;
        }
      }

      // Upload any additional photos in array
      const finalPhotos: string[] = imageUrl ? [imageUrl] : [];
      if (Array.isArray(photos)) {
        for (const p of photos) {
          if (typeof p === 'string' && p.startsWith('data:image/')) {
            const matches = p.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const mimeType = matches[1];
              const buffer = Buffer.from(matches[2], 'base64');
              const uploadRes = await uploadImageToCloudinary(buffer, {
                folder: 'raahi/driver-reports',
                filename: `driver-photo-${Date.now()}`,
                mimetype: mimeType,
              });
              finalPhotos.push(uploadRes.url);
            }
          } else if (typeof p === 'string' && p.trim() && !finalPhotos.includes(p.trim())) {
            finalPhotos.push(p.trim());
          }
        }
      }

      let lat: number | null = null;
      let lng: number | null = null;
      if (coordinates && isPlausibleCoord(coordinates.lat) && isPlausibleCoord(coordinates.lng)) {
        lat = Number(coordinates.lat);
        lng = Number(coordinates.lng);
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { lat = null; lng = null; }
      }
      const coordsText = lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : null;
      const locLabel = String(location || '').trim()
        || (coordsText ? `GPS ${coordsText}` : 'Position unknown — no GPS fix at report time');

      const report = await FieldReport.create({
        id: `FR-${Date.now().toString().slice(-6)}`,
        type: String(type || 'Other').trim() || 'Other',
        iconType: 'damage',
        location: locLabel,
        districtId: String(districtId || 'kamrup').trim(),
        reportedBy: driver.name || String(req.user?.name || 'Driver on Route'),
        priority: ['High', 'Medium', 'Low', 'Informational'].includes(priority) ? priority : 'Medium',
        status: 'Pending',
        reportedOn: new Date().toLocaleString(),
        image: imageUrl,
        photos: imageUrl ? [imageUrl] : (Array.isArray(photos) ? photos : []),
        description: String(description || '').trim() || 'No additional details provided.',
        coordinates: lat != null && lng != null ? { lat, lng } : undefined,
      });

      // Auto-generate system Alert for critical road disruptions
      if (['Road Block', 'Accident', 'Flood', 'Landslide', 'Flooded Road'].includes(report.type) || report.priority === 'High') {
        try {
          const autoAlert = await Alert.create({
            id: `ALT-DRV-${Date.now().toString().slice(-6)}`,
            title: `CRITICAL ROAD ISSUE: ${report.type} (Reported by Driver)`,
            type: report.type.toLowerCase().replace(/\s+/g, '_'),
            severity: 'High',
            severityClass: 'high',
            districtId: report.districtId,
            location: report.location,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            message: `${report.description} (${report.location})`,
            channel: 'driver',
            status: 'active',
          });

          const io = getSocketServer();
          if (io) {
            io.to('admin:all').emit('alert.created', autoAlert);
            io.to('admin:all').emit('alert:broadcast', autoAlert);
          }
          TrackingService.evaluateDynamicReroutesForAlert(autoAlert).catch(() => {});
        } catch (alertErr) {
          console.warn('[DRIVER-REPORT] Auto alert creation notice:', alertErr);
        }
      }

      notifyRiskRecalculation(`field report created: ${report.id}`);
      return sendSuccess(res, report, 'Incident reported to the regional command center', 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // POST /api/driver/road-reports — road-condition report from the driver's GPS.
  static async reportRoadIssue(req: Request, res: Response) {
    try {
      const driver = await Driver.findOne({ where: { user_id: String(req.user?.id) } });
      if (!driver) return sendError(res, 'No driver profile linked to this account', 404);
      const { issue, description, districtId, coordinates, image, photos } = req.body || {};
      const type = String(issue || 'Road Damage').trim();
      const accepted = ['Pothole', 'Road Damage', 'Flooded Road', 'Debris', 'Landslide', 'Blocked Road'];
      const finalType = accepted.includes(type) ? type : 'Road Damage';

      let imageUrl = String(image || '').trim();

      // 1. Multipart file upload priority
      if ((req as any).file) {
        const file = (req as any).file;
        const uploadRes = await uploadImageToCloudinary(file.path, {
          folder: 'raahi/driver-reports',
          filename: file.originalname,
          mimetype: file.mimetype,
        });
        imageUrl = uploadRes.url;
      } else if (imageUrl && imageUrl.startsWith('data:image/')) {
        const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const uploadRes = await uploadImageToCloudinary(buffer, {
            folder: 'raahi/driver-reports',
            filename: `driver-road-${Date.now()}`,
            mimetype: mimeType,
          });
          imageUrl = uploadRes.url;
        }
      }

      // Upload any additional photos in array
      const finalPhotos: string[] = imageUrl ? [imageUrl] : [];
      if (Array.isArray(photos)) {
        for (const p of photos) {
          if (typeof p === 'string' && p.startsWith('data:image/')) {
            const matches = p.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const mimeType = matches[1];
              const buffer = Buffer.from(matches[2], 'base64');
              const uploadRes = await uploadImageToCloudinary(buffer, {
                folder: 'raahi/driver-reports',
                filename: `driver-road-photo-${Date.now()}`,
                mimetype: mimeType,
              });
              finalPhotos.push(uploadRes.url);
            }
          } else if (typeof p === 'string' && p.trim() && !finalPhotos.includes(p.trim())) {
            finalPhotos.push(p.trim());
          }
        }
      }

      let lat: number | null = null;
      let lng: number | null = null;
      if (coordinates && isPlausibleCoord(coordinates.lat) && isPlausibleCoord(coordinates.lng)) {
        lat = Number(coordinates.lat);
        lng = Number(coordinates.lng);
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { lat = null; lng = null; }
      }
      const coordsText = lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : null;

      const report = await FieldReport.create({
        id: `FR-${Date.now().toString().slice(-6)}`,
        type: finalType,
        iconType: 'damage',
        location: coordsText ? `GPS ${coordsText}` : 'Position unknown — no GPS fix at report time',
        districtId: String(districtId || 'kamrup').trim(),
        reportedBy: driver.name || String(req.user?.name || 'Driver on Route'),
        priority: 'Medium',
        status: 'Pending',
        reportedOn: new Date().toLocaleString(),
        image: imageUrl,
        photos: finalPhotos,
        description: String(description || '').trim() || `${finalType} reported by driver.`,
        coordinates: lat != null && lng != null ? { lat, lng } : undefined,
      });

      // Auto-generate system Alert if road is blocked or landslide observed
      if (['Blocked Road', 'Landslide', 'Flooded Road'].includes(finalType)) {
        try {
          const autoAlert = await Alert.create({
            id: `ALT-RD-${Date.now().toString().slice(-6)}`,
            title: `ROAD DISRUPTION: ${finalType} (Driver Report)`,
            type: finalType.toLowerCase().replace(/\s+/g, '_'),
            severity: 'High',
            severityClass: 'high',
            districtId: report.districtId,
            location: report.location,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            message: `${report.description} (${report.location})`,
            channel: 'driver',
            status: 'active',
          });

          const io = getSocketServer();
          if (io) {
            io.to('admin:all').emit('alert.created', autoAlert);
            io.to('admin:all').emit('alert:broadcast', autoAlert);
          }
          TrackingService.evaluateDynamicReroutesForAlert(autoAlert).catch(() => {});
        } catch (alertErr) {
          console.warn('[DRIVER-ROAD] Auto alert creation notice:', alertErr);
        }
      }

      notifyRiskRecalculation(`road report created: ${report.id}`);
      return sendSuccess(res, report, 'Road issue reported for the GIS damage pipeline', 201);
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // PATCH /api/driver/me — driver edits ONLY their own name/phone.
  static async updateMe(req: Request, res: Response) {
    try {
      const user = await User.findByPk(String(req.user?.id));
      if (!user) return sendError(res, 'Account not found', 404);
      const { name, phone } = req.body || {};
      if (name !== undefined && String(name).trim()) user.name = String(name).trim();
      if (phone !== undefined) user.phone = phone ? String(phone).trim() : null;
      await user.save();

      const driver = await Driver.findOne({ where: { user_id: user.id } });
      if (driver) {
        await driver.update({
          name: user.name,
          phone: user.phone ?? null,
        });
      }
      const fresh = await User.findByPk(user.id);
      return sendSuccess(res, {
        user: sanitizeUser(fresh!),
        driver: driver ? { id: driver.id, name: driver.name, phone: driver.phone, rating: driver.rating, status: driver.status } : null,
      }, 'Profile updated');
    } catch (err: any) {
      return sendError(res, err.message);
    }
  }

  // Expose allowed incident types for the form (static metadata, not data).
  static incidentTypes(_req: Request, res: Response) {
    return sendSuccess(res, INCIDENT_TYPES, 'Allowed driver incident types');
  }
}
