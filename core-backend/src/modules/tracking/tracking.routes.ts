import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { Vehicle, Driver, Delivery } from '../../models/postgres';
import { getSocketServer } from '../../sockets/socket.gateway';

/**
 * Vehicle-scoped reads must respect ownership: admin/district officer may read
 * any vehicle, a transporter only their own fleet, and a DRIVER only the exact
 * vehicle assigned to them (identity from the JWT — never from the URL alone).
 */
async function authorizeVehicleRead(user: any, vehicleId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const role = user?.role;
  if (!role) return { ok: false, status: 401, error: 'Unauthorized' };
  if (role === 'admin' || role === 'district_officer') return { ok: true };
  const vehicle = await Vehicle.findByPk(String(vehicleId));
  if (!vehicle) return { ok: false, status: 404, error: 'Vehicle not found' };
  if (role === 'transporter') {
    return vehicle.transporter_id && vehicle.transporter_id === user.transporterId
      ? { ok: true }
      : { ok: false, status: 403, error: 'Vehicle belongs to another transporter' };
  }
  if (role === 'driver') {
    const driver = await Driver.findOne({ where: { user_id: user.id } });
    return driver && driver.vehicle_id === vehicle.id
      ? { ok: true }
      : { ok: false, status: 403, error: 'Driver may only view their assigned vehicle' };
  }
  return { ok: false, status: 403, error: 'Not authorized to view this vehicle' };
}
import { validate } from '../../middleware/validate.middleware';
import { gpsPingSchema, trackingLocationSchema } from '../../middleware/validation.schemas';
import { sendSuccess, sendError } from '../../utils/response';
import { logger } from '../../utils/logger';
import { TrackingService } from './tracking.service';

const router = Router();

/**
 * POST /api/tracking/location  (authenticated)
 * Real GPS ingestion. Identity always comes from the JWT — the payload never
 * carries driver_id. Web/PWA sends source=WEB_GPS; the future Android app will
 * POST the exact same contract with source=ANDROID_GPS. Clients that were
 * offline may resend queued points with source=SYNC (batch-friendly rate gate).
 */
