import { UploadApiResponse } from 'cloudinary';
import type { Express } from 'express';
import { cloudinary } from '../config/cloudinary';
import { getFileExtension } from '../utils/fileUpload';

/**
 * Cloudinary storage service.
 *
 * Replaces the previous local/AWS S3 storage implementation. Files are
 * uploaded programmatically to Cloudinary, organized into project
 * folders, and only the returned secure_url and public_id are persisted
 * in PostgreSQL.
 */

export const CLOUDINARY_ROOT_FOLDER = 'api-marketplace';

export const CLOUDINARY_FOLDERS = {
  AVATARS: `${CLOUDINARY_ROOT_FOLDER}/avatars`,
  CATEGORY_ICONS: `${CLOUDINARY_ROOT_FOLDER}/category-icons`,
  API_LOGOS: `${CLOUDINARY_ROOT_FOLDER}/api-logos`,
  INVOICES: `${CLOUDINARY_ROOT_FOLDER}/invoices`,
} as const;

export type CloudinaryFolder = (typeof CLOUDINARY_FOLDERS)[keyof typeof CLOUDINARY_FOLDERS];

export interface StoredAsset {
  secure_url: string;
  public_id: string;
}

export interface UploadOptions {
  folder: CloudinaryFolder;
  resourceType?: 'image' | 'raw' | 'auto';
  publicId?: string;
}

/**
 * Uploads a file buffer to Cloudinary and returns the asset reference
 * (secure_url + public_id) to be stored in PostgreSQL.
 */
export async function uploadFile(
  file: Express.Multer.File,
  options: UploadOptions,
): Promise<StoredAsset> {
  if (!file.buffer || file.buffer.length === 0) {
    throw new Error('Cannot upload an empty file.');
  }

  const extension = getFileExtension(file.mimetype);
  const fileName = file.originalname.replace(/\.[^.]+$/, '') || `file-${Date.now()}`;
  const publicId = options.publicId ?? `${Date.now()}-${fileName}.${extension}`;

  const result: UploadApiResponse = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: publicId,
        resource_type: options.resourceType ?? 'auto',
        overwrite: true,
      },
      (error, uploadResult) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(uploadResult as UploadApiResponse);
      },
    );

    stream.end(file.buffer);
  });

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
  };
}

/**
 * Deletes an asset from Cloudinary by its public_id.
 */
export async function deleteFile(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}