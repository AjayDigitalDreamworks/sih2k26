import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { logger } from './logger';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const EVIDENCE_DIR = path.join(__dirname, '../../uploads/field-evidence');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET)
  );
}

if (isCloudinaryConfigured()) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloudinary_url: process.env.CLOUDINARY_URL,
    });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  logger.info('[Cloudinary] ✅ Initialized Cloudinary media engine.');
} else {
  logger.info('[Cloudinary] No Cloudinary keys in .env. Falling back to local static storage (/uploads).');
}

export interface MediaUploadResult {
  url: string;
  public_id?: string;
  format?: string;
  bytes?: number;
  provider: 'cloudinary' | 'local';
}

async function saveLocally(
  fileBufferOrPath: Buffer | string,
  options: { filename?: string; mimetype?: string } = {}
): Promise<MediaUploadResult> {
  const ext = options.mimetype ? (options.mimetype.split('/')[1] === 'jpeg' ? 'jpg' : options.mimetype.split('/')[1]) : 'jpg';
  const fname = options.filename || `evidence-${Date.now()}-${uuidv4().substring(0, 8)}.${ext}`;
  const targetPath = path.join(EVIDENCE_DIR, fname);

  if (Buffer.isBuffer(fileBufferOrPath)) {
    fs.writeFileSync(targetPath, fileBufferOrPath);
  } else if (typeof fileBufferOrPath === 'string' && fs.existsSync(fileBufferOrPath)) {
    if (fileBufferOrPath !== targetPath) {
      fs.copyFileSync(fileBufferOrPath, targetPath);
    }
  }

  return {
    url: `/uploads/field-evidence/${fname}`,
    public_id: fname,
    format: ext,
    bytes: Buffer.isBuffer(fileBufferOrPath) ? fileBufferOrPath.length : 0,
    provider: 'local',
  };
}

export async function uploadImageToCloudinary(
  fileBufferOrPath: Buffer | string,
  options: { folder?: string; filename?: string; mimetype?: string } = {}
): Promise<MediaUploadResult> {
  const folder = options.folder || 'raahi/evidence';

  if (isCloudinaryConfigured()) {
    try {
      if (typeof fileBufferOrPath === 'string' && fs.existsSync(fileBufferOrPath)) {
        const result: UploadApiResponse = await cloudinary.uploader.upload(fileBufferOrPath, {
          folder,
          resource_type: 'auto',
          public_id: options.filename ? options.filename.replace(/\.[^/.]+$/, '') : undefined,
        });
        return {
          url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          bytes: result.bytes,
          provider: 'cloudinary',
        };
      } else if (Buffer.isBuffer(fileBufferOrPath)) {
        return new Promise<MediaUploadResult>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder,
              resource_type: 'auto',
              public_id: options.filename ? options.filename.replace(/\.[^/.]+$/, '') : undefined,
            },
            (error, result) => {
              if (error || !result) {
                logger.warn(`[Cloudinary] Cloud upload error, falling back to local: ${error?.message || 'unknown'}`);
                saveLocally(fileBufferOrPath, options).then(resolve).catch(reject);
              } else {
                resolve({
                  url: result.secure_url,
                  public_id: result.public_id,
                  format: result.format,
                  bytes: result.bytes,
                  provider: 'cloudinary',
                });
              }
            }
          );
          uploadStream.end(fileBufferOrPath);
        });
      }
    } catch (err: any) {
      logger.warn(`[Cloudinary] Exception during upload, saving locally: ${err?.message || err}`);
    }
  }

  return saveLocally(fileBufferOrPath, options);
}

export default {
  isCloudinaryConfigured,
  uploadImageToCloudinary,
};
