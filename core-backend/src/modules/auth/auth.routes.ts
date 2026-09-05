import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { registerSchema, loginSchema, refreshSchema } from './auth.validators';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { rateLimit } from '../../middleware/security.middleware';

const router = Router();

// Brute-force protection on credential endpoints only (120 attempts/min/IP).
// Everything else on the API is unthrottled so realtime dashboards never 429.
router.use(rateLimit(120, 60000));

// Public auth routes
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh', validate(refreshSchema), AuthController.refresh);

// Protected routes
router.post(
  '/register',
  authenticateJwt,
  requireRole(['admin']),
  validate(registerSchema),
  AuthController.register
);
router.post('/logout', authenticateJwt, AuthController.logout);
router.get('/me', authenticateJwt, AuthController.me);

export default router;
