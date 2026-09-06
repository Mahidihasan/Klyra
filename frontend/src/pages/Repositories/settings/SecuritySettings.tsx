import React from 'react';
import { ShieldCheck, Lock, Key, Globe, Save, CheckCircle2 } from 'lucide-react';
import { RepoDetail } from '../../../types/repos';

interface Props {
  repo: RepoDetail;
  canWrite: boolean;
}

export const SecuritySettings: React.FC<Props> = ({ repo, canWrite }) => {
  const [secretScanning, setSecretScanning] = React.useState(true);
  const [vulnerabilityAlerts, setVulnerabilityAlerts] = React.useState(true);
  const [corsOrigins, setCorsOrigins] = React.useState('https://app.klyra.dev, https://localhost:3000');
  const [tokenExpiration, setTokenExpiration] = React.useState('30d');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setTimeout(() => {
      setSaving(false);
      setMessage('Security and token policies updated.');
    }, 400);
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>Security & Compliance Settings</h2>
        <p>Configure automated secret scanning, CORS origin policies, and token rotation security.</p>
      </div>

      {message && (
        <div className="kr-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> {message}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Code & Vault Security */}
        <div className="settings-group">
          <div className="settings-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={15} /> Code Base & Vault Security
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Secret Scanning</label>
              <div className="settings-sub">Scan commits and diffs for hardcoded API keys and credentials.</div>
            </div>
            <div className="settings-control">
              <input
                type="checkbox"
                checked={secretScanning}
                onChange={e => setSecretScanning(e.target.checked)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Dependabot Vulnerability Alerts</label>
              <div className="settings-sub">Notify maintainers when vulnerable dependencies are detected in package.json.</div>
            </div>
            <div className="settings-control">
              <input
                type="checkbox"
                checked={vulnerabilityAlerts}
                onChange={e => setVulnerabilityAlerts(e.target.checked)}
                disabled={!canWrite}
              />
            </div>
          </div>
        </div>

        {/* API Gateway Security */}
        <div className="settings-group">
          <div className="settings-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={15} /> API Gateway CORS & Token Policies
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Allowed CORS Origins</label>
              <div className="settings-sub">Comma-separated list of allowed origins for cross-domain browser requests.</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input mono"
                value={corsOrigins}
                onChange={e => setCorsOrigins(e.target.value)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">API Token Expiration Policy</label>
              <div className="settings-sub">Default lifespan for issued access tokens.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={tokenExpiration}
                onChange={e => setTokenExpiration(e.target.value)}
                disabled={!canWrite}
              >
                <option value="7d">7 Days</option>
                <option value="30d">30 Days (Recommended)</option>
                <option value="90d">90 Days</option>
                <option value="never">Never expire (Not recommended)</option>
              </select>
            </div>
          </div>
        </div>

        {canWrite && (
          <div className="settings-actions">
            <button type="submit" className="kr-btn primary" disabled={saving}>
              <Save size={14} />
              {saving ? 'Saving security policies…' : 'Save Security Settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
