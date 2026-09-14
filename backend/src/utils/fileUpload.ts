import { Request } from 'express';
import multer from 'multer';

/**
 * File upload validation and parsing.
 *
 * Files are held in memory and uploaded programmatically to Cloudinary
 * via the storage service. No local disk or AWS S3 storage is used.
 */

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const AVATAR_MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as AllowedMimeType)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

/** Profile avatars have a smaller, image-only upload policy. */
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AVATAR_MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!AVATAR_MIME_TYPES.includes(file.mimetype as (typeof AVATAR_MIME_TYPES)[number])) {
      cb(new Error('Avatar must be a PNG, JPG, or WebP image.'));
      return;
    }
    cb(null, true);
  },
});

export function getFileExtension(mimetype: string): string {
  switch (mimetype) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}
