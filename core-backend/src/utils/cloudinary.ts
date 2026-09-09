import '../config/env';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { logger } from './logger';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const EVIDENCE_DIR = path.join(__dirname, '../../uploads/field-evidence');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function parseCloudinaryUrl(url?: string): { cloudName?: string; apiKey?: string; apiSecret?: string } | null {
  if (!url) return null;
  const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (match) {
    return {
      apiKey: match[1],
      apiSecret: match[2],
      cloudName: match[3],
    };
  }
  return null;
}

export function isCloudinaryConfigured(): boolean {
  const parsed = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || parsed?.cloudName;
  const apiKey = process.env.CLOUDINARY_API_KEY || parsed?.apiKey;
  const apiSecret = process.env.CLOUDINARY_API_SECRET || parsed?.apiSecret;
  return !!(cloudName && apiKey && apiSecret);
}

// Explicitly configure Cloudinary credentials
export function configureCloudinary(): void {
  const parsed = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME || parsed?.cloudName;
  const api_key = process.env.CLOUDINARY_API_KEY || parsed?.apiKey;
  const api_secret = process.env.CLOUDINARY_API_SECRET || parsed?.apiSecret;

  if (cloud_name && api_key && api_secret) {
    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
      secure: true,
    });
    logger.info(`[Cloudinary] ✅ Initialized Cloudinary media engine for cloud: "${cloud_name}".`);
  } else {
    logger.info('[Cloudinary] No Cloudinary keys in .env. Falling back to local static storage (/uploads).');
  }
}

configureCloudinary();

export interface MediaUploadResult {
  url: string;
  public_id?: string;
  format?: string;
  bytes?: number;
  provider: 'cloudinary' | 'local';
}

async function saveLocally(
  fileBufferOrPath: Buffer | string,
  options: { filename?: string; mimetype?: string; folder?: string } = {}
): Promise<MediaUploadResult> {
  const subFolder = options.folder ? options.folder.replace(/^raahi\//, '') : 'field-evidence';
  const targetDir = path.join(__dirname, '../../uploads', subFolder);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ext = options.mimetype ? (options.mimetype.split('/')[1] === 'jpeg' ? 'jpg' : options.mimetype.split('/')[1]) : 'jpg';
  const fname = options.filename || `evidence-${Date.now()}-${uuidv4().substring(0, 8)}.${ext}`;
  const targetPath = path.join(targetDir, fname);

  if (Buffer.isBuffer(fileBufferOrPath)) {
    fs.writeFileSync(targetPath, fileBufferOrPath);
  } else if (typeof fileBufferOrPath === 'string' && fs.existsSync(fileBufferOrPath)) {
    if (fileBufferOrPath !== targetPath) {
      fs.copyFileSync(fileBufferOrPath, targetPath);
    }
  }

  return {
    url: `/uploads/${subFolder}/${fname}`,
    public_id: fname,
    format: ext,
    bytes: Buffer.isBuffer(fileBufferOrPath) ? fileBufferOrPath.length : (fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0),
    provider: 'local',
  };
}

export async function uploadImageToCloudinary(
  fileBufferOrPath: Buffer | string,
  options: { folder?: string; filename?: string; mimetype?: string; upload_preset?: string } = {}
): Promise<MediaUploadResult> {
  const folder = options.folder || 'raahi/evidence';
  const uploadPreset = options.upload_preset || process.env.CLOUDINARY_UPLOAD_PRESET;

  // Make sure Cloudinary is configured
  if (isCloudinaryConfigured() || uploadPreset) {
    configureCloudinary();
    try {
      if (typeof fileBufferOrPath === 'string' && fs.existsSync(fileBufferOrPath)) {
        const uploadOptions: any = {
          folder,
          resource_type: 'auto',
          public_id: options.filename ? options.filename.replace(/\.[^/.]+$/, '') : undefined,
        };

        let result: UploadApiResponse;
        if (uploadPreset) {
          result = await cloudinary.uploader.unsigned_upload(fileBufferOrPath, uploadPreset, uploadOptions);
        } else {
          result = await cloudinary.uploader.upload(fileBufferOrPath, uploadOptions);
        }

        return {
          url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          bytes: result.bytes,
          provider: 'cloudinary',
        };
      } else if (Buffer.isBuffer(fileBufferOrPath)) {
        return new Promise<MediaUploadResult>((resolve, reject) => {
          const uploadOptions: any = {
            folder,
            resource_type: 'auto',
            public_id: options.filename ? options.filename.replace(/\.[^/.]+$/, '') : undefined,
          };

          const uploadCallback = (error: any, result: any) => {
            if (error || !result) {
              logger.warn(`[Cloudinary] Cloud upload error: ${error?.message || 'unknown'}. Falling back to local static storage.`);
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
          };

          const uploadStream = uploadPreset
            ? cloudinary.uploader.unsigned_upload_stream(uploadPreset, uploadOptions, uploadCallback)
            : cloudinary.uploader.upload_stream(uploadOptions, uploadCallback);

          uploadStream.end(fileBufferOrPath);
        });
      }
    } catch (err: any) {
      logger.warn(`[Cloudinary] Exception during upload (${err?.message || err}). Falling back to local static storage.`);
    }
  }

  return saveLocally(fileBufferOrPath, options);
}

export async function testCloudinaryConnection(): Promise<{ ok: boolean; message: string; details?: any }> {
  try {
    configureCloudinary();
    const pingRes = await cloudinary.api.ping();
    return { ok: true, message: 'Cloudinary API ping successful', details: pingRes };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Cloudinary connection failed', details: err };
  }
}

export default {
  isCloudinaryConfigured,
  configureCloudinary,
  uploadImageToCloudinary,
  testCloudinaryConnection,
};

