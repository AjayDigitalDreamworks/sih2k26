import { Router } from 'express';
import { DriverController } from './driver.controller';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();

// Every /api/driver endpoint is strictly for authenticated DRIVER accounts.
// A driver can only ever see their own profile / vehicle / trips / history —
// identity is derived from the JWT, never from the request body.
router.use(authenticateJwt);
router.use(requireRole(['driver']));

router.get('/me', DriverController.me);
router.patch('/me', DriverController.updateMe);
router.get('/vehicle', DriverController.vehicle);
router.get('/trips/active', DriverController.activeTrip);
router.get('/trips/history', DriverController.tripHistory);
router.get('/trips/:tripId/summary', DriverController.tripSummary);
router.get('/incident-types', DriverController.incidentTypes);
router.post('/incidents', DriverController.reportIncident);
router.post('/road-reports', DriverController.reportRoadIssue);

export default router;
