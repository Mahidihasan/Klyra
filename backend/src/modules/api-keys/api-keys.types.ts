export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

/** Metadata safe to return after an API key has been created. */
export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  status: ApiKeyStatus;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreateApiKeyInput {
  name?: unknown;
}

export interface CreatedApiKey {
  apiKey: ApiKeySummary;
  /** Delivered in the creation response only; never retained by the service. */
  secret: string;
}

export class ApiKeyServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiKeyServiceError';
  }
}
