import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary configuration.
 *
 * Credentials are read from the main environment configuration only
 * (e.g. .env, .env.development, .env.production). Test-specific
 * environment files are intentionally not loaded here.
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };
