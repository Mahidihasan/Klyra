import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Ban, CheckCircle2, Clock3, Copy, KeyRound, PencilLine, Play, Plus,
  RefreshCw, Search, ShieldCheck, Trash2,
} from 'lucide-react';
import {
  ApiKeyStats, ApiKeyStatus, ApiKeySummary, ApiKeyTarget, CreateApiKeyPayload, UpdateApiKeyPayload,
} from '../../types/apiKeys';
import { apiKeysApi, ApiKeysApiError, formatApiVersion } from '../../services/api/apiKeys';
import { CreateKeyModal } from './components/CreateKeyModal';
import { EditKeyModal } from './components/EditKeyModal';
import { RevealSecretModal } from './components/RevealSecretModal';
import { ConfirmActionModal, ConfirmAction } from './components/ConfirmActionModal';
import './styles.css';

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_LABEL: Record<ApiKeyStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return 'Never used';
  const diffMs = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diffMs)) return 'Never used';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Number.isNaN(diff) ? null : Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export const ApiKeysPage: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [stats, setStats] = useState<ApiKeyStats | null>(null);
  const [targets, setTargets] = useState<ApiKeyTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const [showCreate, setShowCreate] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeySummary | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ keyName: string; secret: string } | null>(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { apiKeys, stats: nextStats } = await apiKeysApi.list();
      setKeys(apiKeys);
      setStats(nextStats);
    } catch (err) {
      setError(err instanceof ApiKeysApiError ? err.message : 'Unable to load your API keys.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTargets = useCallback(async () => {
    try {
      const { targets: nextTargets } = await apiKeysApi.listTargets();
      setTargets(nextTargets);
    } catch {
      // The create dialog still works for personal keys when targets fail.
    }
  }, []);

  useEffect(() => { void loadKeys(); }, [loadKeys]);
  useEffect(() => { if (showCreate || editingKey) void loadTargets(); }, [showCreate, editingKey, loadTargets]);

  const filteredKeys = useMemo(() => {
    const query = search.trim().toLowerCase();
    return keys.filter((key) => {
      const matchesStatus = statusFilter === 'ALL' || key.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      const target = key.apiName ?? key.projectName ?? '';
      return `${key.name} ${key.keyPrefix} ${target}`.toLowerCase().includes(query);
    });
  }, [keys, search, statusFilter]);

  const replaceKey = (next: ApiKeySummary) => {
    setKeys((current) => current.map((key) => (key.id === next.id ? next : key)));
  };

  const kpis = useMemo(() => ([
    { tone: 'total', icon: KeyRound, value: stats?.total ?? 0, label: 'Total keys' },
    { tone: 'active', icon: ShieldCheck, value: stats?.active ?? 0, label: 'Active' },
    { tone: 'suspended', icon: Ban, value: stats?.suspended ?? 0, label: 'Suspended' },
    { tone: 'expired', icon: Clock3, value: stats?.expired ?? 0, label: 'Expired' },
    { tone: 'revoked', icon: AlertTriangle, value: stats?.revoked ?? 0, label: 'Revoked' },
  ]), [stats]);

  const handleCreate = async (payload: CreateApiKeyPayload) => {
    setActionBusy(true);
    setActionError(null);
    try {
      const result = await apiKeysApi.create(payload);
      setKeys((current) => [result.apiKey, ...current]);
      setShowCreate(false);
      setRevealedSecret({ keyName: result.apiKey.name, secret: result.secret });
      void loadKeys();
    } catch (err) {
      setActionError(err instanceof ApiKeysApiError ? err.message : 'Unable to create the API key.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleUpdate = async (keyId: string, payload: UpdateApiKeyPayload) => {
    setActionBusy(true);
    setActionError(null);
    try {
      const result = await apiKeysApi.update(keyId, payload);
      replaceKey(result.apiKey);
      setEditingKey(null);
      showToast('API key updated');
    } catch (err) {
      setActionError(err instanceof ApiKeysApiError ? err.message : 'Unable to update the API key.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmAction = async (action: ConfirmAction) => {
    setActionBusy(true);
    setActionError(null);
    try {
      switch (action.kind) {
        case 'revoke': {
          const result = await apiKeysApi.revoke(action.keyId);
          replaceKey(result.apiKey);
          showToast(`"${action.keyName}" revoked`);
          break;
        }
        case 'suspend': {
          const result = await apiKeysApi.suspend(action.keyId);
          replaceKey(result.apiKey);
          showToast(`"${action.keyName}" suspended`);
          break;
        }
        case 'activate': {
          const result = await apiKeysApi.activate(action.keyId);
          replaceKey(result.apiKey);
          showToast(`"${action.keyName}" reactivated`);
          break;
        }
        case 'delete': {
          await apiKeysApi.delete(action.keyId);
          setKeys((current) => current.filter((key) => key.id !== action.keyId));
          showToast(`"${action.keyName}" deleted`);
          break;
        }
      }
      setConfirmAction(null);
      void loadKeys();
    } catch (err) {
      setActionError(err instanceof ApiKeysApiError ? err.message : 'The action could not be completed.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="apikeys-page">
      <div className="apikeys-header">
        <div>
          <h1 className="apikeys-title">API Keys</h1>
          <p className="apikeys-subtitle">
            Create and control credentials for the APIs you&apos;re subscribed to and the APIs you own or
            build with API Build. Secrets are hashed — Klyra never stores the raw value.
          </p>
        </div>
        <div className="apikeys-header-actions">
          <button
            type="button"
            className="apikeys-refresh-btn"
            onClick={() => { void loadKeys(); }}
            disabled={isLoading}
          >
            <RefreshCw size={13} className={isLoading ? 'spinning' : ''} />
            Refresh
          </button>
          <button type="button" className="apikeys-create-btn" onClick={() => { setActionError(null); setShowCreate(true); }}>
            <Plus size={15} />
            Create API Key
          </button>
        </div>
      </div>

      <div className="apikeys-kpis">
        {kpis.map(({ tone, icon: Icon, value, label }) => (
          <div key={tone} className="apikeys-kpi" data-tone={tone}>
            <div>
              <div className="apikeys-kpi-value">{value}</div>
              <div className="apikeys-kpi-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {stats && stats.expiringIn30Days > 0 && (
        <div className="apikeys-error-banner" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.07)', color: 'var(--status-beta)' }}>
          <Clock3 size={14} />
          <span>{stats.expiringIn30Days} key{stats.expiringIn30Days === 1 ? '' : 's'} expire within 30 days. Extend their expiration or rotate them to keep traffic flowing.</span>
        </div>
      )}

      {error && (
        <div className="apikeys-error-banner">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="apikeys-toolbar">
        <div className="apikeys-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, prefix, or API…"
            aria-label="Search API keys"
          />
        </div>
        <div className="apikeys-filter-group" role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={statusFilter === filter}
              className={`apikeys-filter-btn ${statusFilter === filter ? 'active' : ''}`}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'ALL' ? 'All' : STATUS_LABEL[filter]}
            </button>
          ))}
        </div>
        <span className="apikeys-count">
          {filteredKeys.length} of {keys.length} keys
        </span>
      </div>

      <div className="apikeys-table-card">
        {isLoading && keys.length === 0 ? (
          <div>
            <div className="apikeys-skeleton-row" />
            <div className="apikeys-skeleton-row" />
            <div className="apikeys-skeleton-row" />
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="apikeys-state">
            <KeyRound size={26} />
            <div className="apikeys-state-title">
              {keys.length === 0 ? 'No API keys yet' : 'No keys match the current filters'}
            </div>
            <span>
              {keys.length === 0
                ? 'Create a key to start calling subscribed APIs or your own API Build projects.'
                : 'Try a different search term or status filter.'}
            </span>
          </div>
        ) : (
          <div className="apikeys-table-scroll">
            <table className="apikeys-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>API</th>
                  <th>Version</th>
                  <th>Rate limit</th>
                  <th>Expires</th>
                  <th>Last used</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map((key) => (
                  <KeyRow
                    key={key.id}
                    apiKey={key}
                    busy={actionBusy}
                    onEdit={() => { setActionError(null); setEditingKey(key); }}
                    onSuspend={() => setConfirmAction({ kind: 'suspend', keyId: key.id, keyName: key.name })}
                    onActivate={() => setConfirmAction({ kind: 'activate', keyId: key.id, keyName: key.name })}
                    onRevoke={() => setConfirmAction({ kind: 'revoke', keyId: key.id, keyName: key.name })}
                    onDelete={() => setConfirmAction({ kind: 'delete', keyId: key.id, keyName: key.name })}
                    onCopyPrefix={() => {
                      void navigator.clipboard?.writeText(key.keyPrefix);
                      showToast('Key prefix copied');
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateKeyModal
          targets={targets}
          busy={actionBusy}
          error={actionError}
          onSubmit={(payload) => { void handleCreate(payload); }}
          onClose={() => { setShowCreate(false); setActionError(null); }}
        />
      )}

      {editingKey && (
        <EditKeyModal
          apiKey={editingKey}
          targets={targets}
          busy={actionBusy}
          error={actionError}
          onSubmit={(keyId, payload) => { void handleUpdate(keyId, payload); }}
          onClose={() => { setEditingKey(null); setActionError(null); }}
        />
      )}

      <ConfirmActionModal
        action={confirmAction}
        busy={actionBusy}
        onConfirm={(action) => { void handleConfirmAction(action); }}
        onClose={() => { setConfirmAction(null); setActionError(null); }}
      />

      <RevealSecretModal secret={revealedSecret} onClose={() => setRevealedSecret(null)} />

      {toast && (
        <div className="apikeys-toast">
          <CheckCircle2 size={14} />
          {toast}
        </div>
      )}
    </div>
  );
};

interface KeyRowProps {
  apiKey: ApiKeySummary;
  busy: boolean;
  onEdit: () => void;
  onSuspend: () => void;
  onActivate: () => void;
  onRevoke: () => void;
  onDelete: () => void;
  onCopyPrefix: () => void;
}

const KeyRow: React.FC<KeyRowProps> = ({ apiKey, busy, onEdit, onSuspend, onActivate, onRevoke, onDelete, onCopyPrefix }) => {
  const days = daysUntil(apiKey.expiresAt);
  const targetName = apiKey.projectId ? apiKey.projectName : apiKey.apiName;
  const version = apiKey.apiVersion
    ? formatApiVersion(apiKey.apiVersion)
    : apiKey.projectVersion
      ? formatApiVersion(apiKey.projectVersion)
      : null;
  const expiringSoon = days !== null && days > 0 && days <= 30;

  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div className="apikeys-key-name">{apiKey.name || 'Untitled key'}</div>
            <div className="apikeys-key-prefix">
              <code className="apikeys-prefix-code">{apiKey.keyPrefix}••••••••</code>
              <button type="button" className="apikeys-copy-btn" title="Copy prefix" onClick={onCopyPrefix}>
                <Copy size={11} />
              </button>
            </div>
          </div>
        </div>
      </td>
      <td>
        {targetName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="apikeys-target-name">{targetName}</span>
            <span className="apikeys-source-badge" data-source={apiKey.source}>{apiKey.source}</span>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Personal key</span>
        )}
      </td>
      <td>
        {version
          ? <span className="apikeys-version-chip">{version}</span>
          : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Latest</span>}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {apiKey.rateLimit.toLocaleString()} / {apiKey.rateLimitPeriod.toLowerCase().replace('minute', 'min')}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {apiKey.expiresAt
          ? <span style={expiringSoon ? { color: 'var(--status-beta)' } : undefined}>{formatDate(apiKey.expiresAt)}</span>
          : <span style={{ color: 'var(--text-muted)' }}>Never</span>}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>{formatRelative(apiKey.lastUsedAt)}</td>
      <td>
        <span className="apikeys-status" data-status={apiKey.status}>
          <span className="apikeys-status-dot" />
          {STATUS_LABEL[apiKey.status]}
        </span>
      </td>
      <td>
        <div className="apikeys-actions">
          {apiKey.status === 'ACTIVE' && (
            <>
              <button type="button" className="apikeys-action-btn" onClick={onEdit} disabled={busy} title="Edit key settings">
                <PencilLine size={11} /> Edit
              </button>
              <button type="button" className="apikeys-action-btn warn" onClick={onSuspend} disabled={busy} title="Temporarily block this key">
                <Ban size={11} /> Suspend
              </button>
              <button type="button" className="apikeys-action-btn danger" onClick={onRevoke} disabled={busy} title="Permanently revoke this key">
                <Trash2 size={11} /> Revoke
              </button>
            </>
          )}
          {apiKey.status === 'SUSPENDED' && (
            <>
              <button type="button" className="apikeys-action-btn success" onClick={onActivate} disabled={busy} title="Reactivate this key">
                <Play size={11} /> Reactivate
              </button>
              <button type="button" className="apikeys-action-btn" onClick={onEdit} disabled={busy} title="Edit key settings">
                <PencilLine size={11} /> Edit
              </button>
              <button type="button" className="apikeys-action-btn danger" onClick={onRevoke} disabled={busy} title="Permanently revoke this key">
                <Trash2 size={11} /> Revoke
              </button>
            </>
          )}
          {(apiKey.status === 'REVOKED' || apiKey.status === 'EXPIRED') && (
            <button type="button" className="apikeys-action-btn danger" onClick={onDelete} disabled={busy} title="Delete this key record">
              <Trash2 size={11} /> Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
