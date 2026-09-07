import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { DriverController } from './driver.controller';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();

const DRIVER_EVIDENCE_DIR = path.join(__dirname, '../../../uploads/driver-reports');
if (!fs.existsSync(DRIVER_EVIDENCE_DIR)) {
  fs.mkdirSync(DRIVER_EVIDENCE_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DRIVER_EVIDENCE_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `driver-${Date.now()}-${uuidv4().substring(0, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPEG, PNG, WebP, and GIF photos are accepted.'));
    }
  },
});

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
router.post('/media/upload', upload.single('file'), DriverController.uploadMedia);
router.post('/incidents', upload.single('file'), DriverController.reportIncident);
router.post('/road-reports', upload.single('file'), DriverController.reportRoadIssue);

export default router;

