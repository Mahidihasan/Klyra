import React, { useMemo, useState } from 'react';
import { PencilLine, X } from 'lucide-react';
import { ApiKeySummary, ApiKeyTarget, RateLimitPeriod, UpdateApiKeyPayload } from '../../../types/apiKeys';
import { RATE_LIMIT_PERIOD_OPTIONS, formatApiVersion } from '../../../services/api/apiKeys';

interface EditKeyModalProps {
  apiKey: ApiKeySummary;
  /** Full target catalogue so the bound API/project's versions can be listed. */
  targets: ApiKeyTarget[];
  busy: boolean;
  error: string | null;
  onSubmit: (keyId: string, payload: UpdateApiKeyPayload) => void;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { value: '', label: 'No expiration' },
  { value: '30', label: '30 days from now' },
  { value: '60', label: '60 days from now' },
  { value: '90', label: '90 days from now' },
  { value: '365', label: '1 year from now' },
];

/** Sentinel option that clears a key's expiration through `expiresAt: null`. */
const REMOVE_EXPIRY = 'remove';

/** Editable key settings. The secret itself is immutable — rotate by creating a new key. */
export const EditKeyModal: React.FC<EditKeyModalProps> = ({ apiKey, targets, busy, error, onSubmit, onClose }) => {
  // Mounted only while a key is selected, so these seed from the live record.
  const [name, setName] = useState(apiKey.name);
  const [expiryDays, setExpiryDays] = useState('');
  const [rateLimit, setRateLimit] = useState(String(apiKey.rateLimit));
  const [rateLimitPeriod, setRateLimitPeriod] = useState<RateLimitPeriod>(apiKey.rateLimitPeriod);
  const [scopes, setScopes] = useState(apiKey.permissions.join(', '));

  const boundTarget = useMemo<ApiKeyTarget | null>(() => {
    if (apiKey.projectId) return targets.find((t) => t.projectId === apiKey.projectId) ?? null;
    if (apiKey.apiId) return targets.find((t) => t.apiId === apiKey.apiId) ?? null;
    return null;
  }, [apiKey.apiId, apiKey.projectId, targets]);

  // Marketplace keys pin by `api_versions.id`; project keys pin by semver text.
  const initialVersion = apiKey.projectId
    ? (apiKey.projectVersion ?? '')
    : (apiKey.apiVersionId ?? '');
  const [versionValue, setVersionValue] = useState(initialVersion);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: UpdateApiKeyPayload = {
      name: name.trim(),
      rateLimit: Math.max(1, Number(rateLimit) || 60),
      rateLimitPeriod,
      permissions: scopes.split(',').map((s) => s.trim()).filter(Boolean),
    };

    if (expiryDays === REMOVE_EXPIRY) payload.expiresAt = null;
    else if (expiryDays) payload.expiresInDays = Number(expiryDays);

    if (versionValue !== initialVersion) {
      if (apiKey.projectId) payload.projectVersion = versionValue || null;
      else if (apiKey.apiId) payload.apiVersionId = versionValue || null;
    }

    onSubmit(apiKey.id, payload);
  };

  return (
    <div className="apikeys-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="apikeys-modal" role="dialog" aria-modal="true" onSubmit={handleSubmit}>
        <div className="apikeys-modal-head">
          <div>
            <div className="apikeys-modal-title">
              <PencilLine size={16} />
              Edit API key
            </div>
            <p className="apikeys-modal-sub">
              <code>{apiKey.keyPrefix}••••••••</code> — the secret value never changes.
            </p>
          </div>
          <button type="button" className="apikeys-modal-close" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={16} />
          </button>
        </div>

        <div className="apikeys-modal-body">
          {error && <div className="apikeys-modal-error">{error}</div>}

          <div className="apikeys-field">
            <label htmlFor="edit-key-name">Key name</label>
            <input
              id="edit-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
              required
            />
          </div>

          {boundTarget && boundTarget.versions.length > 0 && (
            <div className="apikeys-field">
              <label htmlFor="edit-key-version">API version</label>
              <select
                id="edit-key-version"
                value={versionValue}
                onChange={(e) => setVersionValue(e.target.value)}
              >
                <option value="">Always latest version</option>
                {boundTarget.versions.map((version) => (
                  <option key={version.id} value={apiKey.projectId ? version.version : version.id}>
                    {formatApiVersion(version.version)}{version.isCurrent ? ' — current' : ''}{version.isDeprecated ? ' (deprecated)' : ''}
                  </option>
                ))}
              </select>
              <p className="apikeys-field-hint">
                {versionValue === initialVersion
                  ? 'Pin this key to a specific version, or leave it following the latest.'
                  : 'This key\'s version will change when you save.'}
              </p>
            </div>
          )}

          <div className="apikeys-field-row">
            <div className="apikeys-field">
              <label htmlFor="edit-key-expiry">Extend expiration</label>
              <select id="edit-key-expiry" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}>
                <option value="">
                  {apiKey.expiresAt ? 'Keep current expiration' : 'No expiration'}
                </option>
                {EXPIRY_OPTIONS.filter((option) => option.value).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
                {apiKey.expiresAt && <option value={REMOVE_EXPIRY}>Remove expiration</option>}
              </select>
              {apiKey.expiresAt && (
                <p className="apikeys-field-hint">
                  Current expiration: {new Date(apiKey.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="apikeys-field">
              <label htmlFor="edit-key-ratelimit">Rate limit</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="edit-key-ratelimit"
                  type="number"
                  min={1}
                  max={100000}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  style={{ flex: 1 }}
                />
                <select
                  aria-label="Rate limit period"
                  value={rateLimitPeriod}
                  onChange={(e) => setRateLimitPeriod(e.target.value as RateLimitPeriod)}
                  style={{ width: 130 }}
                >
                  {RATE_LIMIT_PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="apikeys-field">
            <label htmlFor="edit-key-scopes">Scopes</label>
            <input
              id="edit-key-scopes"
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              placeholder="read:users, write:data"
            />
            <p className="apikeys-field-hint">Comma-separated permission scopes carried by this key.</p>
          </div>
        </div>

        <div className="apikeys-modal-foot">
          <button type="button" className="apikeys-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="apikeys-btn primary" disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
