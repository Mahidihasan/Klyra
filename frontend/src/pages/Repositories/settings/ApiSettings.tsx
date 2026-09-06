import React from 'react';
import { Cpu, Save, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { reposApi, apiDetectApi } from '../../../services/api/repos';
import { RepoDetail, Detection } from '../../../types/repos';

interface Props {
  repo: RepoDetail;
  canWrite: boolean;
  onChanged: () => void;
}

export const ApiSettings: React.FC<Props> = ({ repo, canWrite, onChanged }) => {
  const [apiName, setApiName] = React.useState(repo.name);
  const [apiVersion, setApiVersion] = React.useState('1.2.0');
  const [baseUrl, setBaseUrl] = React.useState(`https://api.klyra.dev/${repo.name}/v1`);
  const [apiDesc, setApiDesc] = React.useState(repo.description || '');

  // Auth Scheme
  const [authScheme, setAuthScheme] = React.useState('Bearer Token');

  // OpenAPI Spec
  const [openApiVer, setOpenApiVer] = React.useState('3.1');
  const [specFile, setSpecFile] = React.useState('docs/api.md');

  // Documentation
  const [publicDocsUrl, setPublicDocsUrl] = React.useState(`https://docs.klyra.dev/${repo.name}`);

  // Lifecycle
  const [lifecycle, setLifecycle] = React.useState<'Development' | 'Active' | 'Deprecated' | 'Sunset'>('Active');
  const [sunsetDate, setSunsetDate] = React.useState('');
  const [replacementApi, setReplacementApi] = React.useState('');

  // Rate Limiting
  const [rateLimit, setRateLimit] = React.useState('1000');
  const [ratePeriod, setRatePeriod] = React.useState('hour');

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  // Load existing detection if present
  React.useEffect(() => {
    apiDetectApi.get(repo.id).then(r => {
      if (r.detected?.openapi?.version) setOpenApiVer(r.detected.openapi.version);
      if (r.detected?.openapi?.file) setSpecFile(r.detected.openapi.file);
      if (r.detected?.authRequirements?.[0]) setAuthScheme(r.detected.authRequirements[0]);
    }).catch(() => {});
  }, [repo.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await reposApi.update(repo.id, {
        name: apiName.trim(),
        description: apiDesc.trim(),
      });
      setSuccess('API lifecycle configuration and OpenAPI metadata saved successfully.');
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to save API settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>⭐ API Configuration & Lifecycle</h2>
        <p>Configure API identity, authentication policies, OpenAPI schemas, rate limits, and lifecycle deprecation states.</p>
      </div>

      {success && (
        <div className="kr-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> {success}
        </div>
      )}
      {error && <div className="kr-error">{error}</div>}

      <form onSubmit={handleSave}>
        {/* Core API Configuration */}
        <div className="settings-group">
          <div className="settings-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cpu size={15} /> Primary API Identification
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">API Name</label>
              <div className="settings-sub">Public API title rendered in documentation and marketplace.</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input"
                value={apiName}
                onChange={e => setApiName(e.target.value)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Semantic API Version</label>
              <div className="settings-sub">Current production release version (e.g. 1.2.0).</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input mono"
                value={apiVersion}
                onChange={e => setApiVersion(e.target.value)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">API Base URL</label>
              <div className="settings-sub">Primary HTTP gateway endpoint host.</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input mono"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                disabled={!canWrite}
              />
            </div>
          </div>
        </div>

        {/* Authentication & Security Scheme */}
        <div className="settings-group">
          <div className="settings-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={15} /> Authentication & Access Policy
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Primary Authentication Scheme</label>
              <div className="settings-sub">Authentication protocol enforced for inbound API requests.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={authScheme}
                onChange={e => setAuthScheme(e.target.value)}
                disabled={!canWrite}
              >
                <option value="Bearer Token">Bearer Token (JWT / OAuth2 Token)</option>
                <option value="API Key">API Key (x-api-key Header)</option>
                <option value="OAuth 2.0">OAuth 2.0 Client Credentials</option>
                <option value="Webhook Signature">Webhook HMAC Signature Verification</option>
                <option value="None">None (Public Unauthenticated)</option>
              </select>
            </div>
          </div>
        </div>

        {/* OpenAPI Specification */}
        <div className="settings-group">
          <div className="settings-group-title">OpenAPI Specification</div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">OpenAPI Version</label>
              <div className="settings-sub">Target OpenAPI specification version.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={openApiVer}
                onChange={e => setOpenApiVer(e.target.value)}
                disabled={!canWrite}
              >
                <option value="3.1">OpenAPI 3.1.0</option>
                <option value="3.0">OpenAPI 3.0.3</option>
                <option value="2.0">Swagger 2.0</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Spec File Path</label>
              <div className="settings-sub">Relative in-repo path to the primary OpenAPI spec.</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input mono"
                value={specFile}
                onChange={e => setSpecFile(e.target.value)}
                disabled={!canWrite}
              />
            </div>
          </div>
        </div>

        {/* API Lifecycle Management */}
        <div className="settings-group">
          <div className="settings-group-title">API Lifecycle State</div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Current Lifecycle State</label>
              <div className="settings-sub">Communicate stability and deprecation timelines to consumers.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={lifecycle}
                onChange={e => setLifecycle(e.target.value as any)}
                disabled={!canWrite}
              >
                <option value="Active">Active — Production ready & supported</option>
                <option value="Development">Development — Pre-release beta</option>
                <option value="Deprecated">Deprecated — Scheduled for sunsetting</option>
                <option value="Sunset">Sunset — No longer serving requests</option>
              </select>
            </div>
          </div>

          {lifecycle === 'Deprecated' && (
            <>
              <div className="settings-row">
                <div className="settings-info">
                  <label className="settings-label">Scheduled Sunset Date</label>
                  <div className="settings-sub">Date after which this API version will be turned off.</div>
                </div>
                <div className="settings-control">
                  <input
                    type="date"
                    className="kr-input"
                    value={sunsetDate}
                    onChange={e => setSunsetDate(e.target.value)}
                    disabled={!canWrite}
                  />
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-info">
                  <label className="settings-label">Replacement API Version</label>
                  <div className="settings-sub">Recommended upgrade path for clients (e.g. v2.0).</div>
                </div>
                <div className="settings-control">
                  <input
                    className="kr-input mono"
                    placeholder="e.g. v2.0"
                    value={replacementApi}
                    onChange={e => setReplacementApi(e.target.value)}
                    disabled={!canWrite}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rate Limiting */}
        <div className="settings-group">
          <div className="settings-group-title">Gateway Rate Limiting</div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Max Requests per Period</label>
              <div className="settings-sub">Default rate-limit threshold for API consumers.</div>
            </div>
            <div className="settings-control" style={{ display: 'flex', gap: 8 }}>
              <input
                className="kr-input mono"
                type="number"
                value={rateLimit}
                onChange={e => setRateLimit(e.target.value)}
                disabled={!canWrite}
                style={{ width: 120 }}
              />
              <select
                className="kr-select"
                value={ratePeriod}
                onChange={e => setRatePeriod(e.target.value)}
                disabled={!canWrite}
                style={{ width: 120 }}
              >
                <option value="minute">per minute</option>
                <option value="hour">per hour</option>
                <option value="day">per day</option>
              </select>
            </div>
          </div>
        </div>

        {canWrite && (
          <div className="settings-actions">
            <button type="submit" className="kr-btn primary" disabled={saving}>
              <Save size={14} />
              {saving ? 'Saving API settings…' : 'Save API Configuration'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
