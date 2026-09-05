import { Router } from 'express';
import { Op } from 'sequelize';
import { Vehicle, Trip, District, Route, Delivery, Driver } from '../../models/postgres';
import { Alert } from '../../models/mongo';
import { sendSuccess } from '../../utils/response';
import { logger } from '../../utils/logger';

/**
 * Public overview — real, current aggregates for the pre-login branding page.
 * No auth required and NO invented numbers: every value is counted live from
 * PostgreSQL / MongoDB on each request. If the DB is unreachable the endpoint
 * returns 503 and the frontend hides the stat strip instead of faking data.
 */
const router = Router();

const LIVE_STATUSES = ['LIVE', 'MOVING', 'STOPPED', 'DELAYED', 'EMERGENCY', 'live', 'moving', 'stopped', 'delayed', 'emergency'];

router.get('/overview', async (_req, res) => {
  try {
    const [vehicles, drivers, districts, routes, liveVehicles, activeTrips, activeDeliveries, openAlerts] = await Promise.all([
      Vehicle.count(),
      Driver.count(),
      District.count(),
      Route.count(),
      Vehicle.count({ where: { live_status: { [Op.in]: LIVE_STATUSES } } }),
      Trip.count({ where: { status: { [Op.in]: ['planned', 'in_transit', 'delayed'] } } }),
      Delivery.count({ where: { status: { [Op.in]: ['pending', 'in_transit', 'delayed'] } } }),
      Alert.countDocuments({ status: { $in: ['active', 'acknowledged'] } }),
    ]);
    return sendSuccess(res, {
      vehicles,
      drivers,
      districts,
      routes,
      live_vehicles: liveVehicles,
      active_trips: activeTrips,
      active_deliveries: activeDeliveries,
      open_alerts: openAlerts,
      source: 'live-db',
      updated_at: new Date().toISOString(),
    }, 'Raahi network overview');
  } catch (err) {
    logger.error('[public] overview failed', err as Error);
    console.error('[public] overview error detail:', (err as Error)?.message, (err as Error)?.stack);
    return res.status(503).json({ success: false, message: 'Network overview unavailable' });
  }
});

export default router;
