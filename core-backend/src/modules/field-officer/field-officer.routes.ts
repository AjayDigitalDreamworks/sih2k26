import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { FieldOfficerController } from './field-officer.controller';

const router = Router();

// Ensure evidence directory exists
const EVIDENCE_DIR = path.join(__dirname, '../../../uploads/field-evidence');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

// Multer storage setup for evidence photos
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, EVIDENCE_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `evidence-${Date.now()}-${uuidv4().substring(0, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPEG, PNG, and WebP evidence photos are accepted.'));
    }
  },
});

// Guard all Field Officer routes: requires valid JWT & field officer/agent or admin role
router.use(authenticateJwt);
router.use(requireRole(['field_officer', 'field_agent', 'admin', 'district_officer']));

// Officer Profile & KPIs
router.get('/me', FieldOfficerController.getMe);
router.get('/dashboard', FieldOfficerController.getDashboardSummary);

// Field Tasks & State Machine
router.get('/tasks', FieldOfficerController.getTasks);
router.get('/tasks/:id', FieldOfficerController.getTaskById);
router.post('/tasks/:id/status', FieldOfficerController.updateTaskStatus);
router.post('/tasks/:id/verify', FieldOfficerController.verifyTask);

// Ground-Truth Field Reports
router.get('/reports', FieldOfficerController.getReports);
router.post('/reports', FieldOfficerController.createReport);

// Spatial Intelligence
router.get('/nearby-alerts', FieldOfficerController.getNearbyAlerts);

// Media Upload (supports multipart or base64 JSON payload)
router.post('/media/upload', upload.single('file'), FieldOfficerController.uploadMedia);

// Offline Queue Batch Synchronization
router.post('/sync', FieldOfficerController.syncBatch);

export default router;

