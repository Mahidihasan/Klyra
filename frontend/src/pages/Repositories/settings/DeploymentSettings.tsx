import React from 'react';
import { Server, ShieldCheck, Lock, CheckCircle2, Save } from 'lucide-react';
import { RepoDetail } from '../../../types/repos';
import { StatusPill } from '../shared';

interface Props {
  repo: RepoDetail;
  canWrite: boolean;
}

export const DeploymentSettings: React.FC<Props> = ({ repo, canWrite }) => {
  const [prodBranch, setProdBranch] = React.useState(repo.default_branch);
  const [stagingBranch, setStagingBranch] = React.useState('main');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setTimeout(() => {
      setSaving(false);
      setMessage('Deployment environment rules updated.');
    }, 400);
  };

  const branchOptions = (repo.branches || []).map(b => b.name);
  if (!branchOptions.includes(repo.default_branch)) {
    branchOptions.unshift(repo.default_branch);
  }

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>Deployment Environments</h2>
        <p>Configure environment target branches, deployment protection rules, and release auto-deploys.</p>
      </div>

      {message && (
        <div className="kr-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> {message}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Production Environment */}
        <div className="settings-group" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
          <div className="settings-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={16} color="var(--accent-purple)" /> Production Environment
            </span>
            <span className="status-pill success" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Lock size={11} /> Protected Environment
            </span>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Deployment Target Branch</label>
              <div className="settings-sub">Branch required for production deployments.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={prodBranch}
                onChange={e => setProdBranch(e.target.value)}
                disabled={!canWrite}
              >
                {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Production Domain Endpoint</label>
              <div className="settings-sub">Live public API URL.</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input mono"
                readOnly
                value={`https://api.klyra.dev/${repo.name}`}
              />
            </div>
          </div>
        </div>

        {/* Staging Environment */}
        <div className="settings-group">
          <div className="settings-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={16} /> Staging Environment
            </span>
            <StatusPill status="success" />
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Staging Target Branch</label>
              <div className="settings-sub">Branch deployed to pre-release testing.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={stagingBranch}
                onChange={e => setStagingBranch(e.target.value)}
                disabled={!canWrite}
              >
                {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Staging Domain Endpoint</label>
              <div className="settings-sub">Internal integration testing URL.</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input mono"
                readOnly
                value={`https://staging.klyra.dev/${repo.name}`}
              />
            </div>
          </div>
        </div>

        {canWrite && (
          <div className="settings-actions">
            <button type="submit" className="kr-btn primary" disabled={saving}>
              <Save size={14} />
              {saving ? 'Updating environments…' : 'Save Deployment Settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
