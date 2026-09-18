import {
  ApiKeyStats,
  ApiKeySummary,
  ApiKeyTarget,
  CreateApiKeyPayload,
  RateLimitPeriod,
  UpdateApiKeyPayload,
} from '../../types/apiKeys';
import { authenticatedRequest } from './auth';

const BASE_PATH = '/profile/api-keys';

/** Thrown for any API Keys request failure; `message` is user-presentable. */
export class ApiKeysApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiKeysApiError';
  }
}

async function request<T>(operation: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const detail = error instanceof Error ? error.message : '';
    throw new ApiKeysApiError(`Unable to ${operation}. ${detail}`.trim(), (error as { status?: number })?.status);
  }
}

/** Consumer API-key management — the Workspace → API Keys surface. */
export const apiKeysApi = {
  list: () =>
    request('load your API keys', () =>
      authenticatedRequest<{ apiKeys: ApiKeySummary[]; stats: ApiKeyStats }>(BASE_PATH)),

  /** APIs (subscribed + owned) and API Build projects available as key targets. */
  listTargets: () =>
    request('load your APIs', () =>
      authenticatedRequest<{ targets: ApiKeyTarget[] }>(`${BASE_PATH}/targets`)),

  create: (payload: CreateApiKeyPayload) =>
    request('create the API key', () =>
      authenticatedRequest<{ apiKey: ApiKeySummary; secret: string; message: string }>(BASE_PATH, {
        method: 'POST',
        body: JSON.stringify(payload),
      })),

  update: (keyId: string, payload: UpdateApiKeyPayload) =>
    request('update the API key', () =>
      authenticatedRequest<{ apiKey: ApiKeySummary; message: string }>(`${BASE_PATH}/${keyId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })),

  revoke: (keyId: string) =>
    request('revoke the API key', () =>
      authenticatedRequest<{ apiKey: ApiKeySummary; message: string }>(`${BASE_PATH}/${keyId}/revoke`, { method: 'POST' })),

  suspend: (keyId: string) =>
    request('suspend the API key', () =>
      authenticatedRequest<{ apiKey: ApiKeySummary; message: string }>(`${BASE_PATH}/${keyId}/suspend`, { method: 'POST' })),

  activate: (keyId: string) =>
    request('reactivate the API key', () =>
      authenticatedRequest<{ apiKey: ApiKeySummary; message: string }>(`${BASE_PATH}/${keyId}/activate`, { method: 'POST' })),

  delete: (keyId: string) =>
    request('delete the API key', () =>
      authenticatedRequest<{ deleted: { id: string; name: string }; message: string }>(`${BASE_PATH}/${keyId}`, { method: 'DELETE' })),
};

export const RATE_LIMIT_PERIOD_OPTIONS: { value: RateLimitPeriod; label: string }[] = [
  { value: 'SECOND', label: 'per second' },
  { value: 'MINUTE', label: 'per minute' },
  { value: 'HOUR', label: 'per hour' },
  { value: 'DAY', label: 'per day' },
];

/**
 * Renders a version with exactly one leading `v`.
 * Marketplace versions are stored bare (`1.0.0`) while API Build semvers already
 * carry the prefix (`v1.0.0`), so normalizing keeps both displays consistent.
 */
export function formatApiVersion(version: string | null | undefined): string {
  if (!version) return '';
  return `v${version.replace(/^v+/i, '')}`;
}