router.post('/location', authenticateJwt, validate(trackingLocationSchema), async (req: Request, res: Response) => {
  try {
    const result = await TrackingService.processDriverLocation(req.user as any, req.body, {
      syncBatch: (req.headers['x-tracking-sync'] as string) === '1',
    });
    if (result?.error) {
      return sendError(res, result.error, result.statusCode || 400);
    }
    return sendSuccess(res, result, 'GPS point stored and broadcast');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/**
 * POST /api/tracking/gps — legacy alias kept for existing fleet/API clients.
 * Now authenticated and routed through the same validation + PostGIS pipeline.
 */
router.post('/gps', authenticateJwt, validate(gpsPingSchema), async (req: Request, res: Response) => {
  try {
    const b = req.body as any;
    const mapped = {
      vehicle_id: b.vehicleId,
      trip_id: req.body.tripId,
      latitude: b.lat,
      longitude: b.lng,
      accuracy: b.accuracy,
      speed: b.speed,
      heading: b.heading,
      altitude: b.altitude,
      gps_timestamp: b.timestamp,
      source: b.source || 'FLEET_API',
    };
    const result = await TrackingService.processDriverLocation(req.user as any, mapped, {
      syncBatch: (req.headers['x-tracking-sync'] as string) === '1',
    });
    if (result?.error) return sendError(res, result.error, result.statusCode || 400);
    return sendSuccess(res, result, 'GPS point stored and broadcast');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** POST /api/tracking/sos — driver raises an EMERGENCY alert (real, broadcast). */
router.post('/sos', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const result = await TrackingService.sendSos(req.user as any, req.body || {});
    if (result?.error) return sendError(res, result.error, result.statusCode || 400);
    return sendSuccess(res, result, 'EMERGENCY SOS raised — admins notified');
  } catch (err: any) {
    logger.error(`SOS route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** POST /api/tracking/sos/cancel — clear an active SOS. */
router.post('/sos/cancel', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const result = await TrackingService.cancelSos(req.user as any);
    if (result?.error) return sendError(res, result.error, result.statusCode || 400);
    return sendSuccess(res, result, 'SOS cleared');
  } catch (err: any) {
    logger.error(`SOS cancel failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** GET /api/tracking/sos/all — every vehicle with an active SOS (admin/transporter dashboards). */
router.get('/sos/all', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const result = await TrackingService.getAllActiveSos(req.user as any);
    if (result?.error) return sendError(res, result.error, result.statusCode || 403);
    return sendSuccess(res, result, 'Active SOS vehicles');
  } catch (err: any) {
    logger.error(`SOS list failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** GET /api/tracking/sos/active — is this driver's vehicle in SOS right now? */
router.get('/sos/active', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const result = await TrackingService.getSosActive(req.user as any);
    return sendSuccess(res, result, 'SOS state');
  } catch (err: any) {
    logger.error(`SOS state failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** GET /api/tracking/my/context — driver home: assigned vehicle + trip. */
router.get('/my/context', authenticateJwt, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'driver') return sendError(res, 'Driver role required', 403);
    const result = await TrackingService.getDriverContext(req.user as any);
    if (result?.error) return sendError(res, result.error, result.statusCode || 404);
    return sendSuccess(res, result, 'Driver tracking context');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** GET /api/tracking/status — dashboard aggregate (real counts only). */
router.get('/status', authenticateJwt, async (_req: Request, res: Response) => {
  try {
    const result = await TrackingService.getTrackingStatusOverview();
    return sendSuccess(res, result, 'Tracking status overview');
  } catch (err: any) {
    logger.error(`Tracking route failed (${_req.method} ${_req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** GET /api/tracking/vehicles/:vehicleId/current */
router.get('/vehicles/:vehicleId/current', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const auth = await authorizeVehicleRead(req.user as any, String(req.params.vehicleId));
    if (!auth.ok) return sendError(res, auth.error, auth.status);
    const result = await TrackingService.getVehicleTrackingStatus(String(req.params.vehicleId));
    if (!result) return sendError(res, 'Vehicle not found', 404);
    return sendSuccess(res, result, 'Current vehicle tracking state');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** GET /api/tracking/vehicles/:vehicleId/history?start_time&end_time&trip_id&limit&offset */
router.get('/vehicles/:vehicleId/history', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const auth = await authorizeVehicleRead(req.user as any, String(req.params.vehicleId));
    if (!auth.ok) return sendError(res, auth.error, auth.status);
    const result = await TrackingService.getPersistedHistory(String(req.params.vehicleId), {
      startTime: req.query.start_time ? String(req.query.start_time) : undefined,
      endTime: req.query.end_time ? String(req.query.end_time) : undefined,
      tripId: req.query.trip_id ? String(req.query.trip_id) : undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : 500,
      offset: req.query.offset ? parseInt(String(req.query.offset), 10) : 0,
    });
    return sendSuccess(res, result, 'Vehicle location history (PostGIS)');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** GET /api/tracking/vehicles/:vehicleId/trip-summary?trip_id= — real GPS trip stats */
router.get('/vehicles/:vehicleId/trip-summary', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const auth = await authorizeVehicleRead(req.user as any, String(req.params.vehicleId));
    if (!auth.ok) return sendError(res, auth.error, auth.status);
    const result = await TrackingService.getTripSummary(
      String(req.params.vehicleId),
      req.query.trip_id ? String(req.query.trip_id) : undefined
    );
    if (!result) return sendError(res, 'Vehicle not found', 404);
    return sendSuccess(res, result, 'Trip summary from real GPS history');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** GET /api/tracking/vehicles/:vehicleId/status — live/current/legacy */
router.get('/:vehicleId/status', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const auth = await authorizeVehicleRead(req.user as any, String(req.params.vehicleId));
    if (!auth.ok) return sendError(res, auth.error, auth.status);
    const result = await TrackingService.getVehicleTrackingStatus(String(req.params.vehicleId));
    if (!result) return sendError(res, 'Vehicle not found', 404);
    return sendSuccess(res, result, 'Vehicle tracking status');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** GET /api/tracking/vehicles/:vehicleId/trail — recent Redis trail (map polyline) */
router.get('/:vehicleId/trail', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const auth = await authorizeVehicleRead(req.user as any, String(req.params.vehicleId));
    if (!auth.ok) return sendError(res, auth.error, auth.status);
    const limit = parseInt(String(req.query.limit || '200')) || 200;
    const trail = await TrackingService.getGpsTrail(String(req.params.vehicleId), limit);
    return sendSuccess(res, trail, 'GPS trail retrieved');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** POST /api/tracking/trips/:tripId/start — ASSIGNED → STARTED (tracking on) */
router.post('/trips/:tripId/start', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const result = await TrackingService.startTrip(req.user as any, String(req.params.tripId));
    if (result?.error) return sendError(res, result.error, result.statusCode || 400);
    return sendSuccess(res, result, 'Trip started — tracking active');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** POST /api/tracking/trips/:tripId/stop — STARTED → COMPLETED (tracking off) */
router.post('/trips/:tripId/stop', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const result = await TrackingService.stopTrip(req.user as any, String(req.params.tripId));
    if (result?.error) return sendError(res, result.error, result.statusCode || 400);
    return sendSuccess(res, result, 'Trip completed — tracking stopped');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** POST /api/tracking/simulate-step/:vehicleId — step vehicle along its route for live testing */
router.post('/simulate-step/:vehicleId', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const result = await TrackingService.simulateVehicleStep(String(req.params.vehicleId));
    if (result?.error) return sendError(res, result.error, 400);
    return sendSuccess(res, result, 'Simulated tracking step broadcast');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

// Backwards-compatible route names for the mobile contract
router.post('/vehicles/:vehicleId/trips/:tripId/start', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const result = await TrackingService.startTrip(req.user as any, String(req.params.tripId));
    if (result?.error) return sendError(res, result.error, result.statusCode || 400);
    return sendSuccess(res, result, 'Trip started');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});
router.post('/vehicles/:vehicleId/trips/:tripId/stop', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const result = await TrackingService.stopTrip(req.user as any, String(req.params.tripId));
    if (result?.error) return sendError(res, result.error, result.statusCode || 400);
    return sendSuccess(res, result, 'Trip completed');
  } catch (err: any) {
    logger.error(`Tracking route failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

/** POST /api/tracking/deliveries/:id/delivered — driver confirms delivery/pickup handover */
router.post('/deliveries/:id/delivered', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const del = await Delivery.findByPk(String(req.params.id));
    if (!del) return sendError(res, 'Consignment not found', 404);
    await del.update({
      status: 'delivered',
      delivered_at: new Date(),
      pod_url: req.body.podUrl || null,
    });
    const io = getSocketServer();
    if (io) {
      io.emit('delivery.status.updated', {
        deliveryId: del.id,
        status: 'delivered',
        tripId: del.trip_id,
        timestamp: new Date().toISOString(),
      });
    }
    return sendSuccess(res, del, 'Consignment delivery confirmed successfully');
  } catch (err: any) {
    logger.error(`Delivery confirm failed (${req.method} ${req.originalUrl})`, err);
    return sendError(res, err.message);
  }
});

export default router;
