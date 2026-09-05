import { Router } from 'express';
import { VehiclesController } from './vehicles.controller';
import { authenticateJwt } from '../../middleware/auth.middleware';

const router = Router();

// Authorized GPS ping (hardware / ops telemetry) — JWT required and the caller
// must be bound to the vehicle (driver own vehicle, transporter own fleet, admin).
router.post('/:id/ping', authenticateJwt, VehiclesController.pingPosition);

// Authenticated live fleet coordinates
router.get('/live', authenticateJwt, VehiclesController.getLivePositions);

export default router;
