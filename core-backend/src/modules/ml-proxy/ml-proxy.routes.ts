import { Router } from 'express';
import { MLProxyController } from './ml-proxy.controller';
import { authenticateJwt } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticateJwt);

router.post('/route-score', MLProxyController.getRouteScore);
router.post('/disruption-predict', MLProxyController.getDisruptionPrediction);
router.post('/route-suggest', MLProxyController.suggestRoute);
router.post('/routes/plan', MLProxyController.planRoute);
router.post('/routes/reroute-vehicle', MLProxyController.rerouteVehicle);
router.get('/simulation/presets', MLProxyController.getSimulationPresets);
router.post('/simulation/run', MLProxyController.runSimulation);

export default router;

