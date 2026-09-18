import React, { useMemo, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { ApiKeyTarget, CreateApiKeyPayload, RateLimitPeriod } from '../../../types/apiKeys';
import { RATE_LIMIT_PERIOD_OPTIONS, formatApiVersion } from '../../../services/api/apiKeys';

interface CreateKeyModalProps {
  targets: ApiKeyTarget[];
  busy: boolean;
  error: string | null;
  onSubmit: (payload: CreateApiKeyPayload) => void;
  onClose: () => void;
}

const TARGET_VALUE = {
  api: (id: string) => `api:${id}`,
  project: (id: string) => `project:${id}`,
  personal: 'personal',
} as const;

const EXPIRY_OPTIONS = [
  { value: '', label: 'No expiration' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

const SOURCE_LABEL: Record<string, string> = {
  SUBSCRIBED: 'Subscribed APIs',
  OWNED: 'My APIs',
  PROJECT: 'API Build Projects',
};

/** Creates a key bound to a subscription, an owned API, a build project, or nothing (personal). */
export const CreateKeyModal: React.FC<CreateKeyModalProps> = ({ targets, busy, error, onSubmit, onClose }) => {
  const [name, setName] = useState('');
  const [targetValue, setTargetValue] = useState<string>(TARGET_VALUE.personal);
  const [versionId, setVersionId] = useState('');
  const [expiryDays, setExpiryDays] = useState('');
  const [rateLimit, setRateLimit] = useState('60');
  const [rateLimitPeriod, setRateLimitPeriod] = useState<RateLimitPeriod>('MINUTE');
  const [scopes, setScopes] = useState('');

  const selectedTarget = useMemo<ApiKeyTarget | null>(() => {
    if (targetValue.startsWith('api:')) {
      const id = targetValue.slice(4);
      return targets.find((t) => t.apiId === id) ?? null;
    }
    if (targetValue.startsWith('project:')) {
      const id = targetValue.slice(8);
      return targets.find((t) => t.projectId === id) ?? null;
    }
    return null;
  }, [targetValue, targets]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ApiKeyTarget[]>();
    for (const target of targets) {
      const list = groups.get(target.source) ?? [];
      list.push(target);
      groups.set(target.source, list);
    }
    return ['SUBSCRIBED', 'OWNED', 'PROJECT']
      .filter((source) => groups.has(source))
      .map((source) => ({ source, label: SOURCE_LABEL[source], items: groups.get(source)! }));
  }, [targets]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload: CreateApiKeyPayload = {
      name: name.trim(),
      apiId: null,
      projectId: null,
      apiVersionId: null,
      projectVersion: null,
      expiresInDays: expiryDays ? Number(expiryDays) : null,
      rateLimit: Math.max(1, Number(rateLimit) || 60),
      rateLimitPeriod,
      permissions: scopes.split(',').map((s) => s.trim()).filter(Boolean),
    };
    if (targetValue.startsWith('api:')) payload.apiId = targetValue.slice(4);
    else if (targetValue.startsWith('project:')) payload.projectId = targetValue.slice(8);

    if (selectedTarget?.apiId && versionId) payload.apiVersionId = versionId;
    if (selectedTarget?.projectId && versionId) payload.projectVersion = versionId;
    onSubmit(payload);
  };

  return (
    <div className="apikeys-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="apikeys-modal" role="dialog" aria-modal="true" onSubmit={handleSubmit}>
        <div className="apikeys-modal-head">
          <div>
            <div className="apikeys-modal-title">
              <KeyRound size={17} />
              Create API key
            </div>
            <p className="apikeys-modal-sub">The secret is shown once, right after creation.</p>
          </div>
          <button type="button" className="apikeys-modal-close" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={16} />
          </button>
        </div>

        <div className="apikeys-modal-body">
          {error && <div className="apikeys-modal-error">{error}</div>}

          <div className="apikeys-field">
            <label htmlFor="apikey-name">Key name</label>
            <input
              id="apikey-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production backend"
              maxLength={100}
              autoFocus
              required
            />
          </div>

          <div className="apikeys-field">
            <label htmlFor="apikey-target">Bind to API</label>
            <select id="apikey-target" value={targetValue} onChange={(e) => { setTargetValue(e.target.value); setVersionId(''); }}>
              <option value={TARGET_VALUE.personal}>No API — personal account key</option>
              {grouped.map((group) => (
                <optgroup key={group.source} label={group.label}>
                  {group.items.map((target) => (
                    <option
                      key={target.apiId ?? target.projectId ?? ''}
                      value={target.apiId ? TARGET_VALUE.api(target.apiId) : TARGET_VALUE.project(target.projectId!)}
                    >
                      {target.name}{target.slug ? ` (${target.slug})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedTarget?.source === 'SUBSCRIBED' && (
              <p className="apikeys-field-hint">
                {selectedTarget.planName ? `${selectedTarget.planName} plan` : 'Active subscription'}
                {selectedTarget.subscriptionStatus ? ` · ${selectedTarget.subscriptionStatus.toLowerCase()}` : ''}
              </p>
            )}
          </div>

          {selectedTarget && selectedTarget.versions.length > 0 && (
            <div className="apikeys-field">
              <label htmlFor="apikey-version">API version</label>
              <select id="apikey-version" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
                <option value="">Always latest version</option>
                {selectedTarget.versions.map((version) => (
                  <option key={version.id} value={selectedTarget.projectId ? version.version : version.id}>
                    {formatApiVersion(version.version)}{version.isCurrent ? ' — current' : ''}{version.isDeprecated ? ' (deprecated)' : ''}
                  </option>
                ))}
              </select>
              <p className="apikeys-field-hint">Pin the key to a specific version, or leave it following the latest.</p>
            </div>
          )}

          <div className="apikeys-field-row">
            <div className="apikeys-field">
              <label htmlFor="apikey-expiry">Expiration</label>
              <select id="apikey-expiry" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}>
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="apikeys-field">
              <label htmlFor="apikey-ratelimit">Rate limit</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="apikey-ratelimit"
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
            <label htmlFor="apikey-scopes">Scopes (optional)</label>
            <input
              id="apikey-scopes"
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
            {busy ? 'Creating…' : 'Create key'}
          </button>
        </div>
      </form>
    </div>
  );
};
