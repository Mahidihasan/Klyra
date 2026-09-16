import { pool } from '../../services/database.service';
import { generateRandomToken, sha256 } from '../auth/jwt.util';
import { ApiKeyServiceError, ApiKeySummary, CreatedApiKey, CreateApiKeyInput } from './api-keys.types';

const KEY_PREFIX = 'kly_';
const DISPLAY_PREFIX_LENGTH = 10;

function toSummary(row: Record<string, any>): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    status: row.status,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  };
}

function validateName(input: CreateApiKeyInput): string {
  if (typeof input.name !== 'string') {
    throw new ApiKeyServiceError('API key name is required.', 400);
  }
  const name = input.name.trim();
  if (!name || name.length > 100) {
    throw new ApiKeyServiceError('API key name must be between 1 and 100 characters.', 400);
  }
  return name;
}

export class ApiKeysService {
  static async list(userId: string): Promise<ApiKeySummary[]> {
    const result = await pool.query(
      `SELECT id, name, key_prefix, status, is_active, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(toSummary);
  }

  static async create(userId: string, input: CreateApiKeyInput): Promise<CreatedApiKey> {
    const name = validateName(input);

    // A unique hash constraint handles the astronomically unlikely collision.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const secret = `${KEY_PREFIX}${generateRandomToken(32)}`;
      const keyHash = sha256(secret);
      const keyPrefix = secret.slice(0, DISPLAY_PREFIX_LENGTH);
      try {
        const result = await pool.query(
          `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, key_prefix, status, is_active, created_at, last_used_at, revoked_at`,
          [userId, name, keyHash, keyPrefix],
        );
        const apiKey = toSummary(result.rows[0]);
        await pool.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
           VALUES ($1, 'CREATE', 'api_keys', $2, $3::jsonb)`,
          [userId, apiKey.id, JSON.stringify({ name: apiKey.name, key_prefix: apiKey.keyPrefix })],
        );
        return { apiKey, secret };
      } catch (error: any) {
        if (error?.code === '23505' && attempt < 2) continue;
        throw error;
      }
    }
    throw new ApiKeyServiceError('Unable to generate a unique API key. Please try again.', 500);
  }

  static async revoke(userId: string, keyId: string): Promise<ApiKeySummary> {
    const result = await pool.query(
      `UPDATE api_keys
       SET status = 'REVOKED', is_active = FALSE, revoked_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status <> 'REVOKED'
       RETURNING id, name, key_prefix, status, is_active, created_at, last_used_at, revoked_at`,
      [keyId, userId],
    );
    if (result.rows[0]) {
      const apiKey = toSummary(result.rows[0]);
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'UPDATE', 'api_keys', $2, '{"action":"revoked"}'::jsonb)`,
        [userId, apiKey.id],
      );
      return apiKey;
    }

    const owned = await pool.query('SELECT status FROM api_keys WHERE id = $1 AND user_id = $2', [keyId, userId]);
    if (!owned.rows[0]) throw new ApiKeyServiceError('API key not found.', 404);
    throw new ApiKeyServiceError('This API key has already been revoked.', 400);
  }
}
