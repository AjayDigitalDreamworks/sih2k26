import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateJwt } from '../../middleware/auth.middleware';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { sendSuccess, sendError } from '../../utils/response';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../../uploads/general');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `media-${Date.now()}-${uuidv4().substring(0, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPEG, PNG, and WebP photos are accepted.'));
    }
  },
});

router.use(authenticateJwt);

/**
 * POST /api/media/upload
 * Unified media upload endpoint for all authenticated users (driver, field_officer, admin, transporter)
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role || 'user';
    const folder = role === 'driver' ? 'raahi/driver-reports' : role.includes('field') ? 'raahi/field-officer' : 'raahi/evidence';

    if ((req as any).file) {
      const file = (req as any).file;
      const uploadRes = await uploadImageToCloudinary(file.path, {
        folder,
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
        'Media uploaded successfully'
      );
    }

    const { image, data, file: bodyFile, photo, fileName, caption } = req.body || {};
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
        folder,
        filename: fileName || `evidence-${Date.now()}`,
        mimetype: mimeType,
      });

      return sendSuccess(
        res,
        {
          file_path: uploadRes.url,
          url: uploadRes.url,
          file_name: fileName || `evidence-${Date.now()}`,
          file_size: uploadRes.bytes || buffer.length,
          mime_type: mimeType,
          caption: caption || null,
          provider: uploadRes.provider,
        },
        'Media uploaded successfully'
      );
    }

    return sendError(res, 'No media file or base64 image provided', 400);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;